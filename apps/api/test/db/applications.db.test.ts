import { randomUUID } from "node:crypto";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// 요청 제한 카운터가 테스트 사이에 이어지지 않도록 테스트마다 앱을 새로 만든다.
let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({ prisma });
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function signup(role: "CLIENT" | "CREATOR", index = 1) {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      email: `${role.toLowerCase()}-${index}@example.com`,
      password: "correct-horse-battery",
      name: `${role} ${index}`,
      role,
    });
  expect(res.status).toBe(201);
  return {
    token: String(res.body.accessToken),
    userId: BigInt(String(res.body.user.id)),
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// 분류 값이 바뀌어도 테스트가 깨지지 않도록 shared 배열의 값을 쓴다.
// 마감 시각이 지난 프로젝트도 만들 수 있게 DB에 직접 넣는다.
async function createProject(
  clientId: bigint,
  { recruitmentEndsInDays = 3 }: { recruitmentEndsInDays?: number } = {},
) {
  const recruitmentEndAt = new Date(
    Date.now() + recruitmentEndsInDays * DAY_MS,
  );
  return prisma.project.create({
    data: {
      clientId,
      title: "돌잔치 성장영상",
      description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
      purpose: VIDEO_PURPOSES[0],
      styles: [VIDEO_STYLES[0]],
      budget: 50_000n,
      recruitmentEndAt,
      deliveryDueDate: new Date(recruitmentEndAt.getTime() + 7 * DAY_MS),
      createdAt: new Date(recruitmentEndAt.getTime() - 10 * DAY_MS),
    },
  });
}

const APPLICATION = {
  message: "감성적인 성장영상을 3일 안에 만들어 드릴게요.",
  proposedAmount: 45_000,
  expectedDays: 3,
};

function apply(token: string, projectId: bigint, body: object = APPLICATION) {
  return request(app)
    .post(`/api/projects/${projectId}/applications`)
    .set(auth(token))
    .send(body);
}

const discuss = (token: string, applicationId: string) =>
  request(app)
    .post(`/api/applications/${applicationId}/discuss`)
    .set(auth(token));

const withdraw = (token: string, applicationId: string) =>
  request(app)
    .post(`/api/applications/${applicationId}/withdraw`)
    .set(auth(token));

const endWithoutSelection = (token: string, projectId: bigint) =>
  request(app)
    .post(`/api/projects/${projectId}/end-without-selection`)
    .set(auth(token));

const decline = (token: string, applicationId: string) =>
  request(app)
    .post(`/api/applications/${applicationId}/decline`)
    .set(auth(token));

const closeProject = (token: string, projectId: bigint) =>
  request(app).post(`/api/projects/${projectId}/close`).set(auth(token));

const notificationsOf = (userId: bigint) =>
  prisma.notification.findMany({
    where: { recipientUserId: userId },
    orderBy: { id: "asc" },
  });

// 의뢰인 1명·프로젝트 1개·크리에이터 n명이 지원한 상태
async function projectWithApplicants(count: number) {
  const client = await signup("CLIENT");
  const project = await createProject(client.userId);
  const creators = await Promise.all(
    Array.from({ length: count }, (_, i) => signup("CREATOR", i + 1)),
  );
  const applicationIds = await creators.reduce<Promise<string[]>>(
    async (previous, creator) => {
      const ids = await previous;
      const res = await apply(creator.token, project.id);
      expect(res.status).toBe(201);
      return [...ids, String(res.body.id)];
    },
    Promise.resolve([]),
  );
  return { client, project, creators, applicationIds };
}

describe("지원서 제출 (APPLY-01)", () => {
  it("크리에이터가 지원하면 대기 상태로 저장되고 의뢰인에게 알림이 간다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const project = await createProject(client.userId);

    const res = await apply(creator.token, project.id);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      projectId: project.id.toString(),
      creatorName: "CREATOR 1",
      proposedAmount: 45_000,
      expectedDays: 3,
      status: "PENDING",
      closedReason: null,
    });
    const [notification] = await notificationsOf(client.userId);
    expect(notification).toMatchObject({
      eventType: "APPLICATION_SUBMITTED",
      projectId: project.id,
      readAt: null,
    });
  });

  it("같은 프로젝트에는 한 번만 지원할 수 있다 (동시 요청 포함)", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const project = await createProject(client.userId);

    const results = await Promise.all([
      apply(creator.token, project.id),
      apply(creator.token, project.id),
      apply(creator.token, project.id),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.workRequest.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  it("마감 시각이 지났거나 직접 마감한 프로젝트에는 지원할 수 없다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const expired = await createProject(client.userId, {
      recruitmentEndsInDays: -1,
    });
    const closed = await createProject(client.userId);
    expect((await closeProject(client.token, closed.id)).status).toBe(200);

    const late = await apply(creator.token, expired.id);
    const afterClose = await apply(creator.token, closed.id);

    expect(late.status).toBe(409);
    expect(afterClose.status).toBe(409);
    expect(await prisma.workRequest.count()).toBe(0);
  });

  it("의뢰인은 지원할 수 없고, 없는·삭제된 프로젝트는 404, 입력 오류는 400", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const project = await createProject(client.userId);
    const deleted = await createProject(client.userId);
    await request(app)
      .delete(`/api/projects/${deleted.id}`)
      .set(auth(client.token));

    expect((await apply(client.token, project.id)).status).toBe(403);
    expect((await apply(creator.token, 999_999n)).status).toBe(404);
    expect((await apply(creator.token, deleted.id)).status).toBe(404);
    expect(
      (
        await apply(creator.token, project.id, {
          ...APPLICATION,
          message: "짧음",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await apply(creator.token, project.id, {
          ...APPLICATION,
          status: "DISCUSSING",
        })
      ).status,
    ).toBe(400);
    expect(await prisma.workRequest.count()).toBe(0);
  });
});

