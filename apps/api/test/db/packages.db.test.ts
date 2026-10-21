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

const PACKAGE = {
  title: "숏폼 리뷰 영상",
  description: "제품 사용 후기를 담은 세로 영상",
  basePrice: 300_000,
  specification: {
    videoCount: 1,
    lengthSeconds: 30,
    aspectRatio: "9:16",
    resolution: "1080p",
    format: "MP4",
  },
  includedScope: "기획, 촬영, 편집",
  excludedScope: "",
  requiredMaterials: ["제품 2개"],
  deliveryDays: 7,
  revisionLimit: 2,
  revisionScope: "자막·컷 순서",
  sourceDelivery: { provided: false, note: null },
  usageTerms: { note: null },
};

async function signup(
  role: "CLIENT" | "CREATOR",
  email = `${role}@example.com`,
) {
  const res = await request(app).post("/api/auth/signup").send({
    email: email.toLowerCase(),
    password: "correct-horse-battery",
    name: "테스트",
    role,
  });
  expect(res.status).toBe(201);
  return {
    token: String(res.body.accessToken),
    userId: BigInt(String(res.body.user.id)),
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

function createPackage(token: string, body: object = {}) {
  return request(app)
    .post("/api/packages/me")
    .set(auth(token))
    .send({ ...PACKAGE, ...body });
}

function updatePackage(token: string, id: string, body: object) {
  return request(app)
    .patch(`/api/packages/me/${id}`)
    .set(auth(token))
    .send(body);
}

function deletePackage(token: string, id: string) {
  return request(app).delete(`/api/packages/me/${id}`).set(auth(token));
}

function setRepresentative(token: string, id: string) {
  return request(app)
    .put(`/api/packages/me/${id}/representative`)
    .set(auth(token));
}

function setServiceStatus(token: string, status: string) {
  return request(app)
    .put("/api/profiles/me/service-status")
    .set(auth(token))
    .send({ status });
}

// 공개 조건(D01 제안)에 필요한 프로필 항목을 채운다.
function completeProfile(token: string) {
  return request(app)
    .patch("/api/profiles/me")
    .set(auth(token))
    .send({
      introduction: "뷰티 숏폼 크리에이터",
      niche: "BEAUTY",
      contentStyles: ["BRIGHT"],
      productionRoles: ["ON_CAMERA"],
    });
}

async function createdId(res: request.Response): Promise<string> {
  expect(res.status).toBe(201);
  const created = res.body.packages.at(-1);
  return String(created.id);
}

// 어떤 순서로 실행돼도 지켜져야 하는 규칙
// 1) 삭제되지 않은 대표는 최대 1개이고, 대표는 공개 패키지다
// 2) 공개 패키지가 있으면 대표가 정확히 1개 있다
// 3) 서비스가 PUBLIC이면 공개 대표 패키지가 있다
// 4) 삭제된 패키지는 공개·대표가 아니다
async function expectConsistent(userId: bigint) {
  const packages = await prisma.servicePackage.findMany({
    where: { creatorId: userId },
  });
  const live = packages.filter((row) => row.deletedAt === null);
  const representatives = live.filter((row) => row.isRepresentative);
  const publicCount = live.filter((row) => row.isPublic).length;
  const profile = await prisma.creatorProfile.findUnique({ where: { userId } });

  expect(representatives.length).toBeLessThanOrEqual(1);
  expect(representatives.every((row) => row.isPublic)).toBe(true);
  expect(representatives.length).toBe(publicCount > 0 ? 1 : 0);
  if (profile?.serviceStatus === "PUBLIC") {
    expect(representatives).toHaveLength(1);
  }
  expect(
    packages
      .filter((row) => row.deletedAt !== null)
      .every((row) => !row.isPublic && !row.isRepresentative),
  ).toBe(true);
  return { live, representatives, serviceStatus: profile?.serviceStatus };
}

describe("패키지 권한", () => {
  it("로그인하지 않으면 401, 의뢰인은 403", async () => {
    expect((await request(app).get("/api/packages/me")).status).toBe(401);
    const { token } = await signup("CLIENT");
    const res = await createPackage(token);
    expect(res.status).toBe(403);
    expect(await prisma.servicePackage.count()).toBe(0);
  });

  it("다른 크리에이터의 패키지는 수정·삭제·대표 지정할 수 없다 (404)", async () => {
    const owner = await signup("CREATOR", "owner@example.com");
    const other = await signup("CREATOR", "other@example.com");
    const id = await createdId(
      await createPackage(owner.token, { isPublic: true }),
    );

    expect(
      (await updatePackage(other.token, id, { title: "가로채기" })).status,
    ).toBe(404);
    expect((await deletePackage(other.token, id)).status).toBe(404);
    expect((await setRepresentative(other.token, id)).status).toBe(404);
    const row = await prisma.servicePackage.findUniqueOrThrow({
      where: { id: BigInt(id) },
    });
    expect(row.title).toBe(PACKAGE.title);
    expect(row.deletedAt).toBeNull();
  });
});

describe("패키지 만들기·수정 (PACK-01·02)", () => {
  it("프로필을 저장하기 전에도 만들 수 있고, 기본은 비공개다", async () => {
    const { token, userId } = await signup("CREATOR");

    const res = await createPackage(token);

    expect(res.status).toBe(201);
    expect(res.body.serviceStatus).toBe("DRAFT");
    expect(res.body.packages).toMatchObject([
      {
        title: PACKAGE.title,
        basePrice: 300_000,
        currency: "KRW",
        isPublic: false,
        isRepresentative: false,
        requiredMaterials: ["제품 2개"],
        sourceDelivery: { provided: false, note: null },
      },
    ]);
    await expectConsistent(userId);
  });

  it("첫 공개 패키지는 자동으로 대표가 되고, 다음 공개 패키지는 대표가 아니다", async () => {
    const { token, userId } = await signup("CREATOR");

    await createPackage(token, { isPublic: true });
    const res = await createPackage(token, {
      isPublic: true,
      title: "두 번째",
    });

    expect(
      res.body.packages.map(
        (p: { isRepresentative: boolean }) => p.isRepresentative,
      ),
    ).toEqual([true, false]);
    await expectConsistent(userId);
  });

  it("비공개 패키지를 공개하면, 대표가 없을 때만 대표가 된다", async () => {
    const { token, userId } = await signup("CREATOR");
    const id = await createdId(await createPackage(token));

    const res = await updatePackage(token, id, { isPublic: true });

    expect(res.status).toBe(200);
    expect(res.body.packages[0]).toMatchObject({
      isPublic: true,
      isRepresentative: true,
    });
    await expectConsistent(userId);
  });

  it(`패키지는 최대 3개까지 만들 수 있다 (삭제한 패키지는 세지 않음)`, async () => {
    const { token } = await signup("CREATOR");
    const ids = [
      await createdId(await createPackage(token)),
      await createdId(await createPackage(token)),
      await createdId(await createPackage(token)),
    ];

    const fourth = await createPackage(token);
    expect(fourth.status).toBe(409);
    expect(fourth.body.error.code).toBe("PACKAGE_LIMIT_EXCEEDED");

    expect((await deletePackage(token, ids[0] ?? "")).status).toBe(200);
    expect((await createPackage(token)).status).toBe(201);
  });

  it.each([
    ["너무 낮은 금액", { basePrice: 999 }],
    ["너무 높은 금액", { basePrice: 100_000_001 }],
    ["소수 금액", { basePrice: 1000.5 }],
    ["작업 기간 0일", { deliveryDays: 0 }],
    ["수정 횟수 초과", { revisionLimit: 11 }],
    ["모르는 항목", { isRepresentative: true }],
    [
      "규격 수량 없음",
      { specification: { ...PACKAGE.specification, videoCount: 0 } },
    ],
    ["빈 제목", { title: "  " }],
  ])("%s는 400이고 만들지 않는다", async (_label, body) => {
    const { token } = await signup("CREATOR");

    const res = await createPackage(token, body);

    expect(res.status).toBe(400);
    expect(await prisma.servicePackage.count()).toBe(0);
  });

  it("보낸 항목만 바꾸고, 객체 항목은 통째로 바꾼다", async () => {
    const { token } = await signup("CREATOR");
    const id = await createdId(await createPackage(token));

    const res = await updatePackage(token, id, {
      basePrice: 450_000,
      sourceDelivery: { provided: true, note: "원본 영상 전달" },
    });

    expect(res.status).toBe(200);
    expect(res.body.packages[0]).toMatchObject({
      title: PACKAGE.title,
      basePrice: 450_000,
      sourceDelivery: { provided: true, note: "원본 영상 전달" },
      specification: PACKAGE.specification,
    });
  });
});

describe("대표 패키지 (PACK-03)", () => {
  it("대표를 바꾸면 기존 대표는 내려가고, 비공개 패키지는 대표가 될 수 없다", async () => {
    const { token, userId } = await signup("CREATOR");
    const first = await createdId(
      await createPackage(token, { isPublic: true }),
    );
    const second = await createdId(
      await createPackage(token, { isPublic: true }),
    );
    const hidden = await createdId(await createPackage(token));

    const res = await setRepresentative(token, second);
    expect(res.status).toBe(200);
    const { representatives } = await expectConsistent(userId);
    expect(representatives.map((row) => row.id.toString())).toEqual([second]);

    const refused = await setRepresentative(token, hidden);
    expect(refused.status).toBe(409);
    expect(
      (await expectConsistent(userId)).representatives[0]?.id.toString(),
    ).toBe(second);
    expect(first).not.toBe(second);
  });

  it("다른 공개 패키지가 있으면 대표를 비공개·삭제할 수 없다 (먼저 대표를 바꾼다)", async () => {
    const { token, userId } = await signup("CREATOR");
    const representative = await createdId(
      await createPackage(token, { isPublic: true }),
    );
    await createPackage(token, { isPublic: true });

    const hide = await updatePackage(token, representative, {
      isPublic: false,
    });
    const remove = await deletePackage(token, representative);

    expect(hide.status).toBe(409);
    expect(hide.body.error.code).toBe("REPRESENTATIVE_REQUIRED");
    expect(remove.status).toBe(409);
    expect(remove.body.error.code).toBe("REPRESENTATIVE_REQUIRED");
    const { representatives } = await expectConsistent(userId);
    expect(representatives[0]?.id.toString()).toBe(representative);
  });

  it("삭제된 대표 기록은 남아도, 새 대표 지정을 막지 않는다 (부분 UNIQUE 인덱스)", async () => {
    const { token, userId } = await signup("CREATOR");
    const old = await createdId(await createPackage(token, { isPublic: true }));
    expect((await deletePackage(token, old)).status).toBe(200);

    const next = await createdId(
      await createPackage(token, { isPublic: true }),
    );

    const { representatives } = await expectConsistent(userId);
    expect(representatives.map((row) => row.id.toString())).toEqual([next]);
    expect(
      await prisma.servicePackage.count({ where: { creatorId: userId } }),
    ).toBe(2);
  });
});

describe("제작 서비스 공개·비공개 (PROFILE-03·04)", () => {
  it("빠진 프로필 항목과 대표 패키지를 알려주고 공개하지 않는다", async () => {
    const { token, userId } = await signup("CREATOR");
    await createPackage(token);

    const res = await setServiceStatus(token, "PUBLIC");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SERVICE_REQUIREMENTS_MISSING");
    expect(res.body.error.details.missing).toEqual([
      "INTRODUCTION",
      "NICHE",
      "CONTENT_STYLES",
      "PRODUCTION_ROLES",
      "PUBLIC_REPRESENTATIVE_PACKAGE",
    ]);
    const profile = await prisma.creatorProfile.findUniqueOrThrow({
      where: { userId },
    });
    expect(profile.serviceStatus).toBe("DRAFT");
  });

  it("조건을 채우면 공개되고, 비공개로 바꿔도 패키지는 그대로다", async () => {
    const { token, userId } = await signup("CREATOR");
    await completeProfile(token);
    await createPackage(token, { isPublic: true });

    const open = await setServiceStatus(token, "PUBLIC");
    expect(open.status).toBe(200);
    expect(open.body.serviceStatus).toBe("PUBLIC");

    const close = await setServiceStatus(token, "PRIVATE");
    expect(close.status).toBe(200);
    expect(close.body.serviceStatus).toBe("PRIVATE");
    expect(close.body.packages[0]).toMatchObject({
      isPublic: true,
      isRepresentative: true,
    });
    await expectConsistent(userId);
  });

  it("초안(DRAFT) 서비스는 비공개로 바꿀 수 없다", async () => {
    const { token } = await signup("CREATOR");

    const res = await setServiceStatus(token, "PRIVATE");

    expect(res.status).toBe(409);
  });

  it.each([
    [
      "비공개로 바꾸면",
      (token: string, id: string) =>
        updatePackage(token, id, { isPublic: false }),
    ],
    ["삭제하면", (token: string, id: string) => deletePackage(token, id)],
  ])(
    "마지막 공개 패키지를 %s 공개 서비스가 비공개가 된다",
    async (_label, act) => {
      const { token, userId } = await signup("CREATOR");
      await completeProfile(token);
      const id = await createdId(
        await createPackage(token, { isPublic: true }),
      );
      expect((await setServiceStatus(token, "PUBLIC")).status).toBe(200);

      const res = await act(token, id);

      expect(res.status).toBe(200);
      expect(res.body.serviceStatus).toBe("PRIVATE");
      await expectConsistent(userId);
    },
  );

  it("공개 서비스의 공개 패키지만 다른 사람이 볼 수 있다 (대표가 먼저)", async () => {
    const { token, userId } = await signup("CREATOR");
    await completeProfile(token);
    await createPackage(token, { isPublic: true, title: "대표 패키지" });
    const second = await createdId(
      await createPackage(token, { isPublic: true, title: "추가 패키지" }),
    );
    await createPackage(token, { title: "비공개 패키지" });
    const path = `/api/creators/${userId}/packages`;

    expect((await request(app).get(path)).status).toBe(404);
    await setServiceStatus(token, "PUBLIC");
    await setRepresentative(token, second);

    const res = await request(app).get(path);

    expect(res.status).toBe(200);
    expect(res.body.packages.map((p: { title: string }) => p.title)).toEqual([
      "추가 패키지",
      "대표 패키지",
    ]);
    await setServiceStatus(token, "PRIVATE");
    expect((await request(app).get(path)).status).toBe(404);
  });
});

describe("기존 요청·계약 보존", () => {
  it("삭제한 패키지는 행이 남고, 삭제 당시 금액·조건이 그대로다", async () => {
    const { token, userId } = await signup("CREATOR");
    const id = await createdId(await createPackage(token));

    await deletePackage(token, id);

    const row = await prisma.servicePackage.findUniqueOrThrow({
      where: { id: BigInt(id) },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(row.basePrice).toBe(300_000n);
    expect(row.revisionLimit).toBe(2);
    expect((await updatePackage(token, id, { title: "되살리기" })).status).toBe(
      404,
    );
    expect(
      (await request(app).get("/api/packages/me").set(auth(token))).body
        .packages,
    ).toEqual([]);
    await expectConsistent(userId);
  });

  it("DB는 패키지를 참조하는 크리에이터 프로필 삭제를 막는다 (ON DELETE RESTRICT)", async () => {
    const { token, userId } = await signup("CREATOR");
    await createPackage(token);

    await expect(
      prisma.creatorProfile.delete({ where: { userId } }),
    ).rejects.toThrow();
  });
});

describe("DB 제약", () => {
  it("대표 UNIQUE 인덱스는 삭제되지 않은 대표 패키지만 대상으로 한다", async () => {
    const rows = await prisma.$queryRaw<{ definition: string }[]>`
      SELECT pg_get_indexdef('service_packages_one_representative_idx'::regclass) AS definition`;

    expect(rows[0]?.definition).toBe(
      "CREATE UNIQUE INDEX service_packages_one_representative_idx ON public.service_packages USING btree (creator_id) WHERE (is_representative AND (deleted_at IS NULL))",
    );
  });

  it("대표는 삭제되지 않은 패키지 중 하나뿐이고, 공개 패키지여야 한다", async () => {
    const { token, userId } = await signup("CREATOR");
    const a = await createdId(await createPackage(token, { isPublic: true }));
    const b = await createdId(await createPackage(token, { isPublic: true }));
    const hidden = await createdId(await createPackage(token));

    await expect(
      prisma.servicePackage.update({
        where: { id: BigInt(b) },
        data: { isRepresentative: true },
      }),
    ).rejects.toThrow(
      /service_packages_one_representative_idx|Unique constraint/,
    );
    await expect(
      prisma.servicePackage.update({
        where: { id: BigInt(hidden) },
        data: { isRepresentative: true },
      }),
    ).rejects.toThrow(/service_packages_representative_check/);
    await expect(
      prisma.servicePackage.update({
        where: { id: BigInt(a) },
        data: { deletedAt: new Date() },
      }),
    ).rejects.toThrow(/service_packages_(representative|deleted)_check/);
    await expectConsistent(userId);
  });
});

describe("동시 요청", () => {
  // 같은 크리에이터의 변경은 creator_profiles 행 잠금으로 하나씩 실행된다. 어느 순서로 끝나도 규칙이 지켜져야 한다.

  // 경합은 타이밍에 따라 드러나므로 같은 상황을 여러 번 반복한다(각 회차마다 새 크리에이터).
  async function repeat(times: number, round: (n: number) => Promise<void>) {
    await Array.from({ length: times }, (_, n) => n).reduce(
      (previous, n) => previous.then(() => round(n)),
      Promise.resolve(),
    );
  }

  it("패키지를 동시에 만들어도 최대 3개만 생긴다 (5회 반복)", async () => {
    await repeat(5, async (n) => {
      const { token, userId } = await signup(
        "CREATOR",
        `limit${n}@example.com`,
      );
      // 2개를 먼저 만들어 두고, 남은 1자리를 4개 요청이 동시에 다툰다.
      await createPackage(token);
      await createPackage(token);

      const results = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          createPackage(token, { title: `동시 ${i}` }),
        ),
      );

      expect(results.map((res) => res.status).sort()).toEqual([
        201, 409, 409, 409,
      ]);
      const { live } = await expectConsistent(userId);
      expect(live).toHaveLength(3);
    });
  });

  it("두 패키지를 동시에 대표로 지정해도 대표는 하나다", async () => {
    const { token, userId } = await signup("CREATOR");
    await createPackage(token, { isPublic: true });
    const b = await createdId(await createPackage(token, { isPublic: true }));
    const c = await createdId(await createPackage(token, { isPublic: true }));

    const results = await Promise.all([
      setRepresentative(token, b),
      setRepresentative(token, c),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    const { representatives } = await expectConsistent(userId);
    expect([b, c]).toContain(representatives[0]?.id.toString());
  });

  it("서비스 공개와 마지막 공개 패키지 비공개가 겹쳐도, 대표 없이 공개 상태가 되지 않는다", async () => {
    const { token, userId } = await signup("CREATOR");
    await completeProfile(token);
    const id = await createdId(await createPackage(token, { isPublic: true }));

    const [open, hide] = await Promise.all([
      setServiceStatus(token, "PUBLIC"),
      updatePackage(token, id, { isPublic: false }),
    ]);

    expect(hide.status).toBe(200);
    // 공개가 먼저면 200 후 비공개 전환으로 PRIVATE, 늦으면 조건 미충족 409
    expect([200, 409]).toContain(open.status);
    const { serviceStatus } = await expectConsistent(userId);
    expect(serviceStatus).not.toBe("PUBLIC");
  });

  it("대표 비공개와 다른 공개 패키지 삭제가 겹쳐도 규칙이 지켜진다", async () => {
    const { token, userId } = await signup("CREATOR");
    await completeProfile(token);
    const representative = await createdId(
      await createPackage(token, { isPublic: true }),
    );
    const other = await createdId(
      await createPackage(token, { isPublic: true }),
    );
    expect((await setServiceStatus(token, "PUBLIC")).status).toBe(200);

    const [hide, remove] = await Promise.all([
      updatePackage(token, representative, { isPublic: false }),
      deletePackage(token, other),
    ]);

    expect(remove.status).toBe(200);
    // 삭제가 먼저면 대표가 마지막 공개 패키지라 비공개 가능(서비스 PRIVATE), 아니면 409
    expect([200, 409]).toContain(hide.status);
    const { serviceStatus } = await expectConsistent(userId);
    expect(serviceStatus).toBe(hide.status === 200 ? "PRIVATE" : "PUBLIC");
  });

  it("첫 공개 패키지를 동시에 만들어도 대표는 하나다 (5회 반복)", async () => {
    await repeat(5, async (n) => {
      const { token, userId } = await signup(
        "CREATOR",
        `first${n}@example.com`,
      );
      // 프로필 행이 이미 있어야 경합이 잠금만으로 결정된다(처음 만드는 INSERT는 그 자체로 순서를 정한다).
      await completeProfile(token);

      const results = await Promise.all([
        createPackage(token, { isPublic: true, title: "첫째 패키지" }),
        createPackage(token, { isPublic: true, title: "둘째 패키지" }),
      ]);

      expect(results.map((res) => res.status)).toEqual([201, 201]);
      const { representatives } = await expectConsistent(userId);
      expect(representatives).toHaveLength(1);
    });
  });
});
