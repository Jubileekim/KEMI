import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const report = JSON.parse(
  await readFile(join(tmpdir(), "kemi-6-report.json"), "utf8"),
);
const tests = [];
function collect(suite) {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests)
      tests.push({
        file: spec.file,
        title: spec.title,
        project: t.projectName,
        ok: spec.ok,
        results: t.results.map((r) => ({
          status: r.status,
          retry: r.retry,
          duration: r.duration,
          errors: r.errors.map((e) => e.message),
        })),
      });
  for (const child of suite.suites ?? []) collect(child);
}
for (const suite of report.suites) collect(suite);
const sources = {};
for (const p of execFileSync("git", ["ls-files", "--cached"], {
  encoding: "utf8",
})
  .trim()
  .split(/\r?\n/)
  .filter((p) => /^(apps\/web\/(src|e2e|test)\/)/.test(p)))
  sources[p] = createHash("sha256")
    .update(await readFile(p))
    .digest("hex");
const name = process.argv[2] ?? "final-e2e";
await writeFile(
  new URL(`./${name}.json`, import.meta.url),
  `${JSON.stringify({ scope: "Local DEV/MSW Edge; no live API/provider", baseCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), stats: report.stats, errors: report.errors, command: report.config.argv, sources, tests }, null, 2)}\n`,
);
console.log(
  JSON.stringify({
    tests: tests.length,
    failed: tests.filter((t) => !t.ok).length,
    stats: report.stats,
  }),
);
