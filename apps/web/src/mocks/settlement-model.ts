import { z } from "zod";
import type { DeliveryState } from "./delivery-model";
import { ProposalError } from "./proposal-model";

const money = z.number().int().nonnegative().safe();
export const settlementCommandSchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  receiptId: z.string().uuid(),
});
export type SettlementCommand = z.infer<typeof settlementCommandSchema>;
export const settlementRecordSchema = z
  .strictObject({
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    receiptId: z.string().uuid(),
    deliveryId: z.string().uuid(),
    versionId: z.string().uuid(),
    amount: money,
    fee: money,
    net: money,
    clientFee: z.literal(0),
    status: z.enum(["PROCESSING", "UNKNOWN", "FAILED", "SUCCEEDED"]),
    createdAt: z.iso.datetime(),
    confirmedAt: z.iso.datetime().nullable(),
  })
  .refine(
    (v) =>
      v.amount > 0 &&
      v.amount % 10 === 0 &&
      v.fee === v.amount / 10 &&
      v.net + v.fee === v.amount &&
      (v.status === "SUCCEEDED") === Boolean(v.confirmedAt),
  );
export type SettlementRecord = z.infer<typeof settlementRecordSchema>;
export const settlementViewSchema = z
  .strictObject({
    contractId: z.string().uuid(),
    requestId: z.string().uuid(),
    amount: money,
    revision: z.number().int().nonnegative(),
    receiptId: z.string().uuid().nullable(),
    reason: z.string(),
    record: settlementRecordSchema.nullable(),
  })
  .refine(
    (v) =>
      !v.record ||
      (v.record.amount === v.amount &&
        v.record.receiptId === v.receiptId &&
        v.record.revision === v.revision),
  );
export interface SettlementContext {
  delivery: DeliveryState;
  amount: number;
  currency: string;
  paidAmount: number | null;
  prepared: boolean;
  held: boolean;
}
export function settlementBlock(context: SettlementContext): string {
  const {
    delivery: state,
    amount,
    currency,
    paidAmount,
    prepared,
    held,
  } = context;
  const { approval, delivery, receipt, problem } = state.final;
  if (held || problem || !prepared)
    return "준비·파일 문제 또는 취소·분쟁 보류 확인 필요";
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    currency !== "KRW" ||
    paidAmount !== amount
  )
    return "계약과 성공한 전액 결제의 금액·통화 일치 확인 필요";
  if (
    !approval ||
    !delivery ||
    !receipt ||
    receipt.deliveryId !== delivery.id ||
    approval.versionId !== delivery.versionId ||
    state.versions.at(-1)?.id !== approval.versionId ||
    !delivery.files.some((f) => f.role === "FINAL") ||
    state.requests.some((r) => !r.resultVersionId)
  )
    return "최신 검토 승인·계약 최종 파일 전달·전용 수령 확인 필요";
  if (amount % 10 !== 0)
    return "D12 수수료 절사 정책 확인 필요 · 소수 원 계산 보류";
  return "";
}
// Only the development handler supplies the simulated processor result.
export function reconcileSettlement(
  records: SettlementRecord[],
  raw: SettlementCommand,
  context: SettlementContext,
  outcome: "SUCCEEDED" | "PROCESSING" | "UNKNOWN" | "FAILED",
  now: string,
): SettlementRecord[] {
  const cmd = settlementCommandSchema.parse(raw);
  const prior = records.find((r) => r.id === cmd.id);
  if (
    prior &&
    (prior.revision !== cmd.revision || prior.receiptId !== cmd.receiptId)
  )
    throw new ProposalError("정산 요청 식별자 충돌");
  const reason = settlementBlock(context);
  if (reason) throw new ProposalError(reason);
  if (
    cmd.revision !== context.delivery.revision ||
    cmd.receiptId !== context.delivery.final.receipt?.id
  )
    throw new ProposalError("최신 수령 기록을 재조회해 주세요.");
  if (records.some((r) => r.status === "SUCCEEDED")) return records;
  const active = records.find((r) =>
    ["PROCESSING", "UNKNOWN"].includes(r.status),
  );
  if (active && active.id !== cmd.id)
    throw new ProposalError("기존 정산 결과를 먼저 확인해 주세요.");
  if (prior?.status === "FAILED") return records;
  const { delivery, approval, receipt } = context.delivery.final;
  if (!delivery || !approval || !receipt)
    throw new ProposalError("수령 확인 필요");
  const next = settlementRecordSchema.parse({
    ...cmd,
    deliveryId: delivery.id,
    versionId: approval.versionId,
    amount: context.amount,
    fee: context.amount / 10,
    net: context.amount - context.amount / 10,
    clientFee: 0,
    status: outcome,
    createdAt: prior?.createdAt ?? now,
    confirmedAt: outcome === "SUCCEEDED" ? now : null,
  });
  return [...records.filter((r) => r.id !== cmd.id), next];
}
