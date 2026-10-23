import axios from "axios";
import { z } from "zod";

const errorCode = z.object({ error: z.object({ code: z.string() }) });

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
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
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
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
    return Promise.reject(new ApiError(status, code, message));
  },
);
