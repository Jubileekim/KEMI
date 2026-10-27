import { matchRoutes } from "react-router";
import { screens, type Role } from "../../app/routes";

export default function safeReturnTo(
  candidate: string | null,
  role: Role,
): string {
  const fallback = role === "creator" ? "/studio/portfolio" : "/me/activity";
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    /[\\#%\s]/.test(candidate) ||
    Array.from(candidate).some((character) => character.charCodeAt(0) < 32) ||
    candidate.startsWith("//")
  )
    return fallback;
  const path = candidate.split("?")[0] ?? "";
  const screen = matchRoutes(screens, path)?.[0]?.route;
  if (
    !screen ||
    ["/login", "/signup", "/auth/social/callback", "/onboarding"].includes(
      screen.path,
    )
  )
    return fallback;
  if (screen.roles && !screen.roles.includes(role)) return fallback;
  return candidate;
}
