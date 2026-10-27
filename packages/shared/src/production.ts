import { z } from "zod";

// 제작 준비·시작·납기 (READY-01·02, WORK-01·02). 계약 하나에 제작 하나.
// PREPARING(자료 준비) → IN_PROGRESS(제작 중) → DELIVERED(최종 수령, 정산 보류) → COMPLETED(정산·리뷰 가능)
// CANCELED: 취소 합의 승인(단계 7). 이후 제작·납품 동작을 받지 않는다.
export const PRODUCTION_STATUSES = [
  "PREPARING",
  "IN_PROGRESS",
  "DELIVERED",
  "COMPLETED",
  "CANCELED",
] as const;
export const productionStatusSchema = z.enum(PRODUCTION_STATUSES);
export type ProductionStatus = z.infer<typeof productionStatusSchema>;

// 제작 자료: 파일(MATERIAL), 실물 발송(택배), 안내 메모
export const MATERIAL_KINDS = ["FILE", "SHIPMENT", "NOTE"] as const;
export const materialKindSchema = z.enum(MATERIAL_KINDS);
export type MaterialKind = z.infer<typeof materialKindSchema>;

// SUBMITTED(의뢰인 제출) → CONFIRMED(크리에이터가 작업 가능 확인) / ISSUE_REPORTED(누락·문제 신고)
// 문제가 있으면 의뢰인이 대체 자료를 내고, 원래 자료는 REPLACED가 된다.
export const MATERIAL_STATUSES = [
  "SUBMITTED",
  "CONFIRMED",
  "ISSUE_REPORTED",
  "REPLACED",
] as const;
export const materialStatusSchema = z.enum(MATERIAL_STATUSES);
export type MaterialStatus = z.infer<typeof materialStatusSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);
const idString = z.string().regex(/^[1-9]\d*$/);

export const materialCreateSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("FILE"),
    commandId: z.uuid(),
    fileId: idString,
    note: text(1000).optional(),
    replacesMaterialId: idString.optional(),
  }),
  z.strictObject({
    kind: z.literal("SHIPMENT"),
    commandId: z.uuid(),
    carrier: text(50),
    trackingNumber: text(50),
    note: text(1000).optional(),
    replacesMaterialId: idString.optional(),
  }),
  z.strictObject({
    kind: z.literal("NOTE"),
    commandId: z.uuid(),
    note: text(2000),
    replacesMaterialId: idString.optional(),
  }),
]);
export type MaterialCreateRequest = z.input<typeof materialCreateSchema>;

export const materialIssueSchema = z.strictObject({
  note: text(1000),
});

// 납기 변경 요청 (WORK-02). 날짜는 KST 기준 YYYY-MM-DD.
export const deadlineChangeCreateSchema = z.strictObject({
  newDueDate: z.iso.date(),
  reason: text(1000),
});
export type DeadlineChangeCreateRequest = z.input<
  typeof deadlineChangeCreateSchema
>;

export const DEADLINE_CHANGE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export const deadlineChangeStatusSchema = z.enum(DEADLINE_CHANGE_STATUSES);
export type DeadlineChangeStatus = z.infer<typeof deadlineChangeStatusSchema>;

export interface ProductionMaterial {
  id: string;
  kind: MaterialKind;
  status: MaterialStatus;
  fileId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  note: string | null;
  issueNote: string | null;
  replacesMaterialId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export interface DeadlineChange {
  id: string;
  requestedBy: string;
  previousDueDate: string;
  newDueDate: string;
  reason: string;
  status: DeadlineChangeStatus;
  respondedBy: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface Production {
  contractId: string;
  workRequestId: string;
  status: ProductionStatus;
  // 결제 완료 여부(제작 시작 조건)
  paid: boolean;
  materials: ProductionMaterial[];
  // 제작 시작 조건을 모두 갖췄는지(결제 완료, 자료 1개 이상, 남은 미확인·문제 자료 없음)
  readyToStart: boolean;
  startedAt: string | null;
  // 작업 일수(지원 시 제안한 기간)와 실제 마감일(KST)
  workingDays: number;
  dueDate: string | null;
  deadlineChanges: DeadlineChange[];
}
