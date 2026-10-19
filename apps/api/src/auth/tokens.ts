import { createHash, randomBytes } from "node:crypto";
import { errors, jwtVerify, SignJWT } from "jose";
import AppError from "../http/app-error.js";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
// 로그인 세션 최대 수명. 회전해도 늘어나지 않는다.
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ID_PATTERN = /^\d+$/;

export interface AccessTokenClaims {
  userId: bigint;
  sessionId: bigint;
}

// Refresh 토큰 원문: 추측할 수 없는 32바이트 무작위 값. DB에는 해시만 저장한다.
export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function signAccessToken(
  claims: AccessTokenClaims,
  secret: Uint8Array,
): Promise<string> {
  return new SignJWT({ sid: claims.sessionId.toString() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId.toString())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
  secret: Uint8Array,
): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    const { sub, sid } = payload;
    if (
      typeof sub === "string" &&
      ID_PATTERN.test(sub) &&
      typeof sid === "string" &&
      ID_PATTERN.test(sid)
    ) {
      return { userId: BigInt(sub), sessionId: BigInt(sid) };
    }
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new AppError(401, "TOKEN_EXPIRED", "로그인이 만료되었습니다.");
    }
    if (!(err instanceof errors.JOSEError)) {
      throw err;
    }
  }
  throw new AppError(401, "UNAUTHENTICATED", "로그인이 필요합니다.");
}
