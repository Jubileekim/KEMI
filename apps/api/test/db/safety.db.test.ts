import { randomUUID } from "node:crypto";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, DAY_MS, signedDeal, signup } from "../support/deal.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({ prisma });
});

const post = (token: string | null, path: string, body: object = {}) => {
  const req = request(app).post(path);
  return (token ? req.set(auth(token)) : req).send(body);
};
const get = (token: string, path: string) =>
  request(app).get(path).set(auth(token));

const projectBody = () => {
  const end = new Date(Date.now() + 3 * DAY_MS);
  return {
    title: "돌잔치 성장영상",
    description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
    purpose: VIDEO_PURPOSES[0],
    styles: [VIDEO_STYLES[0]],
    budget: 200_000,
    recruitmentEndAt: end.toISOString(),
    deliveryDueDate: new Date(end.getTime() + 10 * DAY_MS)
      .toISOString()
      .slice(0, 10),
  };
};

async function admin() {
  const party = await signup(app, "CLIENT", 99);
  await prisma.user.update({
    where: { id: party.userId },
    data: { role: "ADMIN" },
  });
  return party;
}

describe("신고·이용 제한·이의 제기 (OPS-01·02)", () => {
  it("신고는 접수만 하고, 운영자가 제한하면 새 공고·지원은 막히되 진행 중인 대화는 계속된다", async () => {
    const deal = await signedDeal(app, prisma);
    const { client, creator, workRequestId } = deal;
    const ops = await admin();

    // 의뢰 당사자(크리에이터)가 의뢰를 신고 → 대상은 의뢰인
    const commandId = randomUUID();
    const body = {
      commandId,
      targetType: "WORK_REQUEST",
      targetId: workRequestId,
      reason: "약속과 다른 요구를 반복합니다.",
    };
    const reported = await post(creator.token, "/api/reports", body);
    expect(reported.status).toBe(201);
    expect(reported.body).toMatchObject({
      subjectId: String(client.userId),
      status: "RECEIVED",
      limited: false,
    });
    // 같은 신고 재전송은 처음 접수, 다른 내용은 409
    expect((await post(creator.token, "/api/reports", body)).status).toBe(200);
    expect(
      (
        await post(creator.token, "/api/reports", {
          ...body,
          reason: "다른 사유",
        })
      ).status,
    ).toBe(409);
    // 신고만으로는 제재되지 않는다.
    expect(
      (await post(client.token, "/api/projects", projectBody())).status,
    ).toBe(201);
    // 당사자가 아닌 의뢰·본인 공고 신고는 막힌다.
    const outsider = await signup(app, "CREATOR", 7);
    expect(
      (
        await post(outsider.token, "/api/reports", {
          ...body,
          commandId: randomUUID(),
        })
      ).status,
    ).toBe(404);

    const reportId = reported.body.id;
    // 회원은 조치할 수 없다.
    const action = (token: string, a: string, note = "확인했습니다.") =>
      post(token, `/api/admin/reports/${reportId}/actions`, {
        commandId: randomUUID(),
        action: a,
        note,
      });
    expect((await action(creator.token, "LIMIT")).status).toBe(403);
    const limited = await action(ops.token, "LIMIT", "반복 신고 확인");
    expect(limited.body).toMatchObject({ status: "RESOLVED", limited: true });

    // 제한 중: 새 공고·직접 의뢰는 403 RESTRICTED
    const blocked = await post(client.token, "/api/projects", projectBody());
    expect([blocked.status, blocked.body.error.code]).toEqual([
      403,
      "RESTRICTED",
    ]);
    // 진행 중인 대화는 계속된다.
    expect(
      (
        await post(
          client.token,
          `/api/work-requests/${workRequestId}/chat/messages`,
          {
            clientMessageId: randomUUID(),
            body: "계속 이야기해요.",
          },
        )
      ).status,
    ).toBe(201);

    // 대상자 화면: 제한 안내는 보이지만 신고자·사유는 보이지 않는다.
    const mine = await get(client.token, "/api/reports/me");
    expect(mine.body.limited).toBe(true);
    expect(mine.body.notices).toHaveLength(1);
    expect(JSON.stringify(mine.body.notices)).not.toContain("약속과 다른");
    const noticeTypes = (
      await get(client.token, "/api/notifications")
    ).body.items.map((n: { type: string }) => n.type);
    expect(noticeTypes).toContain("SAFETY_LIMITED");

    // 이의 제기: 대상자만, 같은 식별자는 한 번만
    const appealBody = { commandId: randomUUID(), note: "오해가 있습니다." };
    expect(
      (await post(creator.token, `/api/reports/${reportId}/appeal`, appealBody))
        .status,
    ).toBe(404);
    await post(client.token, `/api/reports/${reportId}/appeal`, appealBody);
    const appealed = await post(
      client.token,
      `/api/reports/${reportId}/appeal`,
      appealBody,
    );
    expect(
      appealed.body.notices[0].history.filter(
        (e: { action: string }) => e.action === "APPEAL",
      ),
    ).toHaveLength(1);
    const filed = await get(creator.token, "/api/reports/me");
    expect(JSON.stringify(filed.body.reports)).not.toContain(appealBody.note);
    const replay = await post(creator.token, "/api/reports", body);
    expect(JSON.stringify(replay.body)).not.toContain(appealBody.note);
    const adminView = await get(ops.token, "/api/admin/reports");
    expect(JSON.stringify(adminView.body)).toContain(appealBody.note);

    // 해제하면 다시 새 공고를 열 수 있다. 처리 근거가 운영 기록에 남는다.
    await action(ops.token, "RELEASE", "이의 검토 후 해제");
    expect(
      (await post(client.token, "/api/projects", projectBody())).status,
    ).toBe(201);
    expect(
      await prisma.operationRecord.count({ where: { targetType: "REPORT" } }),
    ).toBe(2);
    // 해제된 신고는 다시 해제할 수 없다.
    expect((await action(ops.token, "RELEASE")).status).toBe(409);
  });

  it("제한된 크리에이터는 새 지원을 할 수 없다", async () => {
    const client = await signup(app, "CLIENT");
    const creator = await signup(app, "CREATOR");
    const ops = await admin();
    const project = await post(client.token, "/api/projects", projectBody());
    const reported = await post(client.token, "/api/reports", {
      commandId: randomUUID(),
      targetType: "PROJECT",
      targetId: project.body.id,
      reason: "테스트",
    });
    // 본인 공고 신고는 403
    expect(reported.status).toBe(403);
    const byCreator = await post(creator.token, "/api/reports", {
      commandId: randomUUID(),
      targetType: "PROJECT",
      targetId: project.body.id,
      reason: "부적절한 공고",
    });
    expect(byCreator.body.subjectId).toBe(String(client.userId));
    // 크리에이터를 대상으로 한 신고를 만들어 제한한다(직접 넣은 신고 행).
    const report = await prisma.report.create({
      data: {
        reporterId: client.userId,
        subjectId: creator.userId,
        targetType: "PROJECT",
        targetId: BigInt(project.body.id),
        reason: "테스트",
        commandId: randomUUID(),
      },
    });
    await post(ops.token, `/api/admin/reports/${report.id}/actions`, {
      commandId: randomUUID(),
      action: "LIMIT",
      note: "확인",
    });
    const applied = await post(
      creator.token,
      `/api/projects/${project.body.id}/applications`,
      {
        message: "감성적인 영상을 만들어 드릴게요.",
        proposedAmount: 100_000,
        expectedDays: 3,
      },
    );
    expect([applied.status, applied.body.error.code]).toEqual([
      403,
      "RESTRICTED",
    ]);
    const list = await get(ops.token, "/api/admin/reports");
    expect(list.body.items).toHaveLength(2);
  });

  it("비공개·마감·삭제 공고의 ID는 신고로 작성자 정보를 조회할 수 없다", async () => {
    const client = await signup(app, "CLIENT");
    const creator = await signup(app, "CREATOR");
    const created = await post(client.token, "/api/projects", projectBody());
    expect(created.status).toBe(201);
    const projectId = BigInt(created.body.id);
    const reportProject = () =>
      post(creator.token, "/api/reports", {
        commandId: randomUUID(),
        targetType: "PROJECT",
        targetId: String(projectId),
        reason: "공고 신고 테스트",
      });

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "CLOSED", closeReason: "MANUAL" },
    });
    expect((await reportProject()).status).toBe(404);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "OPEN",
        closeReason: null,
        createdAt: new Date(Date.now() - 2 * DAY_MS),
        recruitmentEndAt: new Date(Date.now() - DAY_MS),
      },
    });
    expect((await reportProject()).status).toBe(404);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        recruitmentEndAt: new Date(Date.now() + 3 * DAY_MS),
        status: "CLOSED",
        closeReason: "MANUAL",
        deletedAt: new Date(),
      },
    });
    expect((await reportProject()).status).toBe(404);
    expect(await prisma.report.count()).toBe(0);

    await prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: null, status: "OPEN", closeReason: null },
    });
    const publicReport = await reportProject();
    expect(publicReport.status).toBe(201);
    expect(publicReport.body.subjectId).toBe(String(client.userId));
  });

  it("최근 안내 50건 밖의 이용 제한도 안내와 API에서 유지한다", async () => {
    const subject = await signup(app, "CLIENT");
    const reporter = await signup(app, "CREATOR");
    const ops = await admin();
    await Array.from({ length: 51 }).reduce(async (previous, _, i) => {
      await previous;
      await prisma.report.create({
        data: {
          reporterId: reporter.userId,
          subjectId: subject.userId,
          targetType: "PROJECT",
          targetId: 1n,
          reason: "신고",
          status: "RESOLVED",
          limited: i === 0,
          commandId: randomUUID(),
          events: {
            create: {
              actorId: ops.userId,
              action: i === 0 ? "LIMIT" : "WARN",
              note: "검토 결과",
              commandId: randomUUID(),
            },
          },
        },
      });
    }, Promise.resolve());
    const view = await get(subject.token, "/api/reports/me");
    expect(view.body.notices).toHaveLength(50);
    expect(view.body.limited).toBe(true);
    expect(
      (await post(subject.token, "/api/projects", projectBody())).status,
    ).toBe(403);
  });
});

