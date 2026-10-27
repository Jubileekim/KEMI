import axios from "axios";
import { session } from "../app/session";
import { api } from "../shared/api/client";

// DEV-only transport. Real /api transport remains unchanged.
export default async function memberRequest(
  path: string,
  signal?: AbortSignal,
  command?: unknown,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    url: path,
    baseURL: "/",
    method: command === undefined ? "GET" : "POST",
    data: command,
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
