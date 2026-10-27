import { z } from "zod";

// 검토·수정·최종 수령·정산·리뷰 (단계 5: DEL-01~05, REV-01~02, SETTLE-01, REVIEW-01)
// 파일 업로드와 납품 제출은 다르다. 크리에이터가 확인이 끝난 DELIVERABLE 파일을 묶어 "버전"으로 정식 제출해야 납품이다.

// DRAFT(초안: 방향 확인용, 의견만 받음), REVIEW(검토본: 승인·일반 수정 대상), FINAL(깨끗한 최종 파일)
export const DELIVERABLE_KINDS = ["DRAFT", "REVIEW", "FINAL"] as const;
export const deliverableKindSchema = z.enum(DELIVERABLE_KINDS);
export type DeliverableKind = z.infer<typeof deliverableKindSchema>;

// SUBMITTED(검토 대기) → APPROVED(검토본 승인) / REVISION_REQUESTED(수정 요청) / RECEIVED(최종본 수령 확인)
// 새 버전이 나오면 검토 대기였던 이전 버전은 SUPERSEDED가 된다.
export const DELIVERABLE_STATUSES = [
  "SUBMITTED",
  "APPROVED",
  "REVISION_REQUESTED",
  "SUPERSEDED",
  "RECEIVED",
] as const;
export const deliverableStatusSchema = z.enum(DELIVERABLE_STATUSES);
export type DeliverableStatus = z.infer<typeof deliverableStatusSchema>;

// GENERAL(일반 수정: 계약한 회차에서 차감), DRAFT_FEEDBACK(초안 의견: 차감 없음),
// CONTRACT_FIX(계약 조건과 다른 부분의 시정: 차감 없음)
export const REVISION_TYPES = [
  "GENERAL",
  "DRAFT_FEEDBACK",
  "CONTRACT_FIX",
] as const;
export const revisionTypeSchema = z.enum(REVISION_TYPES);
export type RevisionType = z.infer<typeof revisionTypeSchema>;

// OPEN(수정본 대기) → RESOLVED(수정본 제출로 완료. 일반 회차는 이때 한 번 차감)
export const REVISION_STATUSES = ["OPEN", "RESOLVED"] as const;
export const revisionStatusSchema = z.enum(REVISION_STATUSES);
export type RevisionStatus = z.infer<typeof revisionStatusSchema>;

// 모의 정산. 실제 송금이 아니다(PRD 13장).
export const SETTLEMENT_STATUSES = ["SIMULATED"] as const;
export const settlementStatusSchema = z.enum(SETTLEMENT_STATUSES);
export type SettlementStatus = z.infer<typeof settlementStatusSchema>;

// [확정, PRD 9.3·10장] 모의 정산 수수료 10%. 계약 체결 때 계약에 기록한 요율을 쓴다(만분율).
export const DEFAULT_FEE_RATE_BPS = 1000;
// [제안, D11] 조건서 "수정 횟수"에서 숫자를 찾지 못하면 일반 수정 2회로 본다. 최대 10회.
export const DEFAULT_REVISION_LIMIT = 2;
export const MAX_REVISION_LIMIT = 10;
// [제안, D14] 리뷰 평점 1~5 정수
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

const text = (max: number) => z.string().trim().min(1).max(max);
const idString = z.string().regex(/^[1-9]\d*$/);

// 조건서의 수정 횟수 문구에서 일반 수정 회차를 읽는다. 예: "일반 수정 2회" → 2
export function revisionLimitFrom(revisions: string | null): number {
  const found = revisions?.match(/\d+/);
  if (!found) return DEFAULT_REVISION_LIMIT;
  return Math.min(Number(found[0]), MAX_REVISION_LIMIT);
}

// 수수료는 원 단위 내림 [제안, D12]. 20만원·10% → 수수료 2만원, 지급 18만원
export function settlementAmounts(grossKrw: number, feeRateBps: number) {
  const feeKrw = Math.floor((grossKrw * feeRateBps) / 10_000);
  return { grossKrw, feeRateBps, feeKrw, payoutKrw: grossKrw - feeKrw };
}

// DEL-01·02: 버전 제출. commandId는 화면이 만든 요청 식별자다(재전송해도 버전·회차가 한 번만 생긴다).
export const deliverableCreateSchema = z.strictObject({
  commandId: z.uuid(),
  kind: deliverableKindSchema,
  fileIds: z.array(idString).min(1).max(10),
  note: text(2000).optional(),
});
export type DeliverableCreateRequest = z.input<typeof deliverableCreateSchema>;

// REV-01: 수정 체크리스트 한 줄. 영상 위치(예: 01:23), 현재 문제, 원하는 변경
export const revisionItemSchema = z.strictObject({
  position: z.string().trim().max(50).optional(),
  problem: text(1000),
  desired: text(1000),
});
export type RevisionItem = z.output<typeof revisionItemSchema>;

export const revisionRequestCreateSchema = z.strictObject({
  commandId: z.uuid(),
  type: revisionTypeSchema,
  items: z.array(revisionItemSchema).min(1).max(30),
  fileIds: z.array(idString).max(10).default([]),
  note: text(2000).optional(),
});
export type RevisionRequestCreateRequest = z.input<
  typeof revisionRequestCreateSchema
>;

// REVIEW-01: 정상 완료 거래의 당사자별 리뷰 1회
export const reviewCreateSchema = z.strictObject({
  rating: z.int().min(REVIEW_RATING_MIN).max(REVIEW_RATING_MAX),
  comment: text(2000).optional(),
  tags: z.array(text(30)).max(5).default([]),
});
export type ReviewCreateRequest = z.input<typeof reviewCreateSchema>;

export interface Deliverable {
  id: string;
  versionNo: number;
  kind: DeliverableKind;
  status: DeliverableStatus;
  fileIds: string[];
  note: string | null;
  // 이 버전이 해결한 수정 요청
  resolvesRevisionRequestId: string | null;
  createdAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
}

export interface RevisionRequest {
  id: string;
  deliverableId: string;
  type: RevisionType;
  status: RevisionStatus;
  items: RevisionItem[];
  fileIds: string[];
  note: string | null;
  // 일반 회차를 차감하는 요청인지
  countsTowardLimit: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Settlement {
  contractId: string;
  status: SettlementStatus;
  grossKrw: number;
  feeRateBps: number;
  feeKrw: number;
  payoutKrw: number;
  createdAt: string;
}

export interface Review {
  id: string;
  contractId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string | null;
  tags: string[];
  createdAt: string;
}

export interface Delivery {
  contractId: string;
  workRequestId: string;
  // 제작 상태(PREPARING·IN_PROGRESS·DELIVERED·COMPLETED)
  productionStatus: string;
  revisionLimit: number;
  revisionsUsed: number;
  revisionsRemaining: number;
  deliverables: Deliverable[];
  revisionRequests: RevisionRequest[];
  settlement: Settlement | null;
  reviews: Review[];
  // 화면 안내용: 지금 할 수 있는 다음 동작
  canReview: boolean;
}

export interface SettlementListItem extends Settlement {
  workRequestId: string;
  title: string;
}
