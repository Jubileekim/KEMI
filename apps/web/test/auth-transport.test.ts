import { afterEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";
import { api, connectSession } from "../src/shared/api/client";

const originalAdapter = api.defaults.adapter;
afterEach(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});
describe("인증 Axios 경계", () => {
  it("비로그인 공개 작품·모집 조회는 토큰 없이 성공하고 비공개 조회·쓰기만 차단한다", async () => {
    const token = vi.fn(async (): Promise<string> => {
      throw new Error("AUTH_REQUIRED");
    });
    connectSession({
      token,
      recover: vi.fn(),
      epoch: () => 1,
      isAuthenticated: () => false,
    });
    const seen: string[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(config.url ?? "");
      expect(config.headers.get("Authorization")).toBeUndefined();
      return {
        data: { items: [] },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    for (const path of [
      "/api/feed?page=1",
      "/api/projects?page=1",
      "/api/projects/123",
      "/api/creators/123",
      "/api/packages/123",
      "/api/portfolios/123",
      "/api/portfolios/123/media",
    ]) {
      const response = await api.get(path);
      expect(response.status).toBe(200);
    }
    expect(seen).toHaveLength(7);
    expect(token).not.toHaveBeenCalled();
    await expect(api.get("/api/projects/me")).rejects.toThrow("AUTH_REQUIRED");
    await expect(api.post("/api/projects", {})).rejects.toThrow("AUTH_REQUIRED");
    expect(seen).toHaveLength(7);
    expect(token).toHaveBeenCalledTimes(2);
  });

  it("로그인된 사용자의 공개 상세 조회는 기존 Bearer 권한을 유지한다", async () => {
    connectSession({
      token: async () => "signed-in-token",
      recover: vi.fn(),
      epoch: () => 1,
      isAuthenticated: () => true,
    });
    api.defaults.adapter = async (config) => {
      expect(config.headers.get("Authorization")).toBe("Bearer signed-in-token");
      return {
        data: { items: [] },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    await expect(api.get("/api/projects/123")).resolves.toMatchObject({
      status: 200,
    });
  });

  it.each(["get", "post"] as const)(
    "만료된 %s 요청은 조회만 한번 재전송한다",
    async (method) => {
      let token = "old";
      const recover = vi.fn(async () => {
        token = "new";
      });
      connectSession({ token: async () => token, recover, epoch: () => 1 });
      let calls = 0;
      api.defaults.adapter = async (config) => {
        calls += 1;
        if (config.headers.get("Authorization") === "Bearer old")
          throw new AxiosError(
            "expired",
            "ERR_BAD_REQUEST",
            config,
            undefined,
            {
              data: { error: { code: "TOKEN_EXPIRED" } },
              status: 401,
              statusText: "Unauthorized",
              headers: {},
              config,
            },
          );
        return {
          data: { ok: true },
          status: 200,
          statusText: "OK",
          headers: {},
          config,
        };
      };
      const operation = api.request({ url: "/api/profiles/me", method });
      if (method === "get")
        await expect(operation).resolves.toMatchObject({ data: { ok: true } });
      else await expect(operation).rejects.toMatchObject({ status: 401 });
      expect(calls).toBe(method === "get" ? 2 : 1);
      expect(recover).toHaveBeenCalledOnce();
    },
  );
  it("로그아웃 뒤 늦게 도착한 개인 응답을 취소한다", async () => {
    let epoch = 1;
    connectSession({
      token: async () => "token",
      recover: vi.fn(),
      epoch: () => epoch,
    });
    api.defaults.adapter = async (config) => {
      epoch = 2;
      return {
        data: { secret: "private" },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };
    await expect(api.get("/api/profiles/me")).rejects.toMatchObject({
      code: "ERR_CANCELED",
    });
  });
});
