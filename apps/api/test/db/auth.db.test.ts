import request, { type Response } from "supertest";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REFRESH_COOKIE_NAME } from "../../src/auth/auth.router.js";
import { createTestApp, TEST_APP_ORIGIN } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();
// 동시 갱신 테스트에서 "다른 요청이 잠금을 기다리는 중"인지 확인하는 별도 연결
const monitor = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
  await monitor.$disconnect();
});

// 요청 제한 카운터가 테스트 사이에 이어지지 않도록 테스트마다 앱을 새로 만든다.
let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({ prisma });
});
const PASSWORD = "correct-horse-battery";

function refreshCookieOf(res: Response): string | undefined {
  const header: unknown = res.headers["set-cookie"];
  if (!Array.isArray(header)) return undefined;
  const cookie = header.find(
    (value): value is string =>
      typeof value === "string" && value.startsWith(`${REFRESH_COOKIE_NAME}=`),
  );
  return cookie?.split(";")[0];
}

function signup(email = "client@example.com", role = "CLIENT") {
  return request(app)
    .post("/api/auth/signup")
    .send({ email, password: PASSWORD, name: "테스트", role });
}

async function login(email = "client@example.com") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  const cookie = refreshCookieOf(res);
  if (!cookie) throw new Error("refresh cookie missing");
  return { cookie, accessToken: String(res.body.accessToken) };
}

function refresh(cookie: string, target = app) {
  return request(target)
    .post("/api/auth/refresh")
    .set("Origin", TEST_APP_ORIGIN)
    .set("Cookie", cookie);
}

