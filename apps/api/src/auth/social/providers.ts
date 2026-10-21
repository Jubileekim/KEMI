import { z } from "zod";
import AppError from "../../http/app-error.js";

// 제공자에서 받은 회원 정보. providerUserId가 계정 식별 기준이다(이메일로 병합하지 않는다).
export interface SocialProfile {
  providerUserId: string;
  // 제공자가 확인한(verified) 이메일만 담는다.
  email: string | null;
  name: string | null;
}

export interface SocialProvider {
  // DB auth_identities.provider 값
  provider: "GOOGLE" | "KAKAO";
  // PKCE를 쓰는 제공자만 codeChallenge를 보낸다.
  authorizeUrl(input: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string;
  fetchProfile(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<SocialProfile>;
}

export type FetchFn = typeof fetch;

// 제공자 요청 하나(연결·응답 헤더·본문 읽기 전체)의 제한 시간 [제안]
export const PROVIDER_TIMEOUT_MS = 10_000;

export interface ProviderOptions {
  fetchFn?: FetchFn;
  timeoutMs?: number;
}

function providerFailed(): AppError {
  return new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "소셜 로그인 제공자와 통신하지 못했습니다.",
  );
}

// 제공자에 요청하고 JSON 응답을 검사한다. 제한 시간이 지나면 signal로 실제 HTTP 요청(본문 읽기 포함)을 취소하고,
// 제공자가 signal을 따르지 않더라도 기다리지 않고 실패로 끝낸다. 실패는 모두 같은 오류로 바꾼다(응답 원문은 남기지 않는다).
async function requestJson<T>(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  schema: z.ZodType<T>,
  timeoutMs: number,
): Promise<T> {
  const signal = AbortSignal.timeout(timeoutMs);
  const timedOut = new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(providerFailed()), {
      once: true,
    });
  });
  try {
    const response = await Promise.race([
      fetchFn(url, { ...init, signal }),
      timedOut,
    ]);
    if (!response.ok) {
      await response.body?.cancel();
      throw providerFailed();
    }
    const body: unknown = await Promise.race([response.json(), timedOut]);
    const result = schema.safeParse(body);
    if (!result.success) throw providerFailed();
    return result.data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw providerFailed();
  }
}

const tokenResponseSchema = z.object({ access_token: z.string().min(1) });

// 표시 이름 후보: 공백을 지우고, 비어 있으면 없음으로 본다.
function nameOrNull(name: string | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed || null;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

const googleUserSchema = z.object({
  sub: z.string().min(1),
  email: z.string().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

// Google OpenID Connect (Authorization Code + PKCE)
export function createGoogleProvider(
  { clientId, clientSecret }: GoogleConfig,
  { fetchFn = fetch, timeoutMs = PROVIDER_TIMEOUT_MS }: ProviderOptions = {},
): SocialProvider {
  return {
    provider: "GOOGLE",
    authorizeUrl({ state, codeChallenge, redirectUri }) {
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },
    async fetchProfile({ code, codeVerifier, redirectUri }) {
      const token = await requestJson(
        fetchFn,
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code,
            code_verifier: codeVerifier,
          }),
        },
        tokenResponseSchema,
        timeoutMs,
      );
      // 토큰을 서버가 Google에서 직접(HTTPS) 받았으므로 userinfo 응답을 그대로 신뢰한다.
      const user = await requestJson(
        fetchFn,
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${token.access_token}` } },
        googleUserSchema,
        timeoutMs,
      );
      return {
        providerUserId: user.sub,
        email: user.email_verified === true ? (user.email ?? null) : null,
        name: nameOrNull(user.name),
      };
    },
  };
}

export interface KakaoConfig {
  restApiKey: string;
  // 카카오 개발자 콘솔의 Client Secret(기본 사용). 끈 앱이면 비운다.
  clientSecret?: string;
}

const kakaoUserSchema = z.object({
  id: z.number().int().positive(),
  kakao_account: z
    .object({
      email: z.string().optional(),
      is_email_valid: z.boolean().optional(),
      is_email_verified: z.boolean().optional(),
      profile: z.object({ nickname: z.string().optional() }).optional(),
    })
    .optional(),
});

// 카카오 로그인 REST API. 문서에 PKCE가 없어 state만 쓴다(codeChallenge·codeVerifier는 보내지 않는다).
// 응답 필드는 카카오 개발자 문서 "사용자 정보 조회" 원문과 대조했다(2026-10-21): id(Long, 필수),
// kakao_account.email·is_email_valid·is_email_verified, kakao_account.profile.nickname(모두 선택, 동의항목 필요).
export function createKakaoProvider(
  { restApiKey, clientSecret }: KakaoConfig,
  { fetchFn = fetch, timeoutMs = PROVIDER_TIMEOUT_MS }: ProviderOptions = {},
): SocialProvider {
  return {
    provider: "KAKAO",
    authorizeUrl({ state, redirectUri }) {
      const url = new URL("https://kauth.kakao.com/oauth/authorize");
      url.search = new URLSearchParams({
        client_id: restApiKey,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      }).toString();
      return url.toString();
    },
    async fetchProfile({ code, redirectUri }) {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: restApiKey,
        redirect_uri: redirectUri,
        code,
      });
      if (clientSecret) body.set("client_secret", clientSecret);
      const token = await requestJson(
        fetchFn,
        "https://kauth.kakao.com/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
          body,
        },
        tokenResponseSchema,
        timeoutMs,
      );
      // 문서(사용자 정보 조회)에 Content-Type이 필수로 적혀 있어 함께 보낸다.
      const user = await requestJson(
        fetchFn,
        "https://kapi.kakao.com/v2/user/me",
        {
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
        },
        kakaoUserSchema,
        timeoutMs,
      );
      const account = user.kakao_account;
      return {
        providerUserId: String(user.id),
        email:
          account?.is_email_valid === true && account.is_email_verified === true
            ? (account.email ?? null)
            : null,
        name: nameOrNull(account?.profile?.nickname),
      };
    },
  };
}
