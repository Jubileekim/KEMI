import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockSignedContract } from "./signature-handlers";
import { ProposalError } from "./proposal-model";
import {
  paymentContractSchema,
  paymentCommandSchema,
  createOrder,
  applyPaymentResult,
  type PaymentOrder,
} from "./payment-model";

const records = new Map<string, PaymentOrder[]>();
export const readMockPaidOrder = (id: string) =>
  records.get(id)?.find((order) => order.status === "SUCCEEDED");
export const mockContractPaid = (id: string) =>
  records.get(id)?.some((order) => order.status === "SUCCEEDED") ?? false;
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "모의 결제 확인 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/payments/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/payments/:contractId", async ({ request, params }) => {
    const user = actor(request);
    const epoch = session.epoch();
    if (!user) return fail(401);
    const selected = scenario;
    let raw: unknown;
    try {
      raw = request.method === "POST" ? await request.json() : null;
    } catch {
      return fail(400);
    }
    await delay(selected === "delay" ? 1500 : 80);
    if (epoch !== session.epoch() || actor(request)?.id !== user.id)
      return fail(401);
    const parsed = paymentContractSchema.safeParse(
      readMockSignedContract(String(params.contractId)),
    );
    if (!parsed.success) return fail(404);
    const contract = parsed.data;
    const client = user.role === "CLIENT" && user.id === contract.clientId;
    const creator = user.role === "CREATOR" && user.id === contract.creatorId;
    if (!client && !creator) return fail(404);
    if (["401", "403", "409", "500"].includes(selected))
      return fail(Number(selected));
    if (selected === "network") return HttpResponse.error();
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    let orders = records.get(contract.id) ?? [];
    if (request.method === "GET") {
      // A development-only delayed provider result, reconciled on explicit lookup.
      if (selected === "settled") {
        orders = orders.map((o) =>
          o.status === "UNKNOWN"
            ? applyPaymentResult(o, {
                orderId: o.id,
                amount: contract.amount,
                currency: contract.currency,
                status: "SUCCEEDED",
                revision: o.revision + 1,
              })
            : o,
        );
        records.set(contract.id, orders);
      }
      return HttpResponse.json({ contract, orders });
    }
    if (request.method !== "POST") return fail(405);
    if (!client) return fail(403);
    const command = paymentCommandSchema.safeParse(raw);
    if (!command.success) return fail(400);
    try {
      const cmd = command.data;
      if (cmd.type === "create") orders = createOrder(orders, contract, cmd.id);
      else {
        const order = orders.find((o) => o.id === cmd.id);
        if (!order) return fail(404);
        if (order.status !== "READY") return HttpResponse.json({ ok: true });
        let status: PaymentOrder["status"] = "SUCCEEDED";
        if (selected === "failed") status = "FAILED";
        if (selected === "cancel") status = "CANCELED";
        if (["unknown", "mismatch"].includes(selected)) status = "UNKNOWN";
        orders = orders.map((o) =>
          o.id === cmd.id
            ? applyPaymentResult(o, {
                orderId: o.id,
                amount:
                  selected === "mismatch"
                    ? contract.amount + 1
                    : contract.amount,
                currency: "KRW",
                status,
                revision: o.revision + 1,
              })
            : o,
        );
      }
      records.set(contract.id, orders);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    } catch (error) {
      return fail(error instanceof ProposalError ? error.status : 400);
    }
  }),
];
