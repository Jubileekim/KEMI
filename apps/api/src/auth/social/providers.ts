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

function providerFailed(): AppError {
  return new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "소셜 로그인 제공자와 통신하지 못했습니다.",
  );
}

async function readJson<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!response.ok) throw providerFailed();
  const result = schema.safeParse(await response.json());
  if (!result.success) throw providerFailed();
  return result.data;
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
  fetchFn: FetchFn = fetch,
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
      const token = await readJson(
        await fetchFn("https://oauth2.googleapis.com/token", {
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
        }),
        tokenResponseSchema,
      );
      // 토큰을 서버가 Google에서 직접(HTTPS) 받았으므로 userinfo 응답을 그대로 신뢰한다.
      const user = await readJson(
        await fetchFn("https://openidconnect.googleapis.com/v1/userinfo", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        googleUserSchema,
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
export function createKakaoProvider(
  { restApiKey, clientSecret }: KakaoConfig,
  fetchFn: FetchFn = fetch,
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
      const token = await readJson(
        await fetchFn("https://kauth.kakao.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          },
          body,
        }),
        tokenResponseSchema,
      );
      const user = await readJson(
        await fetchFn("https://kapi.kakao.com/v2/user/me", {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }),
        kakaoUserSchema,
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
