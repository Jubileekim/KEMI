import { describe, expect, it, vi } from "vitest";
import { api, ApiError, connectSession } from "../src/shared/api/client";

describe("실제 API 비회원 탐색", () => {
  it("공개 GET과 분석 POST는 토큰 없이 호출하고 비공개 조회·쓰기는 막는다", async () => {
    const token = vi
      .fn()
      .mockRejectedValue(new ApiError(401, "SESSION_REVOKED", "로그인 필요"));
    connectSession({
      token,
      epoch: () => 0,
      recover: async () => {},
      isGuest: () => true,
    });
    const adapter = vi.fn(async (config) => ({
      data: {},
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    }));
    await Promise.all(
      [
        "/api/feed?page=1",
        "/api/projects",
        "/api/projects/1",
        "/api/portfolios/2/media",
      ].map((url) => api.get(url, { adapter })),
    );
    await api.post("/api/analytics/events", { events: [] }, { adapter });
    expect(token).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(5);
    await expect(api.get("/api/projects/me", { adapter })).rejects.toThrow();
    await expect(api.post("/api/projects", {}, { adapter })).rejects.toThrow();
    await expect(api.get("/api/reports/me", { adapter })).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(5);
  });
});
