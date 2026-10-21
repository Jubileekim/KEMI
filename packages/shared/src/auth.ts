import { z } from "zod";
import type { UserRole, UserStatus } from "./status.js";

// 이메일 정규화: 앞뒤 공백 제거 + 소문자. DB도 같은 규칙을 CHECK 제약으로 강제한다.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailSchema = z
  .string()
  .trim()
  .max(254)
  // 문서(OpenAPI)에 이메일 형식을 표시하기 위한 메타데이터. 검증·정규화 동작은 바꾸지 않는다.
  .meta({ format: "email" })
  .pipe(z.email({ error: "이메일 형식이 올바르지 않습니다." }))
  .transform(normalizeEmail);

// bcrypt는 72바이트 이후를 무시하므로 바이트 길이로 상한을 둔다.
const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "비밀번호가 너무 깁니다.",
  );

// 회원가입으로 고를 수 있는 역할. ADMIN은 가입으로 만들 수 없다.
export const SIGNUP_ROLES = [
  "CLIENT",
  "CREATOR",
] as const satisfies readonly UserRole[];

// 표시 이름 2~20자 (users.name). 가입과 프로필 수정에서 같은 규칙을 쓴다.
export const displayNameSchema = z.string().trim().min(2).max(20);

export const signupRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: displayNameSchema,
  role: z.enum(SIGNUP_ROLES),
});
export type SignupRequest = z.input<typeof signupRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // 로그인은 비밀번호 규칙을 검사하지 않는다. 지나치게 긴 입력만 막는다.
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.input<typeof loginRequestSchema>;

// API에서 사용자 ID는 문자열로 주고받는다(DB는 bigint).
export interface AuthUser {
  id: string;
  email: string | null;
  name: string;
  role: UserRole;
  status: UserStatus;
}

// 회원가입·로그인·갱신 응답. Refresh 토큰은 본문이 아니라 HttpOnly 쿠키로 전달한다.
export interface AuthTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

// 소셜 로그인 경로의 제공자 이름 (/api/auth/{provider}/start)
export const SOCIAL_PROVIDER_PATHS = ["google", "kakao"] as const;
export type SocialProviderPath = (typeof SOCIAL_PROVIDER_PATHS)[number];

// 소셜 로그인 콜백 뒤 서버가 프론트엔드 `/auth/social/callback`으로 보낼 때 붙이는 값
// - result=login: 기존 회원. Refresh 쿠키가 설정됐으므로 POST /api/auth/refresh로 Access 토큰을 받는다.
// - result=signup: 처음 온 소셜 계정. 역할·표시 이름을 받아 POST /api/auth/social/signup으로 가입한다.
// - error=...: 아래 값 중 하나
// SOCIAL_CANCELLED: 사용자가 동의를 취소함 / SOCIAL_FAILED: 검증·통신 실패(다시 시도)
// SOCIAL_UNAVAILABLE: 서버에 해당 제공자 설정이 없음 / FORBIDDEN: 이용 제한·탈퇴 회원
export const SOCIAL_CALLBACK_ERRORS = [
  "SOCIAL_CANCELLED",
  "SOCIAL_FAILED",
  "SOCIAL_UNAVAILABLE",
  "FORBIDDEN",
] as const;
export type SocialCallbackError = (typeof SOCIAL_CALLBACK_ERRORS)[number];

// 소셜 가입: 이메일·비밀번호 없이 역할과 표시 이름만 받는다.
export const socialSignupRequestSchema = signupRequestSchema.pick({
  name: true,
  role: true,
});
export type SocialSignupRequest = z.input<typeof socialSignupRequestSchema>;

// 가입 화면에 보여줄 소셜 계정 정보. 제공자 이메일은 표시용이며 로그인 이메일로 쓰지 않는다.
export interface SocialSignupPendingResponse {
  provider: SocialProviderPath;
  suggestedName: string | null;
  providerEmail: string | null;
}
