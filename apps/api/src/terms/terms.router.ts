import { type Request, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { TermsService } from "./terms.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

const versionNoParamSchema = z
  .string()
  .regex(/^[1-9]\d{0,8}$/, "버전 번호가 올바르지 않습니다.")
  .transform(Number);

// 최종 조건서·서명·계약 (TERMS-01~03, CONTRACT-01, SIGN-01). /api 아래에 붙인다.
// 공개 지원의 요청 ID는 지원 ID와 같다. 직접 의뢰도 같은 경로를 쓸 수 있게 work-requests로 둔다.
export default function createTermsRouter(
  authService: AuthService,
  termsService: TermsService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const requestIdOf = (req: Request) =>
    idParamSchema.parse(req.params.workRequestId);
  const versionNoOf = (req: Request) =>
    versionNoParamSchema.parse(req.params.versionNo);

  router.get("/work-requests/:workRequestId/terms", async (req, res) => {
    const user = await currentUser(req);
    res.json(await termsService.getDocument(user, requestIdOf(req)));
  });

  router.post(
    "/work-requests/:workRequestId/terms/versions",
    async (req, res) => {
      const user = await currentUser(req);
      const { created, version } = await termsService.saveVersion(
        user,
        requestIdOf(req),
        req.body,
      );
      res.status(created ? 201 : 200).json(version);
    },
  );

  router.post(
    "/work-requests/:workRequestId/terms/versions/:versionNo/signing",
    async (req, res) => {
      const user = await currentUser(req);
      res.json(
        await termsService.requestSigning(
          user,
          requestIdOf(req),
          versionNoOf(req),
        ),
      );
    },
  );

  router.post(
    "/work-requests/:workRequestId/terms/versions/:versionNo/signatures",
    async (req, res) => {
      const user = await currentUser(req);
      const { created, result } = await termsService.sign(
        user,
        requestIdOf(req),
        versionNoOf(req),
        req.body,
      );
      res.status(created ? 201 : 200).json(result);
    },
  );

  router.get("/work-requests/:workRequestId/contract", async (req, res) => {
    const user = await currentUser(req);
    res.json(await termsService.getContract(user, requestIdOf(req)));
  });

  return router;
}
