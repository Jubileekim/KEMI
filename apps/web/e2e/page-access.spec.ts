import { expect, test, type Page } from "@playwright/test";

// Explicit MSW sessions: verifies route behavior, not live API authorization.
async function login(page: Page, email: string) {
  await page.goto("/login");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill(email);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
}

[
  {
    email: "client@example.test",
    path: "/studio/portfolio",
    role: "의뢰인",
    required: "크리에이터",
  },
  {
    email: "creator@example.test",
    path: "/campaigns/new?draft=1",
    role: "크리에이터",
    required: "의뢰인",
  },
  {
    email: "client@example.test",
    path: "/ops/reports",
    role: "의뢰인",
    required: "운영자",
  },
].forEach((entry) => {
  test(`${entry.role} cannot open ${entry.path} directly or after reload`, async ({
    page,
  }) => {
    await login(page, entry.email);
    await page.goto(entry.path);
    const denied = page.getByRole("alert").filter({
      has: page.getByRole("heading", { name: "접근 권한이 없어요" }),
    });
    await expect(denied).toContainText(
      `계정만 이용할 수 있어요. 현재 계정은 ${entry.role}입니다.`,
    );
    await expect(denied).toContainText(entry.required);
    await page.reload();
    await expect(denied).toBeVisible();
    await denied.getByRole("link", { name: "홈으로", exact: true }).click();
    await expect(page).toHaveURL("/");
  });
});

test("switching accounts preserves the blocked URL and opens it only for the allowed role", async ({
  page,
}) => {
  await login(page, "creator@example.test");
  await page.goto("/campaigns/new?draft=1");
  await page.getByRole("button", { name: "다른 계정으로 로그인" }).click();
  await expect(page).toHaveURL(
    /\/login\?returnTo=%2Fcampaigns%2Fnew%3Fdraft%3D1/,
  );
  await page.getByLabel("이메일 (필수)").fill("client@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(page).toHaveURL("/campaigns/new?draft=1");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("캠페인 제목")).toBeVisible();
});
