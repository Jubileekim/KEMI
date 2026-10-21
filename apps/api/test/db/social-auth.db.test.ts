import request, { type Response } from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeJwt, SignJWT } from "jose";
import {
  OAUTH_STATE_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SOCIAL_SIGNUP_COOKIE_NAME,
} from "../../src/auth/auth.router.js";
import { SOCIAL_RATE_LIMITS } from "../../src/auth/rate-limits.js";
import {
  createGoogleProvider,
  type FetchFn,
  type SocialProfile,
  type SocialProvider,
} from "../../src/auth/social/providers.js";
import {
  createTestApp,
  TEST_ACCESS_SECRET,
  TEST_APP_ORIGIN,
} from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// 실제 Google 대신 쓰는 가짜 제공자. 코드 값마다 돌려줄 회원 정보를 정해 둔다.
const profilesByCode = new Map<string, SocialProfile>();
let fetchCalls: { code: string; codeVerifier: string; redirectUri: string }[] =
  [];
const fakeGoogle: SocialProvider = {
  provider: "GOOGLE",
  authorizeUrl: ({ state, codeChallenge, redirectUri }) =>
    `https://provider.test/authorize?${new URLSearchParams({ state, codeChallenge, redirectUri }).toString()}`,
  fetchProfile: async (input) => {
    fetchCalls.push(input);
    const profile = profilesByCode.get(input.code);
    if (!profile) throw new Error("invalid code");
    return profile;
  },
};

let app = createTestApp({ prisma, socialProviders: { google: fakeGoogle } });

beforeEach(async () => {
  await resetDatabase(prisma);
  profilesByCode.clear();
  fetchCalls = [];
  app = createTestApp({ prisma, socialProviders: { google: fakeGoogle } });
});

function cookieOf(res: Response, name: string): string | undefined {
  const header: unknown = res.headers["set-cookie"];
  if (!Array.isArray(header)) return undefined;
  const cookie = header.find(
    (value): value is string =>
      typeof value === "string" && value.startsWith(`${name}=`),
  );
  return cookie;
}

// "name=value; Path=..." → "name=value" (값이 비어 있으면 삭제된 쿠키)
function pairOf(res: Response, name: string): string | undefined {
  const pair = cookieOf(res, name)?.split(";")[0];
  return pair === `${name}=` ? undefined : pair;
}

function appRedirectOf(res: Response): URLSearchParams {
  expect(res.status).toBe(302);
  const location = new URL(String(res.headers.location));
  expect(location.origin + location.pathname).toBe(
    `${TEST_APP_ORIGIN}/auth/social/callback`,
  );
  return location.searchParams;
}

// 시작 → 제공자 동의 화면 주소에서 state를 꺼내고, 그 state로 콜백을 부른다.
async function startGoogle() {
  const res = await request(app).get("/api/auth/google/start");
  expect(res.status).toBe(302);
  const state = new URL(String(res.headers.location)).searchParams.get("state");
  const stateCookie = pairOf(res, OAUTH_STATE_COOKIE_NAME);
  if (!state || !stateCookie) throw new Error("state missing");
  return { state, stateCookie };
}

async function googleCallback(
  profile: SocialProfile,
  code = `code-${profile.providerUserId}`,
) {
  profilesByCode.set(code, profile);
  const { state, stateCookie } = await startGoogle();
  return request(app)
    .get("/api/auth/google/callback")
    .query({ code, state })
    .set("Cookie", stateCookie);
}

const GOOGLE_USER: SocialProfile = {
  providerUserId: "google-sub-1",
  email: "social@example.com",
  name: "구글 사용자",
};

async function signupWithGoogle(profile = GOOGLE_USER, role = "CREATOR") {
  const callback = await googleCallback(profile);
  expect(appRedirectOf(callback).get("result")).toBe("signup");
  const ticket = pairOf(callback, SOCIAL_SIGNUP_COOKIE_NAME);
  if (!ticket) throw new Error("signup ticket missing");
  const res = await request(app)
    .post("/api/auth/social/signup")
    .set("Origin", TEST_APP_ORIGIN)
    .set("Cookie", ticket)
    .send({ name: "새 크리에이터", role });
  return { res, ticket };
}

