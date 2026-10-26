// Run after a build with VITE_ENABLE_AUTH_API=true and a local preview on 4181.
// Playwright fulfills API responses: this is NOT live-server verification.
const { chromium } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({
    channel: process.env.KEMI_BROWSER_CHANNEL || undefined,
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    const calls = [];
    const user = {
      id: "fixture-client",
      email: "client@example.test",
      name: "모의 의뢰인",
      role: "CLIENT",
      status: "ACTIVE",
    };
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const endpoint = new URL(route.request().url()).pathname;
      calls.push(endpoint);
      if (endpoint.endsWith("/refresh"))
        return route.fulfill({
          status: 401,
          json: { error: { code: "SESSION_REVOKED" } },
        });
      if (endpoint.endsWith("/login")) {
        assert.equal(
          route.request().postDataJSON().email,
          "client@example.test",
        );
        return route.fulfill({
          json: {
            accessToken: "fixture-only-token",
            accessTokenExpiresIn: 900,
            user,
          },
        });
      }
      if (endpoint.endsWith("/me")) return route.fulfill({ json: { user } });
      if (endpoint.endsWith("/logout")) return route.fulfill({ status: 204 });
      throw new Error(`Unexpected API ${endpoint}`);
    });
    const origin = process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4181";
    await page.goto(`${origin}/requests`);
    await page.getByLabel("이메일 (필수)").fill("Client@Example.test");
    await page
      .getByLabel("비밀번호 (필수)", { exact: true })
      .fill("fixture-password");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await page.waitForURL("**/requests");
    assert.equal(
      await page
        .getByRole("heading", { name: "의뢰 현황", exact: true })
        .count(),
      1,
    );
    assert.equal(await page.getByLabel("개발 전용 도구").count(), 0);
    assert.equal(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
      0,
    );
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await page.waitForURL("**/login?*");
    await page.getByRole("link", { name: "회원가입", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "가입하고 시작하기" })
        .isDisabled(),
      true,
    );
    assert(calls.includes("/api/auth/logout"));
    assert(!calls.includes("/api/auth/signup"));
    assert.deepEqual(errors, []);
    const result = {
      source:
        "production bundle + Playwright fulfilled HTTP fixtures, NOT live API",
      checks: [
        "login normalized email",
        "protected return",
        "logout",
        "signup conflict blocked",
        "no development tools",
        "no worker registration",
        "no page errors",
      ],
      calls,
      errors,
    };
    await fs.writeFile(
      path.join(__dirname, "production-results.json"),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
