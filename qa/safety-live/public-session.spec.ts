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

test("북마크 조회 실패 시 저장되지 않음으로 오표시하지 않고 재시도한다", async ({
  page,
}) => {
  const user = {
    id: "1",
    name: "의뢰인",
    email: "client@example.test",
    role: "CLIENT",
    status: "ACTIVE",
  };
  let reads = 0;
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const reply = (json: unknown, status = 200) =>
      route.fulfill({ json, status });
    if (path === "/api/auth/refresh")
      return reply({
        accessToken: "fixture-token",
        accessTokenExpiresIn: 3600,
        user,
      });
    if (path === "/api/auth/me") return reply({ user });
    if (path === "/api/portfolios/777")
      return reply({
        id: "777",
        creatorId: "1",
        title: "저장 테스트 영상",
        description: null,
        purpose: "OTHER",
        styles: [],
        roles: [],
        packageId: null,
        thumbnailFileId: null,
        videoFileId: null,
      });
    if (path === "/api/me/work-bookmarks") {
      reads += 1;
      return reads === 1
        ? reply({ error: { code: "SERVICE_UNAVAILABLE" } }, 503)
        : reply({ items: [] });
    }
    if (path === "/api/notifications/unread-count") return reply({ count: 0 });
    if (path === "/api/reports/me")
      return reply({ limited: false, reports: [], restrictions: [] });
    return reply({ error: { code: "NOT_FOUND" } }, 404);
  });
  await page.goto("/works/777");
  await expect(
    page.getByRole("alert").filter({
      hasText: "저장 상태를 확인하지 못했어요.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "♡ 저장" })).toHaveCount(0);
  await page.getByRole("button", { name: "저장 상태 다시 확인" }).click();
  await expect(page.getByRole("button", { name: "♡ 저장" })).toBeVisible();
  expect(reads).toBe(2);
});