describe("비활성 의뢰인의 프로젝트 (#22 리뷰)", () => {
  it.each(["RESTRICTED", "WITHDRAWN"])(
    "%s 의뢰인의 프로젝트에는 ID로 직접 지원해도 404이고, 지원·알림이 생기지 않으며 기존 지원은 남는다",
    async (status) => {
      const { client, project } = await projectWithApplicants(1);
      const late = await signup("CREATOR", 9);
      const before = await prisma.notification.count();
      await prisma.user.update({
        where: { id: client.userId },
        data: { status },
      });

      const res = await apply(late.token, project.id);

      expect(res.status).toBe(404);
      expect(
        await prisma.workRequest.count({ where: { creatorId: late.userId } }),
      ).toBe(0);
      expect(await prisma.notification.count()).toBe(before);
      // 기존 지원 이력은 지우지 않는다.
      expect(
        await prisma.workRequest.count({ where: { projectId: project.id } }),
      ).toBe(1);
    },
  );
});

describe("지원 내역 조회", () => {
  it("의뢰인은 본인 프로젝트의 지원자만, 크리에이터는 본인 지원만 본다", async () => {
    const { client, project, creators } = await projectWithApplicants(2);
    const other = await signup("CLIENT", 2);

    const forOwner = await request(app)
      .get(`/api/projects/${project.id}/applications`)
      .set(auth(client.token));
    const forOther = await request(app)
      .get(`/api/projects/${project.id}/applications`)
      .set(auth(other.token));
    const mine = await request(app)
      .get("/api/applications/me")
      .set(auth(creators[0]?.token ?? ""));

    expect(forOwner.status).toBe(200);
    expect(forOwner.body.items).toHaveLength(2);
    expect(forOther.status).toBe(404);
    expect(mine.status).toBe(200);
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0]).toMatchObject({
      creatorName: "CREATOR 1",
      project: { id: project.id.toString(), status: "OPEN" },
    });
    expect(mine.body.pagination).toMatchObject({ page: 1, total: 1 });
  });
});

