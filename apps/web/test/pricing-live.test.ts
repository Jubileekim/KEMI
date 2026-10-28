import { describe, expect, it } from "vitest";
import { ApiError } from "../src/shared/api/client";
import {
  analysisError,
  pricingConditions,
} from "../src/features/campaigns/pricing-form";

describe("AI 참고 제작비 (실제 API)", () => {
  it.each([
    [503, "SERVICE_UNAVAILABLE", "AI 분석을 지금 쓸 수 없어요"],
    [429, "RATE_LIMITED", "1시간에 10번"],
    [403, "FORBIDDEN", "의뢰인 계정만"],
    [400, "VALIDATION_FAILED", "10자 이상"],
  ])("%i 응답을 예산 직접 입력 안내와 함께 보여준다", (status, code, text) => {
    expect(analysisError(new ApiError(status, code, "x"))).toContain(text);
  });

  it("폼이 없으면 빈 설명만 만든다(분석 전 검사에서 막힌다)", () => {
    expect(pricingConditions(null, [])).toEqual({ description: "" });
  });
});
