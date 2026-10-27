import { type Request, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { FileService } from "./file.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 파일 업로드·확인·다운로드 (FILE-01). /api 아래에 붙인다.
export default function createFileRouter(
  authService: AuthService,
  fileService: FileService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const fileIdOf = (req: Request) => idParamSchema.parse(req.params.fileId);

  router.post("/files", async (req, res) => {
    const user = await currentUser(req);
    res.status(201).json(await fileService.create(user, req.body));
  });

  router.post("/files/:fileId/complete", async (req, res) => {
    const user = await currentUser(req);
    res.json(await fileService.complete(user, fileIdOf(req)));
  });

  router.get("/files/:fileId", async (req, res) => {
    const user = await currentUser(req);
    res.json(await fileService.get(user, fileIdOf(req)));
  });

  router.get("/files/:fileId/download", async (req, res) => {
    const user = await currentUser(req);
    res.json(await fileService.download(user, fileIdOf(req)));
  });

  return router;
}
