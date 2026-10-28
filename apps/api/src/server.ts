import { createApp } from "./app.js";
import {
  createAuthService,
  type SocialProviders,
} from "./auth/auth.service.js";
import {
  createGoogleProvider,
  createKakaoProvider,
} from "./auth/social/providers.js";
import { EnvValidationError, parseEnv, type Env } from "./config/env.js";
import { createPrismaClient } from "./lib/prisma.js";
import { createProjectDiscoveryService } from "./project-discovery/project-discovery.service.js";
import { createProfileService } from "./profiles/profile.service.js";
import { createPricingService } from "./pricing/pricing.service.js";
import { createApplicationService } from "./applications/application.service.js";
import { createNotificationService } from "./notifications/notification.service.js";
import { createProjectService } from "./projects/project.service.js";
import { createTermsService } from "./terms/terms.service.js";
import { createPaymentService } from "./payments/payment.service.js";
import { createTossClient } from "./payments/toss.js";
import { createChatService } from "./chat/chat.service.js";
import { createFileService } from "./files/file.service.js";
import { createProductionService } from "./production/production.service.js";
import { createDeliveryService } from "./delivery/delivery.service.js";
import { createCatalogService } from "./catalog/catalog.service.js";
import { createProjectDraftService } from "./projects/project-draft.service.js";
import { createDirectRequestService } from "./direct/direct.service.js";
import { createSafetyService } from "./safety/safety.service.js";
import { createAnalyticsService } from "./safety/analytics.service.js";
import { createActivityService } from "./safety/activity.service.js";
import { createFeedService } from "./direct/feed.service.js";
import { createCancelService } from "./cancel/cancel.service.js";
import { createSupabaseStorage } from "./files/storage.js";

// 환경 변수가 있는 제공자만 켠다.
function socialProvidersOf(env: Env): SocialProviders {
  const providers: SocialProviders = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = createGoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    });
  }
  if (env.KAKAO_REST_API_KEY) {
    providers.kakao = createKakaoProvider({
      restApiKey: env.KAKAO_REST_API_KEY,
      clientSecret: env.KAKAO_CLIENT_SECRET,
    });
  }
  return providers;
}

function start(env: Env) {
  const prisma = createPrismaClient(env);

  // 파일 저장소(Supabase Storage). 없으면 업로드·다운로드·작업물 재생은 503
  const storage =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseStorage({
          supabaseUrl: env.SUPABASE_URL,
          serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
          bucket: env.STORAGE_BUCKET,
        })
      : undefined;
  // 저장소 설정 여부를 시작 로그에 남긴다(키 값은 남기지 않는다). 운영 503 원인 확인용.
  if (storage)
    console.info(`[files] storage enabled: bucket=${env.STORAGE_BUCKET}`);
  else
    console.warn(
      "[files] storage disabled: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 없어 파일 업로드·재생이 503입니다",
    );
  // 테스트 시크릿 키가 있을 때만 결제·환불을 켠다(env.ts가 live 키를 거부한다).
  const toss = env.TOSS_SECRET_KEY
    ? createTossClient({ secretKey: env.TOSS_SECRET_KEY })
    : undefined;
  const app = createApp({
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    checkStorage: async () =>
      storage ? storage.checkBucket() : "not_configured",
    authService: createAuthService({
      prisma,
      accessTokenSecret: env.JWT_ACCESS_SECRET,
      socialProviders: socialProvidersOf(env),
    }),
    profileService: createProfileService({ prisma }),
    projectService: createProjectService({ prisma }),
    applicationService: createApplicationService({ prisma }),
    notificationService: createNotificationService({ prisma }),
    projectDiscoveryService: createProjectDiscoveryService({ prisma }),
    pricingService: createPricingService({
      apiKey: env.AI_PRICING_API_KEY,
      model: env.AI_PRICING_MODEL,
      prisma,
    }),
    termsService: createTermsService({ prisma }),
    chatService: createChatService({ prisma }),
    productionService: createProductionService({ prisma }),
    deliveryService: createDeliveryService({ prisma }),
    catalogService: createCatalogService({ prisma, storage }),
    projectDraftService: createProjectDraftService({ prisma }),
    directRequestService: createDirectRequestService({ prisma }),
    feedService: createFeedService({ prisma }),
    fileService: createFileService({
      prisma,
      storage,
    }),
    paymentService: createPaymentService({
      prisma,
      toss,
    }),
    cancelService: createCancelService({ prisma, toss }),
    safetyService: createSafetyService({ prisma }),
    analyticsService: createAnalyticsService({ prisma }),
    activityService: createActivityService({ prisma }),
    appOrigin: env.APP_ORIGIN,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    apiDocs: env.NODE_ENV !== "production",
  });

  const server = app.listen(env.PORT, () => {
    console.info(`KEMI API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Render는 재배포·중지 시 SIGTERM을 보낸다. 새 요청을 받지 않고, 진행 중인 요청이 끝나면
  // DB 연결을 닫는다. 남은 작업이 없으면 Node 프로세스는 스스로 종료된다.
  const shutdown = (signal: string) => {
    console.info(`${signal} received, shutting down`);
    server.close(() => {
      prisma
        .$disconnect()
        .catch((err: unknown) => console.error("DB disconnect failed:", err));
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}

try {
  start(parseEnv(process.env));
} catch (err) {
  if (!(err instanceof EnvValidationError)) {
    throw err;
  }
  // 환경 변수가 잘못되면 서버를 시작하지 않고 실패 코드로 종료한다.
  console.error(err.message);
  process.exitCode = 1;
}
