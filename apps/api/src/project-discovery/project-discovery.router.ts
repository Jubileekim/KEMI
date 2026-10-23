import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { ProjectDiscoveryService } from "./project-discovery.service.js";

const projectIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "프로젝트 ID가 올바르지 않습니다.")
  .transform(BigInt);

export default function createProjectDiscoveryRouter(
  authService: AuthService,
  discoveryService: ProjectDiscoveryService,
): Router {
  const router = Router();

  router.get("/bookmarks/projects", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.json(await discoveryService.listBookmarks(user, req.query));
  });

  router.put("/bookmarks/projects/:projectId", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    const projectId = projectIdSchema.parse(req.params.projectId);
    res.json(await discoveryService.addBookmark(user, projectId));
  });

  router.delete("/bookmarks/projects/:projectId", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    const projectId = projectIdSchema.parse(req.params.projectId);
    await discoveryService.removeBookmark(user, projectId);
    res.status(204).end();
  });

  router.get("/recommendations/projects", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.json(await discoveryService.listRecommendations(user, req.query));
  });

  return router;
}
