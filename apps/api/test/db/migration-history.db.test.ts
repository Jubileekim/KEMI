import { readFile } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

// 이미 데이터가 있는 DB에 마이그레이션을 적용해도 이력이 바뀌지 않는지 확인한다.
// 마이그레이션 SQL을 기존 행이 있는 상태에서 트랜잭션 안에서 다시 실행하고, 끝나면 되돌린다.

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

class Rollback extends Error {}

async function statements(migration: string): Promise<string[]> {
  const sql = await readFile(
    new URL(
      `../../prisma/migrations/${migration}/migration.sql`,
      import.meta.url,
    ),
    "utf8",
  );
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

describe("협의 모델 마이그레이션(20261026150000_negotiation_model)", () => {
  it("SQL에 기존 알림을 바꾸는 UPDATE가 없다", async () => {
    expect(
      (await statements("20261026150000_negotiation_model")).filter(
        (statement) => /^update\s/i.test(statement),
      ),
    ).toEqual([]);
  });

  it("과거 '선정됨'(APPLICATION_ACCEPTED) 알림을 그대로 보존한다", async () => {
    const user = await prisma.user.create({
      data: {
        email: "legacy@example.com",
        name: "이전 사용자",
        role: "CREATOR",
      },
    });
    await prisma.notification.create({
      data: {
        recipientUserId: user.id,
        eventKey: "legacy-accepted-1",
        eventType: "APPLICATION_ACCEPTED",
        title: "선정되었습니다",
        body: "이전 방식의 선정 알림",
      },
    });

    const sql = await statements("20261026150000_negotiation_model");
    let after: { eventType: string; title: string }[] = [];
    await expect(
      prisma.$transaction(async (tx) => {
        await sql.reduce(
          (previous, statement) =>
            previous.then(() => tx.$executeRawUnsafe(statement)),
          Promise.resolve(0),
        );
        after = await tx.notification.findMany({
          select: { eventType: true, title: true },
        });
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    expect(after).toEqual([
      { eventType: "APPLICATION_ACCEPTED", title: "선정되었습니다" },
    ]);
  });
});