// 조건서를 하나 저장해 둔다(협의가 끝나면 무효가 되는지 보려고).
async function saveTerms(token: string, applicationId: string) {
  const res = await request(app)
    .post(`/api/work-requests/${applicationId}/terms/versions`)
    .set(auth(token))
    .send({
      commandId: randomUUID(),
      baseVersionNo: 0,
      values: {
        amountKrw: 45_000,
        specification: null,
        scope: null,
        materials: null,
        deadline: null,
        revisions: null,
        usageRights: null,
        cancellation: null,
      },
    });
  expect(res.status).toBe(201);
}

const termsStatusesOf = async (applicationId: string) =>
  (
    await prisma.termsVersion.findMany({
      where: { workRequestId: BigInt(applicationId) },
    })
  ).map((row) => row.status);

describe("협의 요청 (APPLY-02)", () => {
  it("협의 요청은 그 지원만 협의 중으로 바꾼다. 프로젝트와 다른 지원은 그대로다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(3);
    const [first, ...rest] = applicationIds;

    const res = await discuss(client.token, first ?? "");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "DISCUSSING" });
    expect(res.body.respondedAt).not.toBeNull();
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
        .status,
    ).toBe("OPEN");
    const others = await prisma.workRequest.findMany({
      where: { id: { in: rest.map(BigInt) } },
    });
    expect(others.map((row) => row.status)).toEqual(["PENDING", "PENDING"]);
    const received = await Promise.all(
      creators.map((creator) => notificationsOf(creator.userId)),
    );
    expect(received.map((list) => list.map((n) => n.eventType))).toEqual([
      ["DISCUSSION_REQUESTED"],
      [],
      [],
    ]);
  });

  it("여러 후보와 동시에 협의할 수 있고, 같은 지원에 다시 요청하면 409", async () => {
    const { client, applicationIds } = await projectWithApplicants(2);
    const results = await Promise.all(
      applicationIds.map((id) => discuss(client.token, id)),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect((await discuss(client.token, applicationIds[0] ?? "")).status).toBe(
      409,
    );
  });

  it("직접 마감·기한 종료 뒤에도 들어온 지원과 협의할 수 있다", async () => {
    const { client, project, applicationIds } = await projectWithApplicants(2);
    expect((await closeProject(client.token, project.id)).status).toBe(200);
    expect((await discuss(client.token, applicationIds[0] ?? "")).status).toBe(
      200,
    );
    await prisma.project.update({
      where: { id: project.id },
      data: { closeReason: "EXPIRED" },
    });
    expect((await discuss(client.token, applicationIds[1] ?? "")).status).toBe(
      200,
    );
  });

  it.each([
    ["무선정 종료", { status: "CLOSED", closeReason: "NO_SELECTION" }],
    ["계약", { status: "CONTRACTED", closeReason: null }],
  ])("%s된 프로젝트에서는 협의 요청·거절할 수 없다", async (_label, data) => {
    const { client, project, applicationIds } = await projectWithApplicants(1);
    await prisma.project.update({ where: { id: project.id }, data });
    expect((await discuss(client.token, applicationIds[0] ?? "")).status).toBe(
      409,
    );
    expect((await decline(client.token, applicationIds[0] ?? "")).status).toBe(
      409,
    );
    expect((await prisma.workRequest.findFirstOrThrow()).status).toBe(
      "PENDING",
    );
  });

  it("남의 프로젝트 지원은 404, 크리에이터는 403", async () => {
    const { creators, applicationIds } = await projectWithApplicants(1);
    const other = await signup("CLIENT", 2);
    expect((await discuss(other.token, applicationIds[0] ?? "")).status).toBe(
      404,
    );
    expect((await decline(other.token, applicationIds[0] ?? "")).status).toBe(
      404,
    );
    expect(
      (await discuss(creators[0]?.token ?? "", applicationIds[0] ?? "")).status,
    ).toBe(403);
    expect((await prisma.workRequest.findFirstOrThrow()).status).toBe(
      "PENDING",
    );
  });
});