describe("행동 기록 (METRIC-01)", () => {
  it("허용된 필드만 받고, 한 번만 세는 이벤트는 중복을 건너뛰며, 시연 계정은 집계에서 뺀다", async () => {
    const creator = await signup(app, "CREATOR");
    const ops = await admin();
    const at = new Date().toISOString();
    // 로그인 없이도 보낼 수 있다.
    const anon = await post(null, "/api/analytics/events", {
      events: [{ name: "feed_view", objectId: "feed", at }],
    });
    expect([anon.status, anon.body.accepted]).toEqual([202, 1]);
    // 허용되지 않은 필드(이메일 등)는 거부한다.
    expect(
      (
        await post(null, "/api/analytics/events", {
          events: [{ name: "feed_view", objectId: "feed", at, email: "a@b.c" }],
        })
      ).status,
    ).toBe(400);
    const once = { name: "request_sent", objectId: "req_1", at };
    const first = await post(creator.token, "/api/analytics/events", {
      events: [once, once, { name: "work_play", objectId: "w1", at }],
    });
    expect(first.body.accepted).toBe(2);
    // 시연 계정 이벤트는 저장하되 집계에서 빠진다.
    const demo = await prisma.user.create({
      data: { email: "demo@kemi.test", name: "시연", role: "CLIENT" },
    });
    await prisma.analyticsEvent.create({
      data: {
        name: "feed_view",
        objectId: "feed",
        userId: demo.id,
        isTest: true,
        occurredAt: new Date(),
      },
    });
    expect((await get(creator.token, "/api/admin/analytics")).status).toBe(403);
    const summary = await get(ops.token, "/api/admin/analytics");
    const count = (name: string) =>
      summary.body.counts.find((c: { name: string }) => c.name === name);
    expect(count("feed_view")).toMatchObject({ total: 1 });
    expect(count("request_sent")).toMatchObject({ total: 1, users: 1 });
  });
});

