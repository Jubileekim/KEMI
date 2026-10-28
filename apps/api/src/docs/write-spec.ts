import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openApiDocument from "./openapi.js";
import openApiToMarkdown from "./spec-markdown.js";

// docs/api-spec.md를 OpenAPI 정의에서 다시 만든다. 사용: npm run docs:api -w @kemi/api
const target = fileURLToPath(
  new URL("../../../../docs/api-spec.md", import.meta.url),
);
await writeFile(target, openApiToMarkdown(openApiDocument));
console.info(`API 명세서를 저장했어요: ${target}`);
