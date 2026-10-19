import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, TEST_APP_ORIGIN } from "./support/test-app.js";

// DB에 닿기 전에 끝나는 요청(입력 검증 실패, 쿠키 없음)으로 횟수만 채운다. 제한은 응답 결과와 관계없이 센다.
async function sendTimes(count: number, send: () => request.Test) {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- 순서대로 보내 횟수를 정확히 센다
    statuses.push((await send()).status);
  }
  return statuses;
}

describe("인증 API 요청 제한", () => {
  it.each([
    ["/api/auth/signup", 10],
    ["/api/auth/login", 10],
  ])("%s: IP당 %i회를 넘으면 429 RATE_LIMITED", async (path, limit) => {
    const app = createTestApp();
    const send = () => request(app).post(path).send({});

    const statuses = await sendTimes(limit, send);
    expect(statuses.every((status) => status === 400)).toBe(true);

    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      },
    });
    expect(limited.headers.ratelimit).toBeDefined();
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("/api/auth/refresh: IP당 60회를 넘으면 429", async () => {
    const app = createTestApp();
    const send = () =>
      request(app).post("/api/auth/refresh").set("Origin", TEST_APP_ORIGIN);

    const statuses = await sendTimes(60, send);
    expect(statuses.every((status) => status === 401)).toBe(true);
    expect((await send()).status).toBe(429);
  });

  it("다른 IP는 따로 센다 (trust proxy 설정 시 X-Forwarded-For 기준)", async () => {
    const app = createTestApp({ trustProxyHops: 1 });
    const from = (ip: string) => () =>
      request(app).post("/api/auth/login").set("X-Forwarded-For", ip).send({});

    await sendTimes(10, from("203.0.113.1"));
    expect((await from("203.0.113.1")()).status).toBe(429);
    expect((await from("203.0.113.2")()).status).toBe(400);
  });
});
