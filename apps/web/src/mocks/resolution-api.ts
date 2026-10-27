import axios from "axios";
import { z } from "zod";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import { finalAssetSchema } from "./final-model";
import {
  resolutionViewSchema,
  type ResolutionCommand,
} from "./resolution-model";

export default async function loadResolution(
  id: string,
  signal?: AbortSignal,
  command?: ResolutionCommand,
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
async function request(path: string, signal?: AbortSignal, data?: unknown) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    baseURL: "/",
    url: path,
    method: data ? "POST" : "GET",
    data,
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function loadOperations(signal?: AbortSignal) {
  return z
    .array(resolutionViewSchema)
    .parse(await request("/__mock__/operations/resolution", signal));
}
export async function reviewResolution(id: string, command: ResolutionCommand) {
  const view = resolutionViewSchema.parse(
    await request(
      `/__mock__/operations/resolution/${encodeURIComponent(id)}`,
      undefined,
      command,
    ),
  );
  if (view.contractId !== id) throw new Error("Invalid operations identity");
  return view;
}
export async function loadDispute(id: string, signal?: AbortSignal) {
  const view = resolutionViewSchema.parse(
    await request(`/__mock__/disputes/${encodeURIComponent(id)}`, signal),
  );
  if (!view.state.workflow.disputes.some((d) => d.id === id))
    throw new Error("Invalid dispute identity");
  return view;
}
export async function uploadResolutionFile(id: string, file: File) {
  const assetId = crypto.randomUUID();
  const asset = finalAssetSchema.parse({
    id: assetId,
    name: file.name,
    mime: file.type,
    size: file.size,
  });
  const form = new FormData();
  form.set("id", assetId);
  form.set("file", file);
  const returned = finalAssetSchema.parse(
    await request(
      `/__mock__/resolution/${encodeURIComponent(id)}/assets`,
      undefined,
      form,
    ),
  );
  if (
    returned.id !== asset.id ||
    returned.name !== asset.name ||
    returned.size !== asset.size ||
    returned.mime !== asset.mime
  )
    throw new Error("Invalid uploaded file identity");
  return returned;
}
export async function downloadResolutionFile(
  id: string,
  file: z.infer<typeof finalAssetSchema>,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const result = await api.get<Blob>(
    `/__mock__/resolution/${encodeURIComponent(id)}/files/${encodeURIComponent(file.id)}`,
    {
      baseURL: "/",
      responseType: "blob",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  if (
    !(result.data instanceof Blob) ||
    result.data.size !== file.size ||
    result.data.type !== file.mime
  )
    throw new Error("Invalid download response");
  return result.data;
}
