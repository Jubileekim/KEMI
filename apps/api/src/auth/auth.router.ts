import type { AuthTokenResponse, MeResponse } from "@kemi/shared";
import cookieParser from "cookie-parser";
import {
  type CookieOptions,
  type Request,
  type Response,
  Router,
} from "express";
import AppError from "../http/app-error.js";
import type { AuthResult, AuthService } from "./auth.service.js";
import createAuthRateLimits from "./rate-limits.js";

export const REFRESH_COOKIE_NAME = "kemi_refresh";

// Refresh 토큰은 인증 경로(/api/auth)로 가는 요청에만 실린다.
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/api/auth",
};

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies[REFRESH_COOKIE_NAME];
  return typeof value === "string" ? value : undefined;
}

function readBearerToken(req: Request): string | undefined {
  const header = req.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

function sendAuthResult(res: Response, status: number, result: AuthResult) {
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: result.sessionExpiresAt.getTime() - Date.now(),
  });
  const body: AuthTokenResponse = {
    accessToken: result.accessToken,
    accessTokenExpiresIn: result.accessTokenExpiresIn,
    user: result.user,
  };
  res.status(status).json(body);
}

export function createAuthRouter(
  authService: AuthService,
  appOrigin: string,
): Router {
  const router = Router();
  router.use(cookieParser());
  // 라우터(앱)마다 따로 센다.
  const limits = createAuthRateLimits();

  // 쿠키만으로 동작하는 요청(refresh·logout)은 우리 프론트엔드에서 온 것만 받는다(CSRF 방어).
  const requireAppOrigin = (req: Request) => {
    if (req.get("origin") !== appOrigin) {
      throw new AppError(403, "FORBIDDEN", "허용되지 않은 출처의 요청입니다.");
    }
  };

  router.post("/signup", limits.signup, async (req, res) => {
    sendAuthResult(res, 201, await authService.signup(req.body));
  });

  router.post("/login", limits.login, async (req, res) => {
    sendAuthResult(res, 200, await authService.login(req.body));
  });

  router.post("/refresh", limits.refresh, async (req, res) => {
    requireAppOrigin(req);
    try {
      sendAuthResult(
        res,
        200,
        await authService.refresh(readRefreshCookie(req)),
      );
    } catch (err) {
      // 다시 쓸 수 없는 세션이면 브라우저의 쿠키도 지운다. (409 REFRESH_RACE는 쿠키를 건드리지 않는다)
      if (err instanceof AppError && err.code === "SESSION_REVOKED") {
        res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
      }
      throw err;
    }
  });

  router.post("/logout", async (req, res) => {
    requireAppOrigin(req);
    await authService.logout(readRefreshCookie(req));
    res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    res.status(204).end();
  });

  router.get("/me", async (req, res) => {
    const body: MeResponse = {
      user: await authService.authenticate(readBearerToken(req)),
    };
    res.json(body);
  });

  return router;
}
