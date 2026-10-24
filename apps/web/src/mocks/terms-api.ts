import axios from "axios";
import { z } from "zod";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import { termsDocumentSchema, type TermsCommand } from "./terms-model";

export const termsViewSchema = z.strictObject({
  document: termsDocumentSchema,
  editable: z.boolean(),
});
export type TermsView = z.infer<typeof termsViewSchema>;
async function request(
  id: string,
  signal?: AbortSignal,
  command?: TermsCommand,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    url: `/__mock__/terms/${encodeURIComponent(id)}`,
    baseURL: "/",
    method: command ? "POST" : "GET",
    signal,
    data: command,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function loadTerms(id: string, signal?: AbortSignal) {
  return termsViewSchema.parse(await request(id, signal));
}
export async function updateTerms(command: TermsCommand) {
  return z
    .strictObject({ ok: z.literal(true) })
    .parse(await request(command.requestId, undefined, command));
}
