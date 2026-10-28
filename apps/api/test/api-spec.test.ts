import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import openApiDocument from "../src/docs/openapi.js";
import openApiToMarkdown from "../src/docs/spec-markdown.js";

// docs/api-spec.md가 OpenAPI 정의(→ openapi.test.ts가 실제 라우트와 맞는지 확인)와 같은지 본다.
// 실패하면: npm run docs:api -w @kemi/api
const specPath = new URL("../../../docs/api-spec.md", import.meta.url);

describe("API 명세서 (docs/api-spec.md)", () => {
  const generated = openApiToMarkdown(openApiDocument);

  it("OpenAPI 정의에서 만든 내용과 같다", async () => {
    const saved = (await readFile(specPath, "utf8")).replace(/\r\n/g, "\n");
    expect(saved).toBe(generated);
  });

  it("모든 엔드포인트를 상세 항목으로 담는다", () => {
    const count = Object.values(openApiDocument.paths).flatMap((item) =>
      Object.keys(item),
    ).length;
    expect(
      generated.match(/^### (GET|POST|PUT|PATCH|DELETE) `/gm),
    ).toHaveLength(count);
  });
});
