import { z } from "zod";
import { ProposalError } from "./proposal-model";
import { isDraftVersion } from "./revision-model";
import type { DeliveryState } from "./delivery-model";

// D17 remains open. These are development guards, not service file policies.
export const finalAssetSchema = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  size: z
    .number()
    .int()
    .positive()
    .max(300 * 1024 * 1024),
  mime: z.enum([
    "video/mp4",
    "video/webm",
    "application/zip",
    "application/x-zip-compressed",
  ]),
});
export type FinalAsset = z.infer<typeof finalAssetSchema>;
export const fileRoleLabels = {
  FINAL: "깨끗한 최종본",
  SOURCE: "합의한 촬영 원본",
  PROJECT: "합의한 편집 프로젝트",
  WORKING: "합의한 현재 작업본",
};
const fileSchema = z.strictObject({
  asset: finalAssetSchema,
  role: z.enum(["FINAL", "SOURCE", "PROJECT", "WORKING"]),
  description: z.string().trim().min(1).max(2000),
});
export type FinalFile = z.infer<typeof fileSchema>;
const event = {
  id: z.string().uuid(),
  actorId: z.string(),
  at: z.iso.datetime(),
};
export const finalStateSchema = z.strictObject({
  approval: z
    .strictObject({ ...event, versionId: z.string().uuid() })
    .nullable(),
  delivery: z
    .strictObject({
      ...event,
      versionId: z.string().uuid(),
      files: z.array(fileSchema).min(1).max(20),
    })
    .nullable(),
  receipt: z
    .strictObject({ ...event, deliveryId: z.string().uuid() })
    .nullable(),
  problem: z
    .strictObject({
      ...event,
      deliveryId: z.string().uuid(),
      reason: z.string().trim().min(1).max(2000),
    })
    .nullable(),
});
export const emptyFinal = () => ({
  approval: null,
  delivery: null,
  receipt: null,
  problem: null,
});
const base = {
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
};
export const finalCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...base,
    type: z.literal("approve"),
    versionId: z.string().uuid(),
    confirmed: z.literal(true),
  }),
  z.strictObject({
    ...base,
    type: z.literal("deliver-final"),
    versionId: z.string().uuid(),
    files: z.array(fileSchema).min(1).max(20),
    contractConfirmed: z.literal(true),
    cleanConfirmed: z.literal(true),
  }),
  z.strictObject({
    ...base,
    type: z.literal("receive-final"),
    deliveryId: z.string().uuid(),
    confirmed: z.literal(true),
  }),
  z.strictObject({
    ...base,
    type: z.literal("report-file"),
    deliveryId: z.string().uuid(),
    reason: z.string().trim().min(1).max(2000),
  }),
]);
export type FinalCommand = z.infer<typeof finalCommandSchema>;
export function changeFinal(
  state: DeliveryState,
  raw: FinalCommand,
  actor: { id: string; creator: boolean },
  allowed: boolean,
  assets: FinalAsset[],
  now: string,
): DeliveryState {
  const cmd = finalCommandSchema.parse(raw);
  if (actor.creator !== (cmd.type === "deliver-final"))
    throw new ProposalError("계약 당사자의 작업 권한을 확인해 주세요.", 403);
  const fingerprint = JSON.stringify(cmd);
  const previous = state.receipts.find((r) => r.id === cmd.id);
  if (previous) {
    if (previous.actorId !== actor.id || previous.fingerprint !== fingerprint)
      throw new ProposalError("작업 식별자 충돌");
    return state;
  }
  if (!allowed || cmd.revision !== state.revision)
    throw new ProposalError("최신 제작·보류 상태를 확인해 주세요.");
  const next = structuredClone(state);
  const record = { id: cmd.id, actorId: actor.id, at: now };
  const { final } = next;
  if (cmd.type === "approve") {
    const version = state.versions.at(-1);
    if (
      final.approval ||
      !version ||
      version.id !== cmd.versionId ||
      isDraftVersion(state, version) ||
      state.requests.some((r) => !r.resultVersionId)
    )
      throw new ProposalError(
        "최신 완성 검토본과 열린 요청을 확인해 주세요. D11 협의 전 승인은 보류해요.",
      );
    final.approval = { ...record, versionId: cmd.versionId };
  } else if (cmd.type === "deliver-final") {
    if (
      !final.approval ||
      final.approval.versionId !== cmd.versionId ||
      final.delivery ||
      final.problem
    )
      throw new ProposalError("승인 버전과 전달 상태를 확인해 주세요.");
    if (
      !cmd.files.some((f) => f.role === "FINAL") ||
      new Set(cmd.files.map((f) => f.asset.id)).size !== cmd.files.length ||
      cmd.files.some(
        (f) =>
          !assets.some(
            (a) =>
              a.id === f.asset.id &&
              a.name === f.asset.name &&
              a.size === f.asset.size &&
              a.mime === f.asset.mime,
          ),
      )
    )
      throw new ProposalError(
        "본인이 새로 준비한 계약 파일과 최종본을 확인해 주세요.",
      );
    final.delivery = { ...record, versionId: cmd.versionId, files: cmd.files };
  } else {
    if (
      !final.delivery ||
      final.delivery.id !== cmd.deliveryId ||
      final.receipt ||
      final.problem
    )
      throw new ProposalError("전달 파일·수령·문제 보류 상태를 확인해 주세요.");
    if (cmd.type === "receive-final")
      final.receipt = { ...record, deliveryId: cmd.deliveryId };
    else
      final.problem = {
        ...record,
        deliveryId: cmd.deliveryId,
        reason: cmd.reason,
      };
  }
  next.revision += 1;
  next.receipts.push({ id: cmd.id, actorId: actor.id, fingerprint });
  return next;
}
