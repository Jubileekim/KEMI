import express, { type Express } from "express";
import createApplicationRouter from "./applications/application.router.js";
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
import createProjectRouter from "./projects/project.router.js";
import type { ProjectService } from "./projects/project.service.js";
import { createHealthRouter, type DatabaseCheck } from "./routes/health.js";

export interface AppDependencies {
  checkDatabase: DatabaseCheck;
  authService: AuthService;
  profileService: ProfileService;
  projectService: ProjectService;
  applicationService: ApplicationService;
  notificationService: NotificationService;
  projectDiscoveryService: ProjectDiscoveryService;
  // 프론트엔드 주소. 쿠키를 쓰는 인증 요청의 Origin 검사에 쓴다.
  appOrigin: string;
  // 앞단 프록시 개수. 요청 제한에 쓰는 클라이언트 IP(req.ip)를 X-Forwarded-For에서 몇 번째 값으로 읽을지 정한다.
  trustProxyHops?: number;
  // API 문서(/api/openapi.json, /api/docs)를 붙일지. 운영 환경에서는 끈다.
  apiDocs?: boolean;
}

export function createApp({
  checkDatabase,
  authService,
  profileService,
  projectService,
  applicationService,
  notificationService,
  projectDiscoveryService,
  appOrigin,
  trustProxyHops = 0,
  apiDocs = false,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  // Render·Vercel 프록시 뒤에서 클라이언트 IP와 https 여부를 올바르게 읽기 위해 사용한다.
  app.set("trust proxy", trustProxyHops);

  app.use(express.json({ limit: "1mb" }));

  app.use(createHealthRouter(checkDatabase));
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
  if (apiDocs) {
    app.use("/api", createDocsRouter());
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
