// Production bundle + independent HTTP auth fixtures; never live API evidence.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const root = path.resolve(__dirname, "../../apps/web/dist");
  const files = await fs.readdir(path.join(root, "assets"));
  const bundle = (
    await Promise.all(
      files
        .filter((file) => file.endsWith(".js"))
        .map((file) => fs.readFile(path.join(root, "assets", file), "utf8")),
    )
  ).join("\n");
  for (const marker of [
    "/__mock__/discovery",
    "PRIVATE_FIXTURE_REFERENCE",
    "2-C 개발 전용 시나리오",
    "모의 마감 확정",
    "setupWorker",
  ])
    expect(bundle).not.toContain(marker);
  expect(
    await fs.stat(path.join(root, "mockServiceWorker.js")).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
  const results = [
    "Discovery Mock code/endpoints/worker excluded from production",
  ];
  const errors = [];
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const role of ["GUEST", "CLIENT", "CREATOR"]) {
      const context = await browser.newContext({
        baseURL: process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4188",
      });
      const products = [];
      const mocks = [];
      await context.route("**/api/**", async (route) => {
        const endpoint = new URL(route.request().url()).pathname;
        const user = {
          id: `http-${role}`,
          name: "HTTP 예시",
          email: "http@example.test",
          role,
          status: "ACTIVE",
        };
        let body;
        let status = 200;
        if (endpoint === "/api/auth/refresh" && role === "GUEST") {
          status = 401;
          body = { error: { code: "SESSION_REVOKED", message: "모의 비회원" } };
        } else if (endpoint === "/api/auth/refresh")
          body = {
            accessToken: "http-fixture-token",
            accessTokenExpiresIn: 900,
            user,
          };
        else if (endpoint === "/api/auth/me") body = { user };
        else {
          products.push(endpoint);
          body = {};
          status = 500;
        }
        await route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (req) => {
        if (req.url().includes("/__mock__/")) mocks.push(req.url());
      });
      for (const url of [
        "/campaigns?q=test&status=CLOSED",
        "/campaigns/00000000-0000-4000-8000-000000000001",
      ]) {
        await page.goto(url);
        await expect(
          page.getByRole("heading", { name: "공개 모집 연결 준비 중" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "모집 마감하기" }),
        ).toHaveCount(0);
        expect(products).toEqual([]);
        expect(mocks).toEqual([]);
        expect(context.serviceWorkers()).toHaveLength(0);
        results.push(`${role} ${url}: production boundary verified`);
      }
      await context.close();
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
  await fs.writeFile(
    path.join(__dirname, "production-results.json"),
    `${JSON.stringify({ source: "production bundle with independent HTTP fixtures; NOT live API", results, pageErrors: errors }, null, 2)}\n`,
  );
  process.stdout.write(`${results.length} production checks passed\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
