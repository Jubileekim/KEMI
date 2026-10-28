import { ApiError } from "../../shared/api/client";

export const selectClass =
  "h-10 min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring";

export function errorText(
  error: unknown,
  fallback = "요청을 처리하지 못했어요.",
) {
  if (error instanceof ApiError) {
    // 서버가 구체적인 이유를 주면 그대로 보여 준다(예: 승인 전 최종본, 납품일 순서).
    if (error.serverMessage && (error.status === 409 || error.status === 400))
      return error.serverMessage;
    if (error.status === 409)
      return "지금 상태에서는 할 수 없어요. 화면을 새로 확인해 주세요.";
    if (error.status === 400 && error.code === "VALIDATION_FAILED")
      return "입력 내용을 확인해 주세요.";
    if (error.status === 503)
      return "외부 서비스 연결이 준비되지 않았어요. 잠시 후 다시 시도해 주세요.";
    return error.message;
  }
  return fallback;
}
