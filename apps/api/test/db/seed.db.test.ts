import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { seedDemo } from "../../src/seed/seed.js";
import { assertSeedDatabase, SeedTargetError } from "../../src/seed/target.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

const PASSWORD = "demo-password-1234";

// 시드가 만드는 행 수(재실행·부분 실패 비교용)
async function counts() {
  const [
    users,
    projects,
    workRequests,
    contracts,
    payments,
    materials,
    deliverables,
    revisions,
    reviews,
    settlements,
    files,
    packages,
    portfolios,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.workRequest.count(),
    prisma.contract.count(),
    prisma.payment.count(),
    prisma.productionMaterial.count(),
    prisma.deliverable.count(),
    prisma.revisionRequest.count(),
    prisma.review.count(),
    prisma.settlement.count(),
    prisma.file.count(),
    prisma.servicePackage.count(),
    prisma.portfolio.count(),
  ]);
  return {
    users,
    projects,
    workRequests,
    contracts,
    payments,
    materials,
    deliverables,
    revisions,
    reviews,
    settlements,
    files,
    packages,
    portfolios,
  };
}

describe("시연 데이터 (단계 8)", () => {
  it("실제 서비스 흐름으로 완료 거래까지 만들고, 다시 실행해도 바뀌지 않는다", async () => {
    const summary = await seedDemo(prisma, { password: PASSWORD });
    expect(summary.users.every((u) => u.email.endsWith("@kemi.test"))).toBe(
      true,
    );
    const settlement = await prisma.settlement.findUniqueOrThrow({
      where: { contractId: BigInt(summary.completedContractId) },
    });
    expect(Number(settlement.payoutKrw)).toBe(180_000);
    expect(await prisma.review.count()).toBe(2);

    const before = await counts();
    const again = await seedDemo(prisma, { password: PASSWORD });
    expect(again).toEqual(summary);
    expect(await counts()).toEqual(before);
  });

  it.each([
    "users",
    "creators",
    "discussion",
    "contract",
    "production",
    "delivery",
  ])(
    "%s 단계 뒤에 실패해도 다시 실행하면 남은 단계만 이어서 끝낸다",
    async (failAfter) => {
      await expect(
        seedDemo(prisma, {
          password: PASSWORD,
          onStep: (name) => {
            if (name === failAfter) throw new Error(`중단: ${name}`);
          },
        }),
      ).rejects.toThrow(`중단: ${failAfter}`);

      const summary = await seedDemo(prisma, { password: PASSWORD });
      const completed = await counts();
      await resetDatabase(prisma);
      await seedDemo(prisma, { password: PASSWORD });
      // 끊겼다 이어서 만든 결과가 한 번에 만든 결과와 같다.
      expect(completed).toEqual(await counts());
      expect(summary.users).toHaveLength(4);
    },
  );

  it("시연 계정이 아닌 사용자가 있는 DB에는 넣지 않는다", async () => {
    await assertSeedDatabase(prisma);
    await prisma.user.create({
      data: { email: "real@example.com", name: "실제 사용자", role: "CLIENT" },
    });
    await expect(assertSeedDatabase(prisma)).rejects.toBeInstanceOf(
      SeedTargetError,
    );
  });
  it("PM이 명시 승인한 시연 데이터는 기존 실사용자를 수정하지 않고 함께 존재한다", async () => {
    const real = await prisma.user.create({
      data: { email: "real@example.com", name: "실제 사용자", role: "CLIENT" },
    });
    // 기본 차단 유지. 운영 DB 대상 확인을 통과한 1회성 호출만 실사용자 공존 허용.
    await expect(assertSeedDatabase(prisma)).rejects.toBeInstanceOf(
      SeedTargetError,
    );
    await assertSeedDatabase(prisma, { allowExistingUsers: true });
    const summary = await seedDemo(prisma, { password: PASSWORD });
    expect(summary.users).toHaveLength(4);
    expect(await prisma.user.count()).toBe(5);
    expect(
      await prisma.user.findUnique({ where: { id: real.id } }),
    ).toMatchObject({ email: real.email, name: real.name, role: real.role });
    // 시연 성공결제 기록이 운영 DB에 1건 추가되는 위험을 명시적으로 검증한다.
    expect(
      await prisma.payment.count({ where: { status: "SUCCEEDED" } }),
    ).toBe(1);
    const repeated = await counts();
    await seedDemo(prisma, { password: PASSWORD });
    expect(await counts()).toEqual(repeated);
  });
});
