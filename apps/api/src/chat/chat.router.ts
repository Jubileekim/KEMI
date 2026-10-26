import { type Request, Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { ChatService } from "./chat.service.js";

const idParamSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "ID가 올바르지 않습니다.")
  .transform(BigInt);

// 요청별 대화 (CHAT-01~05). /api 아래에 붙인다. 방은 요청 ID로 찾는다(조건서와 같은 경로 규칙).
export default function createChatRouter(
  authService: AuthService,
  chatService: ChatService,
): Router {
  const router = Router();
  const currentUser = (req: Request) =>
    authService.authenticate(readBearerToken(req));
  const requestIdOf = (req: Request) =>
    idParamSchema.parse(req.params.workRequestId);

  router.get("/chat/rooms", async (req, res) => {
    const user = await currentUser(req);
    res.json(await chatService.listRooms(user));
  });

  router.get(
    "/work-requests/:workRequestId/chat/messages",
    async (req, res) => {
      const user = await currentUser(req);
      res.json(
        await chatService.listMessages(user, requestIdOf(req), req.query),
      );
    },
  );

  router.post(
    "/work-requests/:workRequestId/chat/messages",
    async (req, res) => {
      const user = await currentUser(req);
      const { created, message } = await chatService.send(
        user,
        requestIdOf(req),
        req.body,
      );
      res.status(created ? 201 : 200).json(message);
    },
  );

  router.post("/work-requests/:workRequestId/chat/read", async (req, res) => {
    const user = await currentUser(req);
    res.json(await chatService.markRead(user, requestIdOf(req), req.body));
  });

  return router;
}
