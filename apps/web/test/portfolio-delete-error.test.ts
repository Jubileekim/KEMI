import { expect, it } from "vitest";
import clarifyPortfolioDeleteError from "../src/features/packages/portfolio-delete-error";
import { ApiError } from "../src/shared/api/client";

it("shows a specific explanation when an existing inquiry prevents portfolio deletion", () => {
  const generic = new ApiError(
    409,
    "CONFLICT",
    "상태가 변경되었어요. 다시 확인해 주세요.",
  );
  const normalized = clarifyPortfolioDeleteError(generic);
  expect(normalized).toBeInstanceOf(ApiError);
  expect(normalized).toHaveProperty("code", "PORTFOLIO_REFERENCED");
  expect(normalized).toHaveProperty(
    "message",
    expect.stringContaining("참고 작품으로 사용되어 삭제할 수 없어요"),
  );
  expect(normalized).toHaveProperty(
    "message",
    expect.stringContaining("비공개로 전환"),
  );
});

it("does not rewrite unrelated errors", () => {
  const forbidden = new ApiError(403, "FORBIDDEN", "접근 권한이 없어요.");
  const otherConflict = new ApiError(409, "OTHER_CONFLICT", "다른 충돌");
  expect(clarifyPortfolioDeleteError(forbidden)).toBe(forbidden);
  expect(clarifyPortfolioDeleteError(otherConflict)).toBe(otherConflict);
});
