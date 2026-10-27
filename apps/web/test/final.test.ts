import { describe, it, expect } from "vitest";
import {
  emptyDelivery,
  submitDelivery,
  type DeliveryState,
} from "../src/mocks/delivery-model";
import {
  changeFinal,
  finalCommandSchema,
  type FinalCommand,
} from "../src/mocks/final-model";
import { changeRevisions } from "../src/mocks/revision-model";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture value");
  return value;
}

const now = "2026-10-26T00:00:00.000Z";
const client = { id: "client", creator: false };
const creator = { id: "creator", creator: true };
const asset = {
  id: crypto.randomUUID(),
  name: "review.webm",
  mime: "video/webm",
  size: 30,
} as const;
const finalAsset = {
  id: crypto.randomUUID(),
  name: "final.zip",
  mime: "application/zip",
  size: 22,
} as const;
function reviewed() {
  return submitDelivery(
    emptyDelivery(),
    {
      id: crypto.randomUUID(),
      revision: 0,
      assetId: asset.id,
      kind: "REVIEW",
      description: "검토",
      watermarkConfirmed: true,
    },
    creator,
    true,
    asset,
    now,
  );
}
function approval(
  state: DeliveryState,
): Extract<FinalCommand, { type: "approve" }> {
  return {
    type: "approve",
    id: crypto.randomUUID(),
    revision: state.revision,
    versionId: required(state.versions.at(-1)).id,
    confirmed: true,
  };
}
function approved() {
  const state = reviewed();
  return changeFinal(state, approval(state), client, true, [], now);
}
function delivery(
  state: DeliveryState,
): Extract<FinalCommand, { type: "deliver-final" }> {
  return {
    type: "deliver-final",
    id: crypto.randomUUID(),
    revision: state.revision,
    versionId: required(state.final.approval).versionId,
    files: [
      { asset: finalAsset, role: "FINAL", description: "깨끗한 최종 영상 ZIP" },
    ],
    cleanConfirmed: true,
    contractConfirmed: true,
  };
}
function delivered() {
  const state = approved();
  return changeFinal(state, delivery(state), creator, true, [finalAsset], now);
}
function receive(
  state: DeliveryState,
): Extract<FinalCommand, { type: "receive-final" }> {
  return {
    type: "receive-final",
    id: crypto.randomUUID(),
    revision: state.revision,
    deliveryId: required(state.final.delivery).id,
    confirmed: true,
  };
}

