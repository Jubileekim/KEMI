import axios from "axios";
import { api, ApiError } from "../shared/api/client";
import { session } from "../app/session";
import { studioSchema, type StudioCommand } from "./studio-model";

export async function studioRequest(
  command?: StudioCommand,
  revision?: number,
  signal?: AbortSignal,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    url: "/__mock__/studio",
    baseURL: "/",
    method: command ? "POST" : "GET",
    signal,
    headers: { Authorization: `Bearer ${token}` },
    data: command ? { revision, command } : undefined,
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return studioSchema.parse(response.data);
}
export function studioError(error: unknown) {
  if (error instanceof ApiError && error.status === 409)
    return "상태가 변경되었어요. 최신 값 확인 후 다시 저장해 주세요.";
  if (
    error instanceof Error &&
    !axios.isAxiosError(error) &&
    error.name !== "ZodError"
  )
    return error.message;
  return "응답을 확인하지 못했어요. 입력을 보존했으니 최신 값을 확인해 주세요.";
}