describe("거절·철회 (APPLY-03)", () => {
  it("의뢰인은 대기·협의 중인 지원을 거절하고, 협의 중이던 조건서는 무효가 된다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(2);
    const [pendingId, discussingId] = applicationIds;
    await discuss(client.token, discussingId ?? "");
    await saveTerms(client.token, discussingId ?? "");

    expect((await decline(client.token, pendingId ?? "")).body.status).toBe(
      "DECLINED",
    );
    expect((await decline(client.token, discussingId ?? "")).body.status).toBe(
      "DECLINED",
    );
    expect(await termsStatusesOf(discussingId ?? "")).toEqual(["VOID"]);
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } }))
        .status,
    ).toBe("OPEN");
    expect(
      (await notificationsOf(creators[0]?.userId ?? 0n)).map(
        (n) => n.eventType,
      ),
    ).toEqual(["APPLICATION_DECLINED"]);
    expect((await decline(client.token, pendingId ?? "")).status).toBe(409);
  });

  it("크리에이터는 계약 전 본인 지원을 철회하고, 의뢰인에게 알림이 간다", async () => {
    const { client, creators, applicationIds } = await projectWithApplicants(2);
    const [pendingId, discussingId] = applicationIds;
    await discuss(client.token, discussingId ?? "");
    await saveTerms(client.token, discussingId ?? "");

    const first = await withdraw(creators[0]?.token ?? "", pendingId ?? "");
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("WITHDRAWN");
    expect(
      (await withdraw(creators[1]?.token ?? "", discussingId ?? "")).body
        .status,
    ).toBe("WITHDRAWN");
    expect(await termsStatusesOf(discussingId ?? "")).toEqual(["VOID"]);
    expect(
      (await notificationsOf(client.userId))
        .map((n) => n.eventType)
        .filter((type) => type === "APPLICATION_WITHDRAWN"),
    ).toHaveLength(2);
    expect(
      (await withdraw(creators[0]?.token ?? "", pendingId ?? "")).status,
    ).toBe(409);
  });

  it("남의 지원은 철회할 수 없고(404), 의뢰인은 철회할 수 없으며(403), 계약 뒤에는 409", async () => {
    const { client, creators, applicationIds } = await projectWithApplicants(2);
    expect(
      (await withdraw(creators[1]?.token ?? "", applicationIds[0] ?? ""))
        .status,
    ).toBe(404);
    expect((await withdraw(client.token, applicationIds[0] ?? "")).status).toBe(
      403,
    );
    await prisma.workRequest.update({
      where: { id: BigInt(applicationIds[0] ?? "0") },
      data: { status: "CONTRACTED" },
    });
    expect(
      (await withdraw(creators[0]?.token ?? "", applicationIds[0] ?? ""))
        .status,
    ).toBe(409);
    expect((await decline(client.token, applicationIds[0] ?? "")).status).toBe(
      409,
    );
  });
});

