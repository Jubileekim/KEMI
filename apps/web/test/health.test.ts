import { afterEach, describe, expect, it, vi } from "vitest";
import axios, { AxiosError, AxiosHeaders } from "axios";
import getHealth from "../src/lib/health";
import { getApiErrorMessage } from "../src/lib/api";

afterEach(() => vi.restoreAllMocks());

describe("서버 연결 확인", () => {
  it("실제 헬스 응답 형식을 검증한다", async () => {
    const data = {
      status: "ok",
      uptimeSeconds: 5,
      timestamp: "2026-10-19T00:00:00.000Z",
    };
    vi.spyOn(axios, "get").mockResolvedValue({ data });
    await expect(getHealth()).resolves.toEqual(data);
  });

  it("프록시가 HTML을 반환하면 연결 성공으로 처리하지 않는다", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: "<!doctype html>" });
    await expect(getHealth()).rejects.toThrow();
  });

  it("서버가 공개한 공통 오류 메시지를 표시한다", () => {
    const error = new AxiosError(
      "Unavailable",
      "ERR_BAD_RESPONSE",
      undefined,
      undefined,
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "잠시 후 다시 시도해주세요.",
          },
        },
      },
    );
    expect(getApiErrorMessage(error)).toBe("잠시 후 다시 시도해주세요.");
  });

  it("시간 초과와 네트워크 실패를 구분한다", () => {
    expect(
      getApiErrorMessage(new AxiosError("timeout", "ECONNABORTED")),
    ).toContain("응답이 늦습니다");
    expect(
      getApiErrorMessage(new AxiosError("Network Error", "ERR_NETWORK")),
    ).toContain("연결하지 못했습니다");
  });
});
