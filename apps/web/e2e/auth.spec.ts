import { expect, test, type Page } from "@playwright/test";

// Explicit MSW fixtures. These tests do not prove server/DB/cookie policy correctness.
async function scenario(page: Page, value: string) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/__mock__/auth/scenario",
    ),
    page.getByLabel("Mock 인증 응답").selectOption(value),
  ]);
}
async function login(
  page: Page,
  email = "client@example.test",
  path = "/login",
) {
  await page.goto(path);
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill(email);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
}
["의뢰인", "크리에이터"].forEach((role) => {
  test(`${role} 가입은 확인값 검증 후 한번 제출하고 프로필로 이동한다`, async ({
    page,
  }) => {
    let submissions = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/auth/signup")
        submissions += 1;
    });
    await page.goto("/signup");
    await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
    await page.getByLabel(role, { exact: true }).check();
    await page.getByLabel("표시 이름 (필수)").fill("새로운 이름");
    await page.getByLabel("이메일 (필수)").fill(" New@Example.test ");
    await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("abcdefgh");
    await page.getByLabel("비밀번호 확인 (필수)").fill("different");
    await page.getByRole("button", { name: "가입하고 시작하기" }).click();
    await expect(
      page.getByText("영문과 숫자를 함께 입력해 주세요.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("비밀번호가 일치하지 않아요.")).toBeVisible();
    await expect(
      page.getByLabel("비밀번호 (필수)", { exact: true }),
    ).toHaveAttribute("aria-describedby", "password-error");
    expect(submissions).toBe(0);
    await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
    await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
    await page.getByRole("button", { name: "가입하고 시작하기" }).click();
    await expect(page).toHaveURL("/me/profile");
    await expect(
      page.getByRole("button", { name: "로그아웃", exact: true }),
    ).toBeVisible();
    expect(submissions).toBe(1);
    // Complete this bundle's contiguous flow without reloading the in-memory Mock registry.
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel("이메일 (필수)").fill("new@example.test");
    await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await expect(page).toHaveURL("/me/profile");
  });
});
test("중복 이메일 가입 오류에서 폼 입력을 보존한다", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("표시 이름 (필수)").fill("동일 이름");
  await page.getByLabel("이메일 (필수)").fill("client@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(
    page.getByText("이미 가입된 이메일이에요.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveValue("동일 이름");
});
test("로그인 오류·중복 클릭 방지·보호 경로 복귀·새로고침을 연결한다", async ({
  page,
}) => {
  await page.goto("/requests?filter=mine");
  await expect(page).toHaveURL(/login\?returnTo=/);
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await scenario(page, "invalid");
  await page.getByLabel("이메일 (필수)").fill("client@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(
    page.getByText("이메일 또는 비밀번호를 확인해 주세요.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("비밀번호 (필수)", { exact: true })).toHaveValue(
    "wrong",
  );
  await scenario(page, "delay");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page
    .getByRole("button", { name: "비밀번호 보기", exact: true })
    .click();
  await expect(
    page.getByLabel("비밀번호 (필수)", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(page.getByRole("button", { name: "처리 중…" })).toBeDisabled();
  await expect(page).toHaveURL("/requests?filter=mine");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "의뢰 현황", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
});
test("크리에이터 기본 이동과 외부 복귀 차단", async ({ page }) => {
  await login(
    page,
    "creator@example.test",
    "/login?returnTo=https%3A%2F%2Fevil.test",
  );
  await expect(page).toHaveURL("/studio/portfolio");
  await page.goto("/campaigns/new");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
});
[
  ["restricted", "이용이 제한된 계정이거나 허용되지 않은 요청이에요."],
  ["rate", "요청이 많아요. 잠시 후 다시 시도해 주세요."],
  ["server", "서버 오류가 발생했어요."],
  ["network", "네트워크 연결을 확인해 주세요."],
].forEach(([value, message]) => {
  test(`로그인 ${value} 오류 뒤 재시도`, async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
    await scenario(page, value ?? "server");
    await page.getByLabel("이메일 (필수)").fill("client@example.test");
    await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await expect(page.getByText(message ?? "", { exact: true })).toBeVisible();
    await scenario(page, "success");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await expect(page).toHaveURL("/me/activity");
  });
});
test("로그아웃 실패를 숨기지 않고 재시도·캐시 제거·뒤로 가기를 처리한다", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL("/me/activity");
  await page.evaluate(async () => {
    const path = "/src/app/query-client.ts";
    const { default: client } = await import(path);
    client.setQueryData(["private-fixture"], { name: "private" });
  });
  await scenario(page, "logout-error");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByText(/서버 로그아웃을 확인하지 못했어요/),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const path = "/src/app/query-client.ts";
      const { default: client } = await import(path);
      return client.getQueryData(["private-fixture"]) === undefined;
    }),
  ).toBe(true);
  await scenario(page, "success");
  await page.getByRole("button", { name: "서버 로그아웃 다시 시도" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goBack();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toHaveCount(0);
});
test("폐기된 세션은 개인 화면을 닫고 다시 로그인하도록 안내한다", async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL("/me/activity");
  await scenario(page, "expired");
  await page.getByRole("button", { name: "인증 세션 확인" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText("로그인이 만료되었어요. 다시 로그인해 주세요.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "내 활동", exact: true }),
  ).toHaveCount(0);
});
test("인증 폼은 모바일·태블릿·데스크톱에서 넘치지 않는다", async ({
  page,
}, testInfo) => {
  await page.goto("/signup");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  async function checkWidth(width: number) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    if (width !== 320)
      await page.screenshot({
        path: testInfo.outputPath(`signup-${width}.png`),
        fullPage: true,
      });
  }
  await checkWidth(320);
  await checkWidth(390);
  await checkWidth(768);
  await checkWidth(1280);
});