describe("마감·무선정 종료·삭제 (CAMP-05·06)", () => {
  it("직접 마감하면 신규 지원만 막히고, 대기 지원자에게 마감 알림이 간다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(2);
    await decline(client.token, applicationIds[1] ?? "");
    const late = await signup("CREATOR", 9);

    const closed = await closeProject(client.token, project.id);

    expect(closed.status).toBe(200);
    expect(closed.body).toMatchObject({
      status: "CLOSED",
      closeReason: "MANUAL",
    });
    expect((await apply(late.token, project.id)).status).toBe(409);
    expect(
      (await notificationsOf(creators[0]?.userId ?? 0n)).map(
        (n) => n.eventType,
      ),
    ).toEqual(["PROJECT_CLOSED"]);
    expect(
      (await notificationsOf(creators[1]?.userId ?? 0n)).map(
        (n) => n.eventType,
      ),
    ).toEqual(["APPLICATION_DECLINED"]);
  });

  it("무선정 종료하면 대기·협의 중인 지원은 미선정(NO_SELECTION), 조건서는 무효가 되고 알림이 간다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(3);
    const [, discussingId, declinedId] = applicationIds;
    await discuss(client.token, discussingId ?? "");
    await saveTerms(client.token, discussingId ?? "");
    await decline(client.token, declinedId ?? "");

    const res = await endWithoutSelection(client.token, project.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "CLOSED",
      closeReason: "NO_SELECTION",
    });
    const rows = await prisma.workRequest.findMany({ orderBy: { id: "asc" } });
    expect(rows.map((row) => [row.status, row.closedReason])).toEqual([
      ["NOT_SELECTED", "NO_SELECTION"],
      ["NOT_SELECTED", "NO_SELECTION"],
      ["DECLINED", null],
    ]);
    expect(await termsStatusesOf(discussingId ?? "")).toEqual(["VOID"]);
    const received = await Promise.all(
      creators.map((creator) => notificationsOf(creator.userId)),
    );
    expect(received.map((list) => list.map((n) => n.eventType))).toEqual([
      ["PROJECT_ENDED_NO_SELECTION"],
      ["DISCUSSION_REQUESTED", "PROJECT_ENDED_NO_SELECTION"],
      ["APPLICATION_DECLINED"],
    ]);
    // 무선정 종료 뒤에는 다시 종료·협의 요청할 수 없다.
    expect((await endWithoutSelection(client.token, project.id)).status).toBe(
      409,
    );
  });

  it("직접 마감한 프로젝트도 무선정 종료할 수 있고, 계약된 프로젝트·남의 프로젝트는 할 수 없다", async () => {
    const { client, project } = await projectWithApplicants(1);
    await closeProject(client.token, project.id);
    expect((await endWithoutSelection(client.token, project.id)).status).toBe(
      200,
    );

    const other = await createProject(client.userId);
    await prisma.project.update({
      where: { id: other.id },
      data: { status: "CONTRACTED" },
    });
    expect((await endWithoutSelection(client.token, other.id)).status).toBe(
      409,
    );
    const stranger = await signup("CLIENT", 7);
    const third = await createProject(client.userId);
    expect((await endWithoutSelection(stranger.token, third.id)).status).toBe(
      404,
    );
  });

  it("삭제하면 대기·협의 중인 지원은 미선정(PROJECT_DELETED)되고 알림이 간다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(2);
    await discuss(client.token, applicationIds[1] ?? "");

    const res = await request(app)
      .delete(`/api/projects/${project.id}`)
      .set(auth(client.token));

    expect(res.status).toBeLessThan(300);
    const rows = await prisma.workRequest.findMany();
    expect(
      rows.every(
        (row) =>
          row.status === "NOT_SELECTED" &&
          row.closedReason === "PROJECT_DELETED",
      ),
    ).toBe(true);
    const received = await Promise.all(
      creators.map((creator) => notificationsOf(creator.userId)),
    );
    expect(received.map((list) => list.at(-1)?.eventType)).toEqual([
      "APPLICATION_AUTO_REJECTED",
      "APPLICATION_AUTO_REJECTED",
    ]);
  });

  it("계약된 프로젝트는 삭제할 수 없다", async () => {
    const { client, project } = await projectWithApplicants(1);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "CONTRACTED" },
    });
    expect(
      (
        await request(app)
          .delete(`/api/projects/${project.id}`)
          .set(auth(client.token))
      ).status,
    ).toBe(409);
  });
});

