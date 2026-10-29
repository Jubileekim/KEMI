import { describe, expect, it } from "vitest";
import limitBudgetInput from "../src/features/campaigns/budget-input";

describe("모집 예산 입력", () => {
  it.each(["", "1", "50000", "999999999", "1000000000"])(
    "허용 값 %s를 보존한다",
    (value) => {
      const input = { value };
      limitBudgetInput({ currentTarget: input });
      expect(input.value).toBe(value);
    },
  );

  it.each(["1000000001", "9999999999", "12345678901234567890", "1e10"])(
    "초과 입력 %s를 상한으로 제한한다",
    (value) => {
      const input = { value };
      limitBudgetInput({ currentTarget: input });
      expect(input.value).toBe("1000000000");
    },
  );
});
