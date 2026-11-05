import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { requestProgress } from "../src/features/live/labels";
import invalidateRequestProgress from "../src/features/live/request-progress";

describe("의뢰 거래 단계 표시", () => {
  it.each([
    ["PAYMENT_PENDING", "계약 확정 · 결제 대기"],
    ["PREPARING", "제작 준비"],
    ["IN_PROGRESS", "제작 중"],
    ["DELIVERED", "수령 완료 · 정산 대기"],
    ["COMPLETED", "거래 완료"],
    ["CANCELED", "취소됨"],
    ["DISPUTED", "분쟁 처리 중"],
  ] as const)("계약 체결 대신 %s 단계를 표시한다", (stage, text) => {
    expect(requestProgress("CONTRACTED", stage)).toBe(text);
  });

  it("계약 전 종료 사유와 이전 API 응답을 보존한다", () => {
    expect(requestProgress("DECLINED", "CLOSED")).toBe("거절됨");
    expect(requestProgress("EXPIRED", "CLOSED")).toBe("만료됨");
    expect(requestProgress("DISCUSSING", "DISCUSSING")).toBe("협의 중");
    expect(requestProgress("CONTRACTED", undefined)).toBe("계약 체결");
  });

  it("제작·결제 변경 후 캐시된 의뢰 상태를 다시 조회하게 한다", async () => {
    const client = new QueryClient();
    const keys = [
      ["activity"],
      ["direct-requests"],
      ["direct-request", "3"],
      ["terms", "3"],
    ];
    keys.forEach((key) =>
      client.setQueryData(key, { stage: "PAYMENT_PENDING" }),
    );
    client.setQueryData(["portfolio", "1"], { title: "참고 작품" });
    await invalidateRequestProgress(client);
    keys.forEach((key) =>
      expect(client.getQueryState(key)?.isInvalidated).toBe(true),
    );
    expect(client.getQueryState(["portfolio", "1"])?.isInvalidated).toBe(false);
    client.clear();
  });
});
