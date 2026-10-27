import axios from "axios";
import { z } from "zod";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import { signatureRoundSchema, type SignatureCommand } from "./signature-model";

export const signatureViewSchema = z.strictObject({
  rounds: z.array(signatureRoundSchema),
  now: z.iso.datetime(),
  editable: z.boolean(),
});
export async function signatureRequest(
  id: string,
  command?: SignatureCommand,
  signal?: AbortSignal,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    url: `/__mock__/signatures/${encodeURIComponent(id)}`,
    baseURL: "/",
    method: command ? "POST" : "GET",
    signal,
    data: command,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function loadSignatures(id: string, signal?: AbortSignal) {
  return signatureViewSchema.parse(
    await signatureRequest(id, undefined, signal),
  );
}
export async function updateSignature(command: SignatureCommand) {
  return z
    .strictObject({ ok: z.literal(true) })
    .parse(await signatureRequest(command.requestId, command));
}
