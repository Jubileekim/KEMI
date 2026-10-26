import axios from "axios";
import { z } from "zod";
import { api } from "../shared/api/client";
import { session } from "../app/session";
import {
  assetSchema,
  deliveryVersionSchema,
  deliveryViewSchema,
  videoTypes,
  type DeliveryCommand,
} from "./delivery-model";

async function request(
  path: string,
  signal?: AbortSignal,
  data?: DeliveryCommand | FormData,
  media = false,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    baseURL: "/",
    url: path,
    method: data ? "POST" : "GET",
    data,
    signal,
    responseType: media ? "blob" : "json",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
const path = (id: string) => `/__mock__/deliveries/${encodeURIComponent(id)}`;
export async function loadDeliveries(id: string, signal?: AbortSignal) {
  const view = deliveryViewSchema.parse(await request(path(id), signal));
  if (view.contractId !== id) throw new Error("Invalid Mock delivery identity");
  return view;
}
export async function uploadDelivery(id: string, file: File) {
  const form = new FormData();
  form.set("id", crypto.randomUUID());
  form.set("file", file);
  return assetSchema.parse(
    await request(`${path(id)}/assets`, undefined, form),
  );
}
export async function saveDelivery(id: string, command: DeliveryCommand) {
  return z
    .strictObject({ ok: z.literal(true) })
    .parse(await request(path(id), undefined, command));
}
export async function loadDeliveryMedia(
  id: string,
  versionId: string,
  signal?: AbortSignal,
) {
  return z
    .instanceof(Blob)
    .refine(
      (value) =>
        value.size > 0 && videoTypes.some((type) => value.type === type),
    )
    .parse(
      await request(
        `${path(id)}/media/${encodeURIComponent(versionId)}`,
        signal,
        undefined,
        true,
      ),
    );
}
export async function loadDeliveryEvents(roomId: string, signal?: AbortSignal) {
  return z
    .array(
      z.strictObject({
        contractId: z.string().uuid(),
        version: deliveryVersionSchema,
      }),
    )
    .parse(
      await request(
        `/__mock__/delivery-events/${encodeURIComponent(roomId)}`,
        signal,
      ),
    );
}
