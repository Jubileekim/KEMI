import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("테스트 DB 연결", () => {
  it("_test로 끝나는 테스트 전용 DB에 연결된다", async () => {
    const rows = await prisma.$queryRaw<
      { db: string }[]
    >`SELECT current_database() AS db`;
    expect(rows[0]?.db).toMatch(/_test$/);
  });

  it("실제 DB로 /health/ready가 200을 반환한다", async () => {
    const app = createApp({
      checkDatabase: async () => {
        await prisma.$queryRaw`SELECT 1`;
      },
    });
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe("ok");
  });
});
