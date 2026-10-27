// Independent HTTP fixtures only; this never contacts an authentication/API/provider server.
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { preview } from "vite";
import { fileURLToPath } from "node:url";

const auth = process.argv.includes("--auth-fixtures");
const root = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const assets = new URL("../../apps/web/dist/assets/", import.meta.url);
const bundle = (
  await Promise.all(
    (await readdir(assets))
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFile(new URL(f, assets), "utf8")),
  )
).join("\n");
for (const marker of [
  "/__mock__/",
  "setupWorker",
  "mock-ops",
  "catalog-sample",
  "직접 의뢰 협의 수락",
  "sample-package",
  "공개 제작자 소개",
])
  expect(bundle).not.toContain(marker);
expect(
  await stat(
    new URL("../../apps/web/dist/mockServiceWorker.js", import.meta.url),
  ).then(
    () => true,
    () => false,
  ),
).toBe(false);
const server = await preview({
  root,
  preview: { host: "127.0.0.1", port: 4206, strictPort: true },
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const role of auth
    ? ["GUEST", "CLIENT", "CREATOR", "ADMIN"]
    : ["UNCONFIGURED"]) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4206",
    });
    const unexpected = [];
    const errors = [];
    const mocks = [];
    const user = {
      id: `http-fixture-${role}`,
      email: "fixture@example.test",
      name: "HTTP fixture",
      role,
      status: "ACTIVE",
    };
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (auth && path === "/api/auth/refresh")
        await route.fulfill(
          role === "GUEST"
            ? {
                status: 401,
                json: {
                  error: { code: "SESSION_REVOKED", message: "fixture guest" },
                },
              }
            : {
                json: {
                  accessToken: "http-fixture-token",
                  accessTokenExpiresIn: 900,
                  user,
                },
              },
        );
      else if (auth && path === "/api/auth/me")
        await route.fulfill({ json: { user } });
      else {
        unexpected.push(path);
        await route.fulfill({ status: 500, json: {} });
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (r.url().includes("/__mock__/")) mocks.push(r.url());
    });
    const paths = [
      ["/", "작품 피드", "public"],
      ["/works/sample-work-1", "작품 상세", "public"],
      ["/creators/mock-creator", "제작자·공개 패키지", "public"],
      [
        "/creators/mock-creator/request?packageId=sample-package",
        "직접 의뢰",
        "client",
      ],
      ["/requests", "제안·협의 연결 준비 중", "members"],
      [
        "/workspace/00000000-0000-4000-8000-000000000001",
        "제안·협의 연결 준비 중",
        "members",
      ],
    ];
    for (const [path, heading, access] of paths) {
      await page.goto(path);
      if (access === "public")
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
      else if (!auth)
        await expect(
          page.getByRole("heading", { name: "인증 연결 준비 중" }),
        ).toBeVisible();
      else if (role === "GUEST") await expect(page).toHaveURL(/\/login/);
      else if (
        (access === "client" && role !== "CLIENT") ||
        (access === "members" && !["CLIENT", "CREATOR"].includes(role))
      )
        await expect(
          page.getByRole("heading", { name: "접근 권한이 없어요" }),
        ).toBeVisible();
      else
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
      expect(
        await page.evaluate(
          async () => (await navigator.serviceWorker.getRegistrations()).length,
        ),
      ).toBe(0);
      results.push({ role, path, passed: true });
    }
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    expect(mocks).toEqual([]);
    await context.close();
  }
  await writeFile(
    new URL(
      auth ? "./production-fixtures.json" : "./production-disabled.json",
      import.meta.url,
    ),
    `${JSON.stringify({ source: "independent HTTP fixtures, not live API", auth, results }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ passed: results.length, auth }));
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
