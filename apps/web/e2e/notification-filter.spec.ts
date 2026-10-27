import { test, expect } from "@playwright/test";
import { login, navigate } from "./proposal-helpers";

test("알림 필터는 클릭·뒤로·앞으로 이동 시 URL과 체크 상태를 유지한다", async ({
  page,
}) => {
  await page.goto("/");
  await login(page);
  await navigate(page, "/notifications");
  const filter = page.getByRole("checkbox", {
    name: "미확인만 보기",
    exact: true,
  });
  await expect(filter).not.toBeChecked();
  await filter.check();
  await expect(page).toHaveURL(/\/notifications\?unread=true$/);
  await expect(filter).toBeChecked();
  await page.goBack();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(filter).not.toBeChecked();
  await page.goForward();
  await expect(page).toHaveURL(/\/notifications\?unread=true$/);
  await expect(filter).toBeChecked();
  await filter.uncheck();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(filter).not.toBeChecked();
  await filter.focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/notifications\?unread=true$/);
  await expect(filter).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(filter).not.toBeChecked();
});
