// API 공통 오류 코드. 화면은 message 문구가 아니라 code로 분기한다.
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "INVALID_JSON",
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "SESSION_REVOKED",
  "INVALID_CREDENTIALS",
  "EMAIL_ALREADY_EXISTS",
  "REFRESH_RACE",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
