// Production assets + independent HTTP auth fixtures. NOT live API/DB.
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
    "/__mock__/campaigns",
    "/__mock__/pricing",
    "mock-fixture-v1",
    "2-B 개발 전용 시나리오",
    "모의 공개 확정",
    "setupWorker",
  ])
    expect(bundle).not.toContain(marker);
  expect(
    await fs.stat(path.join(root, "mockServiceWorker.js")).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
  const results = ["Mock code/endpoints/worker excluded from production"];
  const errors = [];
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const role of ["CLIENT", "CREATOR"]) {
      const context = await browser.newContext({
        baseURL: process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4187",
      });
      const user = {
        id: `http-${role}`,
        name: "HTTP 예시",
        email: "http@example.test",
        role,
        status: "ACTIVE",
      };
      const productRequests = [];
      const mockRequests = [];
      await context.route("**/api/**", async (route) => {
        const endpoint = new URL(route.request().url()).pathname;
        let body;
        if (endpoint === "/api/auth/refresh")
          body = {
            accessToken: "http-fixture-token",
            accessTokenExpiresIn: 900,
            user,
          };
        else if (endpoint === "/api/auth/me") body = { user };
        else {
          productRequests.push(endpoint);
          throw new Error(`Unexpected API ${endpoint}`);
        }
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (req) => {
        if (req.url().includes("/__mock__/")) mockRequests.push(req.url());
      });
      for (const route of ["/campaigns/new", "/campaigns/example/edit"]) {
        await page.goto(route);
        await expect(
          page.getByRole("heading", {
            name:
              role === "CLIENT"
                ? "캠페인 작성·공개 준비 중"
                : "접근 권한이 없어요",
          }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "임시 저장", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "모의 공개 확정" }),
        ).toHaveCount(0);
        expect(mockRequests).toEqual([]);
        expect(productRequests).toEqual([]);
        expect(context.serviceWorkers()).toHaveLength(0);
        results.push(`${role} ${route}: production boundary verified`);
      }
      await context.close();
    }
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
  await fs.writeFile(
    path.join(__dirname, "production-results.json"),
    `${JSON.stringify({ source: "production bundle with independent HTTP auth fixtures; NOT live API", results, pageErrors: errors }, null, 2)}\n`,
  );
  process.stdout.write(`${results.length} production checks passed\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
