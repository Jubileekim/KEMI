import { z } from "zod";
import { ProposalError } from "./proposal-model";
import { finalAssetSchema } from "./final-model";
import type { cancellationVersionSchema } from "./resolution-model";

const text = z.string().trim().min(1).max(2000);
const uuid = z.string().uuid();
const money = z.number().int().nonnegative().safe();
const status = z.enum(["PROCESSING", "UNKNOWN", "FAILED", "SUCCEEDED"]);
const event = { id: uuid, actorId: z.string(), at: z.iso.datetime() };
const base = { id: uuid, revision: z.number().int().nonnegative() };
const version = { ...base, versionId: uuid };
export const workflowCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...version, type: z.literal("refund"), orderId: uuid }),
  z.strictObject({
    ...version,
    type: z.literal("handover"),
    fileIds: z.array(uuid).max(20),
    description: text,
  }),
  z.strictObject({
    ...version,
    type: z.literal("receive"),
    handoverId: uuid,
    consent: z.literal(true),
  }),
  z.strictObject({
    ...base,
    type: z.literal("dispute"),
    reason: text,
    evidence: text,
  }),
  z.strictObject({
    ...base,
    type: z.literal("review"),
    disputeId: uuid,
    note: text,
    nextStep: text,
    release: z.boolean(),
  }),
  z.strictObject({ ...version, type: z.literal("release"), reason: text }),
  z.strictObject({ ...version, type: z.literal("settle") }),
]);
export type WorkflowCommand = z.infer<typeof workflowCommandSchema>;
export const workflowStateSchema = z.strictObject({
  refunds: z.array(
    z.strictObject({
      id: uuid,
      versionId: uuid,
      orderId: uuid,
      amount: money,
      status,
      at: z.iso.datetime(),
    }),
  ),
  handover: z
    .strictObject({
      ...event,
      versionId: uuid,
      files: z.array(finalAssetSchema),
      description: text,
    })
    .nullable(),
  receipt: z
    .strictObject({ ...event, versionId: uuid, handoverId: uuid })
    .nullable(),
  disputes: z.array(
    z.strictObject({
      ...event,
      reason: text,
      evidence: text,
      released: z.boolean(),
      reviews: z.array(
        z.strictObject({
          ...event,
          note: text,
          nextStep: text,
          release: z.boolean(),
        }),
      ),
    }),
  ),
  release: z
    .strictObject({ ...event, versionId: uuid, reason: text })
    .nullable(),
  settlement: z
    .strictObject({
      id: uuid,
      versionId: uuid,
      compensation: money,
      fee: money,
      net: money,
      status,
      at: z.iso.datetime(),
    })
    .nullable(),
});
export type WorkflowState = z.infer<typeof workflowStateSchema>;
export function emptyWorkflow(): WorkflowState {
  return {
    refunds: [],
    handover: null,
    receipt: null,
    disputes: [],
    release: null,
    settlement: null,
  };
}
export interface WorkflowContext {
  actorId: string;
  role: "CLIENT" | "CREATOR" | "ADMIN";
  clientId: string;
  creatorId: string;
  version: z.infer<typeof cancellationVersionSchema> | undefined;
  amount: number;
  paidOrder: { id: string; amount: number; currency: string } | undefined;
  ownedFiles: z.infer<typeof finalAssetSchema>[];
  outcome: z.infer<typeof status>;
  now: string;
}
export function changeWorkflow(
  state: WorkflowState,
  raw: WorkflowCommand,
  context: WorkflowContext,
): WorkflowState {
  const cmd = workflowCommandSchema.parse(raw);
  const { actorId, role, version: latest, now, paidOrder } = context;
  const member =
    (role === "CLIENT" && actorId === context.clientId) ||
    (role === "CREATOR" && actorId === context.creatorId);
  const admin = role === "ADMIN";
  const agreed =
    latest &&
    latest.confirmations.includes(context.clientId) &&
    latest.confirmations.includes(context.creatorId);
  const openDispute = state.disputes.some((d) => !d.released);
  if (cmd.type === "dispute") {
    if (!member || state.settlement?.status === "SUCCEEDED")
      throw new ProposalError("새 분쟁 접수 불가", 403);
    if (openDispute) throw new ProposalError("기존 분쟁을 확인해 주세요.");
    return {
      ...state,
      release: null,
      disputes: [
        ...state.disputes,
        {
          id: cmd.id,
          actorId,
          at: now,
          reason: cmd.reason,
          evidence: cmd.evidence,
          released: false,
          reviews: [],
        },
      ],
    };
  }
  if (cmd.type === "review") {
    if (!admin) throw new ProposalError("운영 Mock 권한 필요", 403);
    const dispute = state.disputes.find((d) => d.id === cmd.disputeId);
    if (!dispute || dispute.released || (cmd.release && !agreed))
      throw new ProposalError("유효 분쟁과 동일 버전 양측 합의 확인 필요");
    return {
      ...state,
      disputes: state.disputes.map((d) =>
        d.id === cmd.disputeId
          ? {
              ...d,
              released: cmd.release,
              reviews: [
                ...d.reviews,
                {
                  id: cmd.id,
                  actorId,
                  at: now,
                  note: cmd.note,
                  nextStep: cmd.nextStep,
                  release: cmd.release,
                },
              ],
            }
          : d,
      ),
    };
  }
  if (!latest || cmd.versionId !== latest.id || !agreed)
    throw new ProposalError("동일 최신 취소 버전 양측 확인 필요");
  if (cmd.type === "refund") {
    if (
      !member ||
      openDispute ||
      !paidOrder ||
      paidOrder.id !== cmd.orderId ||
      paidOrder.currency !== "KRW" ||
      paidOrder.amount !== context.amount ||
      latest.refund + latest.values.compensation !== paidOrder.amount
    )
      throw new ProposalError("원결제·합의 금액·분쟁 보류 확인 필요");
    const success = state.refunds.find((r) => r.status === "SUCCEEDED");
    if (success) return state;
    const unresolved = state.refunds.find((r) =>
      ["PROCESSING", "UNKNOWN"].includes(r.status),
    );
    if (unresolved && unresolved.id !== cmd.id)
      throw new ProposalError("기존 환불 결과를 먼저 확인해 주세요.");
    const prior = state.refunds.find((r) => r.id === cmd.id);
    if (
      prior &&
      (prior.versionId !== cmd.versionId || prior.orderId !== cmd.orderId)
    )
      throw new ProposalError("환불 식별자 충돌");
    if (prior?.status === "FAILED") return state;
    return {
      ...state,
      refunds: [
        ...state.refunds.filter((r) => r.id !== cmd.id),
        {
          id: cmd.id,
          versionId: cmd.versionId,
          orderId: paidOrder.id,
          amount: latest.refund,
          status: context.outcome,
          at: now,
        },
      ],
    };
  }
  if (cmd.type === "handover") {
    if (!member || role !== "CREATOR" || state.receipt || state.settlement)
      throw new ProposalError("크리에이터 파일 인도 필요", 403);
    const files = cmd.fileIds.map((id) =>
      context.ownedFiles.find((f) => f.id === id),
    );
    if (
      new Set(cmd.fileIds).size !== cmd.fileIds.length ||
      files.some((f) => !f)
    )
      throw new ProposalError("본 계약에서 준비한 파일만 인도할 수 있어요.");
    return {
      ...state,
      handover: {
        id: cmd.id,
        actorId,
        at: now,
        versionId: latest.id,
        files: finalAssetSchema.array().parse(files),
        description: cmd.description,
      },
      release: null,
    };
  }
  if (cmd.type === "receive") {
    if (
      !member ||
      role !== "CLIENT" ||
      state.handover?.id !== cmd.handoverId ||
      state.handover.versionId !== latest.id ||
      state.receipt
    )
      throw new ProposalError("현재 합의 파일의 의뢰인 수령 확인 필요");
    return {
      ...state,
      receipt: {
        id: cmd.id,
        actorId,
        at: now,
        versionId: latest.id,
        handoverId: cmd.handoverId,
      },
    };
  }
  const refund = state.refunds.find(
    (r) =>
      r.status === "SUCCEEDED" &&
      r.versionId === latest.id &&
      r.amount === latest.refund,
  );
  if (
    !refund ||
    !state.receipt ||
    state.receipt.versionId !== latest.id ||
    state.receipt.handoverId !== state.handover?.id ||
    openDispute
  )
    throw new ProposalError(
      "환불 성공·합의 파일 인도/수령·분쟁 해소 확인 필요",
    );
  if (cmd.type === "release") {
    if (!admin || state.settlement?.status === "SUCCEEDED" || state.release)
      throw new ProposalError("운영 검토 근거 필요", 403);
    return {
      ...state,
      release: {
        id: cmd.id,
        actorId,
        at: now,
        versionId: latest.id,
        reason: cmd.reason,
      },
    };
  }
  if (
    !member ||
    !state.release ||
    state.release.versionId !== latest.id ||
    latest.values.compensation % 10 !== 0
  )
    throw new ProposalError("근거 있는 보류 해제와 D12 절사 정책 확인 필요");
  if (state.settlement?.status === "SUCCEEDED") return state;
  if (
    state.settlement &&
    state.settlement.status !== "FAILED" &&
    state.settlement.id !== cmd.id
  )
    throw new ProposalError("기존 잔여 정산 결과를 먼저 확인해 주세요.");
  if (state.settlement?.id === cmd.id && state.settlement.status === "FAILED")
    return state;
  const { compensation } = latest.values;
  return {
    ...state,
    settlement: {
      id: cmd.id,
      versionId: latest.id,
      compensation,
      fee: compensation / 10,
      net: compensation - compensation / 10,
      status: context.outcome,
      at: now,
    },
  };
}
