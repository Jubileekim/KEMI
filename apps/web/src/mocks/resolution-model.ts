import { z } from "zod";
import { ProposalError } from "./proposal-model";
import {
  emptyWorkflow,
  workflowStateSchema,
  workflowCommandSchema,
} from "./resolution-workflow-model";

const text = z.string().trim().min(1).max(2000);
const money = z.number().int().nonnegative().safe();
export const cancellationValuesSchema = z.strictObject({
  reason: text,
  progress: text,
  compensation: money,
  files: text,
  unfinished: text,
  originals: text,
  rights: text,
});
export type CancellationValues = z.infer<typeof cancellationValuesSchema>;
export const cancellationVersionSchema = z.strictObject({
  id: z.string().uuid(),
  actorId: z.string(),
  at: z.iso.datetime(),
  values: cancellationValuesSchema,
  refund: money,
  confirmations: z.array(z.string()),
});
export const resolutionStateSchema = z.strictObject({
  workflow: workflowStateSchema,
  revision: z.number().int().nonnegative(),
  versions: z.array(cancellationVersionSchema),
  commands: z.array(
    z.strictObject({
      id: z.string().uuid(),
      actorId: z.string(),
      fingerprint: z.string(),
    }),
  ),
});
export type ResolutionState = z.infer<typeof resolutionStateSchema>;
export const cancellationCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("propose"),
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    values: cancellationValuesSchema,
  }),
  z.strictObject({
    type: z.literal("confirm"),
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    versionId: z.string().uuid(),
    consent: z.literal(true),
  }),
]);
export type CancellationCommand = z.infer<typeof cancellationCommandSchema>;
export const resolutionCommandSchema = z.union([
  cancellationCommandSchema,
  workflowCommandSchema,
]);
export type ResolutionCommand = z.infer<typeof resolutionCommandSchema>;
export const resolutionViewSchema = z
  .strictObject({
    contractId: z.string().uuid(),
    requestId: z.string().uuid(),
    clientId: z.string(),
    creatorId: z.string(),
    amount: money,
    paidAmount: money.nullable(),
    orderId: z.string().uuid().nullable(),
    blocked: z.string(),
    state: resolutionStateSchema,
  })
  .superRefine((view, ctx) => {
    const { workflow, versions } = view.state;
    const latest = versions.at(-1);
    const validVersions = versions.every(
      (v) =>
        v.values.compensation + v.refund === view.amount &&
        new Set(v.confirmations).size === v.confirmations.length &&
        v.confirmations.every(
          (id) => id === view.clientId || id === view.creatorId,
        ),
    );
    const validRefunds =
      workflow.refunds.filter((r) => r.status === "SUCCEEDED").length <= 1 &&
      workflow.refunds.every(
        (r) =>
          versions.some((v) => v.id === r.versionId && r.amount === v.refund) &&
          r.orderId === view.orderId &&
          view.paidAmount === view.amount,
      );
    const { settlement } = workflow;
    const completionEvidence =
      latest &&
      latest.confirmations.length === 2 &&
      workflow.release?.versionId === latest.id &&
      workflow.receipt?.versionId === latest.id &&
      workflow.receipt.handoverId === workflow.handover?.id &&
      !workflow.disputes.some((d) => !d.released) &&
      workflow.refunds.some(
        (r) => r.status === "SUCCEEDED" && r.versionId === latest.id,
      );
    const validSettlement =
      !settlement ||
      Boolean(
        latest &&
        latest.id === settlement.versionId &&
        settlement.compensation === latest.values.compensation &&
        settlement.compensation % 10 === 0 &&
        settlement.fee === settlement.compensation / 10 &&
        settlement.net + settlement.fee === settlement.compensation &&
        (settlement.status !== "SUCCEEDED" || completionEvidence),
      );
    if (!validVersions || !validRefunds || !validSettlement)
      ctx.addIssue({
        code: "custom",
        message: "Invalid resolution money/version evidence",
      });
  });
export function emptyResolution(): ResolutionState {
  return { revision: 0, versions: [], commands: [], workflow: emptyWorkflow() };
}
export function changeCancellation(
  state: ResolutionState,
  raw: CancellationCommand,
  actorId: string,
  amount: number,
  paidAmount: number | null,
  now: string,
): ResolutionState {
  const cmd = cancellationCommandSchema.parse(raw);
  const fingerprint = JSON.stringify(cmd);
  const prior = state.commands.find((c) => c.id === cmd.id);
  if (prior) {
    if (prior.actorId !== actorId || prior.fingerprint !== fingerprint)
      throw new ProposalError("요청 식별자 충돌");
    return state;
  }
  if (cmd.revision !== state.revision)
    throw new ProposalError("최신 취소 합의를 다시 확인해 주세요.");
  const latest = state.versions.at(-1);
  if (cmd.type === "propose") {
    if (latest?.confirmations.length === 2)
      throw new ProposalError("양측 확인 뒤 변경 정책은 D13 조율이 필요해요.");
    if (cmd.values.compensation > amount)
      throw new ProposalError("완료 대가는 계약 금액을 넘을 수 없어요.");
    return {
      ...state,
      revision: state.revision + 1,
      commands: [...state.commands, { id: cmd.id, actorId, fingerprint }],
      versions: [
        ...state.versions,
        {
          id: cmd.id,
          actorId,
          at: now,
          values: cmd.values,
          refund: amount - cmd.values.compensation,
          confirmations: [],
        },
      ],
    };
  }
  if (!latest || latest.id !== cmd.versionId || paidAmount !== amount)
    throw new ProposalError(
      "동일 최신 버전과 성공한 전액 결제를 확인해 주세요.",
    );
  if (latest.confirmations.includes(actorId))
    throw new ProposalError("이미 확인한 버전이에요.");
  return {
    ...state,
    revision: state.revision + 1,
    commands: [...state.commands, { id: cmd.id, actorId, fingerprint }],
    versions: state.versions.map((v) =>
      v.id === latest.id
        ? { ...v, confirmations: [...v.confirmations, actorId] }
        : v,
    ),
  };
}