describe("4-D final workflow invariants", () => {
  it("pins approval then final files then a separate receipt without settlement or round mutation", () => {
    const state = delivered();
    expect(state.final.approval?.versionId).toBe(
      state.final.delivery?.versionId,
    );
    expect(state.final.receipt).toBeNull();
    const next = changeFinal(state, receive(state), client, true, [], now);
    expect(next.final.receipt?.deliveryId).toBe(state.final.delivery?.id);
    expect(next.requests).toEqual(state.requests);
    expect(next).not.toHaveProperty("settled");
    expect(state.final.receipt).toBeNull();
  });
  it("rejects draft, stale version/revision, open request and blocked preparation approval", () => {
    const state = reviewed();
    const cmd = approval(state);
    expect(() =>
      changeFinal(state, { ...cmd, revision: 0 }, client, true, [], now),
    ).toThrow();
    expect(() =>
      changeFinal(
        state,
        { ...cmd, versionId: crypto.randomUUID() },
        client,
        true,
        [],
        now,
      ),
    ).toThrow();
    expect(() => changeFinal(state, cmd, client, false, [], now)).toThrow();
    const draft = structuredClone(state);
    required(draft.versions[0]).kind = "DRAFT";
    expect(() => changeFinal(draft, cmd, client, true, [], now)).toThrow();
    const open = structuredClone(state);
    open.requests.push({
      id: crypto.randomUUID(),
      versionId: required(state.versions[0]).id,
      category: "ERROR",
      items: [],
      authorId: "client",
      at: now,
      correctionAccepted: false,
      resultVersionId: null,
      completedRound: null,
    });
    expect(() => changeFinal(open, cmd, client, true, [], now)).toThrow();
    required(draft.versions[0]).kind = "REVISION";
    required(draft.versions[0]).requestId = required(open.requests[0]).id;
    draft.requests = [
      {
        ...required(open.requests[0]),
        category: "DRAFT",
        resultVersionId: required(draft.versions[0]).id,
      },
    ];
    expect(() => changeFinal(draft, cmd, client, true, [], now)).toThrow();
  });
  it("enforces action roles and requires explicit confirmations", () => {
    const state = reviewed();
    expect(() =>
      changeFinal(state, approval(state), creator, true, [], now),
    ).toThrow();
    const approvedState = approved();
    expect(() =>
      changeFinal(
        approvedState,
        delivery(approvedState),
        client,
        true,
        [finalAsset],
        now,
      ),
    ).toThrow();
    const deliveredState = delivered();
    expect(() =>
      changeFinal(
        deliveredState,
        receive(deliveredState),
        creator,
        true,
        [],
        now,
      ),
    ).toThrow();
    expect(
      finalCommandSchema.safeParse({ ...approval(state), confirmed: false })
        .success,
    ).toBe(false);
    expect(
      finalCommandSchema.safeParse({
        ...delivery(approvedState),
        cleanConfirmed: false,
      }).success,
    ).toBe(false);
  });
  it("rejects unowned/altered/reused assets, missing final role and wrong approval", () => {
    const state = approved();
    const cmd = delivery(state);
    if (cmd.type !== "deliver-final") throw new Error();
    [
      [],
      [{ ...required(cmd.files[0]), role: "SOURCE" as const }],
      [required(cmd.files[0]), required(cmd.files[0])],
      [{ ...required(cmd.files[0]), asset: { ...finalAsset, size: 99 } }],
    ].forEach((files) => {
      expect(() =>
        changeFinal(state, { ...cmd, files }, creator, true, [finalAsset], now),
      ).toThrow();
    });
    expect(() => changeFinal(state, cmd, creator, true, [], now)).toThrow();
    expect(() =>
      changeFinal(
        state,
        { ...cmd, versionId: crypto.randomUUID() },
        creator,
        true,
        [finalAsset],
        now,
      ),
    ).toThrow();
  });
  it("reconciles all actions by same ID with no duplicate even while held; rejects changed content/actor", () => {
    let state = reviewed();
    const approve = approval(state);
    state = changeFinal(state, approve, client, true, [], now);
    expect(changeFinal(state, approve, client, false, [], now)).toBe(state);
    expect(() =>
      changeFinal(state, approve, { ...client, id: "other" }, true, [], now),
    ).toThrow();
    const send = delivery(state);
    state = changeFinal(state, send, creator, true, [finalAsset], now);
    expect(changeFinal(state, send, creator, false, [], now)).toBe(state);
    const cmd = receive(state);
    state = changeFinal(state, cmd, client, true, [], now);
    expect(changeFinal(state, cmd, client, false, [], now)).toBe(state);
    expect(() =>
      changeFinal(state, { ...cmd, revision: 100 }, client, true, [], now),
    ).toThrow();
    expect(state.receipts).toHaveLength(4);
  });
  it("records problems as a hold without receipt and forbids overwrite or receiving", () => {
    const state = delivered();
    const cmd: FinalCommand = {
      type: "report-file",
      id: crypto.randomUUID(),
      revision: state.revision,
      deliveryId: required(state.final.delivery).id,
      reason: "손상·워터마크·미해결 분쟁",
    };
    const held = changeFinal(state, cmd, client, true, [], now);
    expect(held.final.problem?.reason).toBe(cmd.reason);
    expect(held.final.receipt).toBeNull();
    expect(changeFinal(held, cmd, client, false, [], now)).toBe(held);
    expect(() =>
      changeFinal(held, receive(held), client, true, [], now),
    ).toThrow();
    expect(() =>
      changeFinal(held, delivery(held), creator, true, [finalAsset], now),
    ).toThrow();
  });
  it("locks later review/revision edits after approval without reopening or settling", () => {
    const state = approved();
    expect(() =>
      submitDelivery(
        state,
        {
          id: crypto.randomUUID(),
          revision: state.revision,
          assetId: asset.id,
          kind: "REVIEW",
          description: "추가",
          watermarkConfirmed: true,
        },
        creator,
        true,
        asset,
        now,
      ),
    ).toThrow();
    expect(() =>
      changeRevisions(
        state,
        {
          type: "policy",
          id: crypto.randomUUID(),
          revision: state.revision,
          limit: 2,
          scope: "편집",
        },
        { id: client.id, side: "client" },
        true,
        now,
      ),
    ).toThrow();
    const received = delivered();
    expect(() =>
      changeFinal(
        received,
        { ...receive(received), deliveryId: crypto.randomUUID() },
        client,
        true,
        [],
        now,
      ),
    ).toThrow();
  });
});
