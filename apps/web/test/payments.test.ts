import { describe, it, expect } from "vitest";
import {
  createOrder,
  applyPaymentResult,
  paymentCommandSchema,
  paymentContractSchema,
  type PaymentContract,
  type PaymentOrder,
} from "../src/mocks/payment-model";

const contract: PaymentContract = {
  id: crypto.randomUUID(),
  requestId: crypto.randomUUID(),
  versionId: crypto.randomUUID(),
  clientId: "client",
  creatorId: "creator",
  amount: 100000,
  currency: "KRW",
};
function ready(): PaymentOrder {
  const order = createOrder([], contract, crypto.randomUUID()).at(-1);
  if (!order) throw new Error("missing fixture");
  return order;
}
function event(
  order: PaymentOrder,
  status: PaymentOrder["status"] = "SUCCEEDED",
) {
  return {
    orderId: order.id,
    amount: contract.amount,
    currency: "KRW",
    status,
    revision: order.revision + 1,
  };
}
describe("3-C Mock orders and provider result invariants", () => {
  it("uses the frozen full contract amount and never approves on creation", () => {
    expect(ready()).toMatchObject({
      contractId: contract.id,
      amount: 100000,
      currency: "KRW",
      status: "READY",
    });
  });
  it("replays the same order ID even after success without another order", () => {
    const order = ready();
    const orders = [applyPaymentResult(order, event(order))];
    expect(createOrder(orders, contract, order.id)).toBe(orders);
    expect(() => createOrder(orders, contract, crypto.randomUUID())).toThrow();
  });
  it("blocks new orders while ready or unknown", () => {
    const order = ready();
    expect(() => createOrder([order], contract, crypto.randomUUID())).toThrow();
    const unknown = applyPaymentResult(order, event(order, "UNKNOWN"));
    expect(() =>
      createOrder([unknown], contract, crypto.randomUUID()),
    ).toThrow();
  });
  it.each(["FAILED", "CANCELED"] as const)(
    "allows explicit new order only after %s and retains history",
    (status) => {
      const order = ready();
      const failed = applyPaymentResult(order, event(order, status));
      const orders = createOrder([failed], contract, crypto.randomUUID());
      expect(orders).toHaveLength(2);
      expect(orders[0]).toEqual(failed);
      expect(orders[1]?.status).toBe("READY");
    },
  );
  it("requires matching order, amount and currency", () => {
    const order = ready();
    [
      { amount: 1 },
      { orderId: crypto.randomUUID() },
      { currency: "USD" },
    ].forEach((change) => {
      expect(
        applyPaymentResult(order, { ...event(order), ...change }).status,
      ).toBe("UNKNOWN");
    });
  });
  it("ignores duplicate and out of order events, success never regresses", () => {
    const order = ready();
    const unknown = applyPaymentResult(order, event(order, "UNKNOWN"));
    expect(applyPaymentResult(unknown, { ...event(order), revision: 0 })).toBe(
      unknown,
    );
    expect(applyPaymentResult(unknown, event(order))).toBe(unknown);
    const paid = applyPaymentResult(unknown, event(unknown));
    expect(paid.status).toBe("SUCCEEDED");
    expect(applyPaymentResult(paid, event(paid, "FAILED"))).toBe(paid);
  });
  it("terminal failure/cancel cannot be re-approved by a repeated return", () => {
    const order = ready();
    const failed = applyPaymentResult(order, event(order, "FAILED"));
    expect(applyPaymentResult(failed, event(failed))).toBe(failed);
  });
  it("rejects browser amount/approval fields and invalid amounts", () => {
    expect(
      paymentCommandSchema.safeParse({
        type: "create",
        id: crypto.randomUUID(),
        amount: 1,
      }).success,
    ).toBe(false);
    expect(
      paymentCommandSchema.safeParse({
        type: "verify",
        id: crypto.randomUUID(),
        success: true,
      }).success,
    ).toBe(false);
    [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].forEach((amount) =>
      expect(
        paymentContractSchema.safeParse({ ...contract, amount }).success,
      ).toBe(false),
    );
  });
});
