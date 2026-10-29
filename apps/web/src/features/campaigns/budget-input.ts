import { MAX_PROJECT_BUDGET_KRW } from "@kemi/shared";

// max 속성은 제출만 막으므로 타이핑·붙여넣기 시에도 상한을 적용한다.
export default function limitBudgetInput(event: {
  currentTarget: Pick<HTMLInputElement, "value">;
}) {
  const input = event.currentTarget;
  if (Number(input.value) > MAX_PROJECT_BUDGET_KRW) {
    input.value = String(MAX_PROJECT_BUDGET_KRW);
  }
}
