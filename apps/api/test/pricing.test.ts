import type { AuthUser } from "@kemi/shared";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../src/auth/auth.service.js";
import AppError from "../src/http/app-error.js";
import { errorHandler } from "../src/http/error-handler.js";
import { createPrismaClient } from "../src/lib/prisma.js";
import createPricingRouter from "../src/pricing/pricing.router.js";
import {
  createPricingService,
  requestOpenAIPricing,
} from "../src/pricing/pricing.service.js";
import { createTestApp, TEST_ACCESS_SECRET } from "./support/test-app.js";

const client: AuthUser = {
  id: "1",
  email: "customer@example.com",
  name: "고객",
  role: "CLIENT",
  status: "ACTIVE",
};

const validRequest = {
  description: "돌잔치 성장 영상을 사진과 짧은 클립으로 편집하고 싶습니다.",
  purpose: "CHILD_FAMILY" as const,
  expectedDurationSeconds: 120,
};

const modelResult = {
  summary: "기본 편집과 자막 작업을 포함한 예상 비용입니다.",
  workUnits: [
    {
      name: "영상 편집",
      quantity: 2,
      unitPriceKrw: 25_000,
      rationale: "사진·클립 편집 작업에 소요되는 시간",
    },
    {
      name: "자막 작업",
      quantity: 1,
      unitPriceKrw: 10_000,
      rationale: "돌잔치 메시지 자막과 간단한 효과",
    },
  ],
  assumptions: ["고객이 원본 자료를 제공한다"],
};

function pricingTestApp() {
  const app = express();
  app.use(express.json());
  // 이 API에는 인증 기능만 필요하다. 테스트 DB나 실제 토큰에 의존하지 않는다.
  const fakeAuth = createAuthService({
    prisma: createPrismaClient({
      DATABASE_URL: "postgresql://unused:unused@localhost:1/unused_test",
      DATABASE_POOL_MAX: 1,
    }),
    accessTokenSecret: TEST_ACCESS_SECRET,
  });
  const authenticate = vi
    .spyOn(fakeAuth, "authenticate")
    .mockImplementation(async (token: string | undefined) => {
      if (token === "valid-a") return { ...client, id: "user-a" };
      if (token === "valid-b") return { ...client, id: "user-b" };
      throw new AppError(401, "UNAUTHENTICATED", "유효하지 않은 토큰입니다.");
    });
  const generate = vi.fn(async () => modelResult);
  app.use(
    "/api/pricing",
    createPricingRouter(fakeAuth, createPricingService({ generate })),
  );
  app.use(errorHandler);
  return { app, authenticate, generate };
}

