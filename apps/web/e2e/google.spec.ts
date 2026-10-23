import { expect, test, type Page } from "@playwright/test";

async function start(page: Page, path = "/login") {
  await page.goto(path);
  await expect(
    page.getByRole("button", { name: "Google로 계속하기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Google로 계속하기" }).click();
  await expect(
    page.getByRole("heading", { name: "Google 제공자 Mock" }),
  ).toBeVisible();
}
async function fresh(page: Page) {
  await start(page);
  await page.getByRole("button", { name: "새 Google 회원" }).click();
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveValue("Google 이름");
}
test("기존 Google 회원: 안전한 복귀·새로고침·로그아웃", async ({ page }) => {
  let refreshes = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/auth/refresh") refreshes += 1;
  });
  await start(page, "/login?returnTo=%2Frequests%3Ffilter%3Dmine");
  refreshes = 0;
  await page.getByRole("button", { name: "기존 Google 회원" }).click();
  await expect(page).toHaveURL("/requests?filter=mine");
  expect(refreshes).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "의뢰 현황" })).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
["의뢰인", "크리에이터"].forEach((role) => {
  test(`${role} 신규 Google: 역할 필수·이름 수정·중복 방지·동일 계정 재로그인`, async ({
    page,
  }) => {
    let submissions = 0;
    page.on("request", (r) => {
      if (
        new URL(r.url()).pathname === "/api/auth/social/signup" &&
        r.method() === "POST"
      )
        submissions += 1;
    });
    await fresh(page);
    await expect(
      page.getByText(/기존 이메일 계정과 자동으로 합치지/),
    ).toBeVisible();
    await expect(page.getByLabel(/비밀번호/)).toHaveCount(0);
    await page
      .getByRole("button", { name: "Google 계정으로 가입 완료" })
      .click();
    await expect(page.getByText("역할을 선택해 주세요.")).toBeVisible();
    expect(submissions).toBe(0);
    await page.getByLabel(role, { exact: true }).check();
    await page.getByLabel("표시 이름 (필수)").fill("수정한 이름");
    const signupResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/social/signup") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Google 계정으로 가입 완료" })
      .dblclick();
    await expect(page).toHaveURL("/me/profile");
    const originalUser = (await (await signupResponse).json()).user;
    expect(submissions).toBe(1);
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/login/);
    await page.getByRole("button", { name: "Google로 계속하기" }).click();
    const refreshResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/refresh") && r.status() === 200,
    );
    await page.getByRole("button", { name: "새 Google 회원" }).click();
    // Logout's existing safe return points at the profile we just left.
    await expect(page).toHaveURL("/me/profile");
    const returningUser = (await (await refreshResponse).json()).user;
    expect(returningUser.id).toBe(originalUser.id);
    expect(returningUser.role).toBe(
      role === "크리에이터" ? "CREATOR" : "CLIENT",
    );
    expect(submissions).toBe(1);
    const reloadResponse = page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/refresh") && r.status() === 200,
    );
    await page.reload();
    const reloadedUser = (await (await reloadResponse).json()).user;
    expect(reloadedUser.id).toBe(originalUser.id);
    expect(reloadedUser.role).toBe(returningUser.role);
  });
});
[
  ["동의 취소", "취소했어요"],
  ["인증 실패", "확인하지 못했어요"],
  ["설정 없음", "준비되지 않았어요"],
  ["요청 제한", "요청이 많아요"],
  ["이용 제한", "제한된 계정"],
].forEach(([label, message]) => {
  test(`Google ${label}: 계정 생성 없이 오류·다시 시작`, async ({ page }) => {
    let authWrites = 0;
    page.on("request", (r) => {
      if (
        r.method() === "POST" &&
        new URL(r.url()).pathname.startsWith("/api/auth/")
      )
        authWrites += 1;
    });
    await start(page);
    authWrites = 0;
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("alert")).toContainText(message ?? "");
    expect(authWrites).toBe(0);
    await page.getByRole("button", { name: "Google로 계속하기" }).click();
    await expect(
      page.getByRole("heading", { name: "Google 제공자 Mock" }),
    ).toBeVisible();
  });
});
test("위조·모호한 콜백과 티켓 없는 직접 진입은 로그인/가입하지 않는다", async ({
  page,
}) => {
  await page.goto("/auth/social/callback?result=login&error=SOCIAL_FAILED");
  await expect(page.getByRole("alert")).toContainText("올바르지 않은");
  await page.goto("/auth/social/callback?result=login");
  await expect(page.getByRole("alert")).toContainText(
    "세션을 확인하지 못했어요",
  );
  await page.goto("/auth/social/callback?result=signup");
  await expect(page.getByRole("alert")).toContainText("가입 정보가 만료");
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveCount(0);
});
["expired", "invalid", "server", "rate"].forEach((scenario) => {
  test(`가입 ${scenario}: 입력/결과 확인·자동 재전송 없음`, async ({
    page,
  }) => {
    await fresh(page);
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/__mock__/auth/scenario")),
      page.getByLabel("Mock 인증 응답").selectOption(scenario),
    ]);
    await page.getByLabel("의뢰인", { exact: true }).check();
    await page.getByLabel("표시 이름 (필수)").fill("보존할 이름");
    await page
      .getByRole("button", { name: "Google 계정으로 가입 완료" })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("표시 이름 (필수)")).toHaveValue(
      "보존할 이름",
    );
    await expect(page).toHaveURL(/result=signup/);
  });
});
test("Google 화면은 모바일/PC·키보드에서 넘침 없이 KEMI 토큰 사용", async ({
  page,
}) => {
  await fresh(page);
  await [320, 390, 599, 600, 768, 1023, 1024, 1280].reduce(
    async (previous, width) => {
      await previous;
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    },
    Promise.resolve(),
  );
  await expect(
    page.getByRole("button", { name: "Google 계정으로 가입 완료" }),
  ).toHaveCSS("background-color", "rgb(54, 115, 69)");
  await page.getByLabel("의뢰인", { exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("의뢰인", { exact: true })).toBeChecked();
  await page.getByLabel("표시 이름 (필수)").fill("x");
  await page.getByRole("button", { name: "Google 계정으로 가입 완료" }).click();
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveAttribute(
    "aria-describedby",
    "social-name-error",
  );
});
