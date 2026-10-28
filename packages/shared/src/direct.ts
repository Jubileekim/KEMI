import { z } from "zod";
import type { Portfolio } from "./catalog.js";
import type { WorkRequestStatus } from "./application.js";
import { productionRoleSchema } from "./status.js";
import { videoPurposeSchema, videoStyleSchema } from "./project.js";

// ─── 직접 의뢰 (DIRECT-01~03, ORDER-01~03) ─────────────────────
// 공개 패키지에서 공고 없이 보내는 의뢰. 크리에이터가 48시간 안에 협의를 수락하거나 거절한다.
// 협의 수락은 계약 확정이 아니다. 이후 조건서·양측 서명·결제·납품은 공개 모집과 같은 흐름을 쓴다.
export const DIRECT_REQUEST_RESPONSE_HOURS = 48;

// 보유 자료(INQ-01): 사진만 / 사진·영상 / 촬영도 필요
export const MATERIAL_TYPES = [
  "PHOTOS_ONLY",
  "PHOTOS_AND_VIDEOS",
  "NEEDS_SHOOTING",
] as const;
export const materialTypeSchema = z.enum(MATERIAL_TYPES);
export type MaterialType = z.infer<typeof materialTypeSchema>;

const idString = z.string().regex(/^[1-9]\d*$/);

// 직접 의뢰·일괄 문의가 함께 쓰는 요청 조건
const requestConditions = {
  // 요청사항(ORDER-02)
  message: z.string().trim().min(10).max(2000),
  purpose: videoPurposeSchema.optional(),
  // 행사일(있으면). KST 날짜
  eventDate: z.iso.date().optional(),
  // 보유 자료(있으면)
  materialType: materialTypeSchema.optional(),
  // 희망 납품일. 행사 전에 받아 재생을 확인할 수 있게 행사일과 따로 받는다.
  desiredDeliveryDate: z.iso.date().optional(),
};
// 희망 납품일은 행사일보다 늦을 수 없다.
const deliveryBeforeEvent = (value: {
  eventDate?: string;
  desiredDeliveryDate?: string;
}) =>
  !value.eventDate ||
  !value.desiredDeliveryDate ||
  value.desiredDeliveryDate <= value.eventDate;
const deliveryBeforeEventIssue = {
  path: ["desiredDeliveryDate"],
  message: "희망 납품일은 행사일과 같거나 빨라야 합니다.",
};

export const directRequestCreateSchema = z
  .strictObject({
    ...requestConditions,
    // 이 의뢰를 시작한 참고 작품(이 크리에이터의 공개 작품)
    referencePortfolioId: idString.optional(),
  })
  .refine(deliveryBeforeEvent, deliveryBeforeEventIssue);
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
  materialType: MaterialType | null;
  desiredDeliveryDate: string | null;
  // 참고 작품(삭제·비공개가 되어도 ID와 제목은 남긴다)
  referencePortfolio: { id: string; title: string } | null;
  // 일괄 문의로 보냈으면 그 묶음 ID(같은 조건으로 여러 크리에이터에게 보낸 요청)
  inquiryGroupId: string | null;
  status: WorkRequestStatus;
  // 크리에이터 응답 기한
  respondDueAt: string;
  respondedAt: string | null;
  createdAt: string;
}

// ─── 일괄 문의 (INQ-01) ────────────────────────────────────────
// 저장한 작품 1~5개를 골라, 각 작품의 제작자에게 같은 조건으로 직접 의뢰를 보낸다.
// 작품마다 연결 패키지(없으면 그 크리에이터의 대표 패키지) 조건으로 요청한다. 크리에이터당 한 건이다.
export const BULK_INQUIRY_MAX = 5;

export const bulkInquiryCreateSchema = z
  .strictObject({
    // 화면이 만든 요청 식별자. 같은 값으로 다시 보내면 처음 결과를 돌려준다(중복 발송 방지).
    commandId: z.uuid(),
    portfolioIds: z
      .array(idString)
      .min(1)
      .max(BULK_INQUIRY_MAX)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "같은 작품이 두 번 들어 있습니다.",
      ),
    ...requestConditions,
  })
  .refine(deliveryBeforeEvent, deliveryBeforeEventIssue);
export type BulkInquiryCreateRequest = z.input<typeof bulkInquiryCreateSchema>;

// SENT: 보냄, ALREADY_OPEN: 이 패키지로 답을 기다리거나 협의 중인 의뢰가 이미 있음,
// SAME_CREATOR: 같은 크리에이터의 다른 작품으로 이미 보냄, UNAVAILABLE: 작품·패키지·서비스가 공개 상태가 아님
export const BULK_INQUIRY_RESULTS = [
  "SENT",
  "ALREADY_OPEN",
  "SAME_CREATOR",
  "UNAVAILABLE",
] as const;
export type BulkInquiryResultStatus = (typeof BULK_INQUIRY_RESULTS)[number];

export interface BulkInquiryResult {
  portfolioId: string;
  portfolioTitle: string | null;
  creatorName: string | null;
  status: BulkInquiryResultStatus;
  request: DirectRequest | null;
}

export interface BulkInquiryResponse {
  inquiryGroupId: string;
  results: BulkInquiryResult[];
}

// ─── 작품 저장함 (SAVE-01) ─────────────────────────────────────
export const WORK_BOOKMARK_MAX = 100;

export interface WorkBookmark extends FeedItem {
  savedAt: string;
  // 지금도 공개 중이고 의뢰할 수 있는지(작품 공개·서비스 공개·연결 또는 대표 패키지 공개)
  available: boolean;
}

export interface WorkBookmarkListResponse {
  items: WorkBookmark[];
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