describe("AI 단가 분석 (AI-01, AI-02)", () => {
  it("모델 단가·수량으로 합계를 계산하고 참고 견적임을 명시한다", async () => {
    const generate = vi.fn(async () => modelResult);
    const service = createPricingService({ generate });
    const output = await service.analyze(client, validRequest);
    expect(output).toMatchObject({
      source: "AI_ESTIMATE",
      currency: "KRW",
      estimatedBudgetKrw: 60_000,
      workUnits: [
        { name: "영상 편집", subtotalKrw: 50_000 },
        { name: "자막 작업", subtotalKrw: 10_000 },
      ],
    });
    expect(output.notice).toContain("계약 금액을 보장하지");
    expect(generate).toHaveBeenCalledOnce();
  });

  it("설명만 보낸 요청도 허용한다", async () => {
    const service = createPricingService({
      generate: async () => modelResult,
    });
    await expect(
      service.analyze(client, {
        description:
          "사진을 활용해 따뜻한 분위기의 가족 영상을 만들고 싶습니다.",
      }),
    ).resolves.toMatchObject({ estimatedBudgetKrw: 60_000 });
  });

  it("프리랜서/비활성 의뢰인은 외부 모델을 호출하지 않고 403", async () => {
    const generate = vi.fn(async () => modelResult);
    const service = createPricingService({ generate });
    await expect(
      service.analyze({ ...client, role: "CREATOR" }, validRequest),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    await expect(
      service.analyze({ ...client, status: "RESTRICTED" }, validRequest),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("키 미설정은 가짜 AI 결과를 반환하지 않고 503", async () => {
    const service = createPricingService();
    await expect(service.analyze(client, validRequest)).rejects.toMatchObject({
      status: 503,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("입력이 너무 짧거나 모르는 필드가 있으면 모델 호출 전 실패한다", async () => {
    const generate = vi.fn(async () => modelResult);
    const service = createPricingService({ generate });
    await expect(
      service.analyze(client, { description: "짧아요" }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      service.analyze(client, { ...validRequest, hiddenInstruction: true }),
    ).rejects.toMatchObject({ name: "ZodError" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("모델이 잘못된 데이터/초과 단가를 반환하면 502", async () => {
    const service = createPricingService({
      generate: async () => ({
        ...modelResult,
        workUnits: [{ ...modelResult.workUnits[0], unitPriceKrw: -1 }],
      }),
    });
    await expect(service.analyze(client, validRequest)).rejects.toMatchObject({
      status: 502,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("모델 호출 중 내부 오류·비밀 문자열이 응답에 유출되지 않는다", async () => {
    const service = createPricingService({
      generate: async () => {
        throw new Error("sk-private-key");
      },
    });
    try {
      await service.analyze(client, validRequest);
      throw new Error("테스트에서 거부되어야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (!(error instanceof Error)) throw error;
      expect(error.message).not.toContain("sk-private-key");
    }
  });

  it("Responses API는 서버 키·store:false·구조화 형식으로 호출한다", async () => {
    let sent: unknown;
    const fetcher: typeof fetch = async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              content: [
                { type: "output_text", text: JSON.stringify(modelResult) },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    };
    await expect(
      requestOpenAIPricing({
        apiKey: "server-secret-test",
        model: "gpt-4o-mini",
        input: validRequest,
        fetcher,
      }),
    ).resolves.toMatchObject(modelResult);
    expect(sent).toMatchObject({
      store: false,
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(JSON.stringify(sent)).not.toContain("server-secret-test");
  });

  it("Responses API 오류/중단된 출력은 단가로 오인하지 않는다", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ status: "incomplete", output: [] }), {
        status: 200,
      });
    await expect(
      requestOpenAIPricing({
        apiKey: "server-secret-test",
        model: "gpt-4o-mini",
        input: validRequest,
        fetcher,
      }),
    ).rejects.toMatchObject({
      status: 502,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("요청 한도는 인증된 사용자별로 분리되고 11번째에 공통 형식 429", async () => {
    const { app, generate } = pricingTestApp();
    const allowed = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/api/pricing/analyze")
          .set("Authorization", "Bearer valid-a")
          .send(validRequest),
      ),
    );
    expect(allowed.map(({ status }) => status)).toEqual(Array(10).fill(200));

    const blocked = await request(app)
      .post("/api/pricing/analyze")
      .set("Authorization", "Bearer valid-a")
      .send(validRequest);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(generate).toHaveBeenCalledTimes(10);

    const otherUser = await request(app)
      .post("/api/pricing/analyze")
      .set("Authorization", "Bearer valid-b")
      .send(validRequest);
    expect(otherUser.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(11);
  });

  it("인증 실패 401은 같은 사용자 요청 한도를 차감하지 않는다", async () => {
    const { app, generate } = pricingTestApp();
    const unauthenticated = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app)
          .post("/api/pricing/analyze")
          .set("Authorization", "Bearer invalid")
          .send(validRequest),
      ),
    );
    expect(unauthenticated.map(({ status }) => status)).toEqual(
      Array(12).fill(401),
    );
    expect(unauthenticated.map(({ body }) => body.error.code)).toEqual(
      Array(12).fill("UNAUTHENTICATED"),
    );

    const allowed = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post("/api/pricing/analyze")
          .set("Authorization", "Bearer valid-a")
          .send(validRequest),
      ),
    );
    expect(allowed.map(({ status }) => status)).toEqual(Array(10).fill(200));
    expect(generate).toHaveBeenCalledTimes(10);
  });

  it("별도 앱 인스턴스는 요청 제한 카운터를 공유하지 않는다", async () => {
    const first = pricingTestApp();
    const second = pricingTestApp();
    const allowed = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(first.app)
          .post("/api/pricing/analyze")
          .set("Authorization", "Bearer valid-a")
          .send(validRequest),
      ),
    );
    expect(allowed.map(({ status }) => status)).toEqual(Array(10).fill(200));
    const res = await request(second.app)
      .post("/api/pricing/analyze")
      .set("Authorization", "Bearer valid-a")
      .send(validRequest);
    expect(res.status).toBe(200);
    expect(second.generate).toHaveBeenCalledOnce();
  });

  it("모델 HTTP 실패는 상태 코드와 단계만 기록하고 민감정보를 남기지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fetcher: typeof fetch = async () =>
        new Response("upstream-secret-response-body", { status: 401 });
      await expect(
        requestOpenAIPricing({
          apiKey: "sk-private-key",
          model: "gpt-4o-mini",
          input: validRequest,
          fetcher,
        }),
      ).rejects.toMatchObject({ status: 502, code: "SERVICE_UNAVAILABLE" });
      expect(warn).toHaveBeenCalledWith("[pricing] AI upstream failure", {
        stage: "http",
        status: 401,
      });
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(
        /sk-private-key|upstream-secret-response-body|돌잔치/,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("인증 없는 API 호출은 모델 호출 없이 401", async () => {
    const res = await request(createTestApp())
      .post("/api/pricing/analyze")
      .send(validRequest);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
