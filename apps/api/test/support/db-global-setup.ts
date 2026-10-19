import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import pg from "pg";
import loadEnvFileIfExists from "./load-env-file.js";
import { resolveTestDatabaseUrl } from "./test-db-guard.js";

// npx를 셸로 실행하지 않고, 설치된 Prisma CLI를 현재 Node로 직접 실행한다(Windows·Linux 공통).
const prismaCli = createRequire(import.meta.url).resolve(
  "prisma/build/index.js",
);

// Supabase처럼 Data API 역할(anon·authenticated)이 있고, 새 테이블·시퀀스에 이 역할의 권한이
// 자동으로 붙는 상태를 테스트 DB에 재현한다. 마이그레이션이 이 권한을 실제로 회수하는지 검증하기 위해서다.
const SUPABASE_ROLES_SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
`;

async function reproduceSupabaseRoles(connectionString: string) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // 마이그레이션이 하나라도 적용된 DB에서는 재현하지 않는다(이미 적용된 상태를 바꾸지 않기 위해).
    const { rows } = await client.query<{ applied: boolean }>(
      "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS applied",
    );
    if (!rows[0]?.applied) {
      await client.query(SUPABASE_ROLES_SQL);
    }
  } finally {
    await client.end();
  }
}

// DB 테스트를 시작하기 전에 한 번 실행된다.
// 1) .env.test를 읽고  2) 안전장치를 통과한 주소에만  3) Supabase 역할을 재현한 뒤  4) Prisma 마이그레이션을 적용한다.
export default async function setup() {
  // .env(개발용)는 읽지 않는다. 테스트 설정은 .env.test 또는 CI 환경 변수에서만 가져온다.
  loadEnvFileIfExists(".env.test");
  const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

  await reproduceSupabaseRoles(testDatabaseUrl);

  // prisma.config.ts는 MIGRATION_DATABASE_URL을 먼저 쓰므로, 두 값 모두 테스트 DB로 고정한다.
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [prismaCli, "migrate", "deploy"],
    {
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        MIGRATION_DATABASE_URL: testDatabaseUrl,
      },
    },
  );
  console.info(stdout.trim());
}
