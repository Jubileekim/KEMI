import { z } from "zod";
import type { ActivityStage } from "./activity.js";
import type { ProjectStatus } from "./project.js";

// 의뢰 요청(work_requests) 상태. ERD v0.6·결정 기록 3장 값 그대로 둔다.
// 공개 지원: PENDING → DISCUSSING(협의 요청) → CONTRACTED(양측 서명). 끝나는 길: DECLINED(의뢰인 거절),
// WITHDRAWN(크리에이터 철회), NOT_SELECTED(다른 후보 계약·무선정 종료·프로젝트 삭제)
export const WORK_REQUEST_STATUSES = [
  "PENDING",
  "DISCUSSING",
  "CONTRACTED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
  "NOT_SELECTED",
] as const;
export const workRequestStatusSchema = z.enum(WORK_REQUEST_STATUSES);
export type WorkRequestStatus = z.infer<typeof workRequestStatusSchema>;

export const WORK_REQUEST_TYPES = [
  "PROJECT_APPLICATION",
  "DIRECT_REQUEST",
] as const;
export const workRequestTypeSchema = z.enum(WORK_REQUEST_TYPES);

// 미선정(NOT_SELECTED) 사유
export const WORK_REQUEST_CLOSED_REASONS = [
  "OTHER_SELECTED",
  "PROJECT_DELETED",
  "NO_SELECTION",
] as const;
export const workRequestClosedReasonSchema = z.enum(
  WORK_REQUEST_CLOSED_REASONS,
);
export type WorkRequestClosedReason = z.infer<
  typeof workRequestClosedReasonSchema
>;

// 지원서 제출 (APPLY-01) [제안: 글자 수·범위]
export const applicationCreateSchema = z.strictObject({
  message: z.string().trim().min(10).max(2000),
  proposedAmount: z.int().min(1).max(1_000_000_000),
  expectedDays: z.int().min(1).max(365),
});
export type ApplicationCreateRequest = z.input<typeof applicationCreateSchema>;

const pageQuery = (max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .optional();

export const applicationListQuerySchema = z.strictObject({
  page: pageQuery(100_000).default(1),
  pageSize: pageQuery(50).default(20),
});

export interface Application {
  id: string;
  projectId: string;
  creatorId: string;
  creatorName: string;
  message: string;
  proposedAmount: number;
  expectedDays: number;
  status: WorkRequestStatus;
  // 거래 진행 단계(계약 뒤 결제·제작·완료까지)
  stage: ActivityStage;
  closedReason: WorkRequestClosedReason | null;
  respondedAt: string | null;
  createdAt: string;
}

// 크리에이터 본인 지원 내역: 지원 프로젝트의 요약을 함께 준다.
export interface MyApplication extends Application {
  project: { id: string; title: string; status: ProjectStatus };
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MyApplicationListResponse {
  items: MyApplication[];
  pagination: Pagination;
}

export interface ProjectApplicationListResponse {
  items: Application[];
}
