import type { AuthUser } from "@kemi/shared";
import { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import AppError from "../http/app-error.js";
import type { PricingService } from "./pricing.service.js";

export default function createPricingRouter(
  authService: AuthService,
  pricingService: PricingService,
): Router {
  const router = Router();
  const authenticatedUsers = new WeakMap<Request, AuthUser>();

  function pricingUser(req: Request): AuthUser {
    const user = authenticatedUsers.get(req);
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "인증이 필요합니다.");
    }
    return user;
  }

  // 앱 생성마다 별도 저장소. IP/프록시가 아닌 인증된 사용자 ID로 외부 AI 사용량 제한.
  const pricingRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => pricingUser(req).id,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "AI 단가 분석 요청 횟수를 초과했습니다.",
        ),
      );
    },
  });

  router.post(
    "/analyze",
    async (req, _res, next) => {
      const user = await authService.authenticate(readBearerToken(req));
      authenticatedUsers.set(req, user);
      next();
    },
    pricingRateLimit,
    async (req, res) => {
      res.json(await pricingService.analyze(pricingUser(req), req.body));
    },
  );

  return router;
}
