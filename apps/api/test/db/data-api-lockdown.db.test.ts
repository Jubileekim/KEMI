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

// 마이그레이션으로 만드는 앱 테이블. 새 테이블을 추가하면 여기에도 넣는다(빠지면 첫 테스트가 실패한다).
const APP_TABLES = [
  "users",
  "auth_identities",
  "auth_sessions",
  "auth_refresh_tokens",
  "client_profiles",
  "creator_profiles",
  "service_packages",
];
const DATA_API_ROLES = ["anon", "authenticated"];
// PostgreSQL 17의 테이블 권한 전체. MAINTAIN은 information_schema에 나오지 않으므로 직접 포함해 검사한다.
const ALL_TABLE_PRIVILEGES =
  "SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN";

describe("앱 테이블의 Data API 접근 차단", () => {
  it("public의 앱 테이블은 목록과 같고, 모두 RLS가 켜져 있다", async () => {
    const rows = await prisma.$queryRaw<
      { relname: string; relrowsecurity: boolean }[]
    >`SELECT relname, relrowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
        AND relname <> '_prisma_migrations'
      ORDER BY relname`;

    expect(rows.map((row) => row.relname)).toEqual([...APP_TABLES].sort());
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("anon·authenticated는 앱 테이블에 어떤 권한도 없다", async () => {
    const rows = await prisma.$queryRaw<{ granted: bigint }[]>`
      SELECT count(*) AS granted FROM unnest(${DATA_API_ROLES}::text[]) AS r(role)
      CROSS JOIN unnest(${APP_TABLES}::text[]) AS t(name)
      WHERE has_table_privilege(r.role, 'public.' || t.name,
              ${ALL_TABLE_PRIVILEGES})`;

    expect(rows[0]?.granted).toBe(0n);
  });

  it("anon·authenticated는 public의 시퀀스에 어떤 권한도 없다", async () => {
    const rows = await prisma.$queryRaw<
      { sequences: bigint; granted: bigint }[]
    >`
      SELECT count(DISTINCT s.oid) AS sequences,
             count(*) FILTER (WHERE has_sequence_privilege(r.role, s.oid,
               'USAGE, SELECT, UPDATE')) AS granted
      FROM unnest(${DATA_API_ROLES}::text[]) AS r(role)
      CROSS JOIN pg_class s
      WHERE s.relnamespace = 'public'::regnamespace AND s.relkind = 'S'`;

    // 검사할 시퀀스가 실제로 있는지도 확인한다(없으면 항상 통과하므로).
    expect(rows[0]?.sequences).toBeGreaterThan(0n);
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
