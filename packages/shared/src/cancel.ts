import { z } from "zod";

// 취소·부분 환불·분쟁·운영 (단계 7: CANCEL-01~02, REFUND-01, DISPUTE-01, OPS-01)

// 취소 합의 버전. 한쪽이 제안하고 상대방이 승인해야 효력이 생긴다. 새 제안이 나오면 이전 제안은 SUPERSEDED.
export const CANCELLATION_STATUSES = [
  "PROPOSED",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
  "WITHDRAWN",
] as const;
export const cancellationStatusSchema = z.enum(CANCELLATION_STATUSES);
export type CancellationStatus = z.infer<typeof cancellationStatusSchema>;

// 환불: REQUESTED(결제사 요청 중) → SUCCEEDED / FAILED(재시도 가능) / UNKNOWN(결과 불명확, 조회로 맞춤)
export const REFUND_STATUSES = [
  "REQUESTED",
  "UNKNOWN",
  "SUCCEEDED",
  "FAILED",
] as const;
export const refundStatusSchema = z.enum(REFUND_STATUSES);
export type RefundStatus = z.infer<typeof refundStatusSchema>;

export const DISPUTE_STATUSES = ["OPEN", "RESOLVED"] as const;
export const disputeStatusSchema = z.enum(DISPUTE_STATUSES);
export type DisputeStatus = z.infer<typeof disputeStatusSchema>;

const idString = z.string().regex(/^[1-9]\d*$/);
const text = (max: number) => z.string().trim().min(1).max(max);

// CANCEL-01·02: 취소 제안. 결제 완료 계약은 완료 작업 대가 + 환불액 = 원결제 금액이어야 한다(서버가 확인).
export const cancellationCreateSchema = z.strictObject({
  reason: text(2000),
  completedWorkKrw: z.int().min(0).max(1_000_000_000),
  refundKrw: z.int().min(0).max(1_000_000_000),
  // 취소 후 의뢰인에게 넘길 파일(크리에이터가 올린 납품 파일)
  deliveredFileIds: z.array(idString).max(20).default([]),
  // 미완성 작업물 상태 설명
  unfinishedState: text(2000).optional(),
  // 넘긴 파일의 사용권 합의
  usageRights: text(2000).optional(),
});
export type CancellationCreateRequest = z.input<
  typeof cancellationCreateSchema
>;

// DISPUTE-01: 분쟁 신고·증빙 추가
export const disputeCreateSchema = z.strictObject({
  reason: text(2000),
  fileIds: z.array(idString).max(10).default([]),
});
export type DisputeCreateRequest = z.input<typeof disputeCreateSchema>;

export const disputeEvidenceSchema = z.strictObject({
  note: text(2000),
  fileIds: z.array(idString).max(10).default([]),
});

// OPS-01: 운영자 처리. 자동 지급·환불을 하지 않고 근거만 남긴다.
export const disputeResolveSchema = z.strictObject({
  reason: text(2000),
});

export interface Refund {
  id: string;
  amountKrw: number;
  status: RefundStatus;
  attempt: number;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Cancellation {
  id: string;
  versionNo: number;
  status: CancellationStatus;
  proposedBy: string;
  reason: string;
  completedWorkKrw: number;
  refundKrw: number;
  deliveredFileIds: string[];
  unfinishedState: string | null;
  usageRights: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
  // 의뢰인의 인도 파일 수령 확인
  handoverConfirmedAt: string | null;
  refund: Refund | null;
  createdAt: string;
}

export interface DisputeEvidence {
  id: string;
  submittedBy: string;
  note: string;
  fileIds: string[];
  createdAt: string;
}

export interface Dispute {
  id: string;
  contractId: string;
  openedBy: string;
  status: DisputeStatus;
  reason: string;
  evidence: DisputeEvidence[];
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface CancellationOverview {
  contractId: string;
  contractStatus: string;
  // 결제 완료 금액(없으면 0: 미결제 계약 취소)
  paidKrw: number;
  cancellations: Cancellation[];
  disputes: Dispute[];
  // 정산을 막는 사유(없으면 null)
  settlementHold: string | null;
}

export interface OperationRecord {
  id: string;
  adminId: string;
  targetType: string;
  targetId: string;
  action: string;
  reason: string;
  createdAt: string;
}
