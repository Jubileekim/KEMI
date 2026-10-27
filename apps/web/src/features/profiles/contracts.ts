import { z } from "zod";
import {
  clientProfileUpdateSchema,
  creatorProfileUpdateSchema,
  contentStyleSchema,
  creatorServiceStatusSchema,
  productCategorySchema,
  productionRoleSchema,
  type MyProfileResponse,
} from "@kemi/shared";

const client = z.object({
  type: z.literal("CLIENT"),
  imageFileId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .nullable()
    .optional(),
  brandName: z.string().nullable(),
  introduction: z.string().nullable(),
  industry: productCategorySchema.nullable(),
  websiteUrl: z.string().nullable(),
  socialUrl: z.string().nullable(),
});
const creator = z.object({
  type: z.literal("CREATOR"),
  imageFileId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .nullable()
    .optional(),
  career: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  socialUrl: z.string().nullable().optional(),
  introduction: z.string().nullable(),
  niche: productCategorySchema.nullable(),
  contentStyles: z.array(contentStyleSchema),
  productionRoles: z.array(productionRoleSchema),
  workMethod: z.string().nullable(),
  serviceStatus: creatorServiceStatusSchema,
  isAvailable: z.boolean(),
  availableFrom: z.iso.date().nullable(),
});
export const profileResponseSchema = z.object({
  name: z.string(),
  profile: z.discriminatedUnion("type", [client, creator]),
});
export type ProfileRole = "CLIENT" | "CREATOR";

const fields = z.object({
  name: z.string(),
  imageFileId: z.string(),
  career: z.string(),
  brandName: z.string(),
  introduction: z.string(),
  industry: z.string(),
  websiteUrl: z.string(),
  socialUrl: z.string(),
  niche: z.string(),
  contentStyles: z.array(contentStyleSchema),
  productionRoles: z.array(productionRoleSchema),
  workMethod: z.string(),
  isAvailable: z.boolean(),
  availableFrom: z.string(),
});
export type ProfileValues = z.infer<typeof fields>;
export const labels: Record<keyof ProfileValues, string> = {
  name: "표시 이름 (필수)",
  imageFileId: "프로필 이미지",
  career: "경력 (선택)",
  brandName: "브랜드명 (선택)",
  introduction: "소개 (선택)",
  industry: "제품 분야 (선택)",
  websiteUrl: "자사몰 주소 (선택)",
  socialUrl: "공식 SNS 주소 (선택)",
  niche: "제작 분야 (선택)",
  contentStyles: "콘텐츠 스타일 (복수 선택)",
  productionRoles: "제작 역할 (복수 선택)",
  workMethod: "작업 방식 (선택)",
  isAvailable: "현재 작업 가능",
  availableFrom: "작업 가능일 (선택)",
};
export const optionLabels: Record<string, string> = {
  BEAUTY: "뷰티",
  FOOD: "식품",
  LIFESTYLE: "라이프스타일",
  TECH: "테크",
  OTHER: "기타",
  MODERN: "모던",
  BRIGHT: "밝은",
  EMOTIONAL: "감성",
  PROFESSIONAL: "전문적",
  PLANNING: "기획",
  ON_CAMERA: "출연",
  FILMING: "촬영",
  EDITING: "편집",
};
export function profileValues(data: MyProfileResponse): ProfileValues {
  const common: ProfileValues = {
    name: data.name,
    imageFileId: data.profile.imageFileId ?? "",
    career: "",
    introduction: data.profile.introduction ?? "",
    brandName: "",
    industry: "",
    websiteUrl: "",
    socialUrl: "",
    niche: "",
    contentStyles: [],
    productionRoles: [],
    workMethod: "",
    isAvailable: false,
    availableFrom: "",
  };
  if (data.profile.type === "CLIENT")
    return {
      ...common,
      ...data.profile,
      imageFileId: data.profile.imageFileId ?? "",
      introduction: data.profile.introduction ?? "",
      brandName: data.profile.brandName ?? "",
      industry: data.profile.industry ?? "",
      websiteUrl: data.profile.websiteUrl ?? "",
      socialUrl: data.profile.socialUrl ?? "",
    };
  return {
    ...common,
    ...data.profile,
    imageFileId: data.profile.imageFileId ?? "",
    career: data.profile.career ?? "",
    websiteUrl: data.profile.websiteUrl ?? "",
    socialUrl: data.profile.socialUrl ?? "",
    introduction: data.profile.introduction ?? "",
    niche: data.profile.niche ?? "",
    workMethod: data.profile.workMethod ?? "",
    availableFrom: data.profile.availableFrom ?? "",
  };
}
// Only the logged-in role's supported fields ever reach the product API.
export function profileInput(role: ProfileRole, values: ProfileValues) {
  const common = {
    name: values.name,
    introduction: values.introduction,
    imageFileId: values.imageFileId || null,
  };
  if (role === "CLIENT")
    return {
      ...common,
      brandName: values.brandName,
      industry: values.industry || null,
      websiteUrl: values.websiteUrl,
      socialUrl: values.socialUrl,
    };
  return {
    ...common,
    niche: values.niche || null,
    contentStyles: values.contentStyles,
    productionRoles: values.productionRoles,
    workMethod: values.workMethod,
    career: values.career,
    websiteUrl: values.websiteUrl,
    socialUrl: values.socialUrl,
    isAvailable: values.isAvailable,
    availableFrom: values.availableFrom || null,
  };
}
export function profileFormSchema(role: ProfileRole) {
  return fields.superRefine((values, context) => {
    const schema =
      role === "CLIENT"
        ? clientProfileUpdateSchema
        : creatorProfileUpdateSchema;
    const result = schema.safeParse(profileInput(role, values));
    if (!result.success)
      result.error.issues.forEach((issue) =>
        context.addIssue({
          code: "custom",
          path: issue.path,
          message:
            issue.path[0] === "name"
              ? "표시 이름은 2~20자로 입력해 주세요."
              : "입력 형식과 길이를 확인해 주세요.",
        }),
      );
  });
}
export function profilePatch(
  role: ProfileRole,
  values: ProfileValues,
  original: ProfileValues,
) {
  const input = profileInput(role, values);
  const before = profileInput(role, original);
  const changed = Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(Reflect.get(before, key)),
    ),
  );
  return (
    role === "CLIENT" ? clientProfileUpdateSchema : creatorProfileUpdateSchema
  ).parse(changed);
}
