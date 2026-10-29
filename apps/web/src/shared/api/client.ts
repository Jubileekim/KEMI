import axios from "axios";
import { z } from "zod";

const errorCode = z.object({
  error: z.object({
    code: z.string(),
    message: z.string().optional(),
    // 요청 제한은 객체({ retryAfterMs }), 입력 검사는 항목 배열([{ path, message }])이다.
    details: z.unknown().optional(),
  }),
});
const retryDetails = z.object({
  retryAfterMs: z.number().nonnegative().finite().optional(),
});
const issueDetails = z.array(z.object({ message: z.string().optional() }));
const hangul = /[\uac00-\ud7a3]/;

// 사용자에게 보여 줄 서버 문구. KEMI 서버의 4xx 문구는 사용자용 한국어로 쓴다(예: "검토본이 승인된 뒤에 최종본을 낼 수 있습니다.").
// 한국어가 아니거나 너무 긴 문구, 인증·요청 제한·서버 오류(401·429·5xx)는 쓰지 않고 화면 문구를 쓴다.
function userMessage(
  status: number,
  body: z.infer<typeof errorCode>["error"],
): string | undefined {
  if (status < 400 || status >= 500 || status === 401 || status === 429)
    return undefined;
  const issues = issueDetails.safeParse(body.details);
  const candidates = [
    ...(issues.success ? issues.data.map((issue) => issue.message) : []),
    body.message,
  ];
  return candidates.find(
    (text): text is string =>
      typeof text === "string" && hangul.test(text) && text.length <= 200,
  );
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfterMs?: number,
    // 서버가 준 사용자용 이유(4xx). 없으면 undefined
    public serverMessage?: string,
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
// 공개 탐색과 행동 기록은 비회원도 호출할 수 있다. 그 외 경로는 인증을 유지한다.
function publicPath(url = "", method = "get") {
  const path = url.split("?")[0] ?? "";
  if (method.toLowerCase() === "post") return path === "/api/analytics/events";
  if (method.toLowerCase() !== "get") return false;
  return (
    path === "/api/feed" ||
    path === "/api/projects" ||
    /^\/api\/(projects|creators|packages)\/[1-9]\d*$/.test(path) ||
    /^\/api\/portfolios\/[1-9]\d*(\/media)?$/.test(path) ||
    /^\/api\/users\/[1-9]\d*\/reviews$/.test(path)
  );
}
api.interceptors.request.use(async (input) => {
  const config = input;
  if (session && protectedPath(config.url)) {
    // 비로그인 공개 조회는 세션과 무관하다. 세션 번호에 묶지 않아, 확인 중 세션이 바뀌어도 취소되지 않는다.
    if (
      session.isAuthenticated?.() === false &&
      publicPath(config.url, config.method)
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
    // 기본은 화면 문구를 쓴다. 서버의 사용자용 이유는 serverMessage로 따로 넘긴다(userMessage 참고).
    const retry = parsed.success
      ? retryDetails.safeParse(parsed.data.error.details)
      : undefined;
    return Promise.reject(
      new ApiError(
        status,
        code,
        message,
        retry?.success ? retry.data.retryAfterMs : undefined,
        parsed.success ? userMessage(status, parsed.data.error) : undefined,
      ),
    );
  },
);
