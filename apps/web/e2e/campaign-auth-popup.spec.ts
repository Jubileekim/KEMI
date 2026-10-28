import { expect, test } from "@playwright/test";
import { navigate } from "./proposal-helpers";

[0, 1].forEach((index) =>
  test(`비회원은 공개 모집 CTA ${index + 1}에서 안내를 보고 닫을 수 있다`, async ({
    page,
  }) => {
    await page.goto("/");
    const triggers = page.getByRole("button", {
      name: "공개 모집 살펴보기",
      exact: true,
    });

    const trigger = triggers.nth(index);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "로그인이 필요해요" });
    await expect(dialog).toContainText(
      "공개 모집을 올리거나 크리에이터로 참여하려면",
    );
    await expect(
      dialog.getByRole("link", { name: "회원가입", exact: true }),
    ).toHaveAttribute("href", "/signup?returnTo=%2Fcampaigns");
    await expect(
      dialog.getByRole("link", { name: "로그인", exact: true }),
    ).toHaveAttribute("href", "/login?returnTo=%2Fcampaigns");
    if (index === 0) await page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: "닫기" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page).toHaveURL("/");
  }),
);

test("가입 화면과 로그인 전환에서도 공개 모집 목적지를 보존한다", async ({
  page,
}) => {
  await page.goto("/landing");
  await page
    .getByRole("button", { name: "공개 모집 살펴보기", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "회원가입", exact: true })
    .click();
  await expect(page).toHaveURL("/signup?returnTo=%2Fcampaigns");
  await page
    .locator("main")
    .getByRole("link", { name: "로그인", exact: true })
    .click();
  await expect(page).toHaveURL("/login?returnTo=%2Fcampaigns");
});

["client", "creator"].forEach((role) => {
  test(`${role} 로그인 후 공개 모집으로 복귀하고 CTA는 바로 이동한다`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "공개 모집 살펴보기", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "로그인", exact: true })
      .click();
    await page.getByLabel("이메일 (필수)").fill(`${role}@example.test`);
    await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
    await page.getByRole("button", { name: "이메일로 로그인" }).click();
    await expect(page).toHaveURL("/campaigns");
    await navigate(page, "/");
    await page
      .getByRole("link", { name: "공개 모집 살펴보기", exact: true })
      .last()
      .click();
    await expect(page).toHaveURL("/campaigns");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