describe("선정 뒤 모집 상세·지원 목록", () => {
  it("작성자·선정된 크리에이터는 계약 뒤에도 모집 상세를 보고, 지원 목록은 거래 진행 단계를 따른다", async () => {
    const deal = await signedDeal(app, prisma);
    const projectPath = `/api/projects/${deal.project.id}`;
    const owner = await get(deal.client.token, projectPath);
    expect(owner.status).toBe(200);
    expect(owner.body.status).not.toBe("OPEN");
    expect((await get(deal.creator.token, projectPath)).status).toBe(200);
    // 비회원·관계없는 사람에게는 모집 중이 아닌 공고를 보여 주지 않는다.
    expect((await request(app).get(projectPath)).status).toBe(404);

    const applicants = await get(
      deal.client.token,
      `/api/projects/${deal.project.id}/applications`,
    );
    expect(applicants.body.items[0]).toMatchObject({
      status: "CONTRACTED",
      stage: "PAYMENT_PENDING",
    });
    const mine = await get(deal.creator.token, "/api/applications/me");
    expect(mine.body.items[0]).toMatchObject({
      status: "CONTRACTED",
      stage: "PAYMENT_PENDING",
    });
  });
});

describe("내 활동 (ACT-01)·알림 여러 개 읽음 (NOTI-02)", () => {
  it("정산 없는 완료 표시와 열린 분쟁은 정상 완료로 안내하지 않는다", async () => {
    const deal = await signedDeal(app, prisma, { paid: true });
    await prisma.production.update({
      where: { contractId: BigInt(deal.contractId) },
      data: {
        status: "COMPLETED",
        workingDays: 5,
        startedAt: new Date(),
        dueDate: new Date(Date.now() + 5 * DAY_MS),
      },
    });
    expect(
      (await get(deal.client.token, "/api/activity")).body.requests[0].stage,
    ).toBe("DELIVERED");
    await prisma.dispute.create({
      data: {
        contractId: BigInt(deal.contractId),
        openedBy: deal.client.userId,
        reason: "정산 보류 확인",
      },
    });
    expect(
      (await get(deal.client.token, "/api/activity")).body.requests[0].stage,
    ).toBe("DISPUTED");
  });
  it("요청마다 진행 단계를 계산하고, 내 알림만 골라 읽는다", async () => {
    const deal = await signedDeal(app, prisma, { paid: true });
    const draft = await post(deal.client.token, "/api/project-drafts", {
      title: "활동에서 이어 쓸 초안",
    });
    expect(draft.status).toBe(201);
    const clientView = await get(deal.client.token, "/api/activity");
    expect(clientView.body.role).toBe("CLIENT");
    expect(clientView.body.drafts).toEqual([
      expect.objectContaining({
        id: draft.body.id,
        values: expect.objectContaining({ title: "활동에서 이어 쓸 초안" }),
      }),
    ]);
    expect(clientView.body.projects[0]).toMatchObject({ applicationCount: 1 });
    expect(clientView.body.requests[0]).toMatchObject({
      id: deal.workRequestId,
      stage: "PREPARING",
      contractId: deal.contractId,
    });
    const creatorView = await get(deal.creator.token, "/api/activity");
    expect(creatorView.body.drafts).toEqual([]);
    expect(creatorView.body.requests[0]).toMatchObject({
      stage: "PREPARING",
      needsAction: true,
    });

    const { items } = (await get(deal.creator.token, "/api/notifications"))
      .body;
    expect(items.length).toBeGreaterThan(1);
    const ids = items.map((n: { id: string }) => n.id);
    const someoneElse = (await get(deal.client.token, "/api/notifications"))
      .body.items[0].id;
    // 남의 알림이 섞이면 404이고 아무것도 바꾸지 않는다.
    const mixed = await post(deal.creator.token, "/api/notifications/read", {
      ids: [ids[0], someoneElse],
    });
    expect(mixed.status).toBe(404);
    expect(
      (await get(deal.creator.token, "/api/notifications/unread-count")).body
        .unreadCount,
    ).toBe(ids.length);
    const read = await post(deal.creator.token, "/api/notifications/read", {
      ids: [ids[0], ids[0]],
    });
    expect(read.body.unreadCount).toBe(ids.length - 1);
  });
});
