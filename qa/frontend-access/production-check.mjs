// Independent HTTP fixtures, NOT live authentication/API verification.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { preview } from "vite";

const auth = process.argv.includes("--auth-fixtures");
const root = fileURLToPath(new URL("../../apps/web/", import.meta.url));
const assets = new URL("../../apps/web/dist/assets/", import.meta.url);
const bundle = (
  await Promise.all(
    (await readdir(assets))
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFile(new URL(name, assets), "utf8")),
  )
).join("\n");
for (const marker of [
  "/__mock__/",
  "setupWorker",
  "Mock 역할",
  "2-D 개발 전용 시나리오",
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
  preview: { host: "127.0.0.1", port: 4197, strictPort: true },
});
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const role of auth
    ? ["GUEST", "CLIENT", "CREATOR", "ADMIN"]
    : ["GUEST"]) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4197",
    });
    const unexpected = [];
    const errors = [];
    context.on("request", (request) => {
      if (request.url().includes("/__mock__/")) unexpected.push(request.url());
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
      let body;
      let status = 200;
      if (auth && role === "GUEST" && endpoint === "/api/auth/refresh") {
        status = 401;
        body = { error: { code: "SESSION_REVOKED", message: "Fixture guest" } };
      } else if (auth && endpoint === "/api/auth/refresh") {
        body = {
          accessToken: "http-fixture-token",
          accessTokenExpiresIn: 900,
          user,
        };
      } else if (auth && endpoint === "/api/auth/me") body = { user };
      else {
        unexpected.push(endpoint);
        status = 500;
        body = {};
      }
      await route.fulfill({ status, json: body });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    if (role !== "GUEST")
      await expect(
        page.getByRole("button", { name: "로그아웃", exact: true }),
      ).toBeVisible();
    const guide = page.getByRole("navigation", { name: "화면 이동 안내" });
    await expect(guide.getByRole("link")).toHaveCount(
      { GUEST: 3, CLIENT: 4, CREATOR: 5, ADMIN: 1 }[role],
    );
    for (const width of [320, 390, 600, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (auth && [390, 1280].includes(width))
        await page.screenshot({
          path: fileURLToPath(
            new URL(`./${role.toLowerCase()}-${width}.png`, import.meta.url),
          ),
          fullPage: true,
        });
    }
    if (["CLIENT", "CREATOR"].includes(role)) {
      await guide.getByRole("link", { name: /내 제안·협의 이어가기/ }).click();
      await expect(
        page.getByRole("heading", { name: "제안·협의 연결 준비 중" }),
      ).toBeVisible();
      await page.getByRole("link", { name: "KEMI 홈" }).click();
      await guide.getByRole("link", { name: /공개 모집 둘러보기/ }).click();
      await expect(
        page.getByRole("heading", { name: "공개 모집 연결 준비 중" }),
      ).toBeVisible();
    }
    await page.goto("/contracts/example/deliveries");
    const title = !auth
      ? "인증 연결 준비 중"
      : role === "GUEST"
        ? "로그인"
        : role === "ADMIN"
          ? "접근 권한이 없어요"
          : "영상 제출 연결 준비 중";
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(context.serviceWorkers()).toHaveLength(0);
    expect(unexpected).toEqual([]);
    expect(errors).toEqual([]);
    results.push(
      `${role}: navigation, responsive layout, auth/API boundary, no Mock or page errors`,
    );
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}
await writeFile(
  new URL(
    auth ? "./production-fixtures.json" : "./production-disabled.json",
    import.meta.url,
  ),
  `${JSON.stringify({ source: "local production bundle; independent HTTP fixtures, NOT live API", results }, null, 2)}\n`,
);
console.info(
  `${results.length} production role checks passed; auth fixtures=${auth}`,
);