describe("마감·계약 후 상세 조회 (#19 리뷰 4번)", () => {
  const detail = (projectId: bigint, token?: string) => {
    const req = request(app).get(`/api/projects/${projectId}`);
    return token ? req.set(auth(token)) : req;
  };

  it("계약 뒤에는 작성자와 지원자만 상세를 보고, 다른 사람은 404다", async () => {
    const { client, project, creators } = await projectWithApplicants(2);
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "CONTRACTED" },
    });
    const stranger = await signup("CREATOR", 9);
    const otherClient = await signup("CLIENT", 9);

    expect((await detail(project.id)).status).toBe(404);
    expect((await detail(project.id, stranger.token)).status).toBe(404);
    expect((await detail(project.id, otherClient.token)).status).toBe(404);
    expect((await detail(project.id, client.token)).status).toBe(200);
    const applicant = await detail(project.id, creators[0]?.token);
    expect(applicant.status).toBe(200);
    expect(applicant.body.status).toBe("CONTRACTED");
    expect((await detail(project.id, creators[1]?.token)).status).toBe(200);
  });

  it("직접 마감 뒤에도 지원자는 상세를 본다. 잘못된 토큰은 401이다", async () => {
    const { client, project, creators } = await projectWithApplicants(1);
    await closeProject(client.token, project.id);

    expect((await detail(project.id)).status).toBe(404);
    expect((await detail(project.id, creators[0]?.token)).status).toBe(200);
    expect((await detail(project.id, "not-a-token")).status).toBe(401);
  });

  it("삭제한 프로젝트는 지원자도 볼 수 없다 (404)", async () => {
    const { client, project, creators } = await projectWithApplicants(1);
    await request(app)
      .delete(`/api/projects/${project.id}`)
      .set(auth(client.token));

    expect((await detail(project.id, creators[0]?.token)).status).toBe(404);
  });
});

