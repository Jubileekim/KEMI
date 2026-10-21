import type {
  AuthTokenResponse,
  MeResponse,
  SocialSignupPendingResponse,
} from "@kemi/shared";
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
import SocialCallbackFailure from "./social/social-callback-failure.js";
import { SOCIAL_TICKET_TTL_SECONDS } from "./social/tickets.js";

export const REFRESH_COOKIE_NAME = "kemi_refresh";

// Refresh 토큰은 인증 경로(/api/auth)로 가는 요청에만 실린다.
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/api/auth",
};

// 소셜 로그인 중간 단계 쿠키 (10분). 콜백·가입 요청도 /api/auth 아래라 경로를 같게 둔다.
export const OAUTH_STATE_COOKIE_NAME = "kemi_oauth_state";
export const SOCIAL_SIGNUP_COOKIE_NAME = "kemi_social_signup";
const SOCIAL_COOKIE_OPTIONS: CookieOptions = {
  ...REFRESH_COOKIE_OPTIONS,
  maxAge: SOCIAL_TICKET_TTL_SECONDS * 1000,
};

function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = req.cookies[name];
  return typeof value === "string" ? value : undefined;
}

function readRefreshCookie(req: Request): string | undefined {
  return readCookie(req, REFRESH_COOKIE_NAME);
}

function readBearerToken(req: Request): string | undefined {
  const header = req.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

function setRefreshCookie(res: Response, result: AuthResult) {
  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: result.sessionExpiresAt.getTime() - Date.now(),
  });
}

function sendAuthResult(res: Response, status: number, result: AuthResult) {
  setRefreshCookie(res, result);
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

  // ─── 소셜 로그인 (Google·카카오) ───
  // 제공자에 등록하는 콜백 주소. Vercel rewrite로 프론트엔드 도메인의 /api/*가 이 서버로 온다.
  const callbackUri = (provider: string) =>
    `${appOrigin}/api/auth/${provider}/callback`;
  // 결과는 항상 프론트엔드의 고정 경로로 돌려보낸다(다른 주소로 보내지 않는다).
  const redirectToApp = (res: Response, params: Record<string, string>) => {
    const url = new URL("/auth/social/callback", appOrigin);
    url.search = new URLSearchParams(params).toString();
    res.redirect(302, url.toString());
  };

  // 없는 제공자 이름은 서비스에서 404로 처리한다.
  const providerOf = (req: Request) => {
    const { provider } = req.params;
    return typeof provider === "string" ? provider : "";
  };

  router.get("/:provider/start", limits.login, async (req, res) => {
    const provider = providerOf(req);
    try {
      const { redirectUrl, stateCookie } = await authService.startSocial(
        provider,
        callbackUri(provider),
      );
      res.cookie(OAUTH_STATE_COOKIE_NAME, stateCookie, SOCIAL_COOKIE_OPTIONS);
      res.redirect(302, redirectUrl);
    } catch (err) {
      if (!(err instanceof SocialCallbackFailure)) throw err;
      redirectToApp(res, { error: err.reason });
    }
  });

  router.get("/:provider/callback", limits.login, async (req, res) => {
    // state 쿠키는 한 번만 쓴다.
    res.clearCookie(OAUTH_STATE_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    const provider = providerOf(req);
    try {
      const result = await authService.finishSocial(
        provider,
        req.query,
        readCookie(req, OAUTH_STATE_COOKIE_NAME),
        callbackUri(provider),
      );
      if (result.kind === "login") {
        // Access 토큰은 주소에 싣지 않는다. 프론트엔드가 refresh로 받는다.
        setRefreshCookie(res, result.auth);
        redirectToApp(res, { result: "login" });
      } else {
        res.cookie(
          SOCIAL_SIGNUP_COOKIE_NAME,
          result.signupTicket,
          SOCIAL_COOKIE_OPTIONS,
        );
        redirectToApp(res, { result: "signup" });
      }
    } catch (err) {
      if (!(err instanceof SocialCallbackFailure)) throw err;
      redirectToApp(res, { error: err.reason });
    }
  });

  router.get("/social/signup", async (req, res) => {
    const body: SocialSignupPendingResponse =
      await authService.readSocialSignup(
        readCookie(req, SOCIAL_SIGNUP_COOKIE_NAME),
      );
    res.json(body);
  });

  router.post("/social/signup", limits.signup, async (req, res) => {
    requireAppOrigin(req);
    const result = await authService.completeSocialSignup(
      readCookie(req, SOCIAL_SIGNUP_COOKIE_NAME),
      req.body,
    );
    res.clearCookie(SOCIAL_SIGNUP_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
    sendAuthResult(res, 201, result);
  });

  router.get("/me", async (req, res) => {
    const body: MeResponse = {
      user: await authService.authenticate(readBearerToken(req)),
    };
    res.json(body);
  });

  return router;
}
