import { type Request, type Response, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { ProjectDraftService } from "../projects/project-draft.service.js";
import type { CatalogService } from "./catalog.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 제작 패키지·작업물·서비스 공개(PACK·PORT)와 공고 임시 저장(CAMP-01·02). /api 아래에 붙인다.
export default function createCatalogRouter(
  authService: AuthService,
  catalogService: CatalogService,
  projectDraftService: ProjectDraftService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const idOf = (req: Request, name: string) =>
    idParamSchema.parse(req.params[name]);

  // ─── 크리에이터 본인: 패키지 ───
  router.get("/creator/packages", async (req, res) => {
    res.json(await catalogService.listMyPackages(await currentUser(req)));
  });
  router.post("/creator/packages", async (req, res) => {
    const user = await currentUser(req);
    res.status(201).json(await catalogService.createPackage(user, req.body));
  });
  router.patch("/creator/packages/:packageId", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await catalogService.updatePackage(
        user,
        idOf(req, "packageId"),
        req.body,
      ),
    );
  });
  const packageStatus =
    (visible: boolean) => async (req: Request, res: Response) => {
      const user = await currentUser(req);
      res.json(
        await catalogService.setPackageStatus(
          user,
          idOf(req, "packageId"),
          visible,
        ),
      );
    };
  router.post("/creator/packages/:packageId/publish", packageStatus(true));
  router.post("/creator/packages/:packageId/hide", packageStatus(false));
  router.post(
    "/creator/packages/:packageId/representative",
    async (req, res) => {
      const user = await currentUser(req);
      res.json(
        await catalogService.makeRepresentative(user, idOf(req, "packageId")),
      );
    },
  );

  // ─── 크리에이터 본인: 작업물 ───
  router.get("/creator/portfolios", async (req, res) => {
    res.json(await catalogService.listMyPortfolios(await currentUser(req)));
  });
  router.post("/creator/portfolios", async (req, res) => {
    const user = await currentUser(req);
    res.status(201).json(await catalogService.createPortfolio(user, req.body));
  });
  router.patch("/creator/portfolios/:portfolioId", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await catalogService.updatePortfolio(
        user,
        idOf(req, "portfolioId"),
        req.body,
      ),
    );
  });
  const portfolioStatus =
    (visible: boolean) => async (req: Request, res: Response) => {
      const user = await currentUser(req);
      res.json(
        await catalogService.setPortfolioStatus(
          user,
          idOf(req, "portfolioId"),
          visible,
        ),
      );
    };
  router.post(
    "/creator/portfolios/:portfolioId/publish",
    portfolioStatus(true),
  );
  router.post("/creator/portfolios/:portfolioId/hide", portfolioStatus(false));

  // ─── 크리에이터 본인: 제작 서비스 공개 ───
  const serviceStatus =
    (visible: boolean) => async (req: Request, res: Response) => {
      res.json(
        await catalogService.setServiceStatus(await currentUser(req), visible),
      );
    };
  router.post("/creator/service/publish", serviceStatus(true));
  router.post("/creator/service/hide", serviceStatus(false));

  // ─── 공개 조회 ───
  router.get("/creators/:userId", async (req, res) => {
    res.json(await catalogService.getCreator(idOf(req, "userId")));
  });
  router.get("/packages/:packageId", async (req, res) => {
    res.json(await catalogService.getPackage(idOf(req, "packageId")));
  });
  router.get("/portfolios/:portfolioId", async (req, res) => {
    res.json(await catalogService.getPortfolio(idOf(req, "portfolioId")));
  });
  router.get("/portfolios/:portfolioId/media", async (req, res) => {
    res.json(await catalogService.getPortfolioMedia(idOf(req, "portfolioId")));
  });

  // ─── 의뢰인: 공고 임시 저장·공개 ───
  router.get("/project-drafts", async (req, res) => {
    res.json(await projectDraftService.list(await currentUser(req)));
  });
  router.post("/project-drafts", async (req, res) => {
    const user = await currentUser(req);
    res.status(201).json(await projectDraftService.create(user, req.body));
  });
  router.patch("/project-drafts/:draftId", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await projectDraftService.update(user, idOf(req, "draftId"), req.body),
    );
  });
  router.delete("/project-drafts/:draftId", async (req, res) => {
    const user = await currentUser(req);
    await projectDraftService.remove(user, idOf(req, "draftId"));
    res.status(204).end();
  });
  router.post("/project-drafts/:draftId/publish", async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(await projectDraftService.publish(user, idOf(req, "draftId")));
  });

  return router;
}
