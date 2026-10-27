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
  const response = await request(app)
    .post("/api/auth/signup")
    .send({
      email: `${role.toLowerCase()}-discovery-${index}@example.com`,
      password: "correct-horse-battery",
      name: `${role} ${index}`,
      role,
    });
  expect(response.status).toBe(201);
  return String(response.body.accessToken);
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function futureDate(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function projectBody(title: string, purpose: string, styles: string[]) {
  return {
    title,
    description: `${title} 작업에 적합한 크리에이터를 찾는 공개 프로젝트입니다.`,
    purpose,
    styles,
    budget: 100_000,
    expectedDurationSeconds: 60,
    recruitmentEndAt: futureDate(3).toISOString(),
    deliveryDueDate: futureDate(10).toISOString().slice(0, 10),
  };
}

async function createProject(token: string, body: object): Promise<string> {
  const response = await request(app)
    .post("/api/projects")
    .set(auth(token))
    .send(body);
  expect(response.status).toBe(201);
  return String(response.body.id);
}

describe("프로젝트 북마크와 기본 추천", () => {
  it("북마크 저장·목록·해제를 멱등 처리한다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const projectId = await createProject(
      client,
      projectBody("가족 성장 영상", "CHILD_FAMILY", ["EMOTIONAL"]),
    );
    const path = `/api/bookmarks/projects/${projectId}`;

    expect((await request(app).put(path).set(auth(creator))).status).toBe(200);
    expect((await request(app).put(path).set(auth(creator))).status).toBe(200);

    const listed = await request(app)
      .get("/api/bookmarks/projects")
      .set(auth(creator));
    expect(listed.status).toBe(200);
    expect(listed.body.pagination.total).toBe(1);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([
      projectId,
    ]);

    expect((await request(app).delete(path).set(auth(creator))).status).toBe(
      204,
    );
    expect((await request(app).delete(path).set(auth(creator))).status).toBe(
      204,
    );
    expect(
      (await request(app).get("/api/bookmarks/projects").set(auth(creator)))
        .body.pagination.total,
    ).toBe(0);
  });

  it("의뢰인은 북마크와 추천을 사용할 수 없다", async () => {
    const client = await signup("CLIENT");
    expect(
      (
        await request(app)
          .get("/api/recommendations/projects")
          .set(auth(client))
      ).status,
    ).toBe(403);
  });

  it("북마크와 같은 목적의 프로젝트를 추천하고 저장한 항목은 제외한다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const bookmarkedId = await createProject(
      client,
      projectBody("첫 번째 가족 영상", "CHILD_FAMILY", ["EMOTIONAL"]),
    );
    const recommendedId = await createProject(
      client,
      projectBody("두 번째 가족 영상", "CHILD_FAMILY", ["CLEAN"]),
    );
    await createProject(
      client,
      projectBody("SNS 제품 영상", "SNS_SHORTFORM", ["TRENDY"]),
    );
    await request(app)
      .put(`/api/bookmarks/projects/${bookmarkedId}`)
      .set(auth(creator));

    const response = await request(app)
      .get("/api/recommendations/projects")
      .set(auth(creator));
    expect(response.status).toBe(200);
    expect(response.body.recommendation.basis).toBe("PREFERENCES");
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      recommendedId,
    ]);
  });
  it("추천 조건이 없거나 일치하는 모집이 없으면 최신 목록이라는 근거를 제공한다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    await createProject(
      client,
      projectBody("SNS 제작 모집", "SNS_SHORTFORM", ["TRENDY"]),
    );
    const list = () =>
      request(app).get("/api/recommendations/projects").set(auth(creator));
    expect((await list()).body.recommendation.basis).toBe(
      "LATEST_NO_PREFERENCES",
    );
    const favorite = await createProject(
      client,
      projectBody("가족 성장 영상", "CHILD_FAMILY", ["EMOTIONAL"]),
    );
    await request(app)
      .put(`/api/bookmarks/projects/${favorite}`)
      .set(auth(creator));
    const fallback = await list();
    expect(fallback.body.recommendation.basis).toBe("LATEST_NO_MATCHES");
    expect(fallback.body.items).toHaveLength(1);
  });
  it("종료한 저장 공고는 상태를 보여주고 삭제한 공고는 제목 없이 해제할 수 있다", async () => {
    const client = await signup("CLIENT");
    const creator = await signup("CREATOR");
    const id = await createProject(
      client,
      projectBody("삭제되면 숨겨야 하는 제목", "OTHER", ["CLEAN"]),
    );
    const path = `/api/bookmarks/projects/${id}`;
    await request(app).put(path).set(auth(creator));
    await prisma.project.update({
      where: { id: BigInt(id) },
      data: { status: "CLOSED", closeReason: "MANUAL" },
    });
    const closed = await request(app)
      .get("/api/bookmarks/projects")
      .set(auth(creator));
    expect(closed.body.items[0].status).toBe("CLOSED");
    await prisma.project.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    const hidden = await request(app)
      .get("/api/bookmarks/projects")
      .set(auth(creator));
    expect(hidden.body).toMatchObject({
      items: [],
      unavailableIds: [id],
      pagination: { total: 1 },
    });
    expect(JSON.stringify(hidden.body)).not.toContain("숨겨야");
    expect((await request(app).delete(path).set(auth(creator))).status).toBe(
      204,
    );
    expect(
      (await request(app).get("/api/bookmarks/projects").set(auth(creator)))
        .body.pagination.total,
    ).toBe(0);
  });
});
