// Production exclusion + inherited independent HTTP fixtures; not real API evidence.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../apps/web/dist/assets");
const bundle = fs
  .readdirSync(root)
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
  .join("\n");
for (const marker of [
  "/__mock__/final-events",
  "deliver-final",
  "receive-final",
  "report-file",
  "final-assets",
  "최종 파일 수령 확인 (Mock)",
  "이 검토 버전 승인 (Mock)",
])
  assert.equal(bundle.includes(marker), false, marker);
console.info("4-D approval/final/receipt Mock excluded from production");
require("../frontend-4c/production-smoke.cjs");
