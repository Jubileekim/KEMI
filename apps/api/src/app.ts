import express, { type Express } from "express";
import createApplicationRouter from "./applications/application.router.js";
import createChatRouter from "./chat/chat.router.js";
import createFileRouter from "./files/file.router.js";
import createProductionRouter from "./production/production.router.js";
import createDeliveryRouter from "./delivery/delivery.router.js";
import createCatalogRouter from "./catalog/catalog.router.js";
import createDirectRouter from "./direct/direct.router.js";
import createCancelRouter from "./cancel/cancel.router.js";
import type { CancelService } from "./cancel/cancel.service.js";
import type { DirectRequestService } from "./direct/direct.service.js";
import type { FeedService } from "./direct/feed.service.js";
import type { CatalogService } from "./catalog/catalog.service.js";
import type { ProjectDraftService } from "./projects/project-draft.service.js";
import type { DeliveryService } from "./delivery/delivery.service.js";
import type { ProductionService } from "./production/production.service.js";
import type { FileService } from "./files/file.service.js";
import type { ChatService } from "./chat/chat.service.js";
import type { ApplicationService } from "./applications/application.service.js";
import { createAuthRouter } from "./auth/auth.router.js";
import type { AuthService } from "./auth/auth.service.js";
import createDocsRouter from "./docs/docs.router.js";
import { errorHandler, notFoundHandler } from "./http/error-handler.js";
import type { NotificationService } from "./notifications/notification.service.js";
import createProjectDiscoveryRouter from "./project-discovery/project-discovery.router.js";
import type { ProjectDiscoveryService } from "./project-discovery/project-discovery.service.js";
import createProfileRouter from "./profiles/profile.router.js";
import type { ProfileService } from "./profiles/profile.service.js";
import createPaymentRouter from "./payments/payment.router.js";
import type { PaymentService } from "./payments/payment.service.js";
import createPricingRouter from "./pricing/pricing.router.js";
import type { PricingService } from "./pricing/pricing.service.js";
import createProjectRouter from "./projects/project.router.js";
import type { ProjectService } from "./projects/project.service.js";
import {
  createHealthRouter,
  type DatabaseCheck,
  type StorageReadiness,
} from "./routes/health.js";
import createTermsRouter from "./terms/terms.router.js";
import type { TermsService } from "./terms/terms.service.js";
import createSafetyRouter from "./safety/safety.router.js";
import type { SafetyService } from "./safety/safety.service.js";
import type { AnalyticsService } from "./safety/analytics.service.js";
import type { ActivityService } from "./safety/activity.service.js";

export interface AppDependencies {
  checkDatabase: DatabaseCheck;
  // /health/ready에 파일 저장소 점검을 붙인다(없으면 생략)
  checkStorage?: () => Promise<StorageReadiness>;
  authService: AuthService;
  profileService: ProfileService;
  projectService: ProjectService;
  applicationService: ApplicationService;
  notificationService: NotificationService;
  projectDiscoveryService: ProjectDiscoveryService;
  pricingService: PricingService;
  termsService: TermsService;
  paymentService: PaymentService;
  chatService: ChatService;
  fileService: FileService;
  productionService: ProductionService;
  deliveryService: DeliveryService;
  catalogService: CatalogService;
  projectDraftService: ProjectDraftService;
  directRequestService: DirectRequestService;
  feedService: FeedService;
  cancelService: CancelService;
  safetyService: SafetyService;
  analyticsService: AnalyticsService;
  activityService: ActivityService;
  // 프론트엔드 주소. 쿠키를 쓰는 인증 요청의 Origin 검사에 쓴다.
  appOrigin: string;
  // 앞단 프록시 개수. 요청 제한에 쓰는 클라이언트 IP(req.ip)를 X-Forwarded-For에서 몇 번째 값으로 읽을지 정한다.
  trustProxyHops?: number;
  // API 문서(/api/openapi.json, /api/docs)를 붙일지. 운영 환경에서는 끈다.
  apiDocs?: boolean;
}

export function createApp({
  checkDatabase,
  checkStorage,
  authService,
  profileService,
  projectService,
  applicationService,
  notificationService,
  projectDiscoveryService,
  pricingService,
  termsService,
  paymentService,
  chatService,
  fileService,
  productionService,
  deliveryService,
  catalogService,
  projectDraftService,
  directRequestService,
  feedService,
  cancelService,
  safetyService,
  analyticsService,
  activityService,
  appOrigin,
  trustProxyHops = 0,
  apiDocs = false,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  // Render·Vercel 프록시 뒤에서 클라이언트 IP와 https 여부를 올바르게 읽기 위해 사용한다.
  app.set("trust proxy", trustProxyHops);

  app.use(express.json({ limit: "1mb" }));

  app.use(createHealthRouter(checkDatabase, checkStorage));
  app.use("/api/auth", createAuthRouter(authService, appOrigin));
  app.use("/api/profiles", createProfileRouter(authService, profileService));
  app.use("/api/projects", createProjectRouter(authService, projectService));
  // 지원·알림 경로(/api/projects/:id/applications 포함)는 프로젝트 라우터에 없는 경로만 받는다.
  app.use(
    "/api",
    createApplicationRouter(
      authService,
      applicationService,
      notificationService,
    ),
  );
  app.use(
    "/api",
    createProjectDiscoveryRouter(authService, projectDiscoveryService),
  );
  // AI-01·02: 실제 모델 분석은 서버에서만 수행한다. 인증·요청 제한은 라우터에서 처리한다.
  app.use("/api/pricing", createPricingRouter(authService, pricingService));
  // 최종 조건서·서명·계약 (결정 기록 13장)
  app.use("/api", createTermsRouter(authService, termsService));
  // 테스트 결제 (PAY-01·02, Toss Sandbox)
  app.use("/api", createPaymentRouter(authService, paymentService));
  // 요청별 대화 (CHAT-01~05)
  app.use("/api", createChatRouter(authService, chatService));
  // 파일 업로드·확인·다운로드 (FILE-01)
  app.use("/api", createFileRouter(authService, fileService));
  // 제작 준비·시작·납기 (READY-01·02, WORK-01·02)
  app.use("/api", createProductionRouter(authService, productionService));
  // 검토·수정·최종 수령·정산·리뷰 (DEL·REV·SETTLE·REVIEW)
  app.use("/api", createDeliveryRouter(authService, deliveryService));
  // 제작 패키지·작업물·서비스 공개, 공고 임시 저장 (PACK·PORT·CAMP-01·02)
  app.use(
    "/api",
    createCatalogRouter(authService, catalogService, projectDraftService),
  );
  // 직접 의뢰·작업물 피드·운영 지표 (DIRECT·FEED·METRIC)
  app.use(
    "/api",
    createDirectRouter(authService, directRequestService, feedService),
  );
  // 취소·부분 환불·분쟁·운영 (CANCEL·REFUND·DISPUTE·OPS)
  app.use("/api", createCancelRouter(authService, cancelService));
  // ACT-01, OPS-01·02, METRIC-01: 내 활동·신고와 이용 제한·행동 기록
  app.use(
    "/api",
    createSafetyRouter(
      authService,
      safetyService,
      analyticsService,
      activityService,
    ),
  );
  if (apiDocs) {
    app.use("/api", createDocsRouter());
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
