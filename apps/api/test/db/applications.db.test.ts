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

const accept = (token: string, applicationId: string) =>
  request(app)
    .post(`/api/applications/${applicationId}/accept`)
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

describe("선정·거절 (APPLY-02, STATE-01)", () => {
  it("선정하면 프로젝트는 거래 단계, 나머지 대기 지원은 자동 거절되고 각자 알림을 받는다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(3);
    const [selected, ...rest] = applicationIds;

    const res = await accept(client.token, selected ?? "");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "DISCUSSING" });
    expect(res.body.respondedAt).not.toBeNull();
    const projectRow = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(projectRow.status).toBe("MATCHED");
    const others = await prisma.workRequest.findMany({
      where: { id: { in: rest.map(BigInt) } },
    });
    expect(
      others.every(
        (row) =>
          row.status === "NOT_SELECTED" &&
          row.closedReason === "OTHER_SELECTED",
      ),
    ).toBe(true);
    const [first, second, third] = await Promise.all(
      creators.map((creator) => notificationsOf(creator.userId)),
    );
    expect(first?.map((n) => n.eventType)).toEqual(["APPLICATION_ACCEPTED"]);
    expect(second?.map((n) => n.eventType)).toEqual([
      "APPLICATION_AUTO_REJECTED",
    ]);
    expect(third?.map((n) => n.eventType)).toEqual([
      "APPLICATION_AUTO_REJECTED",
    ]);
  });

  it("선정 뒤에는 다른 지원 선정·거절, 신규 지원, 마감, 삭제가 모두 막힌다", async () => {
    const { client, project, applicationIds } = await projectWithApplicants(2);
    await accept(client.token, applicationIds[0] ?? "");
    const late = await signup("CREATOR", 9);

    expect((await accept(client.token, applicationIds[1] ?? "")).status).toBe(
      409,
    );
    expect((await decline(client.token, applicationIds[0] ?? "")).status).toBe(
      409,
    );
    expect((await apply(late.token, project.id)).status).toBe(409);
    expect((await closeProject(client.token, project.id)).status).toBe(409);
    expect(
      (
        await request(app)
          .delete(`/api/projects/${project.id}`)
          .set(auth(client.token))
      ).status,
    ).toBe(409);
  });

  it("직접 거절하면 그 지원만 거절되고 프로젝트는 계속 모집 중이다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(2);

    const res = await decline(client.token, applicationIds[0] ?? "");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DECLINED");
    const projectRow = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(projectRow.status).toBe("OPEN");
    expect(
      (await notificationsOf(creators[0]?.userId ?? 0n)).map(
        (n) => n.eventType,
      ),
    ).toEqual(["APPLICATION_DECLINED"]);
    expect(await notificationsOf(creators[1]?.userId ?? 0n)).toHaveLength(0);
    expect((await decline(client.token, applicationIds[0] ?? "")).status).toBe(
      409,
    );
  });

  it("남의 프로젝트 지원은 선정·거절할 수 없다 (404), 크리에이터는 403", async () => {
    const { creators, applicationIds } = await projectWithApplicants(1);
    const other = await signup("CLIENT", 2);

    expect((await accept(other.token, applicationIds[0] ?? "")).status).toBe(
      404,
    );
    expect((await decline(other.token, applicationIds[0] ?? "")).status).toBe(
      404,
    );
    expect(
      (await accept(creators[0]?.token ?? "", applicationIds[0] ?? "")).status,
    ).toBe(403);
    const row = await prisma.workRequest.findFirstOrThrow();
    expect(row.status).toBe("PENDING");
  });
});

describe("마감·삭제 (일괄 마감)", () => {
  it("직접 마감하면 신규 지원만 막히고, 대기 지원자에게 마감 알림이 가며 선정은 여전히 가능하다", async () => {
    const { client, project, creators, applicationIds } =
      await projectWithApplicants(2);
    await decline(client.token, applicationIds[1] ?? "");

    const closed = await closeProject(client.token, project.id);

    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe("CLOSED");
    // 대기 중인 지원자(1번)만 마감 알림을 받는다. 이미 거절된 2번은 받지 않는다.
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
    expect((await accept(client.token, applicationIds[0] ?? "")).status).toBe(
      200,
    );
  });

  it("삭제하면 대기 지원은 자동 거절(PROJECT_DELETED)되고 알림이 간다", async () => {
    const { client, project, creators } = await projectWithApplicants(2);

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
    expect(received.map((list) => list.map((n) => n.eventType))).toEqual([
      ["APPLICATION_AUTO_REJECTED"],
      ["APPLICATION_AUTO_REJECTED"],
    ]);
  });
});

describe("동시 요청", () => {
  // 같은 프로젝트의 지원·선정·거절·마감·삭제는 프로젝트 행 잠금으로 하나씩 처리된다.

  it("두 지원자를 동시에 선정해도 한 명만 선정되고, 나머지는 자동 거절된다", async () => {
    const { client, project, applicationIds } = await projectWithApplicants(2);

    const results = await Promise.all(
      applicationIds.map((id) => accept(client.token, id)),
    );

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    const rows = await prisma.workRequest.findMany({
      where: { projectId: project.id },
    });
    expect(rows.map((row) => row.status).sort()).toEqual([
      "DISCUSSING",
      "NOT_SELECTED",
    ]);
    const notifications = await prisma.notification.findMany({
      where: {
        eventType: {
          in: ["APPLICATION_ACCEPTED", "APPLICATION_AUTO_REJECTED"],
        },
      },
    });
    expect(notifications.map((n) => n.eventType).sort()).toEqual([
      "APPLICATION_ACCEPTED",
      "APPLICATION_AUTO_REJECTED",
    ]);
  });

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

  it("선정과 다른 지원자 거절이 겹쳐도 상태가 어긋나지 않는다", async () => {
    const { client, project, applicationIds } = await projectWithApplicants(2);

    const [accepted, declined] = await Promise.all([
      accept(client.token, applicationIds[0] ?? ""),
      decline(client.token, applicationIds[1] ?? ""),
    ]);

    expect(accepted.status).toBe(200);
    const other = await prisma.workRequest.findUniqueOrThrow({
      where: { id: BigInt(applicationIds[1] ?? "0") },
    });
    // 거절이 먼저면 DECLINED, 선정이 먼저면 거절은 409이고 자동 거절(NOT_SELECTED)
    if (declined.status === 200) {
      expect(other.status).toBe("DECLINED");
    } else {
      expect(declined.status).toBe(409);
      expect(other.status).toBe("NOT_SELECTED");
    }
    const projectRow = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(projectRow.status).toBe("MATCHED");
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
