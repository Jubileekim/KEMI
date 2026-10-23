// Production bundle with HTTP responses simulated by Playwright. No real API/provider.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    baseURL: process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4182",
  });
  let outcome = "login";
  let authenticated = false;
  let pendingProvider = "google";
  let writes = 0;
  let navigations = 0;
  const user = {
    id: "http-google-fixture",
    email: null,
    name: "구글 이름",
    role: "CREATOR",
    status: "ACTIVE",
  };
  const token = {
    accessToken: "simulated-http-only",
    accessTokenExpiresIn: 900,
    user,
  };
  const pageErrors = [];
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (url.pathname === "/api/auth/google/start") {
      if (!request.isNavigationRequest())
        throw Error("Google start must navigate");
      navigations += 1;
      authenticated = outcome === "login";
      return route.fulfill({
        status: 302,
        headers: { location: `/auth/social/callback?result=${outcome}` },
      });
    }
    if (url.pathname === "/api/auth/refresh")
      return authenticated
        ? json(token)
        : json({ error: { code: "SESSION_REVOKED" } }, 401);
    if (url.pathname === "/api/auth/me") return json({ user });
    if (url.pathname === "/api/auth/logout") {
      authenticated = false;
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/api/auth/social/signup") {
      if (request.method() === "GET")
        return json({
          provider: pendingProvider,
          suggestedName: "구글 이름",
          providerEmail: "client@example.test",
        });
      writes += 1;
      const input = request.postDataJSON();
      expect(input).toEqual({ role: "CREATOR", name: "수정한 구글 이름" });
      authenticated = true;
      return json(token, 201);
    }
    throw Error(`Unexpected API path: ${url.pathname}`);
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/login?returnTo=%2Fstudio%2Fpackages");
  await page.getByRole("button", { name: "Google로 계속하기" }).click();
  await expect(page).toHaveURL("/studio/packages");
  expect(navigations).toBe(1);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  outcome = "signup";
  await page.getByRole("button", { name: "Google로 계속하기" }).click();
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveValue("구글 이름");
  await fs.mkdir(__dirname, { recursive: true });
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: path.join(__dirname, `google-signup-${width}.png`),
      fullPage: true,
    });
  }
  await page.getByLabel("크리에이터", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("수정한 구글 이름");
  await page
    .getByRole("button", { name: "Google 계정으로 가입 완료" })
    .dblclick();
  await expect(page).toHaveURL("/me/profile");
  expect(writes).toBe(1);
  // Same email fixture has no ability to turn a provider email into a login email.
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  pendingProvider = "kakao";
  await page.goto("/auth/social/callback?result=signup");
  await expect(page.getByRole("alert")).toContainText("가입 정보가");
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveCount(0);
  expect(writes).toBe(1);
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0);
  await expect(
    page.getByRole("complementary", { name: "개발 전용 도구" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("개발용 Google Mock", { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /카카오/ })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  const result = {
    mode: "production bundle + simulated HTTP, no real API/Google",
    checks: [
      "navigation to Google start",
      "refresh/me before login",
      "creator-only return preserved",
      "new signup role/name without credentials",
      "single signup POST",
      "unsupported signup provider rejected",
      "no production Mock/worker/Kakao UI",
    ],
    pageErrors,
    navigations,
    signupPosts: writes,
  };
  await fs.writeFile(
    path.join(__dirname, "production-results.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
