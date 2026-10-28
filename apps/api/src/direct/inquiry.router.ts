import { type Request, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { InquiryService } from "./inquiry.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 작품 저장함(SAVE-01)·일괄 문의(INQ-01). /api 아래에 붙인다.
export default function createInquiryRouter(
  authService: AuthService,
  inquiryService: InquiryService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const portfolioIdOf = (req: Request) =>
    idParamSchema.parse(req.params.portfolioId);

  router.get("/me/work-bookmarks", async (req, res) => {
    res.json(await inquiryService.listBookmarks(await currentUser(req)));
  });
  router.put("/portfolios/:portfolioId/bookmark", async (req, res) => {
    const user = await currentUser(req);
    res.json(await inquiryService.saveBookmark(user, portfolioIdOf(req)));
  });
  router.delete("/portfolios/:portfolioId/bookmark", async (req, res) => {
    const user = await currentUser(req);
    res.json(await inquiryService.removeBookmark(user, portfolioIdOf(req)));
  });
  router.post("/direct-inquiries", async (req, res) => {
    const user = await currentUser(req);
    res.status(201).json(await inquiryService.sendBulk(user, req.body));
  });

  return router;
}
