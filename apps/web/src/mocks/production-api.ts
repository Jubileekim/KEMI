import axios from "axios";
import { z } from "zod";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import {
  productionViewSchema,
  type ProductionCommand,
} from "./production-model";

async function request(
  id: string,
  command?: ProductionCommand,
  signal?: AbortSignal,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    baseURL: "/",
    url: `/__mock__/production/${encodeURIComponent(id)}`,
    method: command ? "POST" : "GET",
    data: command,
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function loadProduction(id: string, signal?: AbortSignal) {
  const view = productionViewSchema.parse(await request(id, undefined, signal));
  if (view.contractId !== id) throw new Error("Invalid Mock contract identity");
  return view;
}
export async function updateProduction(id: string, command: ProductionCommand) {
  return z
    .strictObject({ ok: z.literal(true) })
    .parse(await request(id, command));
}
