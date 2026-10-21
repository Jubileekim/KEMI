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

// ─── 프로필 ────────────────────────────────────────────────────
// 제작 서비스 공개 상태. 프로필 저장으로는 바뀌지 않고, 공개·비공개 API(PUT /api/profiles/me/service-status)로만 바뀐다.
export const CREATOR_SERVICE_STATUSES = ["DRAFT", "PUBLIC", "PRIVATE"] as const;
export const creatorServiceStatusSchema = z.enum(CREATOR_SERVICE_STATUSES);
export type CreatorServiceStatus = z.infer<typeof creatorServiceStatusSchema>;

// 본인 제작 역할 (PRD 6.2·7.4: 기획·출연·촬영·편집)
export const PRODUCTION_ROLES = [
  "PLANNING",
  "ON_CAMERA",
  "FILMING",
  "EDITING",
] as const;
export const productionRoleSchema = z.enum(PRODUCTION_ROLES);
export type ProductionRole = z.infer<typeof productionRoleSchema>;

// [제안] 제품·제작 분야와 콘텐츠 스타일 선택값은 아직 미확정(D21)이다. ERD v0.5의 값을 임시로 쓴다.
// 바꿀 때는 이 배열과 DB CHECK 제약을 같은 PR에서 함께 고친다.
export const PRODUCT_CATEGORIES = [
  "BEAUTY",
  "FOOD",
  "LIFESTYLE",
  "TECH",
  "OTHER",
] as const;
export const productCategorySchema = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const CONTENT_STYLES = [
  "MODERN",
  "BRIGHT",
  "EMOTIONAL",
  "PROFESSIONAL",
  "OTHER",
] as const;
export const contentStyleSchema = z.enum(CONTENT_STYLES);
export type ContentStyle = z.infer<typeof contentStyleSchema>;
