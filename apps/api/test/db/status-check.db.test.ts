import {
  CONTRACT_STATUSES,
  PAYMENT_STATUSES,
  TERMS_VERSION_STATUSES,
  WORK_REQUEST_CLOSED_REASONS,
  WORK_REQUEST_STATUSES,
  WORK_REQUEST_TYPES,
  AUTH_PROVIDERS,
  CONTENT_STYLES,
  CREATOR_SERVICE_STATUSES,
  PRODUCT_CATEGORIES,
  PRODUCTION_ROLES,
  PROJECT_CLOSE_REASONS,
  SESSION_REVOKE_REASONS,
  USER_ROLES,
  USER_STATUSES,
  NOTIFICATION_TYPES,
  PROJECT_STATUSES,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
} from "@kemi/shared";
import { afterAll, describe, expect, it } from "vitest";
import { createTestPrismaClient } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// 마이그레이션의 CHECK 제약에 적힌 허용 값을 읽는다. 예: CHECK ((role = ANY (ARRAY['CLIENT'::text, ...])))
async function allowedValues(constraintName: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ definition: string }[]>`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conname = ${constraintName}`;
  const definition = rows[0]?.definition;
  if (!definition) throw new Error(`${constraintName} 제약이 없습니다.`);
  return [...definition.matchAll(/'([^']+)'/g)].map((match) => match[1] ?? "");
}

describe("DB CHECK 제약과 @kemi/shared 상태값이 같다", () => {
  it.each([
    ["users_role_check", USER_ROLES],
    ["users_status_check", USER_STATUSES],
    ["auth_identities_provider_check", AUTH_PROVIDERS],
    ["auth_sessions_revoke_reason_check", SESSION_REVOKE_REASONS],
    ["client_profiles_industry_check", PRODUCT_CATEGORIES],
    ["creator_profiles_niche_check", PRODUCT_CATEGORIES],
    ["creator_profiles_content_styles_check", CONTENT_STYLES],
    ["creator_profiles_production_roles_check", PRODUCTION_ROLES],
    ["creator_profiles_service_status_check", CREATOR_SERVICE_STATUSES],
    ["projects_purpose_check", VIDEO_PURPOSES],
    ["projects_status_check", PROJECT_STATUSES],
    ["projects_close_reason_check", PROJECT_CLOSE_REASONS],
    ["projects_styles_check", VIDEO_STYLES],
    ["work_requests_request_type_check", WORK_REQUEST_TYPES],
    ["work_requests_status_check", WORK_REQUEST_STATUSES],
    ["work_requests_closed_reason_check", WORK_REQUEST_CLOSED_REASONS],
    ["notifications_event_type_check", NOTIFICATION_TYPES],
    ["terms_versions_status_check", TERMS_VERSION_STATUSES],
    ["contracts_status_check", CONTRACT_STATUSES],
    ["payments_status_check", PAYMENT_STATUSES],
  ])("%s", async (constraintName, sharedValues) => {
    expect((await allowedValues(constraintName)).sort()).toEqual(
      [...sharedValues].sort(),
    );
  });
});
