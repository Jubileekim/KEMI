import { test, expect } from "@playwright/test";

for (const entry of [
  { path: "/", api: "/api/feed", loading: "작품을 불러오고 있어요." },
  { path: "/works", api: "/api/feed", loading: "작품을 불러오고 있어요." },
  {
    path: "/campaigns",
    api: "/api/projects",
    loading: "모집 목록을 불러오고 있어요.",
  },
]) {
  test(`실제 API: 세션 확인과 공개 조회 경합 ${entry.path}`, async ({
    page,
  }) => {
    // Keep actual backend responses; delay transport only to exercise the
    // cache-clear race. No fabricated successful response or test data.
    await page.route("**/api/auth/refresh", async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ response });
    });
    await page.route(`**${entry.api}*`, async (route) => {
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({ response }).catch(() => {});
    });
    await page.goto(entry.path);
    await expect(page.getByText(entry.loading, { exact: true })).toBeVisible();
    await expect(page.getByText(entry.loading, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const result = await page.request.get(entry.api);
    expect(result.status()).toBe(200);
  });
}
