import { z } from "zod";
import type { CreatorServiceStatus } from "./status.js";

// 서비스 패키지 (PACK-01~03). 값 범위는 [제안]이며 결정 기록 12장에서 팀이 확정한다.
export const PACKAGE_LIMITS = {
  // 크리에이터 1명이 가질 수 있는 삭제되지 않은 패키지 수 [제안 · 새 정책]
  maxPackages: 3,
  minPrice: 1_000,
  maxPrice: 100_000_000,
  maxDeliveryDays: 90,
  maxRevisions: 10,
  maxRequiredMaterials: 20,
} as const;

// 필수 문자열: 앞뒤 공백을 지운 뒤 비어 있으면 안 된다.
function requiredText(max: number, min = 1) {
  return z.string().trim().min(min).max(max);
}

// 선택 문자열: 빈 값은 "없음"(null)으로 저장한다.
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();
}

// 결과물 규격. 수량만 필수이고 나머지는 자유 입력이다(선택지 목록은 아직 정하지 않았다).
export const packageSpecificationSchema = z.strictObject({
  videoCount: z.int().min(1).max(100),
  lengthSeconds: z.int().min(1).max(3600).nullable(),
  aspectRatio: optionalText(20),
  resolution: optionalText(20),
  format: optionalText(20),
});

export const packageSourceDeliverySchema = z.strictObject({
  provided: z.boolean(),
  note: optionalText(500),
});

// 공통 기본 활용권 외에 이 패키지에만 붙는 조건
export const packageUsageTermsSchema = z.strictObject({
  note: optionalText(1000),
});

const packageFields = {
  title: requiredText(100, 2),
  description: requiredText(2000),
  basePrice: z.int().min(PACKAGE_LIMITS.minPrice).max(PACKAGE_LIMITS.maxPrice),
  specification: packageSpecificationSchema,
  includedScope: requiredText(2000),
  // 제외 작업이 없으면 빈 문자열을 보낸다.
  excludedScope: z.string().trim().max(2000),
  requiredMaterials: z
    .array(requiredText(100))
    .max(PACKAGE_LIMITS.maxRequiredMaterials),
  deliveryDays: z.int().min(1).max(PACKAGE_LIMITS.maxDeliveryDays),
  revisionLimit: z.int().min(0).max(PACKAGE_LIMITS.maxRevisions),
  revisionScope: requiredText(1000),
  sourceDelivery: packageSourceDeliverySchema,
  usageTerms: packageUsageTermsSchema,
  isPublic: z.boolean(),
};

// 패키지 만들기: 공개 여부 외에는 모두 필수. 공개 여부를 빼면 비공개로 만든다.
export const packageCreateSchema = z.strictObject({
  ...packageFields,
  isPublic: packageFields.isPublic.default(false),
});
export type PackageCreateRequest = z.input<typeof packageCreateSchema>;

// 패키지 수정: 보낸 항목만 바꾼다. 객체 항목(specification 등)은 통째로 바꾼다.
export const packageUpdateSchema = z.strictObject(packageFields).partial();
export type PackageUpdateRequest = z.input<typeof packageUpdateSchema>;

// 제작 서비스 공개·비공개 (PROFILE-03·04). DRAFT로는 되돌리지 않는다.
export const serviceStatusUpdateSchema = z.strictObject({
  status: z.enum(["PUBLIC", "PRIVATE"]),
});
export type ServiceStatusUpdateRequest = z.input<
  typeof serviceStatusUpdateSchema
>;

// 공개 전에 채워야 하는 프로필 항목과 패키지 조건 [제안 · D01]
export const SERVICE_REQUIREMENTS = [
  "INTRODUCTION",
  "NICHE",
  "CONTENT_STYLES",
  "PRODUCTION_ROLES",
  "PUBLIC_REPRESENTATIVE_PACKAGE",
] as const;
export type ServiceRequirement = (typeof SERVICE_REQUIREMENTS)[number];

export interface ServicePackage {
  id: string;
  title: string;
  description: string;
  basePrice: number;
  currency: "KRW";
  specification: z.output<typeof packageSpecificationSchema>;
  includedScope: string;
  excludedScope: string;
  requiredMaterials: string[];
  deliveryDays: number;
  revisionLimit: number;
  revisionScope: string;
  sourceDelivery: z.output<typeof packageSourceDeliverySchema>;
  usageTerms: z.output<typeof packageUsageTermsSchema>;
  isPublic: boolean;
  isRepresentative: boolean;
  createdAt: string;
  updatedAt: string;
}

// 본인 패키지 목록과 서비스 상태. 패키지를 바꾸면 대표·서비스 상태가 함께 바뀔 수 있어 모든 변경 응답이 이 형식이다.
export interface MyPackagesResponse {
  serviceStatus: CreatorServiceStatus;
  packages: ServicePackage[];
}

// 다른 회원이 보는 공개 패키지 (공개 서비스의 공개 패키지만)
export interface CreatorPackagesResponse {
  creatorId: string;
  packages: ServicePackage[];
}
