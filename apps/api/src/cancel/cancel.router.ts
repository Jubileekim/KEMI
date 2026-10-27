import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { CancelService } from "./cancel.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 취소·부분 환불·분쟁·운영 (CANCEL-01~02, REFUND-01, DISPUTE-01, OPS-01). /api 아래에 붙인다.
export default function createCancelRouter(
  authService: AuthService,
  cancelService: CancelService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const idOf = (req: Request, name: string) =>
    idParamSchema.parse(req.params[name]);
  const base = "/contracts/:contractId";

  router.get(`${base}/cancellation`, async (req, res) => {
    const user = await currentUser(req);
    res.json(await cancelService.overview(user, idOf(req, "contractId")));
  });
  router.post(`${base}/cancellations`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await cancelService.propose(user, idOf(req, "contractId"), req.body),
      );
  });
  const respond =
    (action: "accept" | "reject" | "withdraw") =>
    async (req: Request, res: Response) => {
      const user = await currentUser(req);
      res.json(
        await cancelService.respond(
          user,
          idOf(req, "contractId"),
          idOf(req, "cancellationId"),
          action,
        ),
      );
    };
  router.post(
    `${base}/cancellations/:cancellationId/accept`,
    respond("accept"),
  );
  router.post(
    `${base}/cancellations/:cancellationId/reject`,
    respond("reject"),
  );
  router.post(
    `${base}/cancellations/:cancellationId/withdraw`,
    respond("withdraw"),
  );
  const contractAction =
    (action: "retryRefund" | "syncRefund" | "confirmHandover") =>
    async (req: Request, res: Response) => {
      const user = await currentUser(req);
      res.json(await cancelService[action](user, idOf(req, "contractId")));
    };
  router.post(`${base}/refund/retry`, contractAction("retryRefund"));
  router.post(`${base}/refund/sync`, contractAction("syncRefund"));
  router.post(`${base}/handover/confirm`, contractAction("confirmHandover"));

  router.post(`${base}/disputes`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await cancelService.openDispute(
          user,
          idOf(req, "contractId"),
          req.body,
        ),
      );
  });
  router.post(`${base}/disputes/:disputeId/evidence`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await cancelService.addEvidence(
          user,
          idOf(req, "contractId"),
          idOf(req, "disputeId"),
          req.body,
        ),
      );
  });

  // 운영자
  router.get("/admin/disputes", async (req, res) => {
    res.json(await cancelService.listDisputes(await currentUser(req)));
  });
  router.get("/admin/disputes/:disputeId", async (req, res) => {
    const user = await currentUser(req);
    res.json(await cancelService.getDispute(user, idOf(req, "disputeId")));
  });
  router.post("/admin/disputes/:disputeId/resolve", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await cancelService.resolveDispute(
        user,
        idOf(req, "disputeId"),
        req.body,
      ),
    );
  });
  router.get("/admin/operation-records", async (req, res) => {
    res.json(await cancelService.listOperationRecords(await currentUser(req)));
  });

  return router;
}
