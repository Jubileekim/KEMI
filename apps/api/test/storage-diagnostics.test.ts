import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@kemi/shared";
import {
  createSupabaseStorage,
  StorageUnavailableError,
} from "../src/files/storage.js";
import { createFileService } from "../src/files/file.service.js";
import { createHealthRouter } from "../src/routes/health.js";
import { createPrismaClient } from "../src/lib/prisma.js";

afterEach(() => vi.restoreAllMocks());

const storageWith = (respond: () => Response | Promise<Response>) =>
  createSupabaseStorage({
    supabaseUrl: "https://example.supabase.co",
    serviceRoleKey: "service-role-test",
    bucket: "kemi-files",
    fetchFn: async () => respond(),
  });

describe("저장소 오류 원인 구분", () => {
  it("거절 응답은 상태와 Supabase 이유를 로그에 남기고 키는 남기지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = storageWith(
      () =>
        new Response(
          JSON.stringify({ statusCode: "404", error: "Bucket not found" }),
          { status: 400 },
        ),
    );
    const err: unknown = await storage
      .createUploadUrl("u/1/a.mp4")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StorageUnavailableError);
    expect(err).toMatchObject({ reason: "http", storageStatus: 400 });
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toContain("upload-sign rejected: http 400 Bucket not found");
    expect(logged).not.toContain("service-role-test");
  });

  it("연결 실패는 network로 구분한다", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = storageWith(() => {
      throw new TypeError("fetch failed");
    });
    await expect(
      storage.createDownloadUrl("u/1/a.mp4", 60),
    ).rejects.toMatchObject({
      reason: "network",
    });
  });

  it.each([
    [200, {}, "ok"],
    [400, { statusCode: "404", error: "Bucket not found" }, "missing_bucket"],
    [
      400,
      {
        statusCode: "403",
        error: "Unauthorized",
        message: "invalid signature",
      },
      "unauthorized",
    ],
    [401, {}, "unauthorized"],
    [500, {}, "error"],
  ] as const)("버킷 점검 %i %j → %s", async (status, body, expected) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const storage = storageWith(
      () => new Response(JSON.stringify(body), { status }),
    );
    expect(await storage.checkBucket()).toBe(expected);
  });

  it("저장소 설정이 없으면 details.reason으로 알린다", async () => {
    const user: AuthUser = {
      id: "1",
      email: "a@kemi.test",
      name: "테스트",
      role: "CREATOR",
      status: "ACTIVE",
    };
    const input = {
      purpose: "PORTFOLIO",
      fileName: "a.mp4",
      mimeType: "video/mp4",
      sizeBytes: 10,
    } as const;
    // 저장소 확인에서 먼저 멈추므로 DB에 접속하지 않는다.
    const prisma = createPrismaClient({
      DATABASE_URL: "postgresql://unused:unused@localhost:1/unused_test",
      DATABASE_POOL_MAX: 1,
    });
    await expect(
      createFileService({ prisma }).create(user, input),
    ).rejects.toMatchObject({
      status: 503,
      details: { reason: "STORAGE_NOT_CONFIGURED" },
    });
  });
});

describe("GET /health/ready 저장소 점검", () => {
  const app = (
    check?: () => Promise<"ok" | "not_configured" | "missing_bucket">,
  ) => express().use(createHealthRouter(() => Promise.resolve(), check));

  it("저장소 상태를 알리지만 준비 여부는 DB만 본다", async () => {
    const res = await request(app(async () => "missing_bucket")).get(
      "/health/ready",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      checks: { database: "ok", storage: "missing_bucket" },
    });
  });

  it("점검이 예외를 던져도 error로 알린다", async () => {
    const res = await request(app(() => Promise.reject(new Error("boom")))).get(
      "/health/ready",
    );
    expect(res.body.checks.storage).toBe("error");
  });
});