describe("소셜 로그인 시작", () => {
  it("제공자 동의 화면으로 보내고, state·PKCE 값을 HttpOnly 쿠키에 담는다", async () => {
    const res = await request(app).get("/api/auth/google/start");

    expect(res.status).toBe(302);
    const location = new URL(String(res.headers.location));
    expect(location.origin).toBe("https://provider.test");
    expect(location.searchParams.get("redirectUri")).toBe(
      `${TEST_APP_ORIGIN}/api/auth/google/callback`,
    );
    expect(location.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
    expect(location.searchParams.get("codeChallenge")).toMatch(/^[\w-]{43}$/);
    const cookie = cookieOf(res, OAUTH_STATE_COOKIE_NAME) ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("설정하지 않은 제공자는 SOCIAL_UNAVAILABLE로 프론트엔드에 돌려보낸다", async () => {
    const res = await request(app).get("/api/auth/kakao/start");

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_UNAVAILABLE");
  });

  it("없는 제공자는 404", async () => {
    expect((await request(app).get("/api/auth/naver/start")).status).toBe(404);
  });
});

describe("소셜 로그인 콜백 검증", () => {
  it("state가 다르면 SOCIAL_FAILED이고 제공자에 코드를 보내지 않는다", async () => {
    profilesByCode.set("code", GOOGLE_USER);
    const { stateCookie } = await startGoogle();

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "code", state: "other-state" })
      .set("Cookie", stateCookie);

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_FAILED");
    expect(fetchCalls).toHaveLength(0);
  });

  it.each([
    ["없음", (_cookie: string) => undefined],
    ["위조", (cookie: string) => `${cookie.slice(0, -2)}xx`],
  ])("state 쿠키가 %s이면 SOCIAL_FAILED", async (_label, cookieFor) => {
    profilesByCode.set("code", GOOGLE_USER);
    const { state, stateCookie } = await startGoogle();
    const cookie = cookieFor(stateCookie);

    const req = request(app)
      .get("/api/auth/google/callback")
      .query({ code: "code", state });
    const res = await (cookie ? req.set("Cookie", cookie) : req);

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_FAILED");
    expect(fetchCalls).toHaveLength(0);
  });

  it("다른 제공자용으로 받은 state는 쓸 수 없다", async () => {
    const kakaoApp = createTestApp({
      prisma,
      socialProviders: {
        google: fakeGoogle,
        kakao: { ...fakeGoogle, provider: "KAKAO" },
      },
    });
    profilesByCode.set("code", GOOGLE_USER);
    const start = await request(kakaoApp).get("/api/auth/kakao/start");
    const state = new URL(String(start.headers.location)).searchParams.get(
      "state",
    );

    const res = await request(kakaoApp)
      .get("/api/auth/google/callback")
      .query({ code: "code", state })
      .set("Cookie", pairOf(start, OAUTH_STATE_COOKIE_NAME) ?? "");

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_FAILED");
  });

  it("사용자가 동의를 취소하면 SOCIAL_CANCELLED", async () => {
    const { state, stateCookie } = await startGoogle();

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ error: "access_denied", state })
      .set("Cookie", stateCookie);

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_CANCELLED");
  });

  it("제공자와 통신에 실패하면 SOCIAL_FAILED", async () => {
    const { state, stateCookie } = await startGoogle();

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "unknown-code", state })
      .set("Cookie", stateCookie);

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_FAILED");
    expect(await prisma.user.count()).toBe(0);
  });

  it("콜백은 state 쿠키를 지운다 (한 번만 사용)", async () => {
    const res = await googleCallback(GOOGLE_USER);

    expect(cookieOf(res, OAUTH_STATE_COOKIE_NAME)).toMatch(
      new RegExp(`^${OAUTH_STATE_COOKIE_NAME}=;`),
    );
  });
});

