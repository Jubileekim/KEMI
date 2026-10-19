import { z } from "zod";

// 상태값의 유일한 원본. DB는 text + CHECK 제약으로 저장하고, CHECK 목록은 이 배열과 같아야 한다.
// (apps/api/test/db/status-check.db.test.ts에서 실제 DB 제약과 비교한다)

export const USER_ROLES = ["CLIENT", "CREATOR", "ADMIN"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_STATUSES = ["ACTIVE", "RESTRICTED", "WITHDRAWN"] as const;
export const userStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const AUTH_PROVIDERS = ["GOOGLE", "KAKAO"] as const;
export const authProviderSchema = z.enum(AUTH_PROVIDERS);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const SESSION_REVOKE_REASONS = [
  "LOGOUT",
  "REUSE_DETECTED",
  "ADMIN",
] as const;
export const sessionRevokeReasonSchema = z.enum(SESSION_REVOKE_REASONS);
export type SessionRevokeReason = z.infer<typeof sessionRevokeReasonSchema>;
