// Production bundle with independent HTTP auth fixtures, NOT live API/PG evidence.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const root = path.resolve(__dirname, "../../apps/web/dist");
  const assets = path.join(root, "assets");
  const files = await fs.readdir(assets);
  const bundle = (
    await Promise.all(
      files
        .filter((f) => f.endsWith(".js"))
        .map((f) => fs.readFile(path.join(assets, f), "utf8")),
    )
  ).join("\n");
  for (const marker of [
    "/__mock__/payments",
    "Mock 테스트 결제 진행",
    "3-C 개발 전용 시나리오",
    "/__mock__/signatures",
    "/__mock__/terms",
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
    "Payment/Signature/Terms Mock code, endpoints and worker excluded from production",
  ];
  const errors = [];
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const role of ["GUEST", "CLIENT", "CREATOR"]) {
      const context = await browser.newContext({
        baseURL: process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4192",
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
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (r.url().includes("/__mock__/")) mocks.push(r.url());
      });
      for (const url of [
        "/contracts/10000000-0000-4000-8000-000000000001/payment",
        "/payments/result?contractId=10000000-0000-4000-8000-000000000001&success=true&amount=1",
      ]) {
        await page.goto(url);
        let heading = "테스트 결제 연결 준비 중";
        if (role === "GUEST") heading = "로그인";
        if (role === "CREATOR" && url.startsWith("/contracts/"))
          heading = "접근 권한이 없어요";
        await expect(
          page.getByRole("heading", { name: heading, exact: true }),
        ).toBeVisible();
        expect(products).toEqual([]);
        expect(mocks).toEqual([]);
        expect(context.serviceWorkers()).toHaveLength(0);
        await expect(
          page.getByRole("button", { name: "테스트 주문 만들기", exact: true }),
        ).toHaveCount(0);
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
    `${JSON.stringify({ source: "production bundle with independent HTTP fixtures; NOT live API/PG", results, pageErrors: errors }, null, 2)}\n`,
  );
  process.stdout.write(`${results.length} production checks passed\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
