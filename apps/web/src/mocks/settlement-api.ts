import axios from "axios";
import { z } from "zod";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import {
  settlementViewSchema,
  settlementRecordSchema,
  type SettlementCommand,
} from "./settlement-model";

async function request(
  path: string,
  signal?: AbortSignal,
  command?: SettlementCommand,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    baseURL: "/",
    url: path,
    method: command ? "POST" : "GET",
    signal,
    data: command,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function loadSettlement(
  id: string,
  signal?: AbortSignal,
  command?: SettlementCommand,
) {
  const view = settlementViewSchema.parse(
    await request(
      `/__mock__/settlements/${encodeURIComponent(id)}`,
      signal,
      command,
    ),
  );
  if (view.contractId !== id)
    throw new Error("Invalid Mock settlement identity");
  return view;
}
export async function loadSettlementEvents(id: string, signal?: AbortSignal) {
  return z
    .array(
      z.strictObject({
        contractId: z.string().uuid(),
        record: settlementRecordSchema,
      }),
    )
    .parse(
      await request(
        `/__mock__/settlement-events/${encodeURIComponent(id)}`,
        signal,
      ),
    )
    .filter((event) => event.record.status === "SUCCEEDED");
}
export async function loadWorkEvents(id: string, signal?: AbortSignal) {
  return z
    .array(
      z.strictObject({
        id: z.string().min(1),
        at: z.iso.datetime(),
        label: z.string(),
        path: z.string(),
      }),
    )
    .parse(
      await request(`/__mock__/work-events/${encodeURIComponent(id)}`, signal),
    )
    .map((event) => {
      // Only same-room signatures or UUID contract preparation anchors are navigable.
      const signature = event.path.startsWith(`/workspace/${id}#signature-`);
      const preparation =
        /^\/contracts\/[0-9a-f-]{36}\/production#production-[0-9a-f-]{36}$/.test(
          event.path,
        );
      if (!signature && !preparation)
        throw new Error("Invalid Mock event destination");
      return event;
    });
}
