import { z } from "zod";
import { videoPurposeSchema, videoStyleSchema } from "./project.js";

// 프로젝트 등록 전에도 설명만 입력해 분석할 수 있다.
export const pricingAnalysisRequestSchema = z.strictObject({
  description: z.string().trim().min(10).max(5000),
  title: z.string().trim().min(2).max(200).optional(),
  purpose: videoPurposeSchema.optional(),
  styles: z.array(videoStyleSchema).min(1).max(5).optional(),
  expectedDurationSeconds: z.number().int().min(1).max(21_600).optional(),
});
export type PricingAnalysisRequest = z.infer<
  typeof pricingAnalysisRequestSchema
>;

// 모델 출력도 서버가 다시 검증한다. 합계는 모델에 맡기지 않는다.
export const pricingModelSchema = z.strictObject({
  summary: z.string().trim().min(5).max(500),
  workUnits: z
    .array(
      z.strictObject({
        name: z.string().trim().min(2).max(80),
        quantity: z.number().int().min(1).max(10),
        unitPriceKrw: z.number().int().min(1000).max(5_000_000),
        rationale: z.string().trim().min(5).max(300),
      }),
    )
    .min(1)
    .max(8),
  assumptions: z.array(z.string().trim().min(2).max(200)).max(6),
});
export type PricingModelOutput = z.infer<typeof pricingModelSchema>;

export interface PricingAnalysisResponse {
  // 저장한 분석 보고서(AI-02 반영에 쓴다). 저장소가 없으면 null
  reportId: string | null;
  source: "AI_ESTIMATE";
  currency: "KRW";
  summary: string;
  workUnits: (PricingModelOutput["workUnits"][number] & {
    subtotalKrw: number;
  })[];
  estimatedBudgetKrw: number;
  assumptions: string[];
  notice: string;
}

// AI-02: 분석 결과를 예산에 명시적으로 반영한다. 분석만으로 예산이 바뀌지 않는다.
// 대상은 본인 공고 초안 또는 본인의 모집 중 공고 하나.
export const aiReportApplySchema = z.union([
  z.strictObject({ draftId: z.string().regex(/^[1-9]\d*$/) }),
  z.strictObject({ projectId: z.string().regex(/^[1-9]\d*$/) }),
]);
export type AiReportApplyRequest = z.input<typeof aiReportApplySchema>;

export interface AiReportApplyResponse {
  reportId: string;
  appliedBudgetKrw: number;
  draftId: string | null;
  projectId: string | null;
  appliedAt: string;
}
