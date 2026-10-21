import { type Request, Router } from "express";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { PackageService } from "./package.service.js";

function paramOf(req: Request, name: string): string {
  const value = req.params[name];
  return typeof value === "string" ? value : "";
}

// 서비스 패키지(PACK-01~03)와 제작 서비스 공개·비공개(PROFILE-03·04).
// 본인 패키지 경로는 항상 토큰의 회원 본인 것만 다룬다. /api 아래에 붙인다.
export default function createPackageRouter(
  authService: AuthService,
  packageService: PackageService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));

  router.get("/packages/me", async (req, res) => {
    res.json(await packageService.getMine(await currentUser(req)));
  });

  router.post("/packages/me", async (req, res) => {
    res
      .status(201)
      .json(await packageService.create(await currentUser(req), req.body));
  });

  router.patch("/packages/me/:packageId", async (req, res) => {
    res.json(
      await packageService.update(
        await currentUser(req),
        paramOf(req, "packageId"),
        req.body,
      ),
    );
  });

  router.delete("/packages/me/:packageId", async (req, res) => {
    res.json(
      await packageService.remove(
        await currentUser(req),
        paramOf(req, "packageId"),
      ),
    );
  });

  router.put("/packages/me/:packageId/representative", async (req, res) => {
    res.json(
      await packageService.setRepresentative(
        await currentUser(req),
        paramOf(req, "packageId"),
      ),
    );
  });

  router.put("/profiles/me/service-status", async (req, res) => {
    res.json(
      await packageService.updateServiceStatus(
        await currentUser(req),
        req.body,
      ),
    );
  });

  // 공개 정보라 로그인 없이 조회할 수 있다 [제안].
  router.get("/creators/:creatorId/packages", async (req, res) => {
    res.json(await packageService.listPublic(paramOf(req, "creatorId")));
  });

  return router;
}
