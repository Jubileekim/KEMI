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
  const loadingHint = page.getByText(
    "첫 방문이라 작품을 불러오는 데 시간이 더 걸릴 수 있어요.",
  );
  const heroLoading = page.getByText("대표 작품을 불러오고 있어요.");
  await expect(heroLoading).toBeVisible();
  await expect(loadingHint).toHaveCount(0);

  await page.clock.fastForward(9_000);
  await expect(loadingHint.first()).toBeVisible();

  releaseFeed?.();
  await expect(loadingHint).toHaveCount(0);
  const emptyHero = page.getByText(
    "함께할 크리에이터의 새로운 작품을 기다리고 있어요.",
  );
  await expect(emptyHero).toBeVisible();
});
