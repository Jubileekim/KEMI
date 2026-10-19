import { rateLimit } from "express-rate-limit";
import AppError from "../http/app-error.js";

const MINUTE_MS = 60 * 1000;

// 클라이언트 IP(req.ip)마다 요청 수를 센다. IP 판단은 app의 trust proxy 설정을 따른다.
// 저장소는 서버 메모리라서, 서버가 재시작되거나 여러 대로 늘어나면 대수만큼 따로 센다.
function limitPerIp(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, _res, next) => {
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

export default function createAuthRateLimits() {
  return {
    signup: limitPerIp(60 * MINUTE_MS, 10),
    login: limitPerIp(15 * MINUTE_MS, 10),
    refresh: limitPerIp(15 * MINUTE_MS, 60),
  };
}
