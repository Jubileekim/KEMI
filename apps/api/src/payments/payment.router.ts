import { type Request, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { PaymentService } from "./payment.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);
const orderIdParamSchema = z.uuid("주문 번호가 올바르지 않습니다.");

// 테스트 결제 (PAY-01·02, Toss Sandbox). /api 아래에 붙인다.
export default function createPaymentRouter(
  authService: AuthService,
  paymentService: PaymentService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));

  router.get("/contracts/:contractId/payments", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await paymentService.list(
        user,
        idParamSchema.parse(req.params.contractId),
      ),
    );
  });

  router.post("/contracts/:contractId/payments", async (req, res) => {
    const user = await currentUser(req);
    const { created, order } = await paymentService.create(
      user,
      idParamSchema.parse(req.params.contractId),
      req.body,
    );
    res.status(created ? 201 : 200).json(order);
  });

  router.post("/payments/confirm", async (req, res) => {
    const user = await currentUser(req);
    res.json(await paymentService.confirm(user, req.body));
  });

  router.post("/payments/:orderId/sync", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await paymentService.sync(
        user,
        orderIdParamSchema.parse(req.params.orderId),
      ),
    );
  });

  router.post("/payments/:orderId/fail", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await paymentService.fail(
        user,
        orderIdParamSchema.parse(req.params.orderId),
        req.body,
      ),
    );
  });

  return router;
}
