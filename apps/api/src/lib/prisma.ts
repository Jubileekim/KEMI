import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrismaClient(
  env: Pick<Env, 'DATABASE_URL' | 'DATABASE_POOL_MAX'>,
): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
  });
  return new PrismaClient({ adapter });
}

export type { PrismaClient };
