import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { PricingService } from "./pricing.service.js";

const pricingRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "AI 단가 분석 요청 횟수를 초과했습니다.",
    },
  },
});

export default function createPricingRouter(
  authService: AuthService,
  pricingService: PricingService,
): Router {
  const router = Router();

  router.post("/analyze", pricingRateLimit, async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.json(await pricingService.analyze(user, req.body));
  });

  return router;
}