describe("소셜 가입", () => {
  it("처음 온 계정은 가입 화면으로 보내고, 가입 전에는 회원을 만들지 않는다", async () => {
    const callback = await googleCallback(GOOGLE_USER);

    expect(appRedirectOf(callback).get("result")).toBe("signup");
    expect(cookieOf(callback, REFRESH_COOKIE_NAME)).toBeUndefined();
    expect(await prisma.user.count()).toBe(0);

    const pending = await request(app)
      .get("/api/auth/social/signup")
      .set("Cookie", pairOf(callback, SOCIAL_SIGNUP_COOKIE_NAME) ?? "");
    expect(pending.status).toBe(200);
    expect(pending.body).toEqual({
      provider: "google",
      suggestedName: "구글 사용자",
      providerEmail: "social@example.com",
    });
  });

  it("역할·표시 이름으로 가입하면 비밀번호·로그인 이메일 없이 회원과 소셜 계정을 만든다", async () => {
    const { res } = await signupWithGoogle();

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      email: null,
      name: "새 크리에이터",
      role: "CREATOR",
      status: "ACTIVE",
    });
    expect(pairOf(res, REFRESH_COOKIE_NAME)).toBeDefined();
    expect(cookieOf(res, SOCIAL_SIGNUP_COOKIE_NAME)).toMatch(
      new RegExp(`^${SOCIAL_SIGNUP_COOKIE_NAME}=;`),
    );
    const user = await prisma.user.findFirstOrThrow({
      include: { identities: true },
    });
    expect(user.email).toBeNull();
    expect(user.passwordHash).toBeNull();
    expect(user.identities).toMatchObject([
      {
        provider: "GOOGLE",
        providerUserId: "google-sub-1",
        providerEmail: "social@example.com",
      },
    ]);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${String(res.body.accessToken)}`);
    expect(me.status).toBe(200);
  });

  it("같은 소셜 계정으로 다시 오면 같은 회원으로 로그인한다 (Access 토큰은 refresh로 받는다)", async () => {
    const { res: signup } = await signupWithGoogle();

    const callback = await googleCallback(GOOGLE_USER, "second-code");

    expect(appRedirectOf(callback).get("result")).toBe("login");
    expect(String(callback.headers.location)).not.toContain("token");
    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", pairOf(callback, REFRESH_COOKIE_NAME) ?? "");
    expect(refresh.status).toBe(200);
    expect(refresh.body.user.id).toBe(signup.body.user.id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("같은 이메일의 이메일 회원이 있어도 자동으로 병합하지 않는다", async () => {
    await request(app).post("/api/auth/signup").send({
      email: "social@example.com",
      password: "correct-horse-battery",
      name: "이메일 회원",
      role: "CLIENT",
    });

    const { res } = await signupWithGoogle();

    expect(res.status).toBe(201);
    expect(await prisma.user.count()).toBe(2);
    expect(await prisma.authIdentity.count()).toBe(1);
  });

  it("이용 제한된 회원은 소셜 로그인도 FORBIDDEN이고 세션을 만들지 않는다", async () => {
    await signupWithGoogle();
    await prisma.user.updateMany({ data: { status: "RESTRICTED" } });
    const sessionsBefore = await prisma.authSession.count();

    const callback = await googleCallback(GOOGLE_USER, "again");

    expect(appRedirectOf(callback).get("error")).toBe("FORBIDDEN");
    expect(cookieOf(callback, REFRESH_COOKIE_NAME)).toBeUndefined();
    expect(await prisma.authSession.count()).toBe(sessionsBefore);
  });

  it("가입 티켓이 없으면 401, Origin이 다르면 403", async () => {
    const noTicket = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", TEST_APP_ORIGIN)
      .send({ name: "새 회원", role: "CLIENT" });
    expect(noTicket.status).toBe(401);
    expect((await request(app).get("/api/auth/social/signup")).status).toBe(
      401,
    );

    const callback = await googleCallback(GOOGLE_USER);
    const otherOrigin = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", "https://evil.example")
      .set("Cookie", pairOf(callback, SOCIAL_SIGNUP_COOKIE_NAME) ?? "")
      .send({ name: "새 회원", role: "CLIENT" });
    expect(otherOrigin.status).toBe(403);
    expect(await prisma.user.count()).toBe(0);
  });

  it.each([
    ["ADMIN 역할", { name: "관리자", role: "ADMIN" }],
    ["잘못된 이름", { name: "가", role: "CLIENT" }],
  ])("%s은 400이고 가입되지 않는다", async (_label, body) => {
    const callback = await googleCallback(GOOGLE_USER);

    const res = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", pairOf(callback, SOCIAL_SIGNUP_COOKIE_NAME) ?? "")
      .send(body);

    expect(res.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it("이미 쓴 가입 티켓을 다시 보내면 409이고 회원이 늘지 않는다", async () => {
    const { ticket } = await signupWithGoogle();

    const again = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", ticket)
      .send({ name: "두 번째", role: "CLIENT" });

    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("CONFLICT");
    expect(await prisma.user.count()).toBe(1);
  });

  it("가입 티켓과 Access 토큰은 서로 바꿔 쓸 수 없다", async () => {
    const { res, ticket } = await signupWithGoogle();
    const ticketValue = ticket.split("=")[1] ?? "";

    const asBearer = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${ticketValue}`);
    expect(asBearer.status).toBe(401);

    const asTicket = await request(app)
      .get("/api/auth/social/signup")
      .set(
        "Cookie",
        `${SOCIAL_SIGNUP_COOKIE_NAME}=${String(res.body.accessToken)}`,
      );
    expect(asTicket.status).toBe(401);
  });

  it("내용이 맞아도 다른 용도(audience)로 서명한 토큰은 가입 티켓으로 받지 않는다", async () => {
    const forged = await new SignJWT({
      provider: "google",
      pid: "google-sub-1",
      email: null,
      name: null,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("kemi:oauth-state")
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(TEST_ACCESS_SECRET));

    const res = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", `${SOCIAL_SIGNUP_COOKIE_NAME}=${forged}`)
      .send({ name: "새 회원", role: "CLIENT" });

    expect(res.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });
});

