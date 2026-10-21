import type { Express } from "express";
import { createApp } from "../../src/app.js";
import {
  createAuthService,
  type SocialProviders,
} from "../../src/auth/auth.service.js";
import { createPrismaClient, type PrismaClient } from "../../src/lib/prisma.js";
import { createProfileService } from "../../src/profiles/profile.service.js";

export const TEST_APP_ORIGIN = "http://localhost:5173";
export const TEST_ACCESS_SECRET = "test-access-secret-at-least-32-characters";

interface TestAppOptions {
  // DB 테스트는 테스트 DB 클라이언트를 넘긴다. 단위 테스트는 생략하면 접속하지 않는 클라이언트를 쓴다.
  prisma?: PrismaClient;
  checkDatabase?: () => Promise<void>;
  beforeRotationCommit?: () => Promise<void>;
  trustProxyHops?: number;
  apiDocs?: boolean;
  socialProviders?: SocialProviders;
}

// 단위 테스트용: 주소만 있고 실제로 쿼리하지 않으므로 접속하지 않는다.
let unusedPrisma: PrismaClient | undefined;

export function createTestApp({
  prisma,
  checkDatabase = () => Promise.resolve(),
  beforeRotationCommit,
  trustProxyHops,
  apiDocs,
  socialProviders,
}: TestAppOptions = {}): Express {
  unusedPrisma ??= createPrismaClient({
    DATABASE_URL: "postgresql://unused:unused@localhost:1/unused_test",
    DATABASE_POOL_MAX: 1,
  });
  const client = prisma ?? unusedPrisma;
  return createApp({
    checkDatabase,
    authService: createAuthService({
      prisma: client,
      accessTokenSecret: TEST_ACCESS_SECRET,
      beforeRotationCommit,
      socialProviders,
    }),
    profileService: createProfileService({ prisma: client }),
    appOrigin: TEST_APP_ORIGIN,
    trustProxyHops,
    apiDocs,
  });
}
