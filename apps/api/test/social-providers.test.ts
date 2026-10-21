import { describe, expect, it } from "vitest";
import {
  createGoogleProvider,
  createKakaoProvider,
  type FetchFn,
  PROVIDER_TIMEOUT_MS,
} from "../src/auth/social/providers.js";
import AppError from "../src/http/app-error.js";

interface SentRequest {
  url: string;
  body: URLSearchParams | undefined;
  authorization: string | null;
  contentType: string | null;
}

// 순서대로 준비한 응답을 돌려주고, 보낸 요청을 기록하는 가짜 fetch
function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const sent: SentRequest[] = [];
  const queue = [...responses];
  const fetchFn: FetchFn = async (input, init) => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected request");
    sent.push({
      url: String(input),
      body: init?.body instanceof URLSearchParams ? init.body : undefined,
      authorization: new Headers(init?.headers).get("authorization"),
      contentType: new Headers(init?.headers).get("content-type"),
    });
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
    });
  };
  return { fetchFn, sent };
}

const REDIRECT_URI = "http://localhost:5173/api/auth/google/callback";

describe("Google 제공자", () => {
  const config = { clientId: "google-id", clientSecret: "google-secret" };

  it("동의 화면 주소에 state·PKCE(S256)·scope를 싣는다", () => {
    const url = new URL(
      createGoogleProvider(config).authorizeUrl({
        state: "st",
        codeChallenge: "challenge",
        redirectUri: REDIRECT_URI,
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "google-id",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      state: "st",
      code_challenge: "challenge",
      code_challenge_method: "S256",
    });
  });

  it("코드를 교환하고 sub·확인된 이메일·이름을 돌려준다", async () => {
    const { fetchFn, sent } = fakeFetch([
      { body: { access_token: "google-access" } },
      {
        body: {
          sub: "1234567890",
          email: "user@gmail.com",
          email_verified: true,
          name: " 홍길동 ",
        },
      },
    ]);

    const profile = await createGoogleProvider(config, {
      fetchFn,
    }).fetchProfile({
      code: "auth-code",
      codeVerifier: "verifier",
      redirectUri: REDIRECT_URI,
    });

    expect(profile).toEqual({
      providerUserId: "1234567890",
      email: "user@gmail.com",
      name: "홍길동",
    });
    expect(sent[0]?.url).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(sent[0]?.body ?? [])).toEqual({
      grant_type: "authorization_code",
      client_id: "google-id",
      client_secret: "google-secret",
      redirect_uri: REDIRECT_URI,
      code: "auth-code",
      code_verifier: "verifier",
    });
    expect(sent[1]?.url).toBe(
      "https://openidconnect.googleapis.com/v1/userinfo",
    );
    expect(sent[1]?.authorization).toBe("Bearer google-access");
  });

  it("확인되지 않은 이메일은 저장하지 않는다", async () => {
    const { fetchFn } = fakeFetch([
      { body: { access_token: "t" } },
      { body: { sub: "1", email: "user@gmail.com", email_verified: false } },
    ]);

    const profile = await createGoogleProvider(config, {
      fetchFn,
    }).fetchProfile({
      code: "c",
      codeVerifier: "v",
      redirectUri: REDIRECT_URI,
    });

    expect(profile).toEqual({ providerUserId: "1", email: null, name: null });
  });

  it.each([
    ["토큰 교환 실패", [{ status: 400, body: { error: "invalid_grant" } }]],
    [
      "회원 정보 형식이 다름",
      [{ body: { access_token: "t" } }, { body: { id: 1 } }],
    ],
  ])("%s이면 SERVICE_UNAVAILABLE", async (_label, responses) => {
    const { fetchFn } = fakeFetch(responses);

    await expect(
      createGoogleProvider(config, { fetchFn }).fetchProfile({
        code: "c",
        codeVerifier: "v",
        redirectUri: REDIRECT_URI,
      }),
    ).rejects.toSatisfy(
      (err) => err instanceof AppError && err.code === "SERVICE_UNAVAILABLE",
    );
  });
});

