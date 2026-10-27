import axios from "axios";
import { z } from "zod";
import { api } from "../shared/api/client";
import { session } from "../app/session";
import {
  messageSchema,
  proposalSchema,
  type ProposalCommand,
} from "./proposal-model";

const work = z.strictObject({ id: z.string(), title: z.string() });
export const proposalViewSchema = z.strictObject({
  items: z.array(
    proposalSchema.extend({
      unread: z.number().int().nonnegative(),
      lastMessage: z.string(),
    }),
  ),
  messages: z.array(messageSchema),
  campaign: z
    .strictObject({ id: z.string(), title: z.string(), ended: z.boolean() })
    .nullable(),
  servicePublic: z.boolean(),
  works: z.array(work),
});
async function request(
  query: string,
  signal?: AbortSignal,
  command?: ProposalCommand,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const result = await api.request<unknown>({
    url: `/__mock__/proposals${query}`,
    baseURL: "/",
    method: command ? "POST" : "GET",
    signal,
    headers: { Authorization: `Bearer ${token}` },
    data: command,
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return result.data;
}
export async function loadProposals(query: string, signal?: AbortSignal) {
  return proposalViewSchema.parse(await request(query, signal));
}
export async function updateProposal(command: ProposalCommand) {
  return z
    .strictObject({ ok: z.literal(true) })
    .parse(await request("", undefined, command));
}
