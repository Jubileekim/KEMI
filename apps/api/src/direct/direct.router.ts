import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { DirectRequestService } from "./direct.service.js";
import type { FeedService } from "./feed.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 직접 의뢰(DIRECT-01~03)·작업물 피드(FEED-01~03)·운영 지표(METRIC-01). /api 아래에 붙인다.
export default function createDirectRouter(
  authService: AuthService,
  directRequestService: DirectRequestService,
  feedService: FeedService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const requestIdOf = (req: Request) =>
    idParamSchema.parse(req.params.requestId);

  router.post("/packages/:packageId/direct-requests", async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await directRequestService.create(
          user,
          idParamSchema.parse(req.params.packageId),
          req.body,
        ),
      );
  });
  router.get("/direct-requests", async (req, res) => {
    res.json(await directRequestService.list(await currentUser(req)));
  });
  router.get("/direct-requests/:requestId", async (req, res) => {
    const user = await currentUser(req);
    res.json(await directRequestService.get(user, requestIdOf(req)));
  });
  const act =
    (action: "accept" | "decline" | "withdraw") =>
    async (req: Request, res: Response) => {
      const user = await currentUser(req);
      res.json(await directRequestService[action](user, requestIdOf(req)));
    };
  router.post("/direct-requests/:requestId/accept", act("accept"));
  router.post("/direct-requests/:requestId/decline", act("decline"));
  router.post("/direct-requests/:requestId/withdraw", act("withdraw"));

  // 공개: 홈 작업물 피드
  router.get("/feed", async (req, res) => {
    res.json(await feedService.feed(req.query));
  });

  router.get("/admin/metrics", async (req, res) => {
    res.json(await feedService.metrics(await currentUser(req)));
  });

  return router;
}
