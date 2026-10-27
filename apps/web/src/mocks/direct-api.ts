import axios from "axios";
import { z } from "zod";
import { api } from "../shared/api/client";
import { session } from "../app/session";
import type { DirectSend, DirectResponse } from "./direct-contract";

async function directRequest(
  path: string,
  command: DirectSend | DirectResponse,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.post<unknown>(path, command, {
    baseURL: "/",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return z
    .strictObject({ ok: z.literal(true), id: z.string().uuid() })
    .parse(response.data);
}
export default function sendDirect(command: DirectSend) {
  return directRequest("/__mock__/direct", command);
}
export function respondToDirect(command: DirectResponse) {
  return directRequest("/__mock__/direct/respond", command);
}