describe("동시 요청", () => {
  // 같은 프로젝트의 지원·협의 요청·거절·철회·마감·무선정 종료·삭제는 프로젝트 행 잠금으로 하나씩 처리된다.

  it("마감과 지원이 겹쳐도, 마감 뒤에 저장된 지원은 없다 (5회 반복)", async () => {
    await Array.from({ length: 5 }, (_, n) => n).reduce(
      (previous, n) =>
        previous.then(async () => {
          const client = await signup("CLIENT", 100 + n);
          const creator = await signup("CREATOR", 100 + n);
          const project = await createProject(client.userId);

          const [applied, closed] = await Promise.all([
            apply(creator.token, project.id),
            closeProject(client.token, project.id),
          ]);

          expect(closed.status).toBe(200);
          const saved = await prisma.workRequest.findMany({
            where: { projectId: project.id },
          });
          if (applied.status === 201) {
            // 지원이 먼저 처리됐다면, 마감 알림을 받는다.
            expect(saved).toHaveLength(1);
            const received = await notificationsOf(creator.userId);
            expect(received.map((item) => item.eventType)).toEqual([
              "PROJECT_CLOSED",
            ]);
          } else {
            expect(applied.status).toBe(409);
            expect(saved).toHaveLength(0);
          }
        }),
      Promise.resolve(),
    );
  });

  it("다른 트랜잭션이 프로젝트를 잠그고 계약하는 동안 들어온 수정은 기다렸다가 409가 된다", async () => {
    const { client, project } = await projectWithApplicants(1);
    let patch: Promise<request.Response> | undefined;

    // 계약 트랜잭션을 흉내 낸다: 프로젝트 행을 잠근 채 CONTRACTED로 바꾸고, 그 사이에 수정 요청을 보낸다.
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${project.id} FOR UPDATE`;
      await tx.project.update({
        where: { id: project.id },
        data: { status: "CONTRACTED" },
      });
      patch = request(app)
        .patch(`/api/projects/${project.id}`)
        .set(auth(client.token))
        .send({ title: "계약 중에 바꾼 제목" })
        .then((res) => res);
      await new Promise((resolve) => {
        setTimeout(resolve, 300);
      });
    });

    const res = await patch;
    expect(res?.status).toBe(409);
    const row = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(row.title).toBe("돌잔치 성장영상");
  });

  it("협의 요청과 무선정 종료가 겹쳐도 상태가 어긋나지 않는다", async () => {
    const { client, project, applicationIds } = await projectWithApplicants(1);

    const [discussed, ended] = await Promise.all([
      discuss(client.token, applicationIds[0] ?? ""),
      endWithoutSelection(client.token, project.id),
    ]);

    expect(ended.status).toBe(200);
    const row = await prisma.workRequest.findFirstOrThrow();
    // 어느 쪽이 먼저든 끝 상태는 미선정(NO_SELECTION)이다. 종료가 먼저면 협의 요청은 409다.
    expect([row.status, row.closedReason]).toEqual([
      "NOT_SELECTED",
      "NO_SELECTION",
    ]);
    expect([200, 409]).toContain(discussed.status);
  });

  it("철회와 거절이 겹쳐도 하나만 반영된다", async () => {
    const { client, creators, applicationIds } = await projectWithApplicants(1);
    const results = await Promise.all([
      withdraw(creators[0]?.token ?? "", applicationIds[0] ?? ""),
      decline(client.token, applicationIds[0] ?? ""),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const row = await prisma.workRequest.findFirstOrThrow();
    expect(["WITHDRAWN", "DECLINED"]).toContain(row.status);
  });
});

describe("알림 조회·읽음 (NOTI-01)", () => {
  it("미확인 개수를 보여주고, 하나씩 또는 모두 읽음 처리한다", async () => {
    const { client } = await projectWithApplicants(3);

    const list = await request(app)
      .get("/api/notifications")
      .set(auth(client.token));
    expect(list.status).toBe(200);
    expect(list.body.unreadCount).toBe(3);
    expect(list.body.items).toHaveLength(3);
    expect(list.body.items[0]).toMatchObject({
      type: "APPLICATION_SUBMITTED",
      readAt: null,
    });

    const firstId = String(list.body.items[0].id);
    const read = await request(app)
      .post(`/api/notifications/${firstId}/read`)
      .set(auth(client.token));
    expect(read.status).toBe(200);
    expect(read.body.readAt).not.toBeNull();

    // 다시 읽어도 처음 읽은 시각을 유지한다.
    const again = await request(app)
      .post(`/api/notifications/${firstId}/read`)
      .set(auth(client.token));
    expect(again.body.readAt).toBe(read.body.readAt);

    const count = await request(app)
      .get("/api/notifications/unread-count")
      .set(auth(client.token));
    expect(count.body.unreadCount).toBe(2);

    const unreadOnly = await request(app)
      .get("/api/notifications?unread=true")
      .set(auth(client.token));
    expect(unreadOnly.body.items).toHaveLength(2);

    const all = await request(app)
      .post("/api/notifications/read-all")
      .set(auth(client.token));
    expect(all.body.unreadCount).toBe(0);
  });

  it("남의 알림은 읽음 처리할 수 없고(404) 상태가 바뀌지 않는다, 로그인하지 않으면 401", async () => {
    const { client, creators } = await projectWithApplicants(1);
    const [own] = await notificationsOf(client.userId);

    const res = await request(app)
      .post(`/api/notifications/${own?.id ?? 0n}/read`)
      .set(auth(creators[0]?.token ?? ""));

    expect(res.status).toBe(404);
    const row = await prisma.notification.findUniqueOrThrow({
      where: { id: own?.id ?? 0n },
    });
    expect(row.readAt).toBeNull();
    expect((await request(app).get("/api/notifications")).status).toBe(401);
  });

  it("같은 사건의 알림은 한 번만 저장된다 (수신자+사건 키 UNIQUE)", async () => {
    const { client, project } = await projectWithApplicants(1);
    const [existing] = await notificationsOf(client.userId);

    await expect(
      prisma.notification.create({
        data: {
          recipientUserId: client.userId,
          eventKey: existing?.eventKey ?? "",
          eventType: "APPLICATION_SUBMITTED",
          title: "중복",
          body: "중복",
          projectId: project.id,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("DB 제약", () => {
  it("공개 지원은 프로젝트가 있어야 하고, 같은 사람이 의뢰인·크리에이터일 수 없다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const base = {
      requestType: "PROJECT_APPLICATION",
      clientId: client.userId,
      creatorId: creator.userId,
      message: "테스트",
      initialAmount: 1n,
      expectedDays: 1,
    };

    await expect(prisma.workRequest.create({ data: base })).rejects.toThrow(
      /work_requests_type_project_check/,
    );
    const project = await createProject(client.userId);
    await expect(
      prisma.workRequest.create({
        data: { ...base, creatorId: client.userId, projectId: project.id },
      }),
    ).rejects.toThrow(/work_requests_parties_check/);
  });
});
