import { SOCIAL_CALLBACK_ERRORS } from "@kemi/shared";
import safeReturnTo from "./redirect";
import type { Role } from "../../app/routes";

const returnKey = "kemi.google.return";
export function readGoogleCallback(search: string) {
  const params = new URLSearchParams(search);
  if (Array.from(params.keys()).length !== 1) return "INVALID";
  const result = params.get("result");
  if (result === "login" || result === "signup") return result;
  return (
    SOCIAL_CALLBACK_ERRORS.find((error) => error === params.get("error")) ??
    "INVALID"
  );
}
export function rememberGoogleReturn(candidate: string | null) {
  try {
    // Only an internal path, never OAuth state, tickets or credentials.
    sessionStorage.setItem(
      returnKey,
      JSON.stringify({
        path:
          candidate &&
          (safeReturnTo(candidate, "client") === candidate ||
            safeReturnTo(candidate, "creator") === candidate)
            ? candidate
            : null,
        time: Date.now(),
      }),
    );
  } catch {
    /* Storage is optional; role-specific fallback still works. */
  }
}
export function googleReturn(role: Role) {
  try {
    const raw: unknown = JSON.parse(
      sessionStorage.getItem(returnKey) ?? "null",
    );
    sessionStorage.removeItem(returnKey);
    if (typeof raw === "object" && raw !== null) {
      const path: unknown = Reflect.get(raw, "path");
      const time: unknown = Reflect.get(raw, "time");
      if (
        typeof path === "string" &&
        typeof time === "number" &&
        Date.now() - time >= 0 &&
        Date.now() - time < 600_000
      )
        return safeReturnTo(path, role);
    }
  } catch {
    /* Ignore invalid or unavailable optional storage. */
  }
  return safeReturnTo(null, role);
}
export const googleErrors: Record<string, string> = {
  SOCIAL_CANCELLED: "Google 로그인을 취소했어요. 계정을 만들지 않았어요.",
  SOCIAL_FAILED: "Google 로그인을 확인하지 못했어요. 다시 시작해 주세요.",
  SOCIAL_UNAVAILABLE:
    "Google 로그인 연결이 준비되지 않았어요. 잠시 후 이용해 주세요.",
  SOCIAL_RATE_LIMITED:
    "요청이 많아요. 잠시 후 Google 로그인을 다시 시작해 주세요.",
  FORBIDDEN: "이용이 제한된 계정이에요. 다른 로그인 방법을 확인해 주세요.",
  INVALID: "올바르지 않은 로그인 결과예요. Google 로그인을 다시 시작해 주세요.",
};
