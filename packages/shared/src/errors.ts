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
  "RATE_LIMITED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  // 패키지 최대 개수 초과
  "PACKAGE_LIMIT_EXCEEDED",
  // 다른 공개 패키지가 있어 대표 패키지를 비공개·삭제할 수 없음 (대표를 먼저 바꿔야 함)
  "REPRESENTATIVE_REQUIRED",
  // 서비스 공개 조건 미충족. details.missing에 빠진 항목
  "SERVICE_REQUIREMENTS_MISSING",
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
