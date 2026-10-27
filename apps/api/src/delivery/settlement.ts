import { settlementAmounts } from "@kemi/shared";
import type { Prisma } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

const settlementInputs = {
  status: true,
  amountKrw: true,
  feeRateBps: true,
  settlement: { select: { contractId: true } },
  payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
  production: { select: { status: true } },
  disputes: { where: { status: "OPEN" }, select: { id: true } },
  cancellations: {
    where: { status: "ACCEPTED" },
    select: {
      completedWorkKrw: true,
      refundKrw: true,
      handoverConfirmedAt: true,
      refund: { select: { status: true } },
      deliveredFiles: { select: { fileId: true } },
    },
  },
} satisfies Prisma.ContractSelect;

type SettlementInputs = Prisma.ContractGetPayload<{
  select: typeof settlementInputs;
}>;

// 정산을 막는 사유. 없으면 null.
// - 정상 거래: 결제 완료 + 최종 수령 + 분쟁 없음
// - 취소 거래: 결제 완료 + 환불 성공(환불액이 있으면) + 인도 파일 수령 확인(있으면) + 분쟁 없음, 완료 작업 대가만 정산
export function settlementHold(contract: SettlementInputs): string | null {
  if (contract.settlement) return "이미 정산됨";
  if (contract.disputes.length > 0) return "분쟁 처리 중";
  if (contract.payments.length === 0) return "결제 미완료";
  if (contract.status === "CANCELED") {
    const [agreement] = contract.cancellations;
    if (!agreement) return "취소 합의 없음";
    if (agreement.refundKrw > 0n && agreement.refund?.status !== "SUCCEEDED") {
      return "환불 처리 중";
    }
    if (
      agreement.deliveredFiles.length > 0 &&
      agreement.handoverConfirmedAt === null
    ) {
      return "인도 파일 수령 확인 전";
    }
    if (agreement.completedWorkKrw === 0n) return "정산할 대가 없음";
    return null;
  }
  if (contract.production?.status !== "DELIVERED") return "최종 수령 전";
  return null;
}

export async function loadSettlementHold(tx: Tx, contractId: bigint) {
  return settlementHold(
    await tx.contract.findUniqueOrThrow({
      where: { id: contractId },
      select: settlementInputs,
    }),
  );
}

// 조건이 갖춰졌으면 계약 당시 요율로 모의 정산한다. 정상 거래는 거래를 완료(COMPLETED)로 닫는다.
export async function settleIfReady(tx: Tx, contractId: bigint) {
  const contract = await tx.contract.findUniqueOrThrow({
    where: { id: contractId },
    select: settlementInputs,
  });
  const hold = settlementHold(contract);
  if (hold) return { hold, amounts: null };
  const canceled = contract.status === "CANCELED";
  const gross = canceled
    ? Number(contract.cancellations[0]?.completedWorkKrw ?? 0n)
    : Number(contract.amountKrw);
  const amounts = settlementAmounts(gross, contract.feeRateBps);
  await tx.settlement.create({
    data: {
      contractId,
      grossKrw: BigInt(amounts.grossKrw),
      feeRateBps: amounts.feeRateBps,
      feeKrw: BigInt(amounts.feeKrw),
      payoutKrw: BigInt(amounts.payoutKrw),
    },
  });
  if (!canceled) {
    await tx.production.update({
      where: { contractId },
      data: { status: "COMPLETED" },
    });
  }
  return { hold: null, amounts };
}