function me(accessToken: string) {
  return request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${accessToken}`);
}

// 가장 최근 로그인 세션 (회원가입도 로그인 상태를 만들어 세션이 하나 더 있다)
async function latestSession() {
  return prisma.authSession.findFirstOrThrow({
    orderBy: { id: "desc" },
    include: { refreshTokens: { orderBy: { id: "asc" } } },
  });
}

describe("회원가입", () => {
  it("201과 문자열 ID를 돌려주고, 비밀번호는 bcrypt(cost 12) 해시로만 저장한다", async () => {
    const res = await signup();

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({
      id: expect.stringMatching(/^\d+$/),
      email: "client@example.com",
      name: "테스트",
      role: "CLIENT",
      status: "ACTIVE",
    });
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(res.body)).not.toContain("$2b$");

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "client@example.com" },
    });
    expect(user.passwordHash).toMatch(/^\$2b\$12\$/);

    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/auth");
  });

  it("대소문자·공백만 다른 같은 이메일은 409 EMAIL_ALREADY_EXISTS", async () => {
    expect((await signup("client@example.com")).status).toBe(201);
    const res = await signup("  Client@EXAMPLE.com ");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("ADMIN 역할로는 가입할 수 없다 (400)", async () => {
    const res = await signup("admin@example.com", "ADMIN");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("로그인", () => {
  beforeEach(async () => {
    await signup();
  });

  it("정상 로그인은 200, Access 토큰과 Refresh 쿠키를 발급한다", async () => {
    const { accessToken } = await login();
    const res = await me(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toMatch(/^\d+$/);
  });

  it("잘못된 비밀번호·없는 이메일·소셜 전용 계정은 모두 같은 401 응답", async () => {
    await prisma.user.create({
      data: { email: "social@example.com", name: "소셜", role: "CLIENT" },
    });
    const attempts = [
      { email: "client@example.com", password: "wrong-password" },
      { email: "nobody@example.com", password: PASSWORD },
      { email: "social@example.com", password: PASSWORD },
    ];

    const bodies = await Promise.all(
      attempts.map(async (body) => {
        const res = await request(app).post("/api/auth/login").send(body);
        expect(res.status).toBe(401);
        return res.body;
      }),
    );

    expect(bodies[0].error.code).toBe("INVALID_CREDENTIALS");
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });

  it("이용 제한된 회원의 Access 토큰은 403", async () => {
    const { accessToken } = await login();
    await prisma.user.updateMany({ data: { status: "RESTRICTED" } });

    const res = await me(accessToken);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Refresh 토큰 회전", () => {
  beforeEach(async () => {
    await signup();
  });

  it("정상 회전: 새 쿠키 발급, 이전 토큰은 사용 처리된 채 보존, 세션 ID와 기존 Access 토큰은 유지", async () => {
    const first = await login();
    const res = await refresh(first.cookie);

    expect(res.status).toBe(200);
    const nextCookie = refreshCookieOf(res);
    expect(nextCookie).toBeDefined();
    expect(nextCookie).not.toBe(first.cookie);

    const session = await latestSession();
    const [oldToken, newToken] = session.refreshTokens;
    expect(session.refreshTokens).toHaveLength(2);
    expect(oldToken?.usedAt).not.toBeNull();
    expect(oldToken?.replacedById).toBe(newToken?.id);
    expect(newToken?.usedAt).toBeNull();
    expect((await me(first.accessToken)).status).toBe(200);
  });

  it("회전해도 세션 최대 수명은 늘어나지 않고, 만료된 세션의 갱신은 401", async () => {
    const { cookie } = await login();
    const before = await latestSession();

    const res = await refresh(cookie);
    expect(res.status).toBe(200);
    expect((await latestSession()).expiresAt).toEqual(before.expiresAt);

    await prisma.authSession.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const nextCookie = refreshCookieOf(res);
    if (!nextCookie) throw new Error("refresh cookie missing");
    const expired = await refresh(nextCookie);
    expect(expired.status).toBe(401);
    expect(expired.body.error.code).toBe("SESSION_REVOKED");
    expect(refreshCookieOf(expired)).toBe(`${REFRESH_COOKIE_NAME}=`);
  });

  it("사용한 지 10초가 지난 토큰을 다시 쓰면 재사용으로 보고 세션 전체를 폐기한다", async () => {
    const first = await login();
    const rotated = await refresh(first.cookie);
    const latestCookie = refreshCookieOf(rotated);
    if (!latestCookie) throw new Error("refresh cookie missing");
    const latestAccessToken = String(rotated.body.accessToken);
    await prisma.authRefreshToken.updateMany({
      where: { usedAt: { not: null } },
      data: { usedAt: new Date(Date.now() - 11_000) },
    });

    const reused = await refresh(first.cookie);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe("SESSION_REVOKED");

    const session = await latestSession();
    expect(session.revokeReason).toBe("REUSE_DETECTED");
    expect((await refresh(latestCookie)).status).toBe(401);
    expect((await me(latestAccessToken)).status).toBe(401);
  });

  it("Origin이 프론트엔드 주소가 아니면 403", async () => {
    const { cookie } = await login();
    const noOrigin = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie);
    const otherOrigin = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", "https://evil.example.com")
      .set("Cookie", cookie);

    expect(noOrigin.status).toBe(403);
    expect(otherOrigin.status).toBe(403);
  });
});

describe("회전 트랜잭션 롤백", () => {
  // 세션 갱신·새 토큰 저장·이전 토큰 사용 처리를 마친 뒤, 커밋 직전에 실패를 일으킨다.
  const failingApp = createTestApp({
    prisma,
    beforeRotationCommit: () => Promise.reject(new Error("중간 실패 재현")),
  });

  beforeEach(async () => {
    await signup();
  });

  it("중간에 실패하면 새 토큰·사용 처리·세션 갱신이 모두 되돌려지고, 같은 토큰으로 다시 갱신할 수 있다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { cookie } = await login();

    const failed = await refresh(cookie, failingApp);
    expect(failed.status).toBe(500);
    expect(refreshCookieOf(failed)).toBeUndefined();

    const session = await latestSession();
    expect(session.lastUsedAt).toBeNull();
    expect(session.refreshTokens).toHaveLength(1);
    expect(session.refreshTokens[0]?.usedAt).toBeNull();
    expect(session.refreshTokens[0]?.replacedById).toBeNull();

    expect((await refresh(cookie)).status).toBe(200);
  });
});

describe("동시 갱신 (같은 토큰의 요청 두 개를 실제로 동시에 보낸다)", () => {
  // 회전 중인 요청이 잠금을 쥔 동안, 다른 요청이 DB에서 잠금을 기다리는지 확인한다.
  async function otherRequestIsWaitingForLock(): Promise<boolean> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop -- 기다리는 요청이 보일 때까지 순서대로 확인한다
      const rows = await monitor.$queryRaw<{ waiting: bigint }[]>`
        SELECT count(*) AS waiting FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if ((rows[0]?.waiting ?? 0n) > 0n) return true;
      // eslint-disable-next-line no-await-in-loop -- 위와 같은 이유
      await delay(50);
    }
    return false;
  }

  const overlapped: boolean[] = [];
  const concurrentApp = createTestApp({
    prisma,
    beforeRotationCommit: async () => {
      overlapped.push(await otherRequestIsWaitingForLock());
    },
  });

  beforeEach(async () => {
    overlapped.length = 0;
    await signup();
  });

  it.each([1, 2, 3, 4, 5])(
    "%i회차: 하나만 200, 다른 하나는 새 토큰 없이 409, 세션은 유지된다",
    async () => {
      const { cookie } = await login();

      const responses = await Promise.all([
        refresh(cookie, concurrentApp),
        refresh(cookie, concurrentApp),
      ]);

      expect(overlapped).toEqual([true]);
      const statuses = responses.map((res) => res.status).sort();
      expect(statuses).toEqual([200, 409]);
      const winner = responses.find((res) => res.status === 200);
      const loser = responses.find((res) => res.status === 409);
      if (!winner || !loser) throw new Error("unexpected responses");
      expect(loser.body.error).toEqual({
        code: "REFRESH_RACE",
        message: expect.any(String),
        details: { retryAfterMs: 500 },
      });
      expect(refreshCookieOf(loser)).toBeUndefined();

      const session = await latestSession();
      expect(session.revokedAt).toBeNull();
      expect(session.refreshTokens).toHaveLength(2);

      // 409를 받은 쪽이 이전 토큰으로 다시 보내면 또 409(새 토큰 없음), 새 쿠키로 보내면 200
      expect((await refresh(cookie)).status).toBe(409);
      const winnerCookie = refreshCookieOf(winner);
      if (!winnerCookie) throw new Error("refresh cookie missing");
      expect((await refresh(winnerCookie)).status).toBe(200);
    },
  );
});

describe("로그아웃", () => {
  beforeEach(async () => {
    await signup();
  });

  it("세션을 폐기하고, 이후 Refresh와 기존 Access 토큰 모두 401", async () => {
    const { cookie, accessToken } = await login();

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", cookie);
    expect(res.status).toBe(204);
    expect(refreshCookieOf(res)).toBe(`${REFRESH_COOKIE_NAME}=`);

    expect((await latestSession()).revokeReason).toBe("LOGOUT");
    expect((await refresh(cookie)).status).toBe(401);
    const meRes = await me(accessToken);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe("SESSION_REVOKED");
  });
});
