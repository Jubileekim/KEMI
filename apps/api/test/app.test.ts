import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import AppError from "../src/http/app-error.js";
import { errorHandler } from "../src/http/error-handler.js";
import { createTestApp } from "./support/test-app.js";

describe("GET /health", () => {
  it("DB 상태와 관계없이 200을 반환한다", async () => {
    const checkDatabase = vi.fn(() => Promise.reject(new Error("db down")));
    const res = await request(createTestApp({ checkDatabase })).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
    expect(typeof res.body.uptimeSeconds).toBe("number");
    expect(checkDatabase).not.toHaveBeenCalled();
  });
});

describe("GET /health/ready", () => {
  it("DB 확인이 성공하면 200을 반환한다", async () => {
    const res = await request(createTestApp()).get("/health/ready");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "ok" } });
  });

  it("DB 확인이 실패하면 503을 반환하고 내부 오류를 노출하지 않는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const checkDatabase = () =>
      Promise.reject(new Error("password authentication failed"));
    const res = await request(createTestApp({ checkDatabase })).get(
      "/health/ready",
    );

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: "unavailable",
      checks: { database: "error" },
    });
    expect(JSON.stringify(res.body)).not.toContain("password");
  });
});

describe("공통 오류 형식", () => {
  it("없는 경로는 NOT_FOUND를 반환한다", async () => {
    const res = await request(createTestApp()).get("/nope");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("잘못된 JSON 본문은 INVALID_JSON을 반환한다", async () => {
    const res = await request(createTestApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("x-powered-by 헤더를 보내지 않는다", async () => {
    const res = await request(createTestApp()).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("errorHandler", () => {
  // 라우터에서 던진 오류가 공통 형식으로 바뀌는지 확인한다. Express 5는 async 오류도 전달한다.
  function requestThrowing(error: unknown) {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express();
    app.get("/boom", async () => {
      throw error;
    });
    app.use(errorHandler);
    return request(app).get("/boom");
  }

  it("AppError의 상태 코드와 코드를 그대로 쓴다", async () => {
    const res = await requestThrowing(
      new AppError(409, "CONFLICT", "이미 처리된 요청입니다."),
    );
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: "CONFLICT", message: "이미 처리된 요청입니다." },
    });
  });

  it("ZodError는 VALIDATION_FAILED와 필드 정보를 반환한다", async () => {
    const parsed = z.object({ title: z.string() }).safeParse({});
    const res = await requestThrowing(parsed.error);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details[0].path).toEqual(["title"]);
  });

  it("알 수 없는 오류는 500 INTERNAL_ERROR로 감춘다", async () => {
    const res = await requestThrowing(new Error("select * from users failed"));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
    });
  });
});
