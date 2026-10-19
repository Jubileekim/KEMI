import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import loadEnvFileIfExists from "./load-env-file.js";
import { resolveTestDatabaseUrl } from "./test-db-guard.js";

// npx를 셸로 실행하지 않고, 설치된 Prisma CLI를 현재 Node로 직접 실행한다(Windows·Linux 공통).
const prismaCli = createRequire(import.meta.url).resolve(
  "prisma/build/index.js",
);

// DB 테스트를 시작하기 전에 한 번 실행된다.
// 1) .env.test를 읽고  2) 안전장치를 통과한 주소에만  3) Prisma 마이그레이션을 적용한다.
export default async function setup() {
  // .env(개발용)는 읽지 않는다. 테스트 설정은 .env.test 또는 CI 환경 변수에서만 가져온다.
  loadEnvFileIfExists(".env.test");
  const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

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
