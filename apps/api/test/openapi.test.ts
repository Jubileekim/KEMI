import SwaggerParser from "@apidevtools/swagger-parser";
import request from "supertest";
import { describe, expect, it } from "vitest";
import openApiDocument from "../src/docs/openapi.js";
import { createTestApp } from "./support/test-app.js";

describe("OpenAPI 문서", () => {
  it("OpenAPI 3.1 규격에 맞는다", async () => {
    // 서버가 실제로 내보내는 JSON 형태로 검증한다. (validate는 넘긴 객체를 바꾸므로 복사본을 쓴다)
    await expect(
      SwaggerParser.validate(JSON.parse(JSON.stringify(openApiDocument))),
    ).resolves.toBeDefined();
  });

  // 문서에 적힌 모든 경로·메서드가 실제 라우터에 있는지 확인한다(DB 없이 끝나는 요청으로).
  it("문서의 모든 경로가 실제로 존재한다 (404가 아님)", async () => {
    const app = createTestApp();
    const operations = Object.entries(openApiDocument.paths).flatMap(
      ([path, methods]) =>
        Object.keys(methods).map((method) => ({ path, method })),
    );
    expect(operations.length).toBeGreaterThan(0);

    const results = await Promise.all(
      operations.map(async ({ path, method }) => {
        const res =
          method === "post"
            ? await request(app).post(path).send({})
            : await request(app).get(path);
        return { path, method, status: res.status };
      }),
    );
    expect(results.filter((result) => result.status === 404)).toEqual([]);
  });

  it("apiDocs를 켜면 /api/openapi.json과 /api/docs를 제공한다", async () => {
    const app = createTestApp({ apiDocs: true });

    const json = await request(app).get("/api/openapi.json");
    expect(json.status).toBe(200);
    expect(json.body.openapi).toBe("3.1.0");

    const ui = await request(app).get("/api/docs/");
    expect(ui.status).toBe(200);
    expect(ui.text).toContain("swagger-ui");
  });

  it("apiDocs를 끄면(운영 환경) 문서 경로가 없다", async () => {
    const app = createTestApp();
    expect((await request(app).get("/api/openapi.json")).status).toBe(404);
    expect((await request(app).get("/api/docs/")).status).toBe(404);
  });
});
