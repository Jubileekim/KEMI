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

  const app = createApp({
    checkDatabase: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
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
    }),
    termsService: createTermsService({ prisma }),
    chatService: createChatService({ prisma }),
    fileService: createFileService({
      prisma,
      storage:
        env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
          ? createSupabaseStorage({
              supabaseUrl: env.SUPABASE_URL,
              serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
              bucket: env.STORAGE_BUCKET,
            })
          : undefined,
    }),
    // 테스트 시크릿 키가 있을 때만 결제를 켠다(env.ts가 live 키를 거부한다).
    paymentService: createPaymentService({
      prisma,
      toss: env.TOSS_SECRET_KEY
        ? createTossClient({ secretKey: env.TOSS_SECRET_KEY })
        : undefined,
    }),
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
