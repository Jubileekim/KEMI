import type { ActivityStage } from "@kemi/shared";
import type { Prisma } from "../generated/prisma/client.js";

// 요청(공개 모집 지원·직접 의뢰)의 거래 진행 단계. 요청 상태만으로는 계약 뒤 단계(결제·제작·완료)를 알 수 없어서
// 계약·결제·제작·정산·분쟁 상태로 계산한다. 내 활동·의뢰 상세·지원 목록이 같은 값을 쓴다.
// 계약에 붙여 읽을 관계(계약을 include로 읽는 곳은 이것만 펼쳐 넣는다)
export const dealContractRelations = {
  payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
  production: { select: { status: true } },
  settlement: { select: { contractId: true, status: true } },
  disputes: { where: { status: "OPEN" }, select: { id: true } },
} satisfies Prisma.ContractInclude;

export const dealStageInclude = {
  contract: {
    select: { id: true, status: true, ...dealContractRelations },
  },
} satisfies Prisma.WorkRequestInclude;

export type DealContract = Prisma.WorkRequestGetPayload<{
  include: typeof dealStageInclude;
}>["contract"];

export function dealStage(
  status: string,
  contract: DealContract,
): ActivityStage {
  if (!contract) {
    if (status === "PENDING") return "PENDING";
    if (status === "DISCUSSING") return "DISCUSSING";
    return "CLOSED";
  }
  if (contract.disputes.length > 0) return "DISPUTED";
  if (contract.status === "CANCELED") return "CANCELED";
  if (contract.settlement?.status === "SIMULATED") return "COMPLETED";
  if (contract.payments.length === 0) return "PAYMENT_PENDING";
  switch (contract.production?.status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "DELIVERED":
      return "DELIVERED";
    case "COMPLETED":
      return "DELIVERED";
    case "CANCELED":
      return "CANCELED";
    default:
      return "PREPARING";
  }
}
