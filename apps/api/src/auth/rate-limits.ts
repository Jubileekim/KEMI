import type { RequestHandler, Response } from "express";
import { rateLimit } from "express-rate-limit";
import AppError from "../http/app-error.js";

const MINUTE_MS = 60 * 1000;

// 소셜 로그인 시작·콜백의 제한 [제안]. 시작과 콜백은 따로 센다(한 번 로그인에 두 번 차감되지 않게).
export const SOCIAL_RATE_LIMITS = {
  windowMs: 15 * MINUTE_MS,
  start: 20,
  callback: 20,
} as const;

// 클라이언트 IP(req.ip)마다 요청 수를 센다. IP 판단은 app의 trust proxy 설정을 따른다.
// 저장소는 서버 메모리라서, 서버가 재시작되거나 여러 대로 늘어나면 대수만큼 따로 센다.
// onLimit을 주지 않으면 429 JSON 오류로 응답한다.
function limitPerIp(
  windowMs: number,
  limit: number,
  onLimit?: (res: Response) => void,
): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res, next) => {
      if (onLimit) {
        onLimit(res);
        return;
      }
      next(
        new AppError(
          429,
          "RATE_LIMITED",
          "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        ),
      );
    },
  });
}

// socialLimited: 소셜 로그인은 브라우저가 이동하는 경로라 JSON 오류 대신 프론트엔드 안내 화면으로 보낸다.
export default function createAuthRateLimits(
  socialLimited: (res: Response) => void,
) {
  return {
    signup: limitPerIp(60 * MINUTE_MS, 10),
    login: limitPerIp(15 * MINUTE_MS, 10),
    refresh: limitPerIp(15 * MINUTE_MS, 60),
    socialStart: limitPerIp(
      SOCIAL_RATE_LIMITS.windowMs,
      SOCIAL_RATE_LIMITS.start,
      socialLimited,
    ),
    socialCallback: limitPerIp(
      SOCIAL_RATE_LIMITS.windowMs,
      SOCIAL_RATE_LIMITS.callback,
      socialLimited,
    ),
  };
}
