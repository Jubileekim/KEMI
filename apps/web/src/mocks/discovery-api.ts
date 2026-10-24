import axios from "axios";
import { z } from "zod";
import { api } from "../shared/api/client";
import { session } from "../app/session";
import { browseResultSchema, listingSchema } from "./discovery-model";

export const detailSchema = z.strictObject({
  item: listingSchema,
  revision: z.number().int().nonnegative().nullable(),
});
export async function discoveryRequest(
  path: string,
  signal?: AbortSignal,
  revision?: number,
) {
  const epoch = session.epoch();
  const token =
    session.snapshot().status === "authenticated"
      ? await session.getToken()
      : "";
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    url: `/__mock__/discovery${path}`,
    baseURL: "/",
    signal,
    method: revision === undefined ? "GET" : "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    data: revision === undefined ? undefined : { revision },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function listDiscovery(search: string, signal?: AbortSignal) {
  return browseResultSchema.parse(await discoveryRequest(`?${search}`, signal));
}
export async function detailDiscovery(id: string, signal?: AbortSignal) {
  return detailSchema.parse(
    await discoveryRequest(`/${encodeURIComponent(id)}`, signal),
  );
}
export async function closeDiscovery(id: string, revision: number) {
  return detailSchema.parse(
    await discoveryRequest(
      `/${encodeURIComponent(id)}/close`,
      undefined,
      revision,
    ),
  );
}
