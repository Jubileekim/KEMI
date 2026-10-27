import { z } from "zod";
import { pricingModelSchema, pricingAnalysisRequestSchema } from "@kemi/shared";

export { pricingAnalysisRequestSchema };
export const pricingResponseSchema = pricingModelSchema
  .extend({
    source: z.literal("AI_ESTIMATE"),
    currency: z.literal("KRW"),
    workUnits: z
      .array(
        pricingModelSchema.shape.workUnits.element.extend({
          subtotalKrw: z.number().int().positive(),
        }),
      )
      .min(1)
      .max(8),
    estimatedBudgetKrw: z.number().int().positive().max(1_000_000_000),
    notice: z.string().trim().min(1).max(1000),
  })
  .refine(
    (value) =>
      value.workUnits.every(
        (unit) => unit.subtotalKrw === unit.quantity * unit.unitPriceKrw,
      ) &&
      value.estimatedBudgetKrw ===
        value.workUnits.reduce((sum, unit) => sum + unit.subtotalKrw, 0),
    { message: "항목 소계·합계가 일치하지 않아요." },
  );

// Local evidence only. The real pricing response has no report/version/storage contract.
export const pricingReportSchema = z.strictObject({
  id: z.string().uuid(),
  input: pricingAnalysisRequestSchema,
  response: pricingResponseSchema,
  modelVersion: z.literal("mock-fixture-v1"),
  promptVersion: z.literal("mock-no-prompt-v1"),
});
export type PricingReport = z.infer<typeof pricingReportSchema>;
export const pricingApplicationSchema = z.strictObject({
  report: pricingReportSchema,
  amountKrw: z.number().int().positive().max(1_000_000_000),
});
export const mockPricingResponse = {
  source: "AI_ESTIMATE",
  currency: "KRW",
  summary: "편집 1편을 가정한 고정 Mock 예시예요.",
  workUnits: [
    {
      name: "기본 편집",
      quantity: 1,
      unitPriceKrw: 100000,
      subtotalKrw: 100000,
      rationale: "제공 영상 편집 1편을 가정한 예시 금액이에요.",
    },
    {
      name: "자막 구성",
      quantity: 1,
      unitPriceKrw: 50000,
      subtotalKrw: 50000,
      rationale: "기본 자막 1세트를 가정한 예시 금액이에요.",
    },
  ],
  estimatedBudgetKrw: 150000,
  assumptions: [
    "촬영·원본 구매 비용 제외",
    "영상 길이·수량·납기·수정 횟수는 의뢰인이 확인해야 해요.",
  ],
  notice:
    "고정 Mock 참고값이며 시장 평균·실제 견적·계약 금액을 보장하지 않아요.",
} as const;