// 신규 가입용 임시 인증 정보(가입 티켓)의 만료·일회성·동시 재사용
describe("가입 티켓 수명", () => {
  // 테스트용 서명 키로 가입 티켓과 같은 형식의 토큰을 만든다. 만료 시각만 바꿔 쓴다.
  function signTicket(expiresAt: number) {
    return new SignJWT({
      provider: "google",
      pid: "google-sub-expired",
      email: null,
      name: "만료",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("kemi:social-signup")
      .setIssuedAt(expiresAt - 600)
      .setExpirationTime(expiresAt)
      .sign(new TextEncoder().encode(TEST_ACCESS_SECRET));
  }

  it("가입 티켓과 쿠키의 유효 시간은 10분이다", async () => {
    const callback = await googleCallback(GOOGLE_USER);
    const ticket = pairOf(callback, SOCIAL_SIGNUP_COOKIE_NAME) ?? "";
    const { iat, exp } = decodeJwt(ticket.split("=")[1] ?? "");

    expect((exp ?? 0) - (iat ?? 0)).toBe(600);
    expect(cookieOf(callback, SOCIAL_SIGNUP_COOKIE_NAME)).toContain(
      "Max-Age=600",
    );
  });

  it("만료된 가입 티켓은 조회·가입 모두 401이고 회원을 만들지 않는다", async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await signTicket(now - 1);
    const valid = await signTicket(now + 60);
    const cookie = (token: string) => `${SOCIAL_SIGNUP_COOKIE_NAME}=${token}`;

    // 같은 형식의 유효한 티켓은 통과하므로, 실패 이유는 만료뿐이다.
    expect(
      (
        await request(app)
          .get("/api/auth/social/signup")
          .set("Cookie", cookie(valid))
      ).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get("/api/auth/social/signup")
          .set("Cookie", cookie(expired))
      ).status,
    ).toBe(401);
    const res = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", cookie(expired))
      .send({ name: "새 회원", role: "CLIENT" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(await prisma.user.count()).toBe(0);
  });

  it("만료된 state 쿠키로는 콜백이 SOCIAL_FAILED이고 제공자에 코드를 보내지 않는다", async () => {
    profilesByCode.set("code", GOOGLE_USER);
    const now = Math.floor(Date.now() / 1000);
    const expiredState = await new SignJWT({
      provider: "google",
      state: "expired-state",
      cv: "verifier",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("kemi:oauth-state")
      .setIssuedAt(now - 601)
      .setExpirationTime(now - 1)
      .sign(new TextEncoder().encode(TEST_ACCESS_SECRET));

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "code", state: "expired-state" })
      .set("Cookie", `${OAUTH_STATE_COOKIE_NAME}=${expiredState}`);

    expect(appRedirectOf(res).get("error")).toBe("SOCIAL_FAILED");
    expect(fetchCalls).toHaveLength(0);
  });

  it("같은 가입 티켓으로 동시에 가입해도 회원·소셜 계정·세션은 하나만 생긴다", async () => {
    const callback = await googleCallback(GOOGLE_USER);
    const ticket = pairOf(callback, SOCIAL_SIGNUP_COOKIE_NAME) ?? "";
    const post = (name: string) =>
      request(app)
        .post("/api/auth/social/signup")
        .set("Origin", TEST_APP_ORIGIN)
        .set("Cookie", ticket)
        .send({ name, role: "CLIENT" });

    const results = await Promise.all([
      post("첫 번째"),
      post("두 번째"),
      post("세 번째"),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409, 409]);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authIdentity.count()).toBe(1);
    expect(await prisma.authSession.count()).toBe(1);
  });

  it("가입에 쓴 티켓은 회원이 탈퇴 상태가 돼도 새 가입에 다시 쓸 수 없다", async () => {
    const { ticket } = await signupWithGoogle();
    await prisma.user.updateMany({ data: { status: "WITHDRAWN" } });

    const again = await request(app)
      .post("/api/auth/social/signup")
      .set("Origin", TEST_APP_ORIGIN)
      .set("Cookie", ticket)
      .send({ name: "다시 가입", role: "CLIENT" });

    expect(again.status).toBe(409);
    expect(await prisma.user.count()).toBe(1);
  });
});

// 같은 요청을 순서대로 n번 보낸다(요청 제한 횟수를 정확히 세기 위해).
async function sequentially<T>(times: number, send: (n: number) => Promise<T>) {
  const results: T[] = [];
  await Array.from({ length: times }, (_, n) => n).reduce(
    (previous, n) =>
      previous.then(async () => {
        results.push(await send(n));
      }),
    Promise.resolve(),
  );
  return results;
}

describe("소셜 로그인 요청 제한", () => {
  it(`시작과 콜백은 따로 센다: 로그인 ${SOCIAL_RATE_LIMITS.start / 2}번(시작+콜백) 뒤에도 다음 시작이 막히지 않는다`, async () => {
    // 시작·콜백이 같은 카운터를 쓰면 이 횟수에서 한도(start)를 다 써서 다음 시작이 막힌다.
    await sequentially(SOCIAL_RATE_LIMITS.start / 2, async (n) => {
      const callback = await googleCallback(
        { ...GOOGLE_USER, providerUserId: `flow-${n}` },
        `flow-code-${n}`,
      );
      expect(appRedirectOf(callback).get("result")).toBe("signup");
    });

    const next = await request(app).get("/api/auth/google/start");

    expect(next.status).toBe(302);
    expect(new URL(String(next.headers.location)).origin).toBe(
      "https://provider.test",
    );
  });

  it("시작 한도를 다 써도 콜백은 그대로 처리되고, 넘친 시작은 안내 화면으로 간다", async () => {
    profilesByCode.set("code-after-limit", GOOGLE_USER);
    const { state, stateCookie } = await startGoogle();
    await sequentially(SOCIAL_RATE_LIMITS.start - 1, () =>
      request(app).get("/api/auth/google/start"),
    );

    const limited = await request(app).get("/api/auth/google/start");
    const callback = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "code-after-limit", state })
      .set("Cookie", stateCookie);

    expect(appRedirectOf(limited).get("error")).toBe("SOCIAL_RATE_LIMITED");
    expect(appRedirectOf(callback).get("result")).toBe("signup");
  });

  it("콜백 한도를 넘으면 JSON 오류가 아니라 안내 화면으로 보내고 state 쿠키를 지운다", async () => {
    const { stateCookie } = await startGoogle();
    await sequentially(SOCIAL_RATE_LIMITS.callback, () =>
      request(app)
        .get("/api/auth/google/callback")
        .query({ code: "x", state: "wrong" })
        .set("Cookie", stateCookie),
    );

    const limited = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "x", state: "wrong" })
      .set("Cookie", stateCookie);

    expect(appRedirectOf(limited).get("error")).toBe("SOCIAL_RATE_LIMITED");
    expect(cookieOf(limited, OAUTH_STATE_COOKIE_NAME)).toMatch(
      new RegExp(`^${OAUTH_STATE_COOKIE_NAME}=;`),
    );
    expect(limited.headers.ratelimit).toBeDefined();
  });
});

