import { describe, expect, it } from "vitest";
import { api, ApiError, connectSession } from "../src/shared/api/client";
import { errorText } from "../src/features/live/errors";

connectSession({
  token: async () => "token",
  epoch: () => 0,
  recover: async () => {},
  isAuthenticated: () => true,
});

const failWith = (status: number, data: unknown) =>
  api
    .get("/api/test", {
      adapter: async (config) =>
        Promise.reject(
          Object.assign(new Error("fail"), {
            isAxiosError: true,
            config,
            response: { status, data, headers: {}, config, statusText: "" },
          }),
        ),
    })
    .catch((error: unknown) => error);

describe("서버의 사용자용 오류 이유", () => {
  it("409·400의 한국어 이유는 그대로 보여 준다", async () => {
    const conflict = await failWith(409, {
      error: {
        code: "CONFLICT",
        message: "검토본이 승인된 뒤에 최종본을 낼 수 있습니다.",
      },
    });
    expect(errorText(conflict)).toBe(
      "검토본이 승인된 뒤에 최종본을 낼 수 있습니다.",
    );
    const invalid = await failWith(400, {
      error: {
        code: "VALIDATION_FAILED",
        message: "희망 납품일은 모집 마감일보다 뒤여야 합니다.",
      },
    });
    expect(errorText(invalid)).toBe(
      "희망 납품일은 모집 마감일보다 뒤여야 합니다.",
    );
    // 입력 검사 항목 배열이 오면 첫 항목의 이유를 쓴다.
    const issues = await failWith(400, {
      error: {
        code: "VALIDATION_FAILED",
        message: "입력값을 확인해주세요.",
        details: [
          { path: ["deliveryDueDate"], message: "납품일을 골라 주세요." },
        ],
      },
    });
    expect(errorText(issues)).toBe("납품일을 골라 주세요.");
  });

  it("서버 오류·영문 문구는 화면 문구를 쓴다", async () => {
    const server = await failWith(500, {
      error: { code: "INTERNAL_ERROR", message: "내부 오류 상세" },
    });
    expect(server).toBeInstanceOf(ApiError);
    expect(errorText(server)).toBe("서버 오류가 발생했어요.");
    const english = await failWith(409, {
      error: { code: "CONFLICT", message: "Unique constraint failed" },
    });
    expect(errorText(english)).toBe(
      "지금 상태에서는 할 수 없어요. 화면을 새로 확인해 주세요.",
    );
    const limited = await failWith(429, {
      error: { code: "RATE_LIMITED", details: { retryAfterMs: 1500 } },
    });
    expect(limited).toMatchObject({ retryAfterMs: 1500 });
  });
});
