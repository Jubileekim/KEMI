import { type Request, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import AppError from "../http/app-error.js";
import readBearerToken from "../http/bearer-token.js";
import type { ActivityService } from "./activity.service.js";
import type { AnalyticsService } from "./analytics.service.js";
import type { SafetyService } from "./safety.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 내 활동(ACT-01)·신고와 이용 제한(OPS-01·02)·행동 기록(METRIC-01). /api 아래에 붙인다.
export default function createSafetyRouter(
  authService: AuthService,
  safetyService: SafetyService,
  analyticsService: AnalyticsService,
  activityService: ActivityService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const reportIdOf = (req: Request) => idParamSchema.parse(req.params.reportId);

  router.get("/activity", async (req, res) => {
    res.json(await activityService.get(await currentUser(req)));
  });

  router.post("/reports", async (req, res) => {
    const { created, report } = await safetyService.report(
      await currentUser(req),
      req.body,
    );
    res.status(created ? 201 : 200).json(report);
  });
  router.get("/reports/me", async (req, res) => {
    res.json(await safetyService.mine(await currentUser(req)));
  });
  router.post("/reports/:reportId/appeal", async (req, res) => {
    res.json(
      await safetyService.appeal(
        await currentUser(req),
        reportIdOf(req),
        req.body,
      ),
    );
  });
  router.get("/admin/reports", async (req, res) => {
    res.json(await safetyService.list(await currentUser(req)));
  });
  router.post("/admin/reports/:reportId/actions", async (req, res) => {
    res.json(
      await safetyService.act(
        await currentUser(req),
        reportIdOf(req),
        req.body,
      ),
    );
  });

  // 행동 기록은 로그인하지 않아도 보낼 수 있다(토큰이 있으면 사용자와 연결). 남용을 막으려 IP당 분당 60회로 제한한다.
  const analyticsLimit = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", "기록 요청이 너무 많습니다."));
    },
  });
  router.post("/analytics/events", analyticsLimit, async (req, res) => {
    const token = readBearerToken(req);
    const user = token ? await authService.authenticate(token) : null;
    res.status(202).json(await analyticsService.record(user, req.body));
  });
  router.get("/admin/analytics", async (req, res) => {
    res.json(await analyticsService.summary(await currentUser(req)));
  });

  return router;
}
