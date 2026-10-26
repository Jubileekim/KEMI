import { z } from "zod";
import { ProposalError } from "./proposal-model";
import {
  revisionPolicySchema,
  revisionRequestSchema,
  usedRounds,
} from "./revision-model";

// Development input guards, not the unresolved D17 service limits.
export const mockVideoLimit = 300 * 1024 * 1024;
export const videoTypes = ["video/mp4", "video/webm"] as const;
export const assetSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  size: z.number().int().positive().max(mockVideoLimit),
  mime: z.enum(videoTypes),
});
export type DeliveryAsset = z.infer<typeof assetSchema>;
export const deliveryCommandSchema = z
  .strictObject({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    assetId: z.string().uuid(),
    kind: z.enum(["DRAFT", "REVIEW", "REVISION"]),
    requestId: z.string().uuid().optional(),
    description: z.string().trim().min(1).max(2000),
    watermarkConfirmed: z.boolean(),
  })
  .refine((v) => v.kind === "DRAFT" || v.watermarkConfirmed)
  .refine((v) => (v.kind === "REVISION") === Boolean(v.requestId));
export type DeliveryCommand = z.infer<typeof deliveryCommandSchema>;
export const deliveryVersionSchema = z.strictObject({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  kind: z.enum(["DRAFT", "REVIEW", "REVISION"]),
  requestId: z.string().uuid().optional(),
  description: z.string(),
  authorId: z.string(),
  at: z.iso.datetime(),
  asset: assetSchema,
  watermarkConfirmed: z.boolean(),
});
export type DeliveryVersion = z.infer<typeof deliveryVersionSchema>;
export const deliveryKindLabels = {
  DRAFT: "초안",
  REVIEW: "완성 검토본",
  REVISION: "수정본",
};
export const deliverySubmitLabels = {
  DRAFT: "초안 정식 공유",
  REVIEW: "완성 검토본 정식 제출",
  REVISION: "요청 연결 수정본 정식 제출",
};
export const deliveryEventLabels = {
  DRAFT: "초안 공유",
  REVIEW: "완성 검토본 제출",
  REVISION: "수정본 제출",
};
export const deliveryStateSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  versions: z.array(deliveryVersionSchema),
  revisionPolicy: revisionPolicySchema.nullable(),
  requests: z.array(revisionRequestSchema),
  receipts: z.array(
    z.strictObject({
      id: z.string().uuid(),
      actorId: z.string(),
      fingerprint: z.string(),
    }),
  ),
});
export type DeliveryState = z.infer<typeof deliveryStateSchema>;
export const deliveryViewSchema = z.strictObject({
  contractId: z.string().uuid(),
  requestId: z.string().uuid(),
  creatorId: z.string(),
  canSubmit: z.boolean(),
  started: z.boolean(),
  prepared: z.boolean(),
  revisionTerms: z.string(),
  state: deliveryStateSchema,
});
export const emptyDelivery = (): DeliveryState => ({
  revision: 0,
  versions: [],
  revisionPolicy: null,
  requests: [],
  receipts: [],
});
export function submitDelivery(
  state: DeliveryState,
  raw: DeliveryCommand,
  actor: { id: string; creator: boolean },
  allowed: boolean,
  asset: DeliveryAsset | undefined,
  now: string,
): DeliveryState {
  const cmd = deliveryCommandSchema.parse(raw);
  if (!actor.creator)
    throw new ProposalError("제작자만 제출할 수 있어요.", 403);
  const fingerprint = JSON.stringify(cmd);
  const receipt = state.receipts.find((r) => r.id === cmd.id);
  if (receipt) {
    if (receipt.actorId !== actor.id || receipt.fingerprint !== fingerprint)
      throw new ProposalError("제출 식별자 충돌");
    return state;
  }
  if (!allowed || cmd.revision !== state.revision)
    throw new ProposalError("제작 상태와 최신 버전을 확인해 주세요.");
  if (
    !asset ||
    asset.id !== cmd.assetId ||
    state.versions.some((v) => v.asset.id === asset.id)
  )
    throw new ProposalError("새로 준비한 본인 영상을 선택해 주세요.");
  const next = structuredClone(state);
  const open = next.requests.find((r) => !r.resultVersionId);
  if (cmd.kind === "REVISION") {
    if (
      !open ||
      open.id !== cmd.requestId ||
      open.versionId !== state.versions.at(-1)?.id ||
      (open.category === "ERROR" && !open.correctionAccepted)
    )
      throw new ProposalError(
        "유효한 원요청과 오류 시정 합의를 확인해 주세요.",
      );
    if (open.category === "GENERAL") {
      if (
        state.revisionPolicy?.confirmedBy.length !== 2 ||
        usedRounds(state) >= state.revisionPolicy.limit
      )
        throw new ProposalError("수정 가능 회차를 확인해 주세요.");
      open.completedRound = usedRounds(state) + 1;
    }
    open.resultVersionId = cmd.id;
  } else if (open)
    throw new ProposalError("진행 중 요청에 연결된 수정본으로 제출해 주세요.");
  next.versions.push({
    id: cmd.id,
    number: next.versions.length + 1,
    kind: cmd.kind,
    ...(cmd.requestId ? { requestId: cmd.requestId } : {}),
    description: cmd.description,
    authorId: actor.id,
    at: now,
    asset,
    watermarkConfirmed: cmd.watermarkConfirmed,
  });
  next.revision += 1;
  next.receipts.push({ id: cmd.id, actorId: actor.id, fingerprint });
  return next;
}
