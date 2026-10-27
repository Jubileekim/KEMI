import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const report = JSON.parse(
  await readFile("qa/frontend-7/tmp/7-report.json", "utf8"),
);
const results = [];
function visit(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        for (const result of test.results)
          results.push({
            file: spec.file,
            title: spec.title,
            project: test.projectName,
            status: result.status,
            expectedStatus: test.expectedStatus,
            retry: result.retry,
            durationMs: result.duration,
            errors: result.errors,
          });
      }
    }
    visit(suite.suites ?? []);
  }
}
visit(report.suites);
const expected = Number(process.argv[2] ?? 24);
assert.equal(results.length, expected);
assert.equal(report.stats.unexpected, 0);
assert.equal(report.stats.skipped, 0);
assert.equal(report.stats.flaky, 0);
assert(results.every((r) => r.status === "passed" && r.retry === 0));
const changed = execFileSync(
  "git",
  ["-c", "core.quotepath=false", "diff", "--name-only", "8fecb83"],
  { encoding: "utf8" },
);
const added = execFileSync(
  "git",
  ["-c", "core.quotepath=false", "ls-files", "--others", "--exclude-standard"],
  { encoding: "utf8" },
);
const paths = [
  ...new Set(
    `${changed}\n${added}`
      .split(/\r?\n/)
      .filter((p) => /^apps\/web\/(src|test|e2e)\//.test(p)),
  ),
].sort();
const sourceSha256 = {};
for (const path of paths)
  sourceSha256[path] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
await writeFile(
  `qa/frontend-7/${expected === 24 ? "final" : "final-engagement"}-e2e.json`,
  `${JSON.stringify({ scope: "local DEV/MSW Edge; no real API/DB/provider verification", command: expected === 24 ? "npm exec -- playwright test --config qa/frontend-7/playwright.edge.config.ts activity.spec.ts engagement.spec.ts safety-analytics.spec.ts screen-access.spec.ts direct-send.spec.ts" : "npm exec -- playwright test --config qa/frontend-7/playwright.edge.config.ts engagement.spec.ts", stats: report.stats, results, sourceSha256 }, null, 2)}\n`,
);
console.log(
  `${expected}/${expected} passed, no skipped/retry/flaky; source hashes preserved`,
);
