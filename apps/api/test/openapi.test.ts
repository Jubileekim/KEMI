import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
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

  it.each(["/api/auth/signup", "/api/auth/login"] as const)(
    "%s 요청 본문의 email은 이메일 형식·최대 254자로 표시된다",
    (path) => {
      const served = JSON.parse(JSON.stringify(openApiDocument));
      const { schema } =
        served.paths[path].post.requestBody.content["application/json"];
      expect(schema.properties.email).toEqual({
        type: "string",
        format: "email",
        maxLength: 254,
      });
    },
  );

  describe("PATCH /api/profiles/me 요청 스키마", () => {
    // 서버가 내보내는 JSON 그대로 OpenAPI 3.1(JSON Schema 2020-12) 검증기로 확인한다.
    const served = JSON.parse(JSON.stringify(openApiDocument));
    const ajv = new Ajv2020({ strict: false });
    addFormats.default(ajv);
    const validate = ajv.compile(
      served.paths["/api/profiles/me"].patch.requestBody.content[
        "application/json"
      ].schema,
    );

    // 공통 항목만 보내는 요청은 두 형식을 모두 만족한다. oneOf였다면 여기서 실패한다.
    it.each([
      ["이름만", { name: "새 이름" }],
      ["소개만", { introduction: "소개" }],
      ["빈", {}],
      ["의뢰인 항목만", { brandName: "KEMI", industry: "BEAUTY" }],
      [
        "크리에이터 항목만",
        { contentStyles: ["BRIGHT"], availableFrom: "2026-11-01" },
      ],
    ])("%s 요청은 문서 검증을 통과한다", (_label, body) => {
      expect(validate(body)).toBe(true);
    });

    it.each([
      ["두 역할 항목을 섞은 요청", { brandName: "KEMI", niche: "FOOD" }],
      ["공개 상태", { serviceStatus: "PUBLIC" }],
      ["모르는 항목", { unknown: 1 }],
    ])("%s은 문서 검증에서도 거부된다", (_label, body) => {
      expect(validate(body)).toBe(false);
    });
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
      operations.map(async ({ path: documented, method }) => {
        // 경로 변수는 실제 값으로 바꿔 부른다.
        const path = documented
          .replace("{provider}", "google")
          .replace("{projectId}", "1")
          .replace("{applicationId}", "1")
          .replace("{notificationId}", "1");
        const agent = request(app);
        let res;
        if (method === "get") res = await agent.get(path);
        else if (method === "patch") res = await agent.patch(path).send({});
        else if (method === "delete") res = await agent.delete(path);
        else res = await agent.post(path).send({});
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
