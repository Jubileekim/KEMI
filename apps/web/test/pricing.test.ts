import { describe, it, expect } from "vitest";
import {
  pricingAnalysisRequestSchema,
  pricingResponseSchema,
  mockPricingResponse,
  pricingReportSchema,
} from "../src/mocks/pricing-model";
import {
  applyCampaign,
  emptyCampaign,
  emptyCampaignState,
} from "../src/mocks/campaign-model";

const report = {
  id: "6ed68f45-5b94-419b-9425-f52ca8701c57",
  input: { description: "제공 영상 편집과 자막 제작 1편" },
  response: mockPricingResponse,
  modelVersion: "mock-fixture-v1",
  promptVersion: "mock-no-prompt-v1",
};
describe("AI-01/02 shared-compatible explicit Mock", () => {
  it("예산 없는 제작 설명 분석·길이 경계와 비허용 필드 제외", () => {
    expect(pricingAnalysisRequestSchema.parse(report.input)).toEqual(
      report.input,
    );
    expect(
      pricingAnalysisRequestSchema.safeParse({ description: "짧음" }).success,
    ).toBe(false);
    expect(
      pricingAnalysisRequestSchema.safeParse({ description: "가".repeat(5001) })
        .success,
    ).toBe(false);
    expect(
      pricingAnalysisRequestSchema.safeParse({
        ...report.input,
        privateFile: "secret",
      }).success,
    ).toBe(false);
  });
  it("구조·소계·합계 검증", () => {
    expect(
      pricingResponseSchema.parse(mockPricingResponse).estimatedBudgetKrw,
    ).toBe(150000);
    expect(
      pricingResponseSchema.safeParse({
        ...mockPricingResponse,
        estimatedBudgetKrw: 1,
      }).success,
    ).toBe(false);
    expect(
      pricingResponseSchema.safeParse({
        ...mockPricingResponse,
        workUnits: [
          { ...mockPricingResponse.workUnits[0], subtotalKrw: 150000 },
        ],
      }).success,
    ).toBe(false);
    expect(
      pricingResponseSchema.safeParse({ ...mockPricingResponse, workUnits: [] })
        .success,
    ).toBe(false);
  });
  it("음수·비정수·과도한 단가·통화·출처·빈 근거 거부", () => {
    [-1, 1.5, 5000001].forEach((unitPriceKrw) => {
      expect(
        pricingResponseSchema.safeParse({
          ...mockPricingResponse,
          workUnits: [{ ...mockPricingResponse.workUnits[0], unitPriceKrw }],
        }).success,
      ).toBe(false);
    });
    expect(
      pricingResponseSchema.safeParse({
        ...mockPricingResponse,
        currency: "USD",
      }).success,
    ).toBe(false);
    expect(
      pricingResponseSchema.safeParse({
        ...mockPricingResponse,
        source: "MARKET_PRICE",
      }).success,
    ).toBe(false);
    expect(
      pricingResponseSchema.safeParse({
        ...mockPricingResponse,
        workUnits: [{ ...mockPricingResponse.workUnits[0], rationale: "" }],
      }).success,
    ).toBe(false);
  });
  it("실제 모델 버전을 Mock 버전으로 가장하지 않음", () => {
    expect(pricingReportSchema.safeParse(report).success).toBe(true);
    expect(
      pricingReportSchema.safeParse({ ...report, modelVersion: "actual-model" })
        .success,
    ).toBe(false);
  });
  it("명시 적용액·리포트 연결과 수동 수정 기록을 초안에 보존", () => {
    const owner = { id: "owner", role: "CLIENT", status: "ACTIVE" };
    const values = {
      ...emptyCampaign,
      budget: "120000",
      pricingApplication: { report, amountKrw: 120000 },
    };
    const state = applyCampaign(
      emptyCampaignState(),
      { revision: 0, command: { type: "save", id: report.id, values } },
      owner,
    );
    expect(state.items[0]?.pricingApplication).toEqual(
      values.pricingApplication,
    );
    const next = applyCampaign(
      state,
      {
        revision: 1,
        command: {
          type: "save",
          id: report.id,
          values: { ...values, budget: "130000" },
        },
      },
      owner,
    );
    expect(next.items[0]?.budget).toBe("130000");
    expect(next.items[0]?.pricingApplication?.amountKrw).toBe(120000);
  });
});
