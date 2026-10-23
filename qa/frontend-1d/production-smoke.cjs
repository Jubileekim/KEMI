// Production bundle + independent HTTP auth fixtures. No live API/DB/provider.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  const errors = [];
  const root = path.resolve(__dirname, "../../apps/web/dist");
  const files = await fs.readdir(path.join(root, "assets"));
  const chunks = await Promise.all(
    files
      .filter((file) => file.endsWith(".js"))
      .map((file) => fs.readFile(path.join(root, "assets", file), "utf8")),
  );
  const bundle = chunks.join("\n");
  for (const marker of [
    "/__mock__/studio",
    "모의 계약 참조 보관",
    "D01 모의 프로필 조건",
    "setupWorker",
    "Mock 업로드 완료 처리",
    "모의 제출 참조 보관",
  ])
    expect(bundle).not.toContain(marker);
  expect(
    await fs.stat(path.join(root, "mockServiceWorker.js")).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
  results.push("production assets: studio Mock code/endpoints/worker excluded");
  for (const role of ["CREATOR", "CLIENT"]) {
    const context = await browser.newContext({
      baseURL: process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4184",
    });
    const user = {
      id: `http-${role}`,
      name: "HTTP 예시",
      email: "http@example.test",
      role,
      status: "ACTIVE",
    };
    let writes = 0;
    const mockRequests = [];
    await context.route("**/api/**", async (route) => {
      const req = route.request();
      const endpoint = new URL(req.url()).pathname;
      if (req.method() !== "GET") writes += 1;
      let body;
      if (endpoint === "/api/auth/refresh")
        body = {
          accessToken: "http-fixture-token",
          accessTokenExpiresIn: 900,
          user,
        };
      else if (endpoint === "/api/auth/me") body = { user };
      else throw new Error(`Unexpected API ${req.method()} ${endpoint}`);
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
    for (const [index, routeName] of ["packages", "portfolio"].entries()) {
      await page.goto(`/studio/${routeName}`);
      await expect(
        page.getByRole("heading", {
          name:
            role === "CREATOR"
              ? routeName === "packages"
                ? "패키지·서비스 관리 준비 중"
                : "작업물 관리 준비 중"
              : "접근 권한이 없어요",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "서비스 공개", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "새 작업물 만들기" }),
      ).toHaveCount(0);
      await expect(
        page.getByText("개발 전용 도구", { exact: true }),
      ).toHaveCount(0);
      expect(mockRequests).toEqual([]);
      expect(writes).toBe(index + 1); // refresh per full page load, no undefined product writes.
      expect(context.serviceWorkers()).toHaveLength(0);
      results.push(
        `${role}/${routeName}: protected production route, no studio Mock/product writes`,
      );
    }
    await context.close();
  }
  expect(errors).toEqual([]);
  await browser.close();
  await fs.writeFile(
    path.join(__dirname, "production-results.json"),
    `${JSON.stringify({ source: "production bundle with independent HTTP auth fixtures; NOT live API", results, pageErrors: errors }, null, 2)}\n`,
  );
  process.stdout.write(`${results.length} production checks passed\n`);
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
