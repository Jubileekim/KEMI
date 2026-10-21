import { Router } from "express";
import type { AuthService } from "../auth/auth.service.js";
import readBearerToken from "../http/bearer-token.js";
import type { ProfileService } from "./profile.service.js";

// 본인 프로필 조회·수정 (PROFILE-01·02). 대상은 항상 토큰의 회원 본인이라 타인 프로필은 고칠 수 없다.
export default function createProfileRouter(
  authService: AuthService,
  profileService: ProfileService,
): Router {
  const router = Router();

  router.get("/me", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.json(await profileService.getMine(user));
  });

  router.patch("/me", async (req, res) => {
    const user = await authService.authenticate(readBearerToken(req));
    res.json(await profileService.updateMine(user, req.body));
  });

  return router;
}
