import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();
let app = createTestApp({ prisma });

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({ prisma });
});

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
  return String(res.body.accessToken);
}

function futureDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function projectBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "돌잔치 성장영상 제작",
    description: "아이의 첫 생일에 상영할 감성적인 성장영상을 만들고 싶습니다.",
    purpose: "CHILD_FAMILY",
    styles: ["EMOTIONAL", "CINEMATIC"],
    budget: 50_000,
    expectedDurationSeconds: 90,
    recruitmentEndAt: futureDate(3).toISOString(),
    deliveryDueDate: dateOnly(futureDate(10)),
    ...overrides,
  };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("공개 프로젝트 CRUD", () => {
  it("의뢰인이 만들고 공개 상세에서 조회한다", async () => {
    const token = await signup("CLIENT");
    const created = await request(app)
      .post("/api/projects")
      .set(auth(token))
      .send(projectBody());

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      clientName: "CLIENT 1",
      purpose: "CHILD_FAMILY",
      styles: ["EMOTIONAL", "CINEMATIC"],
      budget: 50_000,
      status: "OPEN",
    });
    const detail = await request(app).get(`/api/projects/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe(created.body.id);
  });

  it("크리에이터와 비로그인 사용자는 만들 수 없다", async () => {
    const creator = await signup("CREATOR");
    expect(
      (
        await request(app)
          .post("/api/projects")
          .set(auth(creator))
          .send(projectBody())
      ).status,
    ).toBe(403);
    expect(
      (await request(app).post("/api/projects").send(projectBody())).status,
    ).toBe(401);
  });

  it("검색·목적·스타일·예산·정렬·페이지네이션을 적용한다", async () => {
    const token = await signup("CLIENT");
    const projects = [
      projectBody({ title: "감성 돌잔치 영상", budget: 50_000 }),
      projectBody({
        title: "깔끔한 웨딩 영상",
        purpose: "WEDDING_COUPLE",
        styles: ["CLEAN"],
        budget: 30_000,
      }),
      projectBody({
        title: "트렌디 여행 릴스",
        purpose: "TRAVEL_DAILY",
        styles: ["TRENDY"],
        budget: 20_000,
      }),
    ];
    const created = await Promise.all(
      projects.map((body) =>
        request(app).post("/api/projects").set(auth(token)).send(body),
      ),
    );
    expect(created.map((response) => response.status)).toEqual([201, 201, 201]);

    const filtered = await request(app).get(
      "/api/projects?purpose=WEDDING_COUPLE&styles=CLEAN&budgetMin=20000&budgetMax=40000",
    );
    expect(filtered.status).toBe(200);
    expect(
      filtered.body.items.map((item: { title: string }) => item.title),
    ).toEqual(["깔끔한 웨딩 영상"]);

    const paged = await request(app).get(
      "/api/projects?sort=BUDGET_LOW&page=2&pageSize=1",
    );
    expect(paged.status).toBe(200);
    expect(paged.body.items[0].budget).toBe(30_000);
    expect(paged.body.pagination).toEqual({
      page: 2,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });
  });

  it("소유자만 수정·마감·삭제할 수 있고 삭제한 프로젝트는 공개되지 않는다", async () => {
    const owner = await signup("CLIENT", 1);
    const other = await signup("CLIENT", 2);
    const created = await request(app)
      .post("/api/projects")
      .set(auth(owner))
      .send(projectBody());
    const path = `/api/projects/${created.body.id}`;

    expect(
      (await request(app).patch(path).set(auth(other)).send({ budget: 60_000 }))
        .status,
    ).toBe(404);
    const changed = await request(app)
      .patch(path)
      .set(auth(owner))
      .send({ budget: 60_000 });
    expect(changed.status).toBe(200);
    expect(changed.body.budget).toBe(60_000);

    const removed = await request(app).delete(path).set(auth(owner));
    expect(removed.status).toBe(204);
    expect((await request(app).get(path)).status).toBe(404);
    const row = await prisma.project.findUniqueOrThrow({
      where: { id: BigInt(String(created.body.id)) },
    });
    expect(row.status).toBe("CLOSED");
    expect(row.deletedAt).not.toBeNull();
  });

  it("KST 달력 날짜로 납품일을 검증한다 (UTC 자정 근처)", async () => {
    const token = await signup("CLIENT");
    const deadline = "2090-11-02T01:00:00+09:00";

    const sameDay = await request(app)
      .post("/api/projects")
      .set(auth(token))
      .send(
        projectBody({
          recruitmentEndAt: deadline,
          deliveryDueDate: "2090-11-02",
        }),
      );
    expect(sameDay.status).toBe(400);

    const nextDay = await request(app)
      .post("/api/projects")
      .set(auth(token))
      .send(
        projectBody({
          recruitmentEndAt: deadline,
          deliveryDueDate: "2090-11-03",
        }),
      );
    expect(nextDay.status).toBe(201);
  });

  it("DB CHECK도 세션 시간대와 관계없이 KST 날짜를 사용한다", async () => {
    await signup("CLIENT");
    const client = await prisma.user.findUniqueOrThrow({
      where: { email: "client-1@example.com" },
    });
    const tryInsert = (timeZone: string) =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('TimeZone', ${timeZone}, true)`;
        // @db.Date를 JS Date로 바인딩하면 세션 시간대에 따라 입력 날짜가
        // 재해석될 수 있으므로, CHECK 자체는 명시적 SQL DATE로 검사한다.
        return tx.$executeRaw`
          INSERT INTO "projects" (
            "client_id", "title", "description", "purpose", "styles",
            "budget", "recruitment_end_at", "delivery_due_date"
          ) VALUES (
            ${client.id}, 'KST 날짜 경계 테스트',
            '세션 시간대와 무관하게 납품일을 검사합니다.',
            'CHILD_FAMILY', ARRAY['EMOTIONAL']::TEXT[],
            50000, TIMESTAMPTZ '2090-11-02 01:00:00+09',
            DATE '2090-11-02'
          )
        `;
      });

    await expect(tryInsert("UTC")).rejects.toThrow();
    await expect(tryInsert("Asia/Seoul")).rejects.toThrow();
  });
});

