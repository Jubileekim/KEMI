import { z } from "zod";
import { displayNameSchema } from "./auth.js";
import {
  type ContentStyle,
  contentStyleSchema,
  type CreatorServiceStatus,
  type ProductCategory,
  productCategorySchema,
  type ProductionRole,
  productionRoleSchema,
} from "./status.js";

// 선택 입력 문자열: 앞뒤 공백을 지우고, 빈 값은 "입력 안 함"(null)으로 저장한다. (빈 선택값은 오류가 아니다)
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable();
}

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      value === "" ||
      ((value.startsWith("https://") || value.startsWith("http://")) &&
        URL.canParse(value)),
    "http:// 또는 https://로 시작하는 주소를 입력해주세요.",
  )
  .transform((value) => (value === "" ? null : value))
  .nullable();

// 같은 값을 두 번 고르지 않게 한다.
function uniqueList<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .refine(
      (values) => new Set(values).size === values.length,
      "같은 항목을 두 번 선택할 수 없습니다.",
    );
}

// 의뢰인 프로필 수정 (PROFILE-01). 모든 항목 선택, 보낸 항목만 바꾼다.
export const clientProfileUpdateSchema = z.strictObject({
  name: displayNameSchema.optional(),
  brandName: optionalText(50).optional(),
  introduction: optionalText(1000).optional(),
  industry: productCategorySchema.nullable().optional(),
  websiteUrl: optionalUrl.optional(),
  socialUrl: optionalUrl.optional(),
});
export type ClientProfileUpdateRequest = z.input<
  typeof clientProfileUpdateSchema
>;

// 크리에이터 프로필 수정 (PROFILE-02). 미완성 저장 가능. 공개 상태는 여기서 바꾸지 않는다.
export const creatorProfileUpdateSchema = z.strictObject({
  name: displayNameSchema.optional(),
  introduction: optionalText(1000).optional(),
  niche: productCategorySchema.nullable().optional(),
  contentStyles: uniqueList(contentStyleSchema).optional(),
  productionRoles: uniqueList(productionRoleSchema).optional(),
  workMethod: optionalText(1000).optional(),
  isAvailable: z.boolean().optional(),
  availableFrom: z.iso.date().nullable().optional(),
});
export type CreatorProfileUpdateRequest = z.input<
  typeof creatorProfileUpdateSchema
>;

export interface ClientProfile {
  type: "CLIENT";
  brandName: string | null;
  introduction: string | null;
  industry: ProductCategory | null;
  websiteUrl: string | null;
  socialUrl: string | null;
}

export interface CreatorProfile {
  type: "CREATOR";
  introduction: string | null;
  niche: ProductCategory | null;
  contentStyles: ContentStyle[];
  productionRoles: ProductionRole[];
  workMethod: string | null;
  serviceStatus: CreatorServiceStatus;
  isAvailable: boolean;
  // YYYY-MM-DD
  availableFrom: string | null;
}

// 아직 저장한 적이 없으면 기본값(빈 프로필)을 돌려준다.
export interface MyProfileResponse {
  name: string;
  profile: ClientProfile | CreatorProfile;
}
