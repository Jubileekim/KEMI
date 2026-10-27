import { z } from "zod";
import { ProposalError } from "./proposal-model";

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
export const resolutionViewSchema = z.strictObject({
  contractId: z.string().uuid(),
  requestId: z.string().uuid(),
  clientId: z.string(),
  creatorId: z.string(),
  amount: money,
  paidAmount: money.nullable(),
  blocked: z.string(),
  state: resolutionStateSchema,
});
export function emptyResolution(): ResolutionState {
  return { revision: 0, versions: [], commands: [] };
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
    revision: state.revision + 1,
    commands: [...state.commands, { id: cmd.id, actorId, fingerprint }],
    versions: state.versions.map((v) =>
      v.id === latest.id
        ? { ...v, confirmations: [...v.confirmations, actorId] }
        : v,
    ),
  };
}
