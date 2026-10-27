// Independent HTTP fixtures; no live API/authentication/provider verification.
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { preview } from "vite";

const auth = process.argv.includes("--auth-fixtures");
const root = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const assets = new URL("../../apps/web/dist/assets/", import.meta.url);
const bundle = (
  await Promise.all(
    (await readdir(assets))
      .filter((n) => n.endsWith(".js"))
      .map((n) => readFile(new URL(n, assets), "utf8")),
  )
).join("\n");
for (const marker of [
  "/__mock__/",
  "setupWorker",
  "4-E 개발 전용 시나리오",
  "Mock 역할",
  "모의 정산 성공 · 작업 완료",
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
  preview: { host: "127.0.0.1", port: 4198, strictPort: true },
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const role of auth
    ? ["GUEST", "CLIENT", "CREATOR", "ADMIN"]
    : ["GUEST"]) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4198",
    });
    const unexpected = [];
    const errors = [];
    context.on("request", (r) => {
      if (r.url().includes("/__mock__/")) unexpected.push(r.url());
    });
    await context.route("**/api/**", async (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      const user = {
        id: `http-${role}`,
        email: "http@example.test",
        name: "HTTP 예시",
        role,
        status: "ACTIVE",
      };
      if (auth && endpoint === "/api/auth/refresh") {
        await route.fulfill(
          role === "GUEST"
            ? {
                status: 401,
                json: {
                  error: { code: "SESSION_REVOKED", message: "Fixture guest" },
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
      } else if (auth && endpoint === "/api/auth/me")
        await route.fulfill({ json: { user } });
      else {
        unexpected.push(endpoint);
        await route.fulfill({ status: 500, json: {} });
      }
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "/contracts/00000000-0000-4000-8000-000000000001/settlement",
    );
    if (!auth)
      await expect(
        page.getByRole("heading", { name: "인증 연결 준비 중" }),
      ).toBeVisible();
    else if (role === "GUEST") await expect(page).toHaveURL(/\/login/);
    else if (role === "ADMIN")
      await expect(
        page.getByRole("heading", { name: "접근 권한이 없어요" }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", { name: "정산 연결 준비 중" }),
      ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "모의 정산 결과 확인", exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    ).toBe(0);
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    results.push({ role, passed: true, unexpected, errors });
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
