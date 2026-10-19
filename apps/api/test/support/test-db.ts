import { createPrismaClient, type PrismaClient } from '../../src/lib/prisma.js';
import loadEnvFileIfExists from './load-env-file.js';
import { resolveTestDatabaseUrl } from './test-db-guard.js';

// 테스트 파일은 globalSetup과 다른 프로세스에서 실행되므로 .env.test를 다시 읽는다.
loadEnvFileIfExists('.env.test');

// DB 테스트 파일에서 쓰는 Prisma Client. 만들 때마다 안전장치를 다시 확인한다.
export function createTestPrismaClient(): PrismaClient {
  const url = resolveTestDatabaseUrl(process.env);
  return createPrismaClient({ DATABASE_URL: url, DATABASE_POOL_MAX: 2 });
}

// 테스트 사이에 데이터를 비운다. 마이그레이션 기록 테이블은 남긴다.
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
  const db = rows[0]?.db ?? '';
  if (!db.endsWith('_test')) {
    throw new Error(`테스트 DB가 아닌 곳(${db})은 비우지 않습니다.`);
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
