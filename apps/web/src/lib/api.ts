import axios from "axios";
import { ERROR_CODES } from "@kemi/shared";
import { z } from "zod";

// 서비스 API는 Vite 프록시 / Vercel rewrite를 통해 같은 출처로 호출한다.
export const api = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const errorBodySchema = z.object({
  error: z.object({ code: z.enum(ERROR_CODES), message: z.string() }),
});

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<unknown>(error)) {
    const result = errorBodySchema.safeParse(error.response?.data);
    if (result.success) return result.data.error.message;
    if (error.code === "ECONNABORTED")
      return "서버 응답이 늦습니다. 다시 시도해주세요.";
    return "서버에 연결하지 못했습니다. API 서버 실행 상태를 확인해주세요.";
  }
  return "서버 응답을 확인하지 못했습니다. 다시 시도해주세요.";
}
