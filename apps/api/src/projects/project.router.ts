import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { ProjectService } from "./project.service.js";

const projectIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "프로젝트 ID가 올바르지 않습니다.")
  .transform(BigInt);

export default function createProjectRouter(
  authService: AuthService,
  projectService: ProjectService,
): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    res.json(await projectService.listPublic(req.query));
  });

  router.get("/me", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.json(await projectService.listMine(user, req.query));
  });

  router.post("/", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.status(201).json(await projectService.create(user, req.body));
  });

  router.get("/:projectId", async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    // 로그인한 경우(토큰이 있으면) 작성자·지원자는 마감·선정 뒤에도 볼 수 있다. 토큰이 잘못되면 401이다.
    const token = readBearerToken(req);
    const viewer = token ? await authService.authenticate(token) : undefined;
    res.json(await projectService.getPublic(projectId, viewer));
  });

  router.patch("/:projectId", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    const projectId = projectIdSchema.parse(req.params.projectId);
    res.json(await projectService.update(user, projectId, req.body));
  });

  router.post("/:projectId/close", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    const projectId = projectIdSchema.parse(req.params.projectId);
    res.json(await projectService.close(user, projectId));
  });

  router.post("/:projectId/end-without-selection", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    const projectId = projectIdSchema.parse(req.params.projectId);
    res.json(await projectService.endWithoutSelection(user, projectId));
  });

  router.delete("/:projectId", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    const projectId = projectIdSchema.parse(req.params.projectId);
    await projectService.remove(user, projectId);
    res.status(204).end();
  });

  return router;
}
