import { describe, it, expect } from "vitest";
import {
  changeProduction,
  emptyProduction,
  productionCommandSchema,
  type ProductionCommand,
  type ProductionState,
} from "../src/mocks/production-model";

const now = "2026-10-24T15:30:00.000Z";
const client = { id: "client", side: "client" } as const;
const creator = { id: "creator", side: "creator" } as const;
const plan = { days: 7, product: true, file: true, info: true };
function command(
  state: ProductionState,
  action: ProductionCommand["action"],
): ProductionCommand {
  return { id: crypto.randomUUID(), revision: state.revision, action };
}
function apply(
  state: ProductionState,
  action: ProductionCommand["action"],
  actor: typeof client | typeof creator = client,
) {
  return changeProduction(state, command(state, action), actor, true, now);
}
function prepared() {
  let s = apply(emptyProduction(), { type: "plan", plan });
  s = apply(s, { type: "agree-plan" }, creator);
  ["product", "file", "info"].forEach((key) => {
    const k =
      productionCommandSchema.shape.action.options[2].shape.key.parse(key);
    s = apply(s, {
      type: "supply",
      key: k,
      value: "정상 자료",
      ...(k === "product" ? { shippedOn: "2026-10-25" } : {}),
    });
  });
  return s;
}
function started() {
  let s = prepared();
  ["product", "file", "info"].forEach((key) => {
    const k =
      productionCommandSchema.shape.action.options[2].shape.key.parse(key);
    s = apply(
      s,
      { type: "check", key: k, ready: true, reason: "정상 수령/내용 확인" },
      creator,
    );
  });
  return s;
}
describe("4-A explicit Mock preparation and deadline invariants", () => {
  it("blocks unpaid writes and unapproved/unsupplied readiness", () => {
    const s = emptyProduction();
    expect(() =>
      changeProduction(
        s,
        command(s, { type: "plan", plan }),
        client,
        false,
        now,
      ),
    ).toThrow();
    expect(() =>
      apply(
        s,
        { type: "check", key: "file", ready: true, reason: "확인" },
        creator,
      ),
    ).toThrow();
  });
  it("requires opposite-side plan approval and enforces roles", () => {
    let s = apply(emptyProduction(), { type: "plan", plan });
    expect(() => apply(s, { type: "agree-plan" })).toThrow();
    s = apply(s, { type: "agree-plan" }, creator);
    expect(() => apply(s, { type: "plan", plan })).toThrow();
    expect(() =>
      apply(s, { type: "supply", key: "file", value: "a.pdf" }, creator),
    ).toThrow();
  });
  it("shipment is not receipt; product receipt without required files never starts", () => {
    let s = prepared();
    expect(s.startedAt).toBeNull();
    s = apply(
      s,
      { type: "check", key: "product", ready: true, reason: "정상" },
      creator,
    );
    expect(s.startedAt).toBeNull();
    s = apply(
      s,
      { type: "check", key: "file", ready: false, reason: "누락/오배송" },
      creator,
    );
    expect(s.startedAt).toBeNull();
  });
  it("starts exactly once at final preparation with 7 calendar days across month boundary", () => {
    const s = started();
    expect(s.startedAt).toBe(now);
    expect(s.due).toBe("2026-10-31T15:30:00.000Z");
    expect(
      s.history.filter((h) => h.message.includes("모의 제작 시작 1회")),
    ).toHaveLength(1);
    const corrected = apply(
      s,
      { type: "check", key: "file", ready: false, reason: "손상 재확인" },
      creator,
    );
    const restored = apply(
      corrected,
      { type: "check", key: "file", ready: true, reason: "정정" },
      creator,
    );
    expect(restored.startedAt).toBe(s.startedAt);
    expect(restored.due).toBe(s.due);
    expect(
      restored.history.filter((h) => h.message.includes("모의 제작 시작 1회")),
    ).toHaveLength(1);
    expect(s.requirements.file.ready).toBe(true);
  });
  it("resupply clears confirmation while preserving first start and original due", () => {
    const s = started();
    const next = apply(s, {
      type: "supply",
      key: "file",
      value: "교체 파일·기존 파일 손상",
    });
    expect(next.requirements.file.ready).toBe(false);
    expect(next.due).toBe(s.due);
    expect(next.originalDue).toBe(s.originalDue);
  });
  it("replays identical command; rejects ID collision, actor collision and stale revision", () => {
    const s = emptyProduction();
    const cmd = command(s, { type: "plan", plan });
    const next = changeProduction(s, cmd, client, true, now);
    expect(changeProduction(next, cmd, client, true, now)).toBe(next);
    expect(() => changeProduction(next, cmd, creator, true, now)).toThrow();
    expect(() =>
      changeProduction(
        next,
        { ...cmd, action: { type: "plan", plan: { ...plan, days: 8 } } },
        client,
        true,
        now,
      ),
    ).toThrow();
    expect(() =>
      changeProduction(
        next,
        command(s, { type: "plan", plan }),
        client,
        true,
        now,
      ),
    ).toThrow();
  });
  it("only opposite-side approval applies deadline; original and history survive", () => {
    const s = started();
    const due = "2026-11-02T09:00:00.000Z";
    const cmd = command(s, {
      type: "propose",
      due,
      reason: "촬영 일정 합의 요청",
    });
    const requested = changeProduction(s, cmd, client, true, now);
    expect(requested.due).toBe(s.due);
    expect(() =>
      apply(requested, { type: "respond", changeId: cmd.id, accept: true }),
    ).toThrow();
    const next = apply(
      requested,
      { type: "respond", changeId: cmd.id, accept: true },
      creator,
    );
    expect(next.due).toBe(due);
    expect(next.originalDue).toBe(s.due);
    expect(next.changes[0]?.before).toBe(s.due);
    expect(() =>
      apply(next, { type: "respond", changeId: cmd.id, accept: true }, creator),
    ).toThrow();
  });
  it("rejecting change retains due; pending proposals, past dates and pre-start changes rejected", () => {
    const s = started();
    const cmd = command(s, {
      type: "propose",
      due: "2026-11-03T09:00:00.000Z",
      reason: "요청",
    });
    const pending = changeProduction(s, cmd, client, true, now);
    expect(() => apply(pending, cmd.action)).toThrow();
    expect(
      apply(
        pending,
        { type: "respond", changeId: cmd.id, accept: false },
        creator,
      ).due,
    ).toBe(s.due);
    expect(() => apply(emptyProduction(), cmd.action)).toThrow();
    expect(() =>
      apply(s, { type: "propose", due: now, reason: "과거" }),
    ).toThrow();
    expect(() =>
      apply(s, {
        type: "propose",
        due: "2026-10-24T15:30:00Z",
        reason: "동일 시각",
      }),
    ).toThrow();
  });
  it("supports product-only, files-only and no required resources explicitly confirmed by both", () => {
    [
      { product: true, file: false, info: false },
      { product: false, file: true, info: false },
      { product: false, file: false, info: false },
    ].forEach((flags) => {
      let s = apply(emptyProduction(), {
        type: "plan",
        plan: { days: 1, ...flags },
      });
      expect(s.startedAt).toBeNull();
      s = apply(s, { type: "agree-plan" }, creator);
      if (!flags.product && !flags.file) expect(s.startedAt).toBe(now);
      else expect(s.startedAt).toBeNull();
    });
  });
  it("rejects forged fields, huge/invalid durations and future shipment using Korean date", () => {
    const s = prepared();
    expect(() =>
      productionCommandSchema.parse({
        ...command(s, { type: "agree-plan" }),
        paid: true,
      }),
    ).toThrow();
    expect(() =>
      apply(emptyProduction(), { type: "plan", plan: { ...plan, days: 0 } }),
    ).toThrow();
    expect(() =>
      apply(s, {
        type: "supply",
        key: "product",
        value: "발송",
        shippedOn: "2026-10-26",
      }),
    ).toThrow();
    expect(s.requirements.product.shippedOn).toBe("2026-10-25");
  });
});
