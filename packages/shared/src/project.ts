import { z } from "zod";

export const VIDEO_PURPOSES = [
  "WEDDING_COUPLE",
  "CHILD_FAMILY",
  "THANKS_CELEBRATION",
  "TRAVEL_DAILY",
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

export const PROJECT_STATUSES = [
  "OPEN",
  "MATCHED",
  "CLOSED",
  "CONTRACTED",
] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const PROJECT_CLOSE_REASONS = [
  "MANUAL",
  "EXPIRED",
  "NO_SELECTION",
] as const;
export const projectCloseReasonSchema = z.enum(PROJECT_CLOSE_REASONS);
export type ProjectCloseReason = z.infer<typeof projectCloseReasonSchema>;

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
  closeReason: ProjectCloseReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  unavailableIds?: string[];
  recommendation?: {
    basis: "PREFERENCES" | "LATEST_NO_PREFERENCES" | "LATEST_NO_MATCHES";
    reason: string;
  };
  items: ProjectSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
