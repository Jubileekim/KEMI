import {
  pricingAnalysisRequestSchema,
  projectBudgetSchema,
  type PricingAnalysisRequest,
} from "@kemi/shared";
import { ApiError } from "../../shared/api/client";
import { errorText } from "../live/errors";

// AI 참고 제작비 패널(PricingPanel)이 쓰는 폼 읽기·쓰기와 오류 문구.

export function analysisError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503)
      return "AI 분석을 지금 쓸 수 없어요. 예산을 직접 입력해 주세요.";
    if (error.status === 429)
      return "분석은 1시간에 10번까지 할 수 있어요. 잠시 후 다시 시도하거나 예산을 직접 입력해 주세요.";
    if (error.status === 403) return "의뢰인 계정만 AI 분석을 쓸 수 있어요.";
    if (error.status === 400)
      return "설명을 10자 이상 적고 목적·스타일을 확인해 주세요.";
  }
  return errorText(error, "분석하지 못했어요. 예산을 직접 입력해 주세요.");
}

// 폼에 지금 적힌 값으로 분석 요청을 만든다. 빈 항목은 보내지 않는다.
export function pricingConditions(
  form: HTMLFormElement | null,
  styles: string[],
): PricingAnalysisRequest {
  const data = new FormData(form ?? undefined);
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const purpose = pricingAnalysisRequestSchema.shape.purpose.safeParse(
    text("purpose") || undefined,
  );
  const style = pricingAnalysisRequestSchema.shape.styles.safeParse(
    styles.length > 0 ? styles : undefined,
  );
  return {
    description: text("description"),
    ...(text("title").length >= 2 ? { title: text("title") } : {}),
    ...(purpose.success && purpose.data ? { purpose: purpose.data } : {}),
    ...(style.success && style.data ? { styles: style.data } : {}),
  };
}

// 예산 입력란(name="budget")에 금액을 넣는다.
export function setBudget(form: HTMLFormElement | null, amountKrw: number) {
  const input = form?.elements.namedItem("budget");
  if (input instanceof HTMLInputElement)
    input.value = String(projectBudgetSchema.parse(amountKrw));
}
