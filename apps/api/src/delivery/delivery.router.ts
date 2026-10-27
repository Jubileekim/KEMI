import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { DeliveryService } from "./delivery.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 검토·수정·최종 수령·정산·리뷰 (DEL-01~05, REV-01~02, SETTLE-01, REVIEW-01). /api 아래에 붙인다.
export default function createDeliveryRouter(
  authService: AuthService,
  deliveryService: DeliveryService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const contractIdOf = (req: Request) =>
    idParamSchema.parse(req.params.contractId);
  const deliverableIdOf = (req: Request) =>
    idParamSchema.parse(req.params.deliverableId);
  const base = "/contracts/:contractId";

  router.get(`${base}/delivery`, async (req, res) => {
    const user = await currentUser(req);
    res.json(await deliveryService.get(user, contractIdOf(req)));
  });

  router.post(`${base}/deliverables`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(await deliveryService.submit(user, contractIdOf(req), req.body));
  });

  router.post(
    `${base}/deliverables/:deliverableId/revision-requests`,
    async (req, res) => {
      const user = await currentUser(req);
      res
        .status(201)
        .json(
          await deliveryService.requestRevision(
            user,
            contractIdOf(req),
            deliverableIdOf(req),
            req.body,
          ),
        );
    },
  );

  const answer =
    (action: "approve" | "receive") => async (req: Request, res: Response) => {
      const user = await currentUser(req);
      res.json(
        await deliveryService[action](
          user,
          contractIdOf(req),
          deliverableIdOf(req),
        ),
      );
    };
  router.post(`${base}/deliverables/:deliverableId/approve`, answer("approve"));
  router.post(`${base}/deliverables/:deliverableId/receive`, answer("receive"));

  router.post(`${base}/reviews`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(await deliveryService.review(user, contractIdOf(req), req.body));
  });

  router.get("/settlements/me", async (req, res) => {
    const user = await currentUser(req);
    res.json(await deliveryService.listSettlements(user));
  });

  // 공개: 프로필의 받은 리뷰
  router.get("/users/:userId/reviews", async (req, res) => {
    res.json(
      await deliveryService.listReviews(idParamSchema.parse(req.params.userId)),
    );
  });

  return router;
}
