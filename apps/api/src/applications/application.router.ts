import { type Request, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { NotificationService } from "../notifications/notification.service.js";
import type { ApplicationService } from "./application.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 지원(APPLY-01·02)과 알림(NOTI-01). /api 아래에 붙인다.
export default function createApplicationRouter(
  authService: AuthService,
  applicationService: ApplicationService,
  notificationService: NotificationService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));

  router.post("/projects/:projectId/applications", async (req, res) => {
    const user = await currentUser(req);
    res
      .status(201)
      .json(
        await applicationService.apply(
          user,
          idParamSchema.parse(req.params.projectId),
          req.body,
        ),
      );
  });

  router.get("/projects/:projectId/applications", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await applicationService.listForProject(
        user,
        idParamSchema.parse(req.params.projectId),
      ),
    );
  });

  router.get("/applications/me", async (req, res) => {
    const user = await currentUser(req);
    res.json(await applicationService.listMine(user, req.query));
  });

  router.post("/applications/:applicationId/accept", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await applicationService.accept(
        user,
        idParamSchema.parse(req.params.applicationId),
      ),
    );
  });

  router.post("/applications/:applicationId/decline", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await applicationService.decline(
        user,
        idParamSchema.parse(req.params.applicationId),
      ),
    );
  });

  router.get("/notifications", async (req, res) => {
    const user = await currentUser(req);
    res.json(await notificationService.list(user, req.query));
  });

  router.get("/notifications/unread-count", async (req, res) => {
    const user = await currentUser(req);
    res.json(await notificationService.unreadCount(user));
  });

  router.post("/notifications/read-all", async (req, res) => {
    const user = await currentUser(req);
    res.json(await notificationService.markAllRead(user));
  });

  router.post("/notifications/:notificationId/read", async (req, res) => {
    const user = await currentUser(req);
    res.json(
      await notificationService.markRead(
        user,
        idParamSchema.parse(req.params.notificationId),
      ),
    );
  });

  return router;
}
