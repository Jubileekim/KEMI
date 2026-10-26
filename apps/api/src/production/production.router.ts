import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { ProductionService } from "./production.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 제작 준비·시작·납기 (READY-01·02, WORK-01·02). /api 아래에 붙인다.
export default function createProductionRouter(
  authService: AuthService,
  productionService: ProductionService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const contractIdOf = (req: Request) =>
    idParamSchema.parse(req.params.contractId);
  const base = "/contracts/:contractId/production";

  router.get(base, async (req, res) => {
    const user = await currentUser(req);
    res.json(await productionService.get(user, contractIdOf(req)));
  });

  router.post(`${base}/materials`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await productionService.addMaterial(user, contractIdOf(req), req.body),
      );
  });

  router.post(`${base}/materials/:materialId/confirm`, async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await productionService.confirmMaterial(
        user,
        contractIdOf(req),
        idParamSchema.parse(req.params.materialId),
      ),
    );
  });

  router.post(`${base}/materials/:materialId/issue`, async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await productionService.reportMaterialIssue(
        user,
        contractIdOf(req),
        idParamSchema.parse(req.params.materialId),
        req.body,
      ),
    );
  });

  router.post(`${base}/start`, async (req, res) => {
    const user = await currentUser(req);
    res.json(await productionService.start(user, contractIdOf(req)));
  });

  router.post(`${base}/deadline-changes`, async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await productionService.requestDeadlineChange(
          user,
          contractIdOf(req),
          req.body,
        ),
      );
  });

  const respond = (approve: boolean) => async (req: Request, res: Response) => {
    const user = await currentUser(req);
    res.json(
      await productionService.respondDeadlineChange(
        user,
        contractIdOf(req),
        idParamSchema.parse(req.params.changeId),
        approve,
      ),
    );
  };
  router.post(`${base}/deadline-changes/:changeId/approve`, respond(true));
  router.post(`${base}/deadline-changes/:changeId/reject`, respond(false));

  return router;
}
