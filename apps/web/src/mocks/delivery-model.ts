import { z } from "zod";
import { ProposalError } from "./proposal-model";

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
    kind: z.enum(["DRAFT", "REVIEW"]),
    description: z.string().trim().min(1).max(2000),
    watermarkConfirmed: z.boolean(),
  })
  .refine((v) => v.kind !== "REVIEW" || v.watermarkConfirmed);
export type DeliveryCommand = z.infer<typeof deliveryCommandSchema>;
export const deliveryVersionSchema = z.strictObject({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  kind: z.enum(["DRAFT", "REVIEW"]),
  description: z.string(),
  authorId: z.string(),
  at: z.iso.datetime(),
  asset: assetSchema,
  watermarkConfirmed: z.boolean(),
});
export type DeliveryVersion = z.infer<typeof deliveryVersionSchema>;
export const deliveryStateSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  versions: z.array(deliveryVersionSchema),
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
  state: deliveryStateSchema,
});
export const emptyDelivery = (): DeliveryState => ({
  revision: 0,
  versions: [],
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
  next.versions.push({
    id: cmd.id,
    number: next.versions.length + 1,
    kind: cmd.kind,
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
