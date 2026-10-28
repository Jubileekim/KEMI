import { ApiError } from "../../shared/api/client";

/** Give a safe, specific message for a portfolio referenced by an existing inquiry. */
export default function clarifyPortfolioDeleteError(error: unknown): unknown {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === "CONFLICT"
  ) {
    return new ApiError(
      409,
      "PORTFOLIO_REFERENCED",
      "의뢰에 참고 작품으로 사용되어 삭제할 수 없어요. 비공개로 전환해 주세요.",
    );
  }
  return error;
}
