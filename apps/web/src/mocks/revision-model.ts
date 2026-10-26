import { z } from "zod";
import { ProposalError } from "./proposal-model";
import type { DeliveryState, DeliveryVersion } from "./delivery-model";

export const revisionLabels = {
  GENERAL: "일반 수정",
  ERROR: "계약 오류 시정",
  DRAFT: "초안 의견",
};

export const revisionItemSchema = z.strictObject({
  id: z.string().uuid(),
  seconds: z.number().int().min(0).max(86400),
  area: z.enum(["EDITING", "SHOOTING", "ADDITIONAL"]),
  problem: z.string().trim().min(1).max(1000),
  change: z.string().trim().min(1).max(1000),
  reference: z.string().trim().max(1000),
});
export type RevisionItem = z.infer<typeof revisionItemSchema>;
export const revisionRequestSchema = z.strictObject({
  id: z.string().uuid(),
  versionId: z.string().uuid(),
  category: z.enum(["GENERAL", "ERROR", "DRAFT"]),
  items: z.array(revisionItemSchema).min(1).max(20),
  authorId: z.string(),
  at: z.iso.datetime(),
  correctionAccepted: z.boolean(),
  resultVersionId: z.string().uuid().nullable(),
  completedRound: z.number().int().positive().nullable(),
});
export type RevisionRequest = z.infer<typeof revisionRequestSchema>;
export const revisionPolicySchema = z.strictObject({
  limit: z.number().int().min(0).max(20),
  scope: z.string().trim().min(1).max(1000),
  confirmedBy: z.array(z.enum(["client", "creator"])).max(2),
});
const base = {
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
};
export const revisionCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...base,
    type: z.literal("policy"),
    limit: z.number().int().min(0).max(20),
    scope: z.string().trim().min(1).max(1000),
  }),
  z.strictObject({
    ...base,
    type: z.literal("request"),
    versionId: z.string().uuid(),
    category: z.enum(["GENERAL", "ERROR", "DRAFT"]),
    items: z.array(revisionItemSchema).min(1).max(20),
    scopeConfirmed: z.boolean(),
  }),
  z.strictObject({
    ...base,
    type: z.literal("accept-correction"),
    requestId: z.string().uuid(),
  }),
]);
export type RevisionCommand = z.infer<typeof revisionCommandSchema>;
export const usedRounds = (state: DeliveryState) =>
  state.requests.filter((r) => r.completedRound !== null).length;
export const revisionPolicyLocked = (state: DeliveryState) =>
  state.requests.some((r) => r.category !== "DRAFT" || !r.resultVersionId);
export const isDraftVersion = (
  state: DeliveryState,
  version: DeliveryVersion,
) =>
  version.kind === "DRAFT" ||
  (version.kind === "REVISION" &&
    state.requests.find((r) => r.id === version.requestId)?.category ===
      "DRAFT");
export function changeRevisions(
  state: DeliveryState,
  raw: RevisionCommand,
  actor: { id: string; side: "client" | "creator" },
  allowed: boolean,
  now: string,
): DeliveryState {
  const cmd = revisionCommandSchema.parse(raw);
  const fingerprint = JSON.stringify(cmd);
  const receipt = state.receipts.find((r) => r.id === cmd.id);
  if (receipt) {
    if (receipt.actorId !== actor.id || receipt.fingerprint !== fingerprint)
      throw new ProposalError("수정 식별자 충돌");
    return state;
  }
  if (!allowed || cmd.revision !== state.revision)
    throw new ProposalError("최신 제작·수정 상태를 확인해 주세요.");
  const next = structuredClone(state);
  if (cmd.type === "policy") {
    if (revisionPolicyLocked(state))
      throw new ProposalError("요청 후 조건 변경은 별도 협의가 필요해요.");
    const same =
      state.revisionPolicy?.limit === cmd.limit &&
      state.revisionPolicy.scope === cmd.scope;
    const confirmedBy =
      same && state.revisionPolicy ? state.revisionPolicy.confirmedBy : [];
    next.revisionPolicy = {
      limit: cmd.limit,
      scope: cmd.scope,
      confirmedBy: [...new Set([...confirmedBy, actor.side])],
    };
  } else if (cmd.type === "accept-correction") {
    const item = next.requests.find((r) => r.id === cmd.requestId);
    if (actor.side !== "creator")
      throw new ProposalError("제작자만 오류 시정에 동의할 수 있어요.", 403);
    if (
      !item ||
      item.category !== "ERROR" ||
      item.resultVersionId ||
      item.correctionAccepted
    )
      throw new ProposalError("유효한 오류 시정 요청을 확인해 주세요.");
    item.correctionAccepted = true;
  } else {
    if (actor.side !== "client")
      throw new ProposalError("의뢰인만 수정 요청할 수 있어요.", 403);
    const version = state.versions.at(-1);
    if (
      !version ||
      version.id !== cmd.versionId ||
      state.requests.some((r) => !r.resultVersionId)
    )
      throw new ProposalError("최신 영상과 진행 중 요청을 확인해 주세요.");
    if (isDraftVersion(state, version) !== (cmd.category === "DRAFT"))
      throw new ProposalError("초안 의견과 완성 검토본 수정을 구분해 주세요.");
    if (
      new Set(cmd.items.map((i) => i.area)).size !== 1 ||
      cmd.items.some((i) => i.area === "ADDITIONAL")
    )
      throw new ProposalError(
        "혼합·추가 작업은 별도 협의가 필요해요. D10/D11 미결정",
      );
    if (new Set(cmd.items.map((i) => i.id)).size !== cmd.items.length)
      throw new ProposalError("체크 항목 식별자가 중복됐어요.");
    if (
      cmd.category === "GENERAL" &&
      (!cmd.scopeConfirmed ||
        state.revisionPolicy?.confirmedBy.length !== 2 ||
        usedRounds(state) >= state.revisionPolicy.limit)
    )
      throw new ProposalError(
        "양측 수정 조건·남은 회차를 확인하거나 별도 협의해 주세요.",
      );
    next.requests.push({
      id: cmd.id,
      versionId: cmd.versionId,
      category: cmd.category,
      items: cmd.items,
      authorId: actor.id,
      at: now,
      correctionAccepted: false,
      resultVersionId: null,
      completedRound: null,
    });
  }
  next.revision += 1;
  next.receipts.push({ id: cmd.id, actorId: actor.id, fingerprint });
  return next;
}
