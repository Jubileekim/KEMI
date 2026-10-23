import { z } from "zod";

export const VIDEO_PURPOSES = [
  "WEDDING",
  "FIRST_BIRTHDAY",
  "PROPOSAL",
  "FAMILY_EVENT",
  "TRAVEL",
  "SNS_SHORTFORM",
  "OTHER",
] as const;
export const videoPurposeSchema = z.enum(VIDEO_PURPOSES);
export type VideoPurpose = z.infer<typeof videoPurposeSchema>;

export const VIDEO_STYLES = [
  "EMOTIONAL",
  "FUN",
  "CINEMATIC",
  "CLEAN",
  "TRENDY",
  "RETRO",
  "OTHER",
] as const;
export const videoStyleSchema = z.enum(VIDEO_STYLES);
export type VideoStyle = z.infer<typeof videoStyleSchema>;

// OPEN: 모집 중 / CLOSED: 직접 마감(신규 지원만 차단, 대기 지원자 선정 가능) / MATCHED: 지원자 선정, 거래 단계
// CONTRACTED: 계약 체결(계약 기능에서 사용) / NO_SELECTION: 선정자와 합의 실패 등으로 무선정 종료(계약 기능에서 사용)
export const PROJECT_STATUSES = [
  "OPEN",
  "CLOSED",
  "MATCHED",
  "CONTRACTED",
  "NO_SELECTION",
] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const PROJECT_SORTS = [
  "LATEST",
  "BUDGET_LOW",
  "BUDGET_HIGH",
  "DEADLINE",
] as const;
export const projectSortSchema = z.enum(PROJECT_SORTS);
export type ProjectSort = z.infer<typeof projectSortSchema>;

const projectTitleSchema = z.string().trim().min(2).max(200);
const projectDescriptionSchema = z.string().trim().min(10).max(5000);
const projectBudgetSchema = z.number().int().min(1).max(1_000_000_000);
const projectDurationSchema = z.number().int().min(1).max(21_600);
const projectStylesSchema = z
  .array(videoStyleSchema)
  .min(1)
  .max(5)
  .refine(
    (values) => new Set(values).size === values.length,
    "같은 스타일을 두 번 선택할 수 없습니다.",
  );

export const projectCreateSchema = z.strictObject({
  title: projectTitleSchema,
  description: projectDescriptionSchema,
  purpose: videoPurposeSchema,
  styles: projectStylesSchema,
  budget: projectBudgetSchema,
  expectedDurationSeconds: projectDurationSchema.nullable().optional(),
  recruitmentEndAt: z.iso.datetime({ offset: true }),
  deliveryDueDate: z.iso.date(),
});
export type ProjectCreateRequest = z.input<typeof projectCreateSchema>;

export const projectUpdateSchema = projectCreateSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "수정할 항목을 한 개 이상 보내주세요.",
  );
export type ProjectUpdateRequest = z.input<typeof projectUpdateSchema>;

const optionalQueryInteger = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional();

const queryStylesSchema = z
  .string()
  .transform((value) => value.split(",").filter(Boolean))
  .pipe(projectStylesSchema)
  .optional();

export const projectListQuerySchema = z
  .strictObject({
    q: z.string().trim().min(1).max(100).optional(),
    purpose: videoPurposeSchema.optional(),
    styles: queryStylesSchema,
    budgetMin: optionalQueryInteger(1, 1_000_000_000),
    budgetMax: optionalQueryInteger(1, 1_000_000_000),
    sort: projectSortSchema.default("LATEST"),
    page: optionalQueryInteger(1, 100_000).default(1),
    pageSize: optionalQueryInteger(1, 50).default(20),
  })
  .refine(
    ({ budgetMin, budgetMax }) =>
      budgetMin === undefined ||
      budgetMax === undefined ||
      budgetMin <= budgetMax,
    {
      path: ["budgetMax"],
      message: "최대 예산은 최소 예산 이상이어야 합니다.",
    },
  );
export type ProjectListQuery = z.output<typeof projectListQuerySchema>;

export interface ProjectSummary {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  description: string;
  purpose: VideoPurpose;
  styles: VideoStyle[];
  budget: number;
  expectedDurationSeconds: number | null;
  recruitmentEndAt: string;
  deliveryDueDate: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
