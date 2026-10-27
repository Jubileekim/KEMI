// Production bundle inspection + existing independent HTTP auth fixtures.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../apps/web/dist/assets");
const bundle = fs
  .readdirSync(root)
  .filter((file) => file.endsWith(".js"))
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");
for (const marker of [
  "/__mock__/revision-events",
  "수정 요청 정식 등록",
  "입력한 Mock 수정 조건 확인",
  "accept-correction",
  "revisionPolicy",
  "수정 요청 시스템 안내 (Mock)",
])
  assert.equal(bundle.includes(marker), false, marker);
console.info("4-C revision Mock code and endpoints excluded from production");
require("../frontend-4b/production-smoke.cjs");