describe("제공자 응답 지연", () => {
  it("제공자가 응답하지 않으면 제한 시간 뒤 요청을 취소하고 SOCIAL_FAILED로 보낸다 (토큰·원문 미기록)", async () => {
    const signals: AbortSignal[] = [];
    const hanging: FetchFn = (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<globalThis.Response>(() => {});
    };
    const slowApp = createTestApp({
      prisma,
      socialProviders: {
        google: createGoogleProvider(
          { clientId: "test-client", clientSecret: "test-client-secret" },
          { fetchFn: hanging, timeoutMs: 100 },
        ),
      },
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const start = await request(slowApp).get("/api/auth/google/start");
      const state = new URL(String(start.headers.location)).searchParams.get(
        "state",
      );

      const res = await request(slowApp)
        .get("/api/auth/google/callback")
        .query({ code: "secret-auth-code", state })
        .set("Cookie", pairOf(start, OAUTH_STATE_COOKIE_NAME) ?? "");

      expect(appRedirectOf(res).get("error")).toBe("SOCIAL_FAILED");
      expect(signals).toHaveLength(1);
      expect(signals[0]?.aborted).toBe(true);
      expect(await prisma.user.count()).toBe(0);
      const logged = errors.mock.calls.flat().map(String).join("\n");
      expect(logged).not.toContain("secret-auth-code");
      expect(logged).not.toContain("test-client-secret");
    } finally {
      errors.mockRestore();
    }
  });
});
