import express, { type Express } from "express";
import { createAuthRouter } from "./auth/auth.router.js";
import type { AuthService } from "./auth/auth.service.js";
import { errorHandler, notFoundHandler } from "./http/error-handler.js";
import { createHealthRouter, type DatabaseCheck } from "./routes/health.js";

export interface AppDependencies {
  checkDatabase: DatabaseCheck;
  authService: AuthService;
  // 프론트엔드 주소. 쿠키를 쓰는 인증 요청의 Origin 검사에 쓴다.
  appOrigin: string;
  trustProxy?: boolean;
}

export function createApp({
  checkDatabase,
  authService,
  appOrigin,
  trustProxy = false,
}: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  // Render·Vercel 프록시 뒤에서 클라이언트 IP와 https 여부를 올바르게 읽기 위해 사용한다.
  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(express.json({ limit: "1mb" }));

  app.use(createHealthRouter(checkDatabase));
  app.use("/api/auth", createAuthRouter(authService, appOrigin));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
