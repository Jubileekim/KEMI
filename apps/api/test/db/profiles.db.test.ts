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

// 거부해야 하는 javascript: 주소. 그대로 쓰면 ESLint no-script-url에 걸려 이어 붙인다.
const SCRIPT_URL = ["javascript", "alert(1)"].join(":");

async function signup(role: "CLIENT" | "CREATOR") {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      email: `${role.toLowerCase()}@example.com`,
      password: "correct-horse-battery",
      name: "테스트",
      role,
    });
  expect(res.status).toBe(201);
  return {
    accessToken: String(res.body.accessToken),
    userId: BigInt(String(res.body.user.id)),
  };
}

function getProfile(accessToken: string) {
  return request(app)
    .get("/api/profiles/me")
    .set("Authorization", `Bearer ${accessToken}`);
}

function patchProfile(accessToken: string, body: object) {
  return request(app)
    .patch("/api/profiles/me")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("프로필 접근 권한", () => {
  it("토큰이 없으면 조회·수정 모두 401", async () => {
    expect((await request(app).get("/api/profiles/me")).status).toBe(401);
    const res = await request(app)
      .patch("/api/profiles/me")
      .send({ brandName: "KEMI" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("관리자 계정은 403", async () => {
    const { accessToken, userId } = await signup("CLIENT");
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" },
    });

    expect((await getProfile(accessToken)).status).toBe(403);
    const res = await patchProfile(accessToken, { name: "관리자" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // 상태가 바뀌기 전에 발급된 Access 토큰(아직 만료 전)으로도 조회·수정할 수 없어야 한다.
  it.each([
    ["CLIENT", "RESTRICTED", { brandName: "바뀐 이름" }],
    ["CLIENT", "WITHDRAWN", { brandName: "바뀐 이름" }],
    ["CREATOR", "RESTRICTED", { introduction: "바뀐 소개" }],
    ["CREATOR", "WITHDRAWN", { introduction: "바뀐 소개" }],
  ] as const)(
    "%s 회원이 %s가 되면 기존 토큰으로 조회·수정 모두 403이고 저장된 값이 그대로다",
    async (role, status, change) => {
      const { accessToken, userId } = await signup(role);
      const saved = await patchProfile(accessToken, {
        name: "원래 이름",
        introduction: "원래 소개",
      });
      expect(saved.status).toBe(200);
      await prisma.user.update({ where: { id: userId }, data: { status } });

      const read = await getProfile(accessToken);
      const write = await patchProfile(accessToken, {
        ...change,
        name: "바뀐 이름",
      });

      expect(read.status).toBe(403);
      expect(read.body.error.code).toBe("FORBIDDEN");
      expect(read.body.profile).toBeUndefined();
      expect(write.status).toBe(403);
      expect(write.body.error.code).toBe("FORBIDDEN");
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(user.name).toBe("원래 이름");
      const profile =
        role === "CLIENT"
          ? await prisma.clientProfile.findUniqueOrThrow({ where: { userId } })
          : await prisma.creatorProfile.findUniqueOrThrow({
              where: { userId },
            });
      expect(profile.introduction).toBe("원래 소개");
      if ("brandName" in profile) expect(profile.brandName).toBeNull();
    },
  );
});

describe("의뢰인 프로필 (PROFILE-01)", () => {
  it("저장 전에는 가입 이름과 빈 프로필을 돌려주고, 행을 만들지 않는다", async () => {
    const { accessToken } = await signup("CLIENT");

    const res = await getProfile(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      name: "테스트",
      profile: {
        type: "CLIENT",
        brandName: null,
        introduction: null,
        industry: null,
        websiteUrl: null,
        socialUrl: null,
      },
    });
    expect(await prisma.clientProfile.count()).toBe(0);
  });

  it("보낸 항목만 바꾸고, 앞뒤 공백을 지우며, 빈 값은 null로 저장한다", async () => {
    const { accessToken } = await signup("CLIENT");

    const first = await patchProfile(accessToken, {
      brandName: "  KEMI 코스메틱  ",
      industry: "BEAUTY",
      websiteUrl: "https://kemi.example.com",
    });
    expect(first.status).toBe(200);
    expect(first.body.profile).toMatchObject({
      brandName: "KEMI 코스메틱",
      industry: "BEAUTY",
      websiteUrl: "https://kemi.example.com",
    });

    const second = await patchProfile(accessToken, {
      introduction: "소개",
      websiteUrl: "",
    });
    expect(second.status).toBe(200);
    expect(second.body.profile).toEqual({
      type: "CLIENT",
      brandName: "KEMI 코스메틱",
      introduction: "소개",
      industry: "BEAUTY",
      websiteUrl: null,
      socialUrl: null,
    });
    expect((await getProfile(accessToken)).body).toEqual(second.body);
  });

  it("null을 보내면 저장된 선택 항목을 지운다", async () => {
    const { accessToken } = await signup("CLIENT");
    await patchProfile(accessToken, {
      brandName: "KEMI",
      industry: "BEAUTY",
      socialUrl: "https://sns.example.com/kemi",
    });

    const res = await patchProfile(accessToken, {
      brandName: null,
      industry: null,
      socialUrl: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      brandName: null,
      industry: null,
      socialUrl: null,
    });
  });

  it("브랜드 정보를 비워 보내도 오류 없이 저장된다", async () => {
    const { accessToken, userId } = await signup("CLIENT");

    const res = await patchProfile(accessToken, {
      brandName: "   ",
      introduction: "",
    });

    expect(res.status).toBe(200);
    const row = await prisma.clientProfile.findUniqueOrThrow({
      where: { userId },
    });
    expect(row.brandName).toBeNull();
    expect(row.introduction).toBeNull();
  });

  it.each([
    ["스크립트 주소", { websiteUrl: SCRIPT_URL }],
    ["http(s)가 아닌 주소", { socialUrl: "ftp://example.com" }],
    ["주소가 아닌 값", { websiteUrl: "https://" }],
    ["없는 분야", { industry: "CAR" }],
    ["크리에이터 항목", { niche: "BEAUTY" }],
    ["공개 상태", { serviceStatus: "PUBLIC" }],
    ["너무 긴 브랜드명", { brandName: "가".repeat(51) }],
    ["분야에 빈 문자열", { industry: "" }],
    ["이름에 null", { name: null }],
    ["빈 이름", { name: "  " }],
  ])("%s는 400이고 저장되지 않는다", async (_label, body) => {
    const { accessToken } = await signup("CLIENT");

    const res = await patchProfile(accessToken, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(await prisma.clientProfile.count()).toBe(0);
  });

  it("name을 보내면 회원 표시 이름이 바뀐다", async () => {
    const { accessToken, userId } = await signup("CLIENT");

    const res = await patchProfile(accessToken, { name: "  새 이름 " });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("새 이름");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.name).toBe("새 이름");
  });

  it("잘못된 name이면 다른 항목도 저장되지 않는다", async () => {
    const { accessToken, userId } = await signup("CLIENT");

    const res = await patchProfile(accessToken, {
      name: "가",
      brandName: "KEMI",
    });

    expect(res.status).toBe(400);
    expect(await prisma.clientProfile.count()).toBe(0);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.name).toBe("테스트");
  });
});

describe("크리에이터 프로필 (PROFILE-02)", () => {
  it("저장 전에는 비공개 초안 기본값을 돌려준다", async () => {
    const { accessToken } = await signup("CREATOR");

    const res = await getProfile(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual({
      type: "CREATOR",
      introduction: null,
      niche: null,
      contentStyles: [],
      productionRoles: [],
      workMethod: null,
      serviceStatus: "DRAFT",
      isAvailable: false,
      availableFrom: null,
    });
  });

  it("미완성 상태로 저장되고, 저장해도 공개되지 않는다", async () => {
    const { accessToken, userId } = await signup("CREATOR");

    const res = await patchProfile(accessToken, {
      introduction: "뷰티 숏폼 크리에이터",
      contentStyles: ["BRIGHT", "MODERN"],
      productionRoles: ["ON_CAMERA", "EDITING"],
      isAvailable: true,
      availableFrom: "2026-11-01",
    });

    expect(res.status).toBe(200);
    expect(res.body.profile).toEqual({
      type: "CREATOR",
      introduction: "뷰티 숏폼 크리에이터",
      niche: null,
      contentStyles: ["BRIGHT", "MODERN"],
      productionRoles: ["ON_CAMERA", "EDITING"],
      workMethod: null,
      serviceStatus: "DRAFT",
      isAvailable: true,
      availableFrom: "2026-11-01",
    });
    const row = await prisma.creatorProfile.findUniqueOrThrow({
      where: { userId },
    });
    expect(row.serviceStatus).toBe("DRAFT");
  });

  it("목록을 빈 배열로, 날짜를 null로 되돌릴 수 있다", async () => {
    const { accessToken } = await signup("CREATOR");
    await patchProfile(accessToken, {
      contentStyles: ["BRIGHT"],
      availableFrom: "2026-11-01",
    });

    const res = await patchProfile(accessToken, {
      contentStyles: [],
      availableFrom: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      contentStyles: [],
      availableFrom: null,
    });
  });

  it("공개 상태를 이미 바꾼 프로필도 저장으로 상태가 바뀌지 않는다", async () => {
    const { accessToken, userId } = await signup("CREATOR");
    await prisma.creatorProfile.create({
      data: { userId, serviceStatus: "PUBLIC" },
    });

    const res = await patchProfile(accessToken, { introduction: "수정" });

    expect(res.status).toBe(200);
    expect(res.body.profile.serviceStatus).toBe("PUBLIC");
  });

  it.each([
    ["공개 상태", { serviceStatus: "PUBLIC" }],
    ["의뢰인 항목", { brandName: "KEMI" }],
    ["중복 선택", { contentStyles: ["BRIGHT", "BRIGHT"] }],
    ["없는 스타일", { contentStyles: ["DARK"] }],
    ["없는 제작 역할", { productionRoles: ["DIRECTING"] }],
    ["날짜 형식이 아닌 값", { availableFrom: "2026-13-01" }],
    ["목록 대신 null", { productionRoles: null }],
    ["작업 가능 여부에 null", { isAvailable: null }],
    ["날짜에 빈 문자열", { availableFrom: "" }],
    ["분야에 빈 문자열", { niche: "" }],
  ])("%s는 400이고 저장되지 않는다", async (_label, body) => {
    const { accessToken } = await signup("CREATOR");

    const res = await patchProfile(accessToken, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(await prisma.creatorProfile.count()).toBe(0);
  });
});

describe("프로필 DB 제약", () => {
  it("허용하지 않은 값은 API를 거치지 않아도 DB가 거부한다", async () => {
    const { userId } = await signup("CREATOR");

    await expect(
      prisma.creatorProfile.create({
        data: { userId, contentStyles: ["DARK"] },
      }),
    ).rejects.toThrow(/creator_profiles_content_styles_check/);
    await expect(
      prisma.$executeRaw`INSERT INTO creator_profiles (user_id, content_styles, updated_at)
        VALUES (${userId}, NULL, now())`,
    ).rejects.toThrow(/creator_profiles_content_styles_check/);
  });
});
