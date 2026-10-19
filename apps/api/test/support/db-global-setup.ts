import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolveTestDatabaseUrl } from './test-db-guard.js';

// DB 테스트를 시작하기 전에 한 번 실행된다.
// 1) .env.test를 읽고  2) 안전장치를 통과한 주소에만  3) Prisma 마이그레이션을 적용한다.
export default function setup() {
  // .env(개발용)는 읽지 않는다. 테스트 설정은 .env.test 또는 CI 환경 변수에서만 가져온다.
  if (existsSync('.env.test')) {
    process.loadEnvFile('.env.test');
  }
  const testDatabaseUrl = resolveTestDatabaseUrl(process.env);

  // prisma.config.ts는 MIGRATION_DATABASE_URL을 먼저 쓰므로, 두 값 모두 테스트 DB로 고정한다.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      MIGRATION_DATABASE_URL: testDatabaseUrl,
    },
  });
}