describe("마감·상태·회원 상태 정책 (#19 리뷰)", () => {
  async function createdProject(token: string, overrides = {}) {
    const res = await request(app)
      .post("/api/projects")
      .set(auth(token))
      .send(projectBody(overrides));
    expect(res.status).toBe(201);
    return BigInt(String(res.body.id));
  }

  // 마감 시각만 과거로 옮긴다. CHECK(recruitment_end_at > created_at)를 지키려고 생성 시각도 함께 당긴다.
  async function expire(projectId: bigint) {
    await prisma.project.update({
      where: { id: projectId },
      data: {
        recruitmentEndAt: new Date(Date.now() - 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    });
  }

  it.each([
    ["제목만 수정", () => ({ title: "제목만 바꿔요" })],
    ["마감 연장", () => ({ recruitmentEndAt: futureDate(5).toISOString() })],
  ])(
    "마감 시각이 지난 프로젝트는 %s도 409이고 바뀌지 않는다",
    async (_label, body) => {
      const token = await signup("CLIENT");
      const projectId = await createdProject(token);
      await expire(projectId);

      const res = await request(app)
        .patch(`/api/projects/${projectId}`)
        .set(auth(token))
        .send(body());

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toContain("마감");
      const row = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      expect(row.title).toBe(projectBody().title);
    },
  );

  it("마감 시각이 지난 프로젝트는 공개 목록·상세에서 빠지고, 내 목록에는 남는다", async () => {
    const token = await signup("CLIENT");
    const projectId = await createdProject(token);
    await expire(projectId);

    const list = await request(app).get("/api/projects");
    const detail = await request(app).get(`/api/projects/${projectId}`);
    const mine = await request(app).get("/api/projects/me").set(auth(token));

    expect(list.body.items).toHaveLength(0);
    expect(detail.status).toBe(404);
    expect(mine.body.items).toHaveLength(1);
  });

  it.each(["MATCHED", "CONTRACTED"])(
    "%s 프로젝트는 삭제할 수 없다 (409)",
    async (status) => {
      const token = await signup("CLIENT");
      const projectId = await createdProject(token);
      await prisma.project.update({
        where: { id: projectId },
        data: { status },
      });

      const res = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set(auth(token));

      expect(res.status).toBe(409);
      const row = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      expect(row.deletedAt).toBeNull();
    },
  );

  it.each(["RESTRICTED", "WITHDRAWN"])(
    "%s 회원의 프로젝트는 공개 목록·상세에서 빠지고, 프로젝트 행은 남는다",
    async (status) => {
      const token = await signup("CLIENT");
      const projectId = await createdProject(token);
      await prisma.user.updateMany({ data: { status } });

      const list = await request(app).get("/api/projects");
      const detail = await request(app).get(`/api/projects/${projectId}`);

      expect(list.body.items).toHaveLength(0);
      expect(list.body.pagination.total).toBe(0);
      expect(detail.status).toBe(404);
      expect(await prisma.project.count()).toBe(1);
    },
  );

  it("알 수 없는 필드로 상태를 바꾸려 하면 400이다", async () => {
    const token = await signup("CLIENT");
    const projectId = await createdProject(token);

    const res = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set(auth(token))
      .send({ status: "CLOSED" });

    expect(res.status).toBe(400);
  });
});