describe("카카오 제공자", () => {
  it("동의 화면 주소에 state를 싣고, 문서에 없는 PKCE 값은 보내지 않는다", () => {
    const url = new URL(
      createKakaoProvider({ restApiKey: "kakao-key" }).authorizeUrl({
        state: "st",
        codeChallenge: "challenge",
        redirectUri: REDIRECT_URI,
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://kauth.kakao.com/oauth/authorize",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "kakao-key",
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      state: "st",
    });
  });

  it("Client Secret을 설정하면 토큰 요청에 넣고, 숫자 id를 문자열로 돌려준다", async () => {
    const { fetchFn, sent } = fakeFetch([
      { body: { access_token: "kakao-access" } },
      {
        body: {
          id: 4012345678,
          kakao_account: {
            email: "user@kakao.com",
            is_email_valid: true,
            is_email_verified: true,
            profile: { nickname: "카카오" },
          },
        },
      },
    ]);

    const profile = await createKakaoProvider(
      { restApiKey: "kakao-key", clientSecret: "kakao-secret" },
      { fetchFn },
    ).fetchProfile({ code: "c", codeVerifier: "v", redirectUri: REDIRECT_URI });

    expect(profile).toEqual({
      providerUserId: "4012345678",
      email: "user@kakao.com",
      name: "카카오",
    });
    expect(sent[0]?.url).toBe("https://kauth.kakao.com/oauth/token");
    expect(Object.fromEntries(sent[0]?.body ?? [])).toEqual({
      grant_type: "authorization_code",
      client_id: "kakao-key",
      redirect_uri: REDIRECT_URI,
      code: "c",
      client_secret: "kakao-secret",
    });
    expect(sent[1]?.url).toBe("https://kapi.kakao.com/v2/user/me");
    expect(sent[1]?.authorization).toBe("Bearer kakao-access");
    expect(sent[1]?.contentType).toBe(
      "application/x-www-form-urlencoded;charset=utf-8",
    );
  });

  it.each([
    [
      "유효하지 않은 이메일",
      { is_email_valid: false, is_email_verified: true },
    ],
    [
      "확인되지 않은 이메일",
      { is_email_valid: true, is_email_verified: false },
    ],
  ])(
    "%s은 저장하지 않고, Client Secret이 없으면 보내지 않는다",
    async (_label, flags) => {
      const { fetchFn, sent } = fakeFetch([
        { body: { access_token: "t" } },
        {
          body: {
            id: 7,
            kakao_account: { email: "user@kakao.com", ...flags },
          },
        },
      ]);

      const profile = await createKakaoProvider(
        { restApiKey: "kakao-key" },
        { fetchFn },
      ).fetchProfile({
        code: "c",
        codeVerifier: "v",
        redirectUri: REDIRECT_URI,
      });

      expect(profile).toEqual({ providerUserId: "7", email: null, name: null });
      expect(sent[0]?.body?.has("client_secret")).toBe(false);
    },
  );
});

describe("제공자 요청 제한 시간", () => {
  const input = { code: "c", codeVerifier: "v", redirectUri: REDIRECT_URI };
  const isProviderFailure = (err: unknown) =>
    err instanceof AppError && err.code === "SERVICE_UNAVAILABLE";

  // 응답을 보내지 않는 제공자. 요청이 취소되면(signal) 그 사실을 기록한다.
  function hangingFetch() {
    const signals: AbortSignal[] = [];
    const fetchFn: FetchFn = (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise<Response>(() => {});
    };
    return { fetchFn, signals };
  }

  it("기본 제한 시간은 10초다", () => {
    expect(PROVIDER_TIMEOUT_MS).toBe(10_000);
  });

  it("토큰 교환 응답이 오지 않으면 제한 시간 뒤 요청을 취소하고 실패한다 (Google)", async () => {
    const { fetchFn, signals } = hangingFetch();
    const started = Date.now();

    await expect(
      createGoogleProvider(
        { clientId: "id", clientSecret: "secret" },
        { fetchFn, timeoutMs: 50 },
      ).fetchProfile(input),
    ).rejects.toSatisfy(isProviderFailure);

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
  });

  it("응답 본문을 읽다가 멈춰도 제한 시간 뒤 실패한다 (카카오 사용자 정보)", async () => {
    const signals: AbortSignal[] = [];
    let calls = 0;
    const fetchFn: FetchFn = async (_input, init) => {
      if (init?.signal) signals.push(init.signal);
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ access_token: "t" }));
      }
      // 헤더는 바로 오지만 본문이 끝나지 않는 응답
      return new Response(new ReadableStream({ start() {} }));
    };

    await expect(
      createKakaoProvider(
        { restApiKey: "kakao-key" },
        { fetchFn, timeoutMs: 50 },
      ).fetchProfile(input),
    ).rejects.toSatisfy(isProviderFailure);

    expect(calls).toBe(2);
    // 요청마다 제한 시간(signal)을 따로 두고, 멈춘 둘째 요청이 취소됐다.
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals[1]?.aborted).toBe(true);
  });

  it("네트워크 오류도 같은 실패로 바꾸고 원문을 드러내지 않는다", async () => {
    const fetchFn: FetchFn = async () => {
      throw new Error("connect ECONNREFUSED secret-detail");
    };

    const err: unknown = await createGoogleProvider(
      { clientId: "id", clientSecret: "secret" },
      { fetchFn },
    )
      .fetchProfile(input)
      .catch((caught: unknown) => caught);

    expect(isProviderFailure(err)).toBe(true);
    expect(String(err instanceof Error ? err.message : err)).not.toContain(
      "secret-detail",
    );
  });
});
