import { z } from "zod";
import { productionRoleSchema } from "./status.js";
import {
  projectBudgetSchema,
  videoPurposeSchema,
  videoStyleSchema,
} from "./project.js";

// 제작 패키지·작업물·제작 서비스 공개 (단계 1: PACK-01~03, PORT-01~02)
// 초안(DRAFT)으로 저장하고, 필수 항목을 갖춰야 공개(PUBLIC)할 수 있다. PRIVATE는 공개했다가 내린 상태다.
export const CATALOG_STATUSES = ["DRAFT", "PUBLIC", "PRIVATE"] as const;
export const catalogStatusSchema = z.enum(CATALOG_STATUSES);
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;

// 작업물 출처: 본인 작업(OWN_WORK), 고객 의뢰 작업(CLIENT_WORK: 고객 동의 확인 기능 전까지 공개 불가) [D16]
export const PORTFOLIO_SOURCES = ["OWN_WORK", "CLIENT_WORK"] as const;
export const portfolioSourceSchema = z.enum(PORTFOLIO_SOURCES);
export type PortfolioSource = z.infer<typeof portfolioSourceSchema>;

const idString = z.string().regex(/^[1-9]\d*$/);
const optionalText = (min: number, max: number) =>
  z.string().trim().min(min).max(max).nullable().optional();

// 패키지 저장: 초안은 제목만 있어도 된다. 나머지는 공개할 때 모두 있어야 한다.
const packageFields = {
  title: z.string().trim().min(2).max(100),
  description: optionalText(10, 3000),
  purpose: videoPurposeSchema.nullable().optional(),
  priceKrw: z.int().min(1).max(1_000_000_000).nullable().optional(),
  deliveryDays: z.int().min(1).max(365).nullable().optional(),
  revisionCount: z.int().min(0).max(10).nullable().optional(),
  // 제공 내용(예: "3분 영상 1편", "자막")
  includes: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
};
export const packageCreateSchema = z.strictObject(packageFields);
export type PackageCreateRequest = z.input<typeof packageCreateSchema>;
export const packageUpdateSchema = z
  .strictObject(packageFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "수정할 항목을 한 개 이상 보내주세요.",
  );
export type PackageUpdateRequest = z.input<typeof packageUpdateSchema>;

const portfolioFields = {
  title: z.string().trim().min(2).max(100),
  description: optionalText(1, 3000),
  purpose: videoPurposeSchema.nullable().optional(),
  styles: z.array(videoStyleSchema).max(5).optional(),
  // 본인 제작 역할(기획·출연·촬영·편집)
  roles: z.array(productionRoleSchema).max(4).optional(),
  source: portfolioSourceSchema.optional(),
  clientConsent: z.boolean().optional(),
  // 확인이 끝난 본인 PORTFOLIO 파일(영상·대표 이미지)
  videoFileId: idString.nullable().optional(),
  thumbnailFileId: idString.nullable().optional(),
  // 작품 상세에서 보여줄 본인 공개 패키지
  packageId: idString.nullable().optional(),
};
export const portfolioCreateSchema = z.strictObject(portfolioFields);
export type PortfolioCreateRequest = z.input<typeof portfolioCreateSchema>;
export const portfolioUpdateSchema = z
  .strictObject(portfolioFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "수정할 항목을 한 개 이상 보내주세요.",
  );
export type PortfolioUpdateRequest = z.input<typeof portfolioUpdateSchema>;

export interface ServicePackage {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  purpose: string | null;
  priceKrw: number | null;
  deliveryDays: number | null;
  revisionCount: number | null;
  includes: string[];
  status: CatalogStatus;
  isRepresentative: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Portfolio {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  purpose: string | null;
  styles: string[];
  roles: string[];
  source: PortfolioSource;
  clientConsent: boolean;
  videoFileId: string | null;
  thumbnailFileId: string | null;
  packageId: string | null;
  status: CatalogStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 공개 제작자 페이지 (PORT-01, PACK-01)
export interface CreatorPublicProfile {
  userId: string;
  career?: string | null;
  websiteUrl?: string | null;
  socialUrl?: string | null;
  image?: { url: string; expiresAt: string } | null;
  name: string;
  introduction: string | null;
  niche: string | null;
  contentStyles: string[];
  productionRoles: string[];
  isAvailable: boolean;
  representativePackage: ServicePackage;
  // 대표 외 공개 패키지
  packages: ServicePackage[];
  portfolios: Portfolio[];
  review: { averageRating: number | null; count: number };
}

export interface PortfolioMedia {
  video: { url: string; expiresAt: string } | null;
  thumbnail: { url: string; expiresAt: string } | null;
}

// ─── 공고 임시 저장·공개 (CAMP-01·02) ────────────────────────
// [확정, 단계 계획] 모집 기간 3·7·14일, 기본 7일. 마감은 공개 시각 기준으로 계산한다.
export const RECRUITMENT_DAYS = [3, 7, 14] as const;
export const DEFAULT_RECRUITMENT_DAYS = 7;
export const recruitmentDaysSchema = z.union([
  z.literal(3),
  z.literal(7),
  z.literal(14),
]);

// 초안은 무엇이든 비어 있어도 된다. 공개할 때 projectCreateSchema와 같은 검사를 한다(마감은 서버가 계산).
export const projectDraftValuesSchema = z.strictObject({
  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  purpose: videoPurposeSchema.nullable().optional(),
  styles: z.array(videoStyleSchema).max(5).optional(),
  budget: projectBudgetSchema.nullable().optional(),
  expectedDurationSeconds: z.int().min(1).max(21_600).nullable().optional(),
  deliveryDueDate: z.iso.date().nullable().optional(),
  recruitmentDays: recruitmentDaysSchema.optional(),
});
export type ProjectDraftValues = z.output<typeof projectDraftValuesSchema>;

export interface ProjectDraft {
  id: string;
  values: ProjectDraftValues;
  recruitmentDays: number;
  // 공개되면 만들어진 프로젝트
  publishedProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}
