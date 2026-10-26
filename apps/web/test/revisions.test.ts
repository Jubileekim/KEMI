import { describe, it, expect } from "vitest";
import {
  emptyDelivery,
  submitDelivery,
  type DeliveryState,
} from "../src/mocks/delivery-model";
import {
  changeRevisions,
  usedRounds,
  type RevisionCommand,
} from "../src/mocks/revision-model";

const now = "2026-10-26T01:00:00.000Z";
const client = { id: "client", side: "client" } as const;
const creator = { id: "creator", side: "creator" } as const;
const item = {
  id: crypto.randomUUID(),
  seconds: 1,
  area: "EDITING",
  problem: "자막 오타",
  change: "문구 수정",
  reference: "계약 조건",
} as const;
function video(
  state = emptyDelivery(),
  kind: "DRAFT" | "REVIEW" | "REVISION" = "REVIEW",
  requestId?: string,
) {
  const asset = {
    id: crypto.randomUUID(),
    name: "video.webm",
    size: 200,
    mime: "video/webm",
  } as const;
  const cmd = {
    id: crypto.randomUUID(),
    revision: state.revision,
    assetId: asset.id,
    kind,
    ...(requestId ? { requestId } : {}),
    description: "항목 처리 완료",
    watermarkConfirmed: true,
  };
  const next = submitDelivery(
    state,
    cmd,
    { id: creator.id, creator: true },
    true,
    asset,
    now,
  );
  return { next, cmd, asset };
}
function policy(state: DeliveryState, limit = 1) {
  const first = changeRevisions(
    state,
    {
      type: "policy",
      id: crypto.randomUUID(),
      revision: state.revision,
      limit,
      scope: "편집 자막",
    },
    client,
    true,
    now,
  );
  return changeRevisions(
    first,
    {
      type: "policy",
      id: crypto.randomUUID(),
      revision: first.revision,
      limit,
      scope: "편집 자막",
    },
    creator,
    true,
    now,
  );
}
function request(
  state: DeliveryState,
  category: "GENERAL" | "ERROR" | "DRAFT" = "GENERAL",
): Extract<RevisionCommand, { type: "request" }> {
  return {
    type: "request",
    id: crypto.randomUUID(),
    revision: state.revision,
    versionId: state.versions.at(-1)?.id ?? "",
    category,
    items: [item, { ...item, id: crypto.randomUUID(), seconds: 2 }],
    scopeConfirmed: true,
  };
}
describe("4-C request and round invariants", () => {
  it("groups checklist items and completes one round only on linked submission", () => {
    const state = policy(video().next);
    const cmd = request(state);
    const pending = changeRevisions(state, cmd, client, true, now);
    expect(usedRounds(pending)).toBe(0);
    expect(pending.requests[0]?.items).toHaveLength(2);
    const result = video(pending, "REVISION", cmd.id);
    expect(usedRounds(result.next)).toBe(1);
    expect(result.next.requests[0]).toMatchObject({
      versionId: cmd.versionId,
      resultVersionId: result.cmd.id,
      completedRound: 1,
    });
    expect(result.next.versions[0]).toEqual(state.versions[0]);
    expect(
      submitDelivery(
        result.next,
        result.cmd,
        { id: creator.id, creator: true },
        false,
        result.asset,
        now,
      ),
    ).toBe(result.next);
    expect(() => video(result.next, "REVISION", cmd.id)).toThrow();
    expect(result.next).not.toHaveProperty("approved");
    expect(result.next).not.toHaveProperty("settled");
  });
  it("requires both structured confirmations without assigning a default quota", () => {
    const state = video().next;
    expect(state.revisionPolicy).toBeNull();
    expect(() =>
      changeRevisions(state, request(state), client, true, now),
    ).toThrow();
    const ready = policy(state);
    expect(() =>
      changeRevisions(
        ready,
        { ...request(ready), scopeConfirmed: false },
        client,
        true,
        now,
      ),
    ).toThrow();
  });
  it("blocks exhausted general requests but permits agreed error correction without charge", () => {
    const state = policy(video().next, 0);
    expect(() =>
      changeRevisions(state, request(state), client, true, now),
    ).toThrow();
    const cmd = request(state, "ERROR");
    const pending = changeRevisions(state, cmd, client, true, now);
    expect(() => video(pending, "REVISION", cmd.id)).toThrow();
    const agree = {
      type: "accept-correction",
      id: crypto.randomUUID(),
      revision: pending.revision,
      requestId: cmd.id,
    } as const;
    expect(() => changeRevisions(pending, agree, client, true, now)).toThrow();
    const accepted = changeRevisions(pending, agree, creator, true, now);
    expect(usedRounds(video(accepted, "REVISION", cmd.id).next)).toBe(0);
  });
  it("keeps draft feedback outside general rounds", () => {
    const state = video(emptyDelivery(), "DRAFT").next;
    expect(() =>
      changeRevisions(state, request(state), client, true, now),
    ).toThrow();
    const cmd = request(state, "DRAFT");
    const pending = changeRevisions(state, cmd, client, true, now);
    const revised = video(pending, "REVISION", cmd.id).next;
    expect(usedRounds(revised)).toBe(0);
    expect(() =>
      changeRevisions(revised, request(revised), client, true, now),
    ).toThrow();
    expect(
      changeRevisions(revised, request(revised, "DRAFT"), client, true, now)
        .requests,
    ).toHaveLength(2);
    expect(policy(revised).revisionPolicy?.confirmedBy).toHaveLength(2);
  });
  it("rejects stale/foreign targets roles invalid times mixed and additional work", () => {
    const state = policy(video().next);
    const cmd = request(state);
    expect(() => changeRevisions(state, cmd, creator, true, now)).toThrow();
    expect(() => changeRevisions(state, cmd, client, false, now)).toThrow();
    [
      { revision: 0 },
      { versionId: crypto.randomUUID() },
      { items: [{ ...item, seconds: -1 }] },
      { items: [item, { ...item, area: "SHOOTING" as const }] },
      { items: [{ ...item, area: "ADDITIONAL" as const }] },
    ].forEach((changes) => {
      expect(() =>
        changeRevisions(state, { ...cmd, ...changes }, client, true, now),
      ).toThrow();
    });
    expect(state.requests).toHaveLength(0);
  });
  it("reconciles duplicate IDs and rejects changed payload actor and parallel requests", () => {
    const state = policy(video().next);
    const cmd = request(state);
    const pending = changeRevisions(state, cmd, client, true, now);
    expect(changeRevisions(pending, cmd, client, false, now)).toBe(pending);
    expect(() =>
      changeRevisions(pending, { ...cmd, items: [item] }, client, true, now),
    ).toThrow();
    expect(() => changeRevisions(pending, cmd, creator, true, now)).toThrow();
    expect(() =>
      changeRevisions(pending, request(pending), client, true, now),
    ).toThrow();
    expect(() => video(pending)).toThrow();
    expect(() =>
      changeRevisions(
        pending,
        {
          type: "policy",
          id: crypto.randomUUID(),
          revision: pending.revision,
          limit: 9,
          scope: "변경",
        },
        client,
        true,
        now,
      ),
    ).toThrow();
  });
});
