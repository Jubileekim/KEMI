import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  epoch: 0,
  listeners: new Set<() => void>(),
  send: vi.fn().mockResolvedValue({ accepted: 1 }),
}));
vi.mock("../src/app/session", () => ({
  session: {
    epoch: () => state.epoch,
    subscribe: (listener: () => void) => state.listeners.add(listener),
  },
}));
vi.mock("../src/shared/api/kemi", () => ({ kemi: { analytics: state.send } }));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  state.listeners.clear();
  state.epoch = 0;
  state.send.mockClear();
  vi.stubEnv("VITE_ENABLE_MOCKS", "false");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("실제 행동 기록의 세션 경계", () => {
  it("전송 전에 계정이 바뀌면 이전 계정의 기록을 버린다", async () => {
    const { default: track } = await import("../src/shared/analytics/track");
    track("request_sent", "42");
    state.epoch += 1;
    state.listeners.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.send).not.toHaveBeenCalled();
    expect(track("request_sent", "42")).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it("허용된 필드만 보내고 같은 세션의 중복 완료는 전송하지 않는다", async () => {
    const { default: track } = await import("../src/shared/analytics/track");
    expect(track("work_play", "https://private.example")).toBe(false);
    expect(track("transaction_completed", "9")).toBe(true);
    expect(track("transaction_completed", "9")).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.send.mock.calls[0]?.[0].events).toEqual([
      { name: "transaction_completed", objectId: "9", at: expect.any(String) },
    ]);
  });

  it("개발 Mock은 실제 분석 API를 부르지 않는다", async () => {
    vi.stubEnv("VITE_ENABLE_MOCKS", "true");
    const { default: track } = await import("../src/shared/analytics/track");
    expect(track("feed_view", "feed")).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.send).not.toHaveBeenCalled();
  });
});
