// Production bundle + independent Playwright HTTP fixtures. No live API or DB.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  const results = [];
  for (const role of ["CLIENT", "CREATOR"]) {
    const context = await browser.newContext({
      baseURL: process.env.KEMI_PREVIEW_URL || "http://127.0.0.1:4183",
    });
    const user = {
      id: `http-${role}`,
      name: "기존 이름",
      email: "private@example.test",
      role,
      status: "ACTIVE",
    };
    const profile =
      role === "CLIENT"
        ? {
            type: role,
            brandName: null,
            introduction: null,
            industry: null,
            websiteUrl: null,
            socialUrl: null,
          }
        : {
            type: role,
            introduction: null,
            niche: null,
            contentStyles: [],
            productionRoles: [],
            workMethod: null,
            serviceStatus: "PUBLIC",
            isAvailable: false,
            availableFrom: null,
          };
    const token = {
      accessToken: "http-fixture-token",
      accessTokenExpiresIn: 900,
      user,
    };
    const writes = [];
    let failSave = false;
    await context.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname === "/api/auth/refresh") return json(token);
      if (url.pathname === "/api/auth/me") return json({ user });
      if (url.pathname === "/api/profiles/me") {
        expect(request.headers().authorization).toBe(
          "Bearer http-fixture-token",
        );
        if (request.method() === "PATCH") {
          const patch = request.postDataJSON();
          writes.push(patch);
          if (failSave) return json({ error: { code: "SERVER_ERROR" } }, 500);
          const { name, ...fields } = patch;
          if (name) user.name = name;
          Object.assign(profile, fields);
        }
        return json({ name: user.name, profile });
      }
      throw Error(`Unexpected API request ${request.method()} ${url.pathname}`);
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/me/profile");
    await expect(page.getByLabel("표시 이름 (필수)")).toHaveValue("기존 이름");
    await expect(
      page.getByText("private@example.test", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("complementary", { name: "개발 전용 도구" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "추가 정보 Mock" }),
    ).toHaveCount(0);
    const name = page.getByLabel("표시 이름 (필수)");
    await name.fill("저장한 이름");
    await name.press("Tab");
    if (role === "CLIENT")
      await page.getByLabel("자사몰 주소 (선택)").fill("https://example.test");
    else {
      await page.getByLabel("촬영", { exact: true }).focus();
      await page.keyboard.press("Space");
      await expect(page.getByLabel("촬영", { exact: true })).toBeChecked();
    }
    await page
      .getByRole("button", { name: "프로필 저장", exact: true })
      .click();
    await expect(
      page.getByText("프로필을 저장했어요.", { exact: true }),
    ).toBeVisible();
    expect(writes).toEqual([
      role === "CLIENT"
        ? { name: "저장한 이름", websiteUrl: "https://example.test" }
        : { name: "저장한 이름", productionRoles: ["FILMING"] },
    ]);
    results.push(
      `${role}: validated bearer / role-specific partial PATCH / response reset / keyboard`,
    );
    if (role === "CREATOR") {
      await expect(
        page.getByRole("heading", { name: "제작 서비스 상태: 공개" }),
      ).toBeVisible();
      results.push(
        "PUBLIC stays PUBLIC after editing (no serviceStatus in PATCH)",
      );
    }
    await page.reload();
    await expect(name).toHaveValue("저장한 이름");
    results.push(
      `${role}: independent HTTP fixture retains saved profile across reload`,
    );
    failSave = true;
    await page.getByLabel("소개 (선택)").fill("실패 후 보존");
    await page
      .getByRole("button", { name: "프로필 저장", exact: true })
      .click();
    await expect(
      page.getByText("입력은 유지했어요.", { exact: false }),
    ).toBeVisible();
    expect(writes).toHaveLength(2);
    await expect(page.getByLabel("소개 (선택)")).toHaveValue("실패 후 보존");
    failSave = false;
    await page
      .getByRole("button", { name: "최신 값 확인 (입력 대체)" })
      .click();
    await expect(page.getByLabel("소개 (선택)")).toHaveValue("");
    results.push(
      `${role}: save failure preserves input / explicit read restores server value`,
    );
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(
          __dirname,
          `profile-${role.toLowerCase()}-${width}.png`,
        ),
        fullPage: true,
      });
    }
    expect(
      await page.evaluate(() =>
        navigator.serviceWorker
          .getRegistrations()
          .then((items) => items.length),
      ),
    ).toBe(0);
    await context.close();
  }
  expect(errors).toEqual([]);
  results.push(
    "production: no Mock UI / service worker / private email rendering / page errors",
  );
  const files = await fs.readdir(
    path.join(__dirname, "../../apps/web/dist/assets"),
  );
  const scripts = await Promise.all(
    files
      .filter((file) => file.endsWith(".js"))
      .map((file) =>
        fs.readFile(
          path.join(__dirname, "../../apps/web/dist/assets", file),
          "utf8",
        ),
      ),
  );
  expect(scripts.join("\n")).not.toMatch(
    /Mock 미리보기|mock-access-|__mock__\/profiles\/scenario|setupWorker/,
  );
  expect(
    await fs.readdir(path.join(__dirname, "../../apps/web/dist")),
  ).not.toContain("mockServiceWorker.js");
  results.push(
    "production: Mock profile fixture / extras / worker absent in bundle",
  );
  await fs.writeFile(
    path.join(__dirname, "production-results.json"),
    `${JSON.stringify({ source: "production bundle + simulated HTTP; not live API/DB", passed: results.length, results, pageErrors: errors }, null, 2)}\n`,
  );
  await browser.close();
  console.log(JSON.stringify({ passed: results.length, pageErrors: errors }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
