import axios from "axios";
import { z } from "zod";
import { api } from "../shared/api/client";
import { session } from "../app/session";
import type { DirectSend } from "./direct-contract";

export default async function sendDirect(command: DirectSend) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.post<unknown>("/__mock__/direct", command, {
    baseURL: "/",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return z
    .strictObject({ ok: z.literal(true), id: z.string().uuid() })
    .parse(response.data);
}
