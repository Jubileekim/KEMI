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
    // 운영 DB에서만 허용되는 1회성 옵션은 기존 사용자 공존 여부 검사에만 예외를 준다.
    await assertSeedDatabase(prisma, { allowExistingUsers: true });
  });
});

describe("실사용자와 함께 쓰는 DB에 시연 데이터 넣기 (sharedDatabase)", () => {
  async function realCreator() {
    const user = await prisma.user.create({
      data: { email: "real@example.com", name: "실제 제작자", role: "CREATOR" },
    });
    await prisma.creatorProfile.create({
      data: {
        userId: user.id,
        introduction: "실제 제작자 소개",
        niche: "LIFESTYLE",
        isAvailable: false,
      },
    });
    return user.id;
  }
  const snapshot = (userId: bigint) =>
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { creatorProfile: true },
    });

  it("실사용자와 기존 시연 프로필을 바꾸지 않고, 작업물을 공개하지 않으며, 다시 실행해도 같다", async () => {
    const realId = await realCreator();
    const real = await snapshot(realId);
    // 이전 실행에서 시드가 만든 계정을 누군가 고쳐 둔 상태
    const demo = await prisma.user.create({
      data: {
        email: "demo-creator@kemi.test",
        name: "[시연] 박편집",
        role: "CREATOR",
      },
    });
    await prisma.creatorProfile.create({
      data: {
        userId: demo.id,
        introduction: "직접 고친 소개",
        niche: "FOOD",
        isAvailable: false,
      },
    });

    const summary = await seedDemo(prisma, {
      password: PASSWORD,
      sharedDatabase: true,
    });
    expect(await snapshot(realId)).toEqual(real);
    const kept = await prisma.creatorProfile.findUniqueOrThrow({
      where: { userId: demo.id },
    });
    expect(kept).toMatchObject({
      introduction: "직접 고친 소개",
      niche: "FOOD",
      isAvailable: false,
    });
    expect(await prisma.portfolio.count({ where: { status: "PUBLIC" } })).toBe(
      0,
    );

    const before = await counts();
    expect(
      await seedDemo(prisma, { password: PASSWORD, sharedDatabase: true }),
    ).toEqual(summary);
    expect(await counts()).toEqual(before);
    expect(await snapshot(realId)).toEqual(real);
  });

  it("시드가 만들지 않은 같은 이메일 계정이 있으면 아무것도 쓰지 않고 멈춘다", async () => {
    await realCreator();
    await prisma.user.create({
      data: {
        email: "demo-client2@kemi.test",
        name: "직접 만든 시연 계정",
        role: "CLIENT",
      },
    });
    const before = await counts();
    await expect(
      seedDemo(prisma, { password: PASSWORD, sharedDatabase: true }),
    ).rejects.toBeInstanceOf(SeedTargetError);
    expect(await counts()).toEqual(before);
  });

  it.each([
    [
      "서비스를 내려 둔 경우",
      async (creatorId: bigint) => {
        await prisma.creatorProfile.update({
          where: { userId: creatorId },
          data: { serviceStatus: "PRIVATE" },
        });
      },
    ],
    [
      "다른 패키지를 대표로 정한 경우",
      async (creatorId: bigint) => {
        await prisma.servicePackage.updateMany({
          where: { creatorId },
          data: { isRepresentative: false },
        });
        await prisma.servicePackage.create({
          data: {
            creatorId,
            title: "직접 만든 대표 패키지",
            description: "직접 만든 패키지입니다.",
            purpose: "CHILD_FAMILY",
            priceKrw: 100_000,
            deliveryDays: 3,
            revisionCount: 1,
            includes: ["영상 1편"],
            status: "PUBLIC",
            isRepresentative: true,
          },
        });
      },
    ],
    [
      "시연 패키지를 비공개로 돌린 경우",
      async (creatorId: bigint) => {
        await prisma.servicePackage.updateMany({
          where: { creatorId, title: "돌잔치 성장영상 기본" },
          data: { status: "PRIVATE", isRepresentative: false },
        });
      },
    ],
  ])(
    "시드가 만든 제작자의 %s 되돌리지 않고 쓰기 전에 멈춘다",
    async (_label, change) => {
      await realCreator();
      await seedDemo(prisma, { password: PASSWORD, sharedDatabase: true });
      const demo = await prisma.user.findUniqueOrThrow({
        where: { email: "demo-creator@kemi.test" },
      });
      await change(demo.id);
      const before = await counts();
      const profile = await prisma.creatorProfile.findUniqueOrThrow({
        where: { userId: demo.id },
      });
      await expect(
        seedDemo(prisma, { password: PASSWORD, sharedDatabase: true }),
      ).rejects.toBeInstanceOf(SeedTargetError);
      expect(await counts()).toEqual(before);
      expect(
        await prisma.creatorProfile.findUniqueOrThrow({
          where: { userId: demo.id },
        }),
      ).toEqual(profile);
    },
  );
});
