import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7은 .env를 자동으로 읽지 않는다. 로컬에서만 .env를 읽고, 배포 환경은 플랫폼 환경 변수를 쓴다.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // 마이그레이션 전용 주소가 있으면 우선 사용하고, 없으면 실행용 주소를 그대로 쓴다.
    url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
  },
});
