import { z } from "zod";
import { ProposalError } from "./proposal-model";

export const paymentContractSchema = z.strictObject({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  versionId: z.string().uuid(),
  clientId: z.string(),
  creatorId: z.string(),
  amount: z.number().int().positive().safe(),
  currency: z.literal("KRW"),
});
export type PaymentContract = z.infer<typeof paymentContractSchema>;
export const paymentOrderSchema = z.strictObject({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  amount: z.number().int().positive().safe(),
  currency: z.literal("KRW"),
  status: z.enum(["READY", "UNKNOWN", "SUCCEEDED", "FAILED", "CANCELED"]),
  revision: z.number().int().nonnegative(),
});
export type PaymentOrder = z.infer<typeof paymentOrderSchema>;
export const paymentCommandSchema = z.strictObject({
  type: z.enum(["create", "verify"]),
  id: z.string().uuid(),
});
export type PaymentCommand = z.infer<typeof paymentCommandSchema>;
export const paymentViewSchema = z.strictObject({
  contract: paymentContractSchema,
  orders: z.array(paymentOrderSchema),
});
export function createOrder(
  orders: PaymentOrder[],
  contract: PaymentContract,
  id: string,
): PaymentOrder[] {
  const existing = orders.find((o) => o.id === id);
  if (existing) return orders;
  if (orders.some((o) => ["READY", "UNKNOWN", "SUCCEEDED"].includes(o.status)))
    throw new ProposalError("기존 주문 결과를 먼저 확인해 주세요.");
  return [
    ...orders,
    {
      id: z.string().uuid().parse(id),
      contractId: contract.id,
      amount: contract.amount,
      currency: contract.currency,
      status: "READY",
      revision: 0,
    },
  ];
}
// Only the Mock provider handler calls this. Browser return parameters are never evidence.
export function applyPaymentResult(
  order: PaymentOrder,
  event: {
    orderId: string;
    amount: number;
    currency: string;
    status: PaymentOrder["status"];
    revision: number;
  },
): PaymentOrder {
  if (
    ["SUCCEEDED", "FAILED", "CANCELED"].includes(order.status) ||
    event.revision <= order.revision
  )
    return order;
  if (
    event.orderId !== order.id ||
    event.amount !== order.amount ||
    event.currency !== order.currency
  )
    return { ...order, status: "UNKNOWN", revision: event.revision };
  return { ...order, status: event.status, revision: event.revision };
}
