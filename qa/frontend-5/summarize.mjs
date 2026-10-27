import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const report = JSON.parse(
  await readFile(join(tmpdir(), "kemi-5-report.json"), "utf8"),
);
const tests = [];
function collect(suite) {
  for (const spec of suite.specs ?? [])
    for (const test of spec.tests)
      tests.push({
        file: spec.file,
        title: spec.title,
        project: test.projectName,
        ok: spec.ok,
        expectedStatus: test.expectedStatus,
        results: test.results.map((r) => ({
          status: r.status,
          retry: r.retry,
          duration: r.duration,
          errors: r.errors.map((e) => e.message),
        })),
      });
  for (const child of suite.suites ?? []) collect(child);
}
for (const suite of report.suites) collect(suite);
const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], {
  encoding: "utf8",
})
  .trim()
  .split(/\r?\n/);
const added = execFileSync(
  "git",
  ["ls-files", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/);
const sources = {};
for (const path of [...new Set([...changed, ...added])].filter(
  (p) => p.startsWith("apps/web/src/") || p.startsWith("apps/web/e2e/"),
))
  sources[path] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const evidence = {
  scope: "DEV/MSW and local Edge only, no live API/provider verification",
  baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  command: report.config.argv,
  stats: report.stats,
  errors: report.errors,
  workers: report.config.workers,
  retries: report.config.projects.map((p) => ({
    name: p.name,
    retries: p.retries,
  })),
  sources,
  tests,
};
await writeFile(
  new URL("./final-e2e.json", import.meta.url),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
const focused = tests.filter((t) =>
  /(?:cancellation|refunds-disputes)\.spec\.ts$/.test(t.file),
);
await writeFile(
  new URL("./5b-final-e2e.json", import.meta.url),
  `${JSON.stringify({ ...evidence, scope: "5-A/5-B subset of the same final run; not an additional execution", tests: focused }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    tests: tests.length,
    failed: tests.filter((t) => !t.ok).length,
    focused: focused.length,
    stats: report.stats,
  }),
);
