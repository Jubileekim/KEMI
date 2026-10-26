import SwaggerParser from "@apidevtools/swagger-parser";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import request from "supertest";
import express, { Router, type Express } from "express";
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

// 마운트 하나가 경로 조각과 정확히 맞는지 본다. Express 5는 마운트 경로 문자열을 보관하지 않아서
// matcher로만 확인할 수 있다.
type MountMatch = (segment: string) => boolean;

interface MountedRoute {
  // 바깥 마운트부터 순서대로
  mounts: MountMatch[];
  route: string;
  methods: string[];
}

function mountMatcher(layer: unknown): MountMatch {
  // app.use(router)·router.use("/", router)는 slash로 표시되고 경로 조각이 빈 문자열이다.
  if (field(layer, "slash") === true) return (segment) => segment === "";
  const matchers = field(layer, "matchers");
  return (segment) =>
    Array.isArray(matchers) &&
    matchers.some((match: unknown) => {
      if (typeof match !== "function") return false;
      const result: unknown = Reflect.apply(match, undefined, [segment]);
      return field(result, "path") === segment;
    });
}

function routeOf(layer: unknown): { path: string; methods: string[] } | null {
  const route = field(layer, "route");
  const path = field(route, "path");
  const methods = field(route, "methods");
  if (typeof path !== "string" || typeof methods !== "object" || !methods) {
    return null;
  }
  // router.all()은 methods에 `_all`로 남는다. OpenAPI 메서드 하나로 적을 수 없으므로
  // 버리지 않고 `all`로 남겨, 문서 대조에서 항상 누락으로 보고되게 한다.
  return {
    path,
    methods: Object.keys(methods).map((method) =>
      method === "_all" ? "all" : method,
    ),
  };
}

// 라우터 스택을 끝까지 내려가며 라우트를 모은다. 하위 라우터(router.use)도 포함한다.
function collectRoutes(stack: unknown, mounts: MountMatch[]): MountedRoute[] {
  if (!Array.isArray(stack)) return [];
  return stack.flatMap((layer: unknown): MountedRoute[] => {
    const route = routeOf(layer);
    if (route) return [{ mounts, route: route.path, methods: route.methods }];
    const children = field(field(layer, "handle"), "stack");
    if (!Array.isArray(children)) return [];
    return collectRoutes(children, [...mounts, mountMatcher(layer)]);
  });
}

function mountedRoutes(app: Express): MountedRoute[] {
  const stack = field(field(app, "router"), "stack");
  if (!Array.isArray(stack)) {
    throw new Error("Express 라우터 구조를 읽지 못했습니다.");
  }
  return collectRoutes(stack, []);
}

// prefix를 마운트 순서대로 나눠 각 마운트에 정확히 맞출 수 있는지 본다. 나누는 위치는 "/" 앞이다.
function matchesMounts(prefix: string, mounts: MountMatch[]): boolean {
  const [first, ...rest] = mounts;
  if (!first) return prefix === "";
  for (let end = 0; end <= prefix.length; end += 1) {
    const atBoundary = end === prefix.length || prefix[end] === "/";
    if (
      atBoundary &&
      first(prefix.slice(0, end)) &&
      matchesMounts(prefix.slice(end), rest)
    ) {
      return true;
    }
  }
  return false;
}

// 문서 경로를 Express 표기로 바꾼다: /api/projects/{projectId} → /api/projects/:projectId
const documentedOperations = Object.entries(openApiDocument.paths).map(
  ([path, methods]) => ({
    path: path.replace(/\{(\w+)\}/g, ":$1"),
    methods: new Set(Object.keys(methods)),
  }),
);

// 문서에 없는 실제 라우트를 "메서드 경로"로 돌려준다.
function undocumentedRoutes(routes: MountedRoute[]): string[] {
  return routes.flatMap(({ mounts, route, methods }) => {
    // 문서 경로 중 뒷부분이 라우트 경로와 같고, 앞부분이 마운트들에 정확히 맞는 것을 찾는다.
    const suffix = route === "/" ? "" : route;
    const full = documentedOperations.find(
      ({ path }) =>
        path.endsWith(suffix) &&
        matchesMounts(path.slice(0, path.length - suffix.length), mounts),
    );
    return (
      methods
        .filter((method) => !full?.methods.has(method))
        // 문서에 경로가 없으면 마운트 앞부분을 알 수 없어 라우터 기준 경로(…/경로)로 표시한다.
        .map((method) => `${method.toUpperCase()} ${full?.path ?? `…${route}`}`)
    );
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
          .replace("{notificationId}", "1")
          .replace("{workRequestId}", "1")
          .replace("{versionNo}", "1")
          .replace("{contractId}", "1")
          .replace("{materialId}", "1")
          .replace("{changeId}", "1")
          .replace("{deliverableId}", "1")
          .replace("{userId}", "1")
          .replace("{orderId}", "00000000-0000-4000-8000-000000000000");
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
    const routes = mountedRoutes(createTestApp());
    // Express 내부 구조가 바뀌어 라우트를 못 읽으면 이 테스트가 아무것도 확인하지 않게 된다.
    expect(routes.length).toBeGreaterThanOrEqual(documentedOperations.length);
    expect(undocumentedRoutes(routes)).toEqual([]);
  });

  it("하위 라우터와 router.all()의 문서 누락도 찾아낸다", () => {
    const ok = (_req: express.Request, res: express.Response) => {
      res.end();
    };
    const profiles = Router();
    profiles.get("/me", ok); // 문서에 있음: GET /api/profiles/me (두 단계 마운트)
    const nested = Router();
    nested.get("/debug", ok); // 문서에 없음
    // 문서에 없음: /api/misplaced/me. 바깥 마운트(/api)만 보면 문서의 /api/profiles/me와 헷갈린다.
    const misplaced = Router();
    misplaced.get("/me", ok);
    const api = Router();
    api.use("/profiles", profiles);
    api.use("/nested", nested);
    api.use("/misplaced", misplaced);
    api.all("/all-debug", ok); // 문서에 없음 (메서드를 특정할 수 없음)
    const app = express();
    app.use("/api", api);

    expect(undocumentedRoutes(mountedRoutes(app))).toEqual([
      "GET …/debug",
      "GET …/me",
      "ALL …/all-debug",
    ]);
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
