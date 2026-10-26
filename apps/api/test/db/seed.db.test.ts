import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SeedAlreadyAppliedError, seedDemo } from "../../src/seed/seed.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

describe("시연 데이터 (단계 8)", () => {
  it("실제 서비스 흐름으로 완료 거래까지 만들고, 두 번 넣지 않는다", async () => {
    const summary = await seedDemo(prisma, { password: "demo-password-1234" });
    expect(summary.users.every((u) => u.email.endsWith("@kemi.test"))).toBe(
      true,
    );
    const settlement = await prisma.settlement.findUniqueOrThrow({
      where: { contractId: BigInt(summary.completedContractId) },
    });
    expect(Number(settlement.payoutKrw)).toBe(180_000);
    expect(await prisma.review.count()).toBe(2);
    await expect(
      seedDemo(prisma, { password: "demo-password-1234" }),
    ).rejects.toBeInstanceOf(SeedAlreadyAppliedError);
  });
});
