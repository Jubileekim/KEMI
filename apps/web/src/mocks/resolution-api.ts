import axios from "axios";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import {
  resolutionViewSchema,
  type CancellationCommand,
} from "./resolution-model";

export default async function loadResolution(
  id: string,
  signal?: AbortSignal,
  command?: CancellationCommand,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    baseURL: "/",
    url: `/__mock__/resolution/${encodeURIComponent(id)}`,
    method: command ? "POST" : "GET",
    data: command,
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const view = resolutionViewSchema.parse(response.data);
  if (view.contractId !== id) throw new Error("Invalid resolution identity");
  return view;
}
