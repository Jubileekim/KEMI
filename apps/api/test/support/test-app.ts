import type { Express } from "express";
import { createApp } from "../../src/app.js";
import {
  createAuthService,
  type SocialProviders,
} from "../../src/auth/auth.service.js";
import { createPrismaClient, type PrismaClient } from "../../src/lib/prisma.js";
import { createProfileService } from "../../src/profiles/profile.service.js";
import {
  createPricingService,
  type PricingService,
} from "../../src/pricing/pricing.service.js";
import { createApplicationService } from "../../src/applications/application.service.js";
import { createNotificationService } from "../../src/notifications/notification.service.js";
import {
  createProjectDiscoveryService,
  type ProjectDiscoveryService,
} from "../../src/project-discovery/project-discovery.service.js";
import {
  createProjectService,
  type ProjectService,
} from "../../src/projects/project.service.js";
import {
  createTermsService,
  type TermsService,
} from "../../src/terms/terms.service.js";
import {
  createPaymentService,
  type PaymentService,
} from "../../src/payments/payment.service.js";
import { createChatService } from "../../src/chat/chat.service.js";

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
  projectService?: ProjectService;
  projectDiscoveryService?: ProjectDiscoveryService;
  pricingService?: PricingService;
  // 서명 기한 테스트는 시계를 바꾼 조건서 서비스를 넘긴다.
  termsService?: TermsService;
  // 결제 테스트는 가짜 Toss 클라이언트를 넣은 결제 서비스를 넘긴다.
  paymentService?: PaymentService;
}

const EMPTY_PROJECT = {
  id: "1",
  clientId: "1",
  clientName: "테스트 의뢰인",
  title: "테스트 영상 제작",
  description: "테스트를 위한 공개 맞춤 영상 제작 의뢰입니다.",
  purpose: "OTHER" as const,
  styles: ["CLEAN" as const],
  budget: 30_000,
  expectedDurationSeconds: 60,
  recruitmentEndAt: "2026-11-01T00:00:00.000Z",
  deliveryDueDate: "2026-11-10",
  status: "OPEN" as const,
  closeReason: null,
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
};

const unusedProjectService: ProjectService = {
  listPublic: () =>
    Promise.resolve({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    }),
  getPublic: () => Promise.resolve(EMPTY_PROJECT),
  listMine: () =>
    Promise.resolve({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    }),
  create: () => Promise.resolve(EMPTY_PROJECT),
  update: () => Promise.resolve(EMPTY_PROJECT),
  close: () =>
    Promise.resolve({
      ...EMPTY_PROJECT,
      status: "CLOSED",
      closeReason: "MANUAL",
    }),
  remove: () => Promise.resolve(),
  endWithoutSelection: () =>
    Promise.resolve({
      ...EMPTY_PROJECT,
      status: "CLOSED" as const,
      closeReason: "NO_SELECTION" as const,
    }),
};

const unusedProjectDiscoveryService: ProjectDiscoveryService = {
  listBookmarks: () =>
    Promise.resolve({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    }),
  addBookmark: () => Promise.resolve(EMPTY_PROJECT),
  removeBookmark: () => Promise.resolve(),
  listRecommendations: () =>
    Promise.resolve({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    }),
};

// 단위 테스트용: 주소만 있고 실제로 쿼리하지 않으므로 접속하지 않는다.
let unusedPrisma: PrismaClient | undefined;

export function createTestApp({
  prisma,
  checkDatabase = () => Promise.resolve(),
  beforeRotationCommit,
  trustProxyHops,
  apiDocs,
  socialProviders,
  projectService,
  projectDiscoveryService,
  pricingService,
  termsService,
  paymentService,
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
    projectService:
      projectService ??
      (prisma
        ? createProjectService({ prisma: client })
        : unusedProjectService),
    // 지원·알림 경로는 인증을 먼저 하므로, DB 없는 단위 테스트에서도 쿼리 전에 끝난다.
    applicationService: createApplicationService({ prisma: client }),
    notificationService: createNotificationService({ prisma: client }),
    projectDiscoveryService:
      projectDiscoveryService ??
      (prisma
        ? createProjectDiscoveryService({ prisma: client })
        : unusedProjectDiscoveryService),
    pricingService: pricingService ?? createPricingService(),
    // 조건서 경로도 인증을 먼저 하므로, DB 없는 단위 테스트에서는 쿼리 전에 끝난다.
    termsService: termsService ?? createTermsService({ prisma: client }),
    paymentService: paymentService ?? createPaymentService({ prisma: client }),
    chatService: createChatService({ prisma: client }),
    appOrigin: TEST_APP_ORIGIN,
    trustProxyHops,
    apiDocs,
  });
}
