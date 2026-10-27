// Local production bundle and independent HTTP auth fixtures, never live API proof.
import { chromium, expect } from "@playwright/test";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const mode = process.env.KEMI_PRODUCTION_MODE || "default";
const origin = "http://127.0.0.1:4207";
const routes = [
  ["/me/activity", ["CLIENT", "CREATOR"], "활동 연결 준비 중"],
  ["/bookmarks", ["CREATOR"], "활동 연결 준비 중"],
  ["/recommendations", ["CREATOR"], "활동 연결 준비 중"],
  ["/notifications", ["CLIENT", "CREATOR"], "알림·리뷰 연결 준비 중"],
  [
    "/contracts/00000000-0000-4000-8000-000000000001/review",
    ["CLIENT", "CREATOR"],
    "알림·리뷰 연결 준비 중",
  ],
  ["/reports/new", ["CLIENT", "CREATOR"], "신고·이용 제한 안내 연결 준비 중"],
  ["/ops/reports", ["ADMIN"], "신고·이용 제한 안내 연결 준비 중"],
];
const assets = await readdir("apps/web/dist/assets");
for (const asset of assets.filter((name) => name.endsWith(".js"))) {
  const text = await readFile(join("apps/web/dist/assets", asset), "utf8");
  expect(text).not.toMatch(
    /\/__mock__\/|setupWorker|recordMockEvent|mock-access-|readMockAnalytics|mockAccountLimited/,
  );
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
const results = [];
try {
  for (const role of mode === "default"
    ? ["GUEST"]
    : ["GUEST", "CLIENT", "CREATOR", "ADMIN"]) {
    const context = await browser.newContext({ baseURL: origin });
    const errors = [];
    const forbidden = [];
    context.on("page", (page) => {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (req) => {
        if (/__mock__|mockServiceWorker|supabase|toss/.test(req.url()))
          forbidden.push(req.url());
      });
    });
    await context.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (role === "GUEST")
        return route.fulfill({
          status: 401,
          json: { error: { code: "SESSION_REVOKED" } },
        });
      const user = {
        id: `http-${role}`,
        name: "독립 HTTP 예시",
        email: null,
        role,
        status: "ACTIVE",
      };
      if (path === "/api/auth/refresh")
        return route.fulfill({
          json: {
            accessToken: "http-fixture",
            accessTokenExpiresIn: 900,
            user,
          },
        });
      if (path === "/api/auth/me") return route.fulfill({ json: { user } });
      throw new Error(`Unexpected production API ${path}`);
    });
    const page = await context.newPage();
    for (const [path, allowed, title] of routes) {
      await page.goto(path);
      let expected = title;
      if (mode === "default") expected = "인증 연결 준비 중";
      else if (role === "GUEST") expected = "로그인";
      else if (!allowed.includes(role)) expected = "접근 권한이 없어요";
      await expect(
        page.getByRole("heading", { name: expected, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByLabel("개발 전용 도구", { exact: true }),
      ).toHaveCount(0);
      results.push({ role, path, expected, passed: true });
    }
    expect(errors).toEqual([]);
    expect(forbidden).toEqual([]);
    expect(await context.serviceWorkers()).toHaveLength(0);
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `qa/frontend-7/production-${mode}.json`,
  `${JSON.stringify({ mode, scope: "local production bundle + independent HTTP auth fixtures; no real API", mockExcluded: true, results }, null, 2)}\n`,
);
console.log(
  `${mode}: ${results.length}/${results.length} passed; Mock/analytics code, requests and worker excluded`,
);
