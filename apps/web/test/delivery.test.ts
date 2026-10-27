import { describe, it, expect } from "vitest";
import {
  assetSchema,
  deliveryCommandSchema,
  emptyDelivery,
  submitDelivery,
  type DeliveryCommand,
} from "../src/mocks/delivery-model";

const creator = { id: "creator", creator: true };
const asset = {
  id: crypto.randomUUID(),
  name: "kemi.webm",
  mime: "video/webm",
  size: 200,
} as const;
const now = "2026-10-24T10:00:00.000Z";
function command(changes: Partial<DeliveryCommand> = {}): DeliveryCommand {
  return {
    id: crypto.randomUUID(),
    revision: 0,
    assetId: asset.id,
    kind: "DRAFT",
    description: "초안 설명",
    watermarkConfirmed: false,
    ...changes,
  };
}
describe("4-B delivery invariants", () => {
  it("preserves draft/review versions with actor/time and no revision-round mutation", () => {
    const first = submitDelivery(
      emptyDelivery(),
      command(),
      creator,
      true,
      asset,
      now,
    );
    const secondAsset = { ...asset, id: crypto.randomUUID() };
    const next = submitDelivery(
      first,
      command({
        revision: 1,
        assetId: secondAsset.id,
        kind: "REVIEW",
        watermarkConfirmed: true,
      }),
      creator,
      true,
      secondAsset,
      now,
    );
    expect(first.versions).toHaveLength(1);
    expect(next.versions[0]).toEqual(first.versions[0]);
    expect(next.versions[1]).toMatchObject({
      number: 2,
      kind: "REVIEW",
      authorId: "creator",
      at: now,
    });
    expect(next).not.toHaveProperty("approved");
    expect(next).not.toHaveProperty("settled");
    expect(next).not.toHaveProperty("revisionRounds");
  });
  it("requires manual watermark confirmation only for review", () => {
    expect(
      deliveryCommandSchema.safeParse(command({ kind: "REVIEW" })).success,
    ).toBe(false);
    expect(deliveryCommandSchema.safeParse(command()).success).toBe(true);
  });
  it("rejects client/blocked creation without mutating old state", () => {
    const state = emptyDelivery();
    expect(() =>
      submitDelivery(
        state,
        command(),
        { id: "client", creator: false },
        true,
        asset,
        now,
      ),
    ).toThrow();
    expect(() =>
      submitDelivery(state, command(), creator, false, asset, now),
    ).toThrow();
    expect(state.versions).toHaveLength(0);
  });
  it("reconciles same ID after lost response, even when production becomes held", () => {
    const cmd = command();
    const state = submitDelivery(
      emptyDelivery(),
      cmd,
      creator,
      true,
      asset,
      now,
    );
    expect(submitDelivery(state, cmd, creator, false, undefined, now)).toBe(
      state,
    );
    expect(state.versions).toHaveLength(1);
    expect(state.receipts).toHaveLength(1);
  });
  it("rejects ID reuse with changed content, revision, kind or actor", () => {
    const cmd = command();
    const state = submitDelivery(
      emptyDelivery(),
      cmd,
      creator,
      true,
      asset,
      now,
    );
    [
      { description: "변경" },
      { revision: 1 },
      { kind: "REVIEW" as const, watermarkConfirmed: true },
    ].forEach((patch) => {
      expect(() =>
        submitDelivery(state, { ...cmd, ...patch }, creator, true, asset, now),
      ).toThrow();
    });
    expect(() =>
      submitDelivery(state, cmd, { ...creator, id: "other" }, true, asset, now),
    ).toThrow();
  });
  it("rejects stale concurrent submission and repeated prepared asset", () => {
    const state = submitDelivery(
      emptyDelivery(),
      command(),
      creator,
      true,
      asset,
      now,
    );
    expect(() =>
      submitDelivery(state, command(), creator, true, asset, now),
    ).toThrow();
    expect(() =>
      submitDelivery(
        state,
        command({ revision: 1 }),
        creator,
        true,
        asset,
        now,
      ),
    ).toThrow();
  });
  it("rejects missing or mismatched assets", () => {
    expect(() =>
      submitDelivery(emptyDelivery(), command(), creator, true, undefined, now),
    ).toThrow();
    expect(() =>
      submitDelivery(
        emptyDelivery(),
        command(),
        creator,
        true,
        { ...asset, id: crypto.randomUUID() },
        now,
      ),
    ).toThrow();
  });
  it("validates developer file bounds and strict commands", () => {
    [0, 300 * 1024 * 1024 + 1].forEach((size) =>
      expect(assetSchema.safeParse({ ...asset, size }).success).toBe(false),
    );
    expect(assetSchema.safeParse({ ...asset, mime: "text/html" }).success).toBe(
      false,
    );
    expect(
      deliveryCommandSchema.safeParse({ ...command(), system: true }).success,
    ).toBe(false);
    expect(
      deliveryCommandSchema.safeParse(command({ description: " " })).success,
    ).toBe(false);
  });
});
