import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import request from "supertest";
import type { Express } from "express";
import { describe, expect, it } from "vitest";
import openApiDocument from "../src/docs/openapi.js";
import { createTestApp } from "./support/test-app.js";

// Express 5(router 2.x)의 내부 구조를 읽는다. 공개 API가 아니라서 타입 없이 값을 하나씩 확인한다.
function field(value: unknown, key: string): unknown {
  if ((typeof value !== "object" && typeof value !== "function") || !value) {
    return undefined;
  }
  return Reflect.get(value, key);
}

interface MountedRoute {
  // 문서 경로의 앞부분이 이 라우터의 마운트 경로와 정확히 같은지
  matchesMount: (prefix: string) => boolean;
  route: string;
  methods: string[];
}

function routeOf(layer: unknown): { path: string; methods: string[] } | null {
  const route = field(layer, "route");
  const path = field(route, "path");
  const methods = field(route, "methods");
  if (typeof path !== "string" || typeof methods !== "object" || !methods) {
    return null;
  }
  return {
    path,
    methods: Object.keys(methods).filter((method) => method !== "_all"),
  };
}

// app에 마운트된 라우터의 라우트를 모은다. Express 5는 마운트 경로 문자열을 보관하지 않아서,
// 각 마운트의 matcher로 경로 앞부분이 맞는지만 확인할 수 있다.
function mountedRoutes(app: Express): MountedRoute[] {
  const stack = field(field(app, "router"), "stack");
  if (!Array.isArray(stack))
    throw new Error("Express 라우터 구조를 읽지 못했습니다.");
  return stack.flatMap((layer: unknown): MountedRoute[] => {
    const own = routeOf(layer);
    if (own) {
      return [
        {
          matchesMount: (prefix) => prefix === "",
          route: own.path,
          methods: own.methods,
        },
      ];
    }
    const children = field(field(layer, "handle"), "stack");
    if (!Array.isArray(children)) return [];
    const matchers = field(layer, "matchers");
    // app.use(router)·app.use("/", router)는 slash로 표시되고 앞부분이 빈 문자열이다.
    const matchesMount = (prefix: string) =>
      field(layer, "slash") === true
        ? prefix === ""
        : Array.isArray(matchers) &&
          matchers.some((match: unknown) => {
            if (typeof match !== "function") return false;
            const result: unknown = Reflect.apply(match, undefined, [prefix]);
            return field(result, "path") === prefix;
          });
    return children.flatMap((child: unknown) => {
      const route = routeOf(child);
      return route
        ? [{ matchesMount, route: route.path, methods: route.methods }]
        : [];
    });
  });
}

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
        else if (method === "put") res = await agent.put(path).send({});
        else if (method === "patch") res = await agent.patch(path).send({});
        else if (method === "delete") res = await agent.delete(path);
        else res = await agent.post(path).send({});
        return { path, method, status: res.status };
      }),
    );
    expect(results.filter((result) => result.status === 404)).toEqual([]);
  });

  // 반대 방향: 실제 라우터의 모든 경로·메서드가 문서에 있는지 확인한다(이슈 #25).
  it("실제 라우터의 모든 경로·메서드가 문서에 있다", () => {
    const app = createTestApp();
    // 문서 경로를 Express 표기로 바꾼다: /api/projects/{projectId} → /api/projects/:projectId
    const documented = Object.entries(openApiDocument.paths).map(
      ([path, methods]) => ({
        path: path.replace(/\{(\w+)\}/g, ":$1"),
        methods: new Set(Object.keys(methods)),
      }),
    );

    const routes = mountedRoutes(app);
    // Express 내부 구조가 바뀌어 라우트를 못 읽으면 이 테스트가 아무것도 확인하지 않게 된다.
    expect(routes.length).toBeGreaterThanOrEqual(documented.length);

    const undocumented = routes.flatMap(({ matchesMount, route, methods }) => {
      // Express 5는 마운트 경로 문자열을 보관하지 않는다. 그래서 문서 경로 중에서
      // 뒷부분이 라우트 경로와 같고 앞부분이 이 마운트에 정확히 맞는 것을 찾는다.
      const full = documented.find(({ path }) => {
        const suffix = route === "/" ? "" : route;
        if (!path.endsWith(suffix)) return false;
        return matchesMount(path.slice(0, path.length - suffix.length));
      });
      return (
        methods
          .filter((method) => !full?.methods.has(method))
          // 문서에 경로가 없으면 마운트 앞부분을 알 수 없어 라우터 기준 경로(…/경로)로 표시한다.
          .map(
            (method) => `${method.toUpperCase()} ${full?.path ?? `…${route}`}`,
          )
      );
    });
    expect(undocumented).toEqual([]);
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
