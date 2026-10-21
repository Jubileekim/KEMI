import { createHash, randomBytes } from "node:crypto";
import { type SocialProviderPath, SOCIAL_PROVIDER_PATHS } from "@kemi/shared";
import { errors, jwtVerify, SignJWT } from "jose";
import type { SocialProfile } from "./providers.js";

// 소셜 로그인 중간 단계 값은 서버 DB에 두지 않고, 서명한 짧은 JWT를 HttpOnly 쿠키에 담는다.
// audience로 용도를 나눠 Access 토큰·다른 티켓과 바꿔 쓸 수 없게 한다.
export const SOCIAL_TICKET_TTL_SECONDS = 10 * 60;
const STATE_AUDIENCE = "kemi:oauth-state";
const SIGNUP_AUDIENCE = "kemi:social-signup";

function randomValue(): string {
  return randomBytes(32).toString("base64url");
}

function isProviderPath(value: unknown): value is SocialProviderPath {
  return SOCIAL_PROVIDER_PATHS.some((path) => path === value);
}

function sign(
  claims: Record<string, string | null>,
  audience: string,
  secret: Uint8Array,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${SOCIAL_TICKET_TTL_SECONDS}s`)
    .sign(secret);
}

// 서명·만료·용도가 맞지 않으면 undefined
async function verify(
  token: string | undefined,
  audience: string,
  secret: Uint8Array,
) {
  if (!token) return undefined;
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      audience,
    });
    return payload;
  } catch (err) {
    if (err instanceof errors.JOSEError) return undefined;
    throw err;
  }
}

function stringOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

export interface OAuthState {
  provider: SocialProviderPath;
  state: string;
  codeVerifier: string;
}

// CSRF 방지용 state와 PKCE code_verifier를 만든다.
export async function createOAuthState(
  provider: SocialProviderPath,
  secret: Uint8Array,
): Promise<{ cookie: string; state: string; codeChallenge: string }> {
  const state = randomValue();
  const codeVerifier = randomValue();
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const cookie = await sign(
    { provider, state, cv: codeVerifier },
    STATE_AUDIENCE,
    secret,
  );
  return { cookie, state, codeChallenge };
}

export async function readOAuthState(
  cookie: string | undefined,
  secret: Uint8Array,
): Promise<OAuthState | undefined> {
  const payload = await verify(cookie, STATE_AUDIENCE, secret);
  if (
    payload &&
    isProviderPath(payload.provider) &&
    typeof payload.state === "string" &&
    typeof payload.cv === "string"
  ) {
    return {
      provider: payload.provider,
      state: payload.state,
      codeVerifier: payload.cv,
    };
  }
  return undefined;
}

export interface SignupTicket {
  provider: SocialProviderPath;
  profile: SocialProfile;
}

export function createSignupTicket(
  { provider, profile }: SignupTicket,
  secret: Uint8Array,
): Promise<string> {
  return sign(
    {
      provider,
      pid: profile.providerUserId,
      email: profile.email,
      name: profile.name,
    },
    SIGNUP_AUDIENCE,
    secret,
  );
}

export async function readSignupTicket(
  cookie: string | undefined,
  secret: Uint8Array,
): Promise<SignupTicket | undefined> {
  const payload = await verify(cookie, SIGNUP_AUDIENCE, secret);
  if (!payload || !isProviderPath(payload.provider)) return undefined;
  const email = stringOrNull(payload.email);
  const name = stringOrNull(payload.name);
  if (
    typeof payload.pid !== "string" ||
    email === undefined ||
    name === undefined
  ) {
    return undefined;
  }
  return {
    provider: payload.provider,
    profile: { providerUserId: payload.pid, email, name },
  };
}
