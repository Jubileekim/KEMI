import { afterAll, describe, expect, it } from "vitest";
import { createTestPrismaClient } from "../support/test-db.js";

// 테스트 DB에는 globalSetup이 Supabase와 같은 anon·authenticated 역할과 기본 권한을 재현해 둔다.
const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// 검사 결과를 담아 트랜잭션을 되돌리기 위한 표시
class ProbeResult extends Error {
  constructor(readonly granted: bigint) {
    super("probe rollback");
  }
}

const AUTH_TABLES = [
  "users",
  "auth_identities",
  "auth_sessions",
  "auth_refresh_tokens",
];
const DATA_API_ROLES = ["anon", "authenticated"];
// PostgreSQL 17의 테이블 권한 전체. MAINTAIN은 information_schema에 나오지 않으므로 직접 포함해 검사한다.
const ALL_TABLE_PRIVILEGES =
  "SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN";

describe("인증 테이블의 Data API 접근 차단", () => {
  it("4개 테이블 모두 RLS가 켜져 있다", async () => {
    const rows = await prisma.$queryRaw<
      { relname: string; relrowsecurity: boolean }[]
    >`SELECT relname, relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname = ANY(${AUTH_TABLES})
      ORDER BY relname`;

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("anon·authenticated는 인증 테이블·시퀀스에 어떤 권한도 없다", async () => {
    const rows = await prisma.$queryRaw<{ granted: bigint }[]>`
      SELECT count(*) AS granted FROM unnest(${DATA_API_ROLES}::text[]) AS r(role)
      CROSS JOIN unnest(${AUTH_TABLES}::text[]) AS t(name)
      WHERE has_table_privilege(r.role, 'public.' || t.name,
              ${ALL_TABLE_PRIVILEGES})
         OR has_sequence_privilege(r.role, 'public.' || t.name || '_id_seq',
              'USAGE, SELECT, UPDATE')`;

    expect(rows[0]?.granted).toBe(0n);
  });

  it("anon·authenticated는 Prisma 마이그레이션 이력 테이블에 어떤 권한도 없다", async () => {
    // _prisma_migrations는 Prisma가 첫 마이그레이션보다 먼저 만들어, 기본 권한 변경 전의 권한을 받는다.
    const rows = await prisma.$queryRaw<{ granted: bigint }[]>`
      SELECT count(*) AS granted FROM unnest(${DATA_API_ROLES}::text[]) AS r(role)
      WHERE has_table_privilege(r.role, 'public._prisma_migrations',
              ${ALL_TABLE_PRIVILEGES})`;

    expect(rows[0]?.granted).toBe(0n);
  });

  it("앞으로 public에 새로 만드는 테이블·시퀀스에도 자동으로 권한이 붙지 않는다", async () => {
    // 새 테이블을 만들어 확인한 뒤, 트랜잭션을 되돌려 흔적을 남기지 않는다.
    const granted = await prisma
      .$transaction(async (tx) => {
        await tx.$executeRaw`CREATE TABLE public.default_acl_probe (id bigserial PRIMARY KEY)`;
        const rows = await tx.$queryRaw<{ granted: bigint }[]>`
          SELECT count(*) AS granted FROM unnest(${DATA_API_ROLES}::text[]) AS r(role)
          WHERE has_table_privilege(r.role, 'public.default_acl_probe', ${ALL_TABLE_PRIVILEGES})
             OR has_sequence_privilege(r.role, 'public.default_acl_probe_id_seq', 'USAGE, SELECT, UPDATE')`;
        throw new ProbeResult(rows[0]?.granted ?? -1n);
      })
      .catch((err: unknown) => {
        if (err instanceof ProbeResult) return err.granted;
        throw err;
      });

    expect(granted).toBe(0n);
  });
});
