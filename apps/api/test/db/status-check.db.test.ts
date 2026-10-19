import {
  AUTH_PROVIDERS,
  SESSION_REVOKE_REASONS,
  USER_ROLES,
  USER_STATUSES,
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
  ])("%s", async (constraintName, sharedValues) => {
    expect((await allowedValues(constraintName)).sort()).toEqual(
      [...sharedValues].sort(),
    );
  });
});
