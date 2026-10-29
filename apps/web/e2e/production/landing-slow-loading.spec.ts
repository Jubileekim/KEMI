import { expect, test } from "@playwright/test";

test("landing explains an unusually slow public feed and clears the hint after load", async ({
  page,
}) => {
  await page.clock.install();
  let releaseFeed: (() => void) | undefined;
  const pendingFeed = new Promise<void>((resolve) => {
    releaseFeed = resolve;
  });

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/feed") {
      await pendingFeed;
      return route.fulfill({
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (path === "/api/auth/refresh" || path === "/api/auth/me") {
      return route.fulfill({
        status: 401,
        json: { error: { code: "UNAUTHORIZED" } },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto("/");
  await expect(
    page.getByText("대표 작품을 불러오고 있어요."),
  ).toBeVisible();
  await expect(page.getByText(/첫 방문에는 서버가 준비되는 동안/)).toHaveCount(
    0,
  );

  await page.clock.fastForward(9_000);
  await expect(
    page.getByText(/첫 방문에는 서버가 준비되는 동안/).first(),
  ).toBeVisible();

  releaseFeed?.();
  await expect(
    page.getByText(/첫 방문에는 서버가 준비되는 동안/),
  ).toHaveCount(0);
  await expect(
    page.getByText("함께할 크리에이터의 새로운 작품을 기다리고 있어요."),
  ).toBeVisible();
});
