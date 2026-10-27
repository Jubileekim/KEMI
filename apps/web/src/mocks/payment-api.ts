import axios from "axios";
import { z } from "zod";
import { session } from "../app/session";
import { api } from "../shared/api/client";
import { paymentViewSchema, type PaymentCommand } from "./payment-model";

async function requestPayment(
  id: string,
  command?: PaymentCommand,
  signal?: AbortSignal,
) {
  const epoch = session.epoch();
  const token = await session.getToken();
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  const response = await api.request<unknown>({
    baseURL: "/",
    url: `/__mock__/payments/${encodeURIComponent(id)}`,
    method: command ? "POST" : "GET",
    data: command,
    signal,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (epoch !== session.epoch()) throw new axios.CanceledError();
  return response.data;
}
export async function loadPayments(id: string, signal?: AbortSignal) {
  const view = paymentViewSchema.parse(
    await requestPayment(id, undefined, signal),
  );
  if (
    view.contract.id !== id ||
    view.orders.some(
      (o) =>
        o.contractId !== id ||
        o.amount !== view.contract.amount ||
        o.currency !== view.contract.currency,
    )
  )
    throw new Error("Invalid Mock payment identity");
  return view;
}
export async function updatePayment(id: string, command: PaymentCommand) {
  return z
    .strictObject({ ok: z.literal(true) })
    .parse(await requestPayment(id, command));
}
