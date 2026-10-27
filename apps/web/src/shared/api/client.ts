import axios from "axios";
import { z } from "zod";

const errorCode = z.object({
  error: z.object({
    code: z.string(),
    details: z
      .object({ retryAfterMs: z.number().nonnegative().finite().optional() })
      .optional(),
  }),
});

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const messages: Record<number, string> = {
  401: "로그인이 필요해요.",
  403: "접근 권한이 없어요.",
  404: "대상을 찾을 수 없어요.",
  409: "상태가 변경되었어요. 다시 확인해 주세요.",
  500: "서버 오류가 발생했어요.",
};
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/",
  timeout: 10000,
});
interface SessionTransport {
  token: () => Promise<string>;
  recover: (token: string) => Promise<void>;
  epoch: () => number;
  isAuthenticated?: () => boolean;
}
let session: SessionTransport | undefined;
export function connectSession(transport: SessionTransport) {
  session = transport;
}
declare module "axios" {
  interface InternalAxiosRequestConfig {
    sessionEpoch?: number;
    sessionToken?: string;
    sessionRetried?: boolean;
  }
}
function protectedPath(url = "") {
  return (
    url === "/api/auth/me" ||
    (url.startsWith("/api/") && !url.startsWith("/api/auth/"))
  );
}
// 공개 조회는 비로그인 상태에서도 가능하다. 쓰기·내 정보는 항상 Bearer 검증한다.
function publicReadPath(url = "", method = "get") {
  if (method.toLowerCase() !== "get") return false;
  const path = url.split("?")[0];
  return (
    path === "/api/feed" ||
    path === "/api/projects" ||
    new RegExp("^/api/projects/[1-9][0-9]*$").test(path) ||
    new RegExp("^/api/creators/[1-9][0-9]*$").test(path) ||
    new RegExp("^/api/packages/[1-9][0-9]*$").test(path) ||
    new RegExp("^/api/portfolios/[1-9][0-9]*(/media)?$").test(path)
  );
}
api.interceptors.request.use(async (input) => {
  const config = input;
  if (session && protectedPath(config.url)) {
    if (
      publicReadPath(config.url, config.method) &&
      session.isAuthenticated?.() === false
    )
      return config;
    config.sessionEpoch ??= session.epoch();
    if (config.sessionEpoch !== session.epoch())
      throw new axios.CanceledError();
    const token = await session.token();
    if (config.sessionEpoch !== session.epoch())
      throw new axios.CanceledError();
    config.sessionToken = token;
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});
api.interceptors.response.use(
  async (response) => {
    if (
      session &&
      response.config.sessionEpoch !== undefined &&
      response.config.sessionEpoch !== session.epoch()
    )
      throw new axios.CanceledError();
    return response;
  },
  async (error: unknown) => {
    if (
      !axios.isAxiosError<unknown>(error) ||
      !session ||
      !error.config?.sessionToken
    )
      throw error;
    const { config } = error;
    if (config.sessionEpoch !== session.epoch())
      throw new axios.CanceledError();
    const parsed = errorCode.safeParse(error.response?.data);
    if (error.response?.status === 401) {
      if (
        !config.sessionRetried &&
        parsed.success &&
        parsed.data.error.code === "TOKEN_EXPIRED"
      ) {
        await session.recover(config.sessionToken ?? "");
        // Never replay a write. The caller must ask the user to submit again.
        if ((config.method ?? "get").toLowerCase() === "get") {
          config.sessionRetried = true;
          return api.request(config);
        }
      } else {
        await session.recover("");
      }
    }
    throw error;
  },
);
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof ApiError) return Promise.reject(error);
    if (axios.isCancel(error)) return Promise.reject(error);
    if (!axios.isAxiosError<unknown>(error))
      return Promise.reject(
        new ApiError(0, "UNKNOWN", "요청을 처리하지 못했어요."),
      );
    const status = error.response?.status ?? 0;
    const parsed = errorCode.safeParse(error.response?.data);
    let code = status ? "HTTP_ERROR" : "NETWORK_ERROR";
    if (parsed.success) code = parsed.data.error.code;
    let message = messages[status] ?? "요청을 처리하지 못했어요.";
    if (!status) {
      message =
        error.code === "ECONNABORTED"
          ? "응답 시간이 초과되었어요."
          : "네트워크 연결을 확인해 주세요.";
    }
    // Render local copy; server messages may expose implementation details.
    return Promise.reject(
      new ApiError(
        status,
        code,
        message,
        parsed.success ? parsed.data.error.details?.retryAfterMs : undefined,
      ),
    );
  },
);
