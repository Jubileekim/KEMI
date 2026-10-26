import { describe, it, expect } from "vitest";
import { emptyDelivery } from "../src/mocks/delivery-model";
import {
  settlementBlock,
  reconcileSettlement,
  settlementRecordSchema,
  type SettlementContext,
  type SettlementCommand,
} from "../src/mocks/settlement-model";

const now = "2026-10-26T10:00:00.000Z";
function eligible(): SettlementContext {
  const delivery = emptyDelivery();
  const versionId = crypto.randomUUID();
  const deliveryId = crypto.randomUUID();
  const event = () => ({ id: crypto.randomUUID(), actorId: "client", at: now });
  const asset = {
    id: crypto.randomUUID(),
    name: "final.webm",
    size: 20,
    mime: "video/webm",
  } as const;
  delivery.versions.push({
    ...event(),
    id: versionId,
    number: 1,
    kind: "REVIEW",
    description: "검토",
    authorId: "creator",
    asset,
    watermarkConfirmed: true,
  });
  delivery.final.approval = { ...event(), versionId };
  delivery.final.delivery = {
    ...event(),
    id: deliveryId,
    versionId,
    files: [{ asset, role: "FINAL", description: "최종본" }],
  };
  delivery.final.receipt = { ...event(), deliveryId };
  delivery.revision = 4;
  return {
    delivery,
    amount: 100000,
    currency: "KRW",
    paidAmount: 100000,
    prepared: true,
    held: false,
  };
}
function command(context: SettlementContext): SettlementCommand {
  const { receipt } = context.delivery.final;
  if (!receipt) throw new Error("missing receipt");
  return {
    id: crypto.randomUUID(),
    revision: context.delivery.revision,
    receiptId: receipt.id,
  };
}
describe("4-E Mock settlement invariants", () => {
  it("deducts confirmed 10%, charges client zero and conserves amount with one success", () => {
    const context = eligible();
    const cmd = command(context);
    const before = structuredClone(context);
    const records = reconcileSettlement([], cmd, context, "SUCCEEDED", now);
    expect(records[0]).toMatchObject({
      amount: 100000,
      fee: 10000,
      net: 90000,
      clientFee: 0,
      status: "SUCCEEDED",
      confirmedAt: now,
    });
    expect(reconcileSettlement(records, cmd, context, "SUCCEEDED", now)).toBe(
      records,
    );
    expect(
      reconcileSettlement(
        records,
        { ...cmd, id: crypto.randomUUID() },
        context,
        "SUCCEEDED",
        now,
      ),
    ).toBe(records);
    expect(context).toEqual(before);
  });
  it("requires successful full payment, currency and preparation without hold", () => {
    const context = eligible();
    [
      { paidAmount: null },
      { paidAmount: 99999 },
      { currency: "USD" },
      { prepared: false },
      { held: true },
    ].forEach((patch) => {
      const changed = { ...context, ...patch };
      expect(settlementBlock(changed)).not.toBe("");
      expect(() =>
        reconcileSettlement([], command(context), changed, "SUCCEEDED", now),
      ).toThrow();
    });
  });
  it("does not settle approval, download, missing/mismatched receipt or file problem", () => {
    (["approval", "delivery", "receipt"] as const).forEach((key) => {
      const context = eligible();
      context.delivery.final[key] = null;
      expect(settlementBlock(context)).not.toBe("");
    });
    const context = eligible();
    if (context.delivery.final.receipt)
      context.delivery.final.receipt.deliveryId = crypto.randomUUID();
    expect(settlementBlock(context)).not.toBe("");
    context.delivery.final.problem = {
      id: crypto.randomUUID(),
      actorId: "client",
      at: now,
      deliveryId: crypto.randomUUID(),
      reason: "파일 불일치",
    };
    expect(settlementBlock(context)).toContain("보류");
  });
  it("holds fractional won fees instead of deciding D12 rounding or tax", () => {
    const context = eligible();
    context.amount = 100001;
    context.paidAmount = 100001;
    expect(settlementBlock(context)).toContain("D12");
    expect(() =>
      reconcileSettlement([], command(context), context, "SUCCEEDED", now),
    ).toThrow();
  });
  it("preserves one unresolved attempt; rejects new requests, stale receipt and changed ID payload", () => {
    const context = eligible();
    const cmd = command(context);
    const pending = reconcileSettlement([], cmd, context, "PROCESSING", now);
    expect(pending[0]?.confirmedAt).toBeNull();
    expect(() =>
      reconcileSettlement(
        pending,
        { ...cmd, id: crypto.randomUUID() },
        context,
        "SUCCEEDED",
        now,
      ),
    ).toThrow();
    expect(() =>
      reconcileSettlement(
        pending,
        { ...cmd, revision: 0 },
        context,
        "SUCCEEDED",
        now,
      ),
    ).toThrow();
    expect(() =>
      reconcileSettlement(
        [],
        { ...cmd, receiptId: crypto.randomUUID() },
        context,
        "SUCCEEDED",
        now,
      ),
    ).toThrow();
    const unknown = reconcileSettlement(pending, cmd, context, "UNKNOWN", now);
    expect(unknown[0]?.confirmedAt).toBeNull();
    expect(
      reconcileSettlement(unknown, cmd, context, "SUCCEEDED", now),
    ).toHaveLength(1);
  });
  it("failed attempt remains failed; explicit new attempt can succeed once", () => {
    const context = eligible();
    const cmd = command(context);
    const failed = reconcileSettlement([], cmd, context, "FAILED", now);
    expect(reconcileSettlement(failed, cmd, context, "SUCCEEDED", now)).toBe(
      failed,
    );
    const result = reconcileSettlement(
      failed,
      { ...cmd, id: crypto.randomUUID() },
      context,
      "SUCCEEDED",
      now,
    );
    expect(result.filter((r) => r.status === "SUCCEEDED")).toHaveLength(1);
  });
  it("rejects malformed/money-forged commands and inconsistent successful responses", () => {
    const context = eligible();
    const cmd = command(context);
    const forged = { ...cmd, amount: 1 };
    expect(() =>
      reconcileSettlement([], forged, context, "SUCCEEDED", now),
    ).toThrow();
    const record = reconcileSettlement([], cmd, context, "SUCCEEDED", now)[0];
    expect(
      settlementRecordSchema.safeParse({ ...record, net: 100000 }).success,
    ).toBe(false);
    expect(
      settlementRecordSchema.safeParse({ ...record, confirmedAt: null })
        .success,
    ).toBe(false);
  });
});
