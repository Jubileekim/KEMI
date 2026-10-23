import axios from "axios";
import { z } from "zod";
import type {
  AuthTokenResponse,
  AuthUser,
  LoginRequest,
  SignupRequest,
} from "@kemi/shared";
import { api, ApiError } from "../../shared/api/client";
import { authResponseSchema, authUserSchema } from "./contracts";
import type { Role } from "../../app/routes";

export interface SessionState {
  status:
    | "checking"
    | "guest"
    | "authenticated"
    | "error"
    | "logging-out"
    | "logout-error";
  role: Role;
  user: AuthUser | null;
  notice: string;
}
const guest: SessionState = {
  status: "guest",
  role: "guest",
  user: null,
  notice: "",
};
const roleOf = (user: AuthUser): Role => {
  if (user.role === "CLIENT") return "client";
  if (user.role === "CREATOR") return "creator";
  return "ops";
};

// One controller per browser tab. Tokens never enter a React/Query/devtools store or browser storage.
export default function createSessionController(
  enabled: boolean,
  clearPrivate: () => void,
  mock = false,
) {
  let state: SessionState = enabled ? { ...guest, status: "checking" } : guest;
  let token = "";
  let expiresAt = 0;
  let epoch = 0;
  let refreshFlight: Promise<void> | undefined;
  let bootstrapFlight: Promise<void> | undefined;
  let cookieQueue: Promise<unknown> = Promise.resolve();
  // Serialize every cookie-writing auth operation, including logout/login, so a
  // late refresh Set-Cookie cannot overwrite a newer login's cookie.
  function withCookieLock<T>(run: () => Promise<T>): Promise<T> {
    const operation = cookieQueue
      .catch(() => {})
      .then(async () => {
        if (typeof navigator !== "undefined" && navigator.locks) {
          return navigator.locks.request("kemi-auth-refresh", run);
        }
        return run();
      });
    cookieQueue = operation;
    return operation;
  }
  const listeners = new Set<() => void>();
  const publish = (next: SessionState) => {
    state = next;
    listeners.forEach((fn) => fn());
  };
  function reset(notice = "", status: SessionState["status"] = "guest") {
    epoch += 1;
    token = "";
    expiresAt = 0;
    clearPrivate();
    publish({ ...guest, notice, status });
  }
  function accept(result: AuthTokenResponse, expected: number) {
    if (expected !== epoch) throw new axios.CanceledError();
    if (
      state.user &&
      (state.user.id !== result.user.id || state.user.role !== result.user.role)
    ) {
      reset("계정 정보가 변경되었어요. 다시 로그인해 주세요.");
      throw new ApiError(401, "ACCOUNT_CHANGED", "다시 로그인해 주세요.");
    }
    if (result.user.status !== "ACTIVE")
      throw new ApiError(403, "FORBIDDEN", "이용이 제한된 계정이에요.");
    token = result.accessToken;
    expiresAt = Date.now() + result.accessTokenExpiresIn * 1000;
    publish({
      status: state.status === "checking" ? "checking" : "authenticated",
      user: result.user,
      role: roleOf(result.user),
      notice: "",
    });
  }
  async function refreshAttempt(expected: number) {
    const started = Date.now();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (expected !== epoch) throw new axios.CanceledError();
      const remaining = 3000 - (Date.now() - started);
      if (remaining <= 0)
        throw new ApiError(409, "REFRESH_RACE", "다시 로그인해 주세요.");
      try {
        // Rotation retries must be sequential and share one bounded budget.
        // eslint-disable-next-line no-await-in-loop
        const response = await api.post<unknown>(
          "/api/auth/refresh",
          undefined,
          { withCredentials: true, timeout: remaining },
        );
        accept(authResponseSchema.parse(response.data), expected);
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || attempt === 2) throw error;
        const networkRetry = error.code === "NETWORK_ERROR" && attempt === 0;
        if (error.code !== "REFRESH_RACE" && !networkRetry) throw error;
        const wait = networkRetry
          ? 0
          : (error.retryAfterMs ?? (attempt + 1) * 500);
        if (Date.now() - started + wait >= 3000) throw error;
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => {
          setTimeout(resolve, wait);
        });
      }
    }
  }
  function refresh() {
    if (refreshFlight) return refreshFlight;
    const expected = epoch;
    const run = () => refreshAttempt(expected);
    const operation = withCookieLock(run);
    refreshFlight = Promise.resolve(operation)
      .then(() => {})
      .catch((error: unknown) => {
        if (expected === epoch)
          reset(
            "로그인이 만료되었거나 세션을 확인하지 못했어요. 다시 로그인해 주세요.",
          );
        throw error;
      })
      .finally(() => {
        refreshFlight = undefined;
      });
    return refreshFlight;
  }
  async function getToken() {
    if (
      state.status !== "authenticated" &&
      !(state.status === "checking" && token)
    )
      throw new ApiError(401, "SESSION_REVOKED", "다시 로그인해 주세요.");
    if (Date.now() >= expiresAt) await refresh();
    return token;
  }
  async function bootstrap() {
    if (!enabled) return undefined;
    if (bootstrapFlight) return bootstrapFlight;
    bootstrapFlight = (async () => {
      publish({ ...guest, status: "checking" });
      try {
        await refresh();
        const expected = epoch;
        const response = await api.get<unknown>("/api/auth/me");
        const { user } = z
          .object({ user: authUserSchema })
          .parse(response.data);
        if (expected !== epoch) return;
        if (user.status !== "ACTIVE")
          throw new ApiError(403, "FORBIDDEN", "이용이 제한된 계정이에요.");
        publish({
          ...state,
          status: "authenticated",
          user,
          role: roleOf(user),
        });
      } catch (error) {
        if (axios.isCancel(error)) return;
        if (error instanceof ApiError && error.status === 401) reset();
        else
          reset(
            "세션을 확인하지 못했어요. 다시 확인하거나 로그인해 주세요.",
            "error",
          );
      }
    })().finally(() => {
      bootstrapFlight = undefined;
    });
    return bootstrapFlight;
  }
  async function authenticate(
    input: LoginRequest | SignupRequest,
    signup = false,
  ) {
    if (!enabled || (signup && !mock))
      throw new ApiError(
        0,
        "CONTRACT_PENDING",
        "가입 API의 비밀번호 정책 조율이 필요해요.",
      );
    reset();
    const expected = epoch;
    const response = await withCookieLock(() =>
      api.post<unknown>(`/api/auth/${signup ? "signup" : "login"}`, input, {
        withCredentials: true,
      }),
    );
    accept(authResponseSchema.parse(response.data), expected);
  }
  async function verify() {
    if (state.status !== "authenticated") return;
    const expected = epoch;
    try {
      const response = await api.get<unknown>("/api/auth/me");
      const { user } = z.object({ user: authUserSchema }).parse(response.data);
      if (expected !== epoch) return;
      if (user.status !== "ACTIVE")
        throw new ApiError(403, "FORBIDDEN", "이용이 제한된 계정이에요.");
      publish({ ...state, user, role: roleOf(user) });
    } catch (error) {
      if (expected === epoch && !axios.isCancel(error))
        reset("세션을 확인하지 못했어요. 다시 로그인해 주세요.");
    }
  }
  async function logout() {
    if (state.status === "logging-out") return;
    reset("", "logging-out");
    const expected = epoch;
    try {
      await withCookieLock(() =>
        api.post("/api/auth/logout", undefined, { withCredentials: true }),
      );
      if (expected === epoch) publish({ ...guest, notice: "로그아웃했어요." });
    } catch {
      if (expected === epoch)
        publish({
          ...guest,
          status: "logout-error",
          notice:
            "이 기기의 화면 정보는 지웠지만 서버 로그아웃을 확인하지 못했어요. 다시 시도해 주세요.",
        });
    }
  }
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    snapshot: () => state,
    epoch: () => epoch,
    getToken,
    bootstrap,
    authenticate,
    verify,
    logout,
    async recover(stale: string) {
      if (!stale) {
        reset("로그인이 만료되었어요. 다시 로그인해 주세요.");
        throw new ApiError(401, "SESSION_REVOKED", "다시 로그인해 주세요.");
      }
      if (stale === token) await refresh();
    },
    setMockRole(role: Role) {
      if (!mock) return;
      reset();
      if (role !== "guest")
        publish({ ...guest, role, status: "authenticated" });
    },
  };
}
