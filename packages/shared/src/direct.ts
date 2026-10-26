import { z } from "zod";
import type { Portfolio } from "./catalog.js";
import type { WorkRequestStatus } from "./application.js";
import { productionRoleSchema } from "./status.js";
import { videoPurposeSchema, videoStyleSchema } from "./project.js";

// ─── 직접 의뢰 (DIRECT-01~03, ORDER-01~03) ─────────────────────
// 공개 패키지에서 공고 없이 보내는 의뢰. 크리에이터가 48시간 안에 협의를 수락하거나 거절한다.
// 협의 수락은 계약 확정이 아니다. 이후 조건서·양측 서명·결제·납품은 공개 모집과 같은 흐름을 쓴다.
export const DIRECT_REQUEST_RESPONSE_HOURS = 48;

export const directRequestCreateSchema = z.strictObject({
  // 요청사항(ORDER-02)
  message: z.string().trim().min(10).max(2000),
  purpose: videoPurposeSchema.optional(),
  // 행사일(있으면). KST 날짜
  eventDate: z.iso.date().optional(),
});
export type DirectRequestCreateRequest = z.input<
  typeof directRequestCreateSchema
>;

// 요청 시점의 패키지 조건 사본(나중에 패키지를 고쳐도 바뀌지 않는다)
export interface PackageSnapshot {
  packageId: string;
  title: string;
  priceKrw: number;
  deliveryDays: number;
  revisionCount: number;
  includes: string[];
}

export interface DirectRequest {
  id: string;
  clientId: string;
  clientName: string;
  creatorId: string;
  creatorName: string;
  package: PackageSnapshot;
  message: string;
  purpose: string | null;
  eventDate: string | null;
  status: WorkRequestStatus;
  // 크리에이터 응답 기한
  respondDueAt: string;
  respondedAt: string | null;
  createdAt: string;
}

// ─── 작업물 피드 (FEED-01~03) ──────────────────────────────────
const pageQuery = (max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .optional();
// 쉼표로 구분한 목록(예: styles=EMOTIONAL,FUN)
const commaList = (value: string) => value.split(",").filter(Boolean);

export const feedQuerySchema = z.strictObject({
  purpose: videoPurposeSchema.optional(),
  styles: z
    .string()
    .transform(commaList)
    .pipe(z.array(videoStyleSchema).min(1).max(7))
    .optional(),
  // 작업 유형(본인 제작 역할)
  roles: z
    .string()
    .transform(commaList)
    .pipe(z.array(productionRoleSchema).min(1).max(4))
    .optional(),
  page: pageQuery(100_000).default(1),
  pageSize: pageQuery(50).default(24),
});
export type FeedQuery = z.output<typeof feedQuerySchema>;

export interface FeedItem {
  portfolio: Portfolio;
  creator: { userId: string; name: string };
  // 대표 패키지 가격(시작 가격 표시용)
  startingPriceKrw: number | null;
}

export interface FeedResponse {
  items: FeedItem[];
  page: number;
  pageSize: number;
  total: number;
}

// ─── 운영 지표 (METRIC-01) ─────────────────────────────────────
// [제안, D22] 별도 이벤트 저장소 없이 거래 테이블에서 계산한다(거래 확정 중복 없음, 개인정보 없음).
// 시드·시연 계정(이메일 도메인 kemi.test)은 빼고 센다.
export const TEST_EMAIL_DOMAIN = "kemi.test";

export interface MetricsSummary {
  generatedAt: string;
  projectsPublished: number;
  applications: number;
  directRequests: number;
  contracts: number;
  paymentsSucceeded: number;
  completedDeals: number;
  // 납품 버전 중 수정 요청을 받은 비율(0~1)
  revisionRequestRate: number | null;
  // 제작 시작부터 최종 수령까지 평균 일수
  averageProductionDays: number | null;
  aiAnalyses: number;
  aiBudgetsApplied: number;
}
