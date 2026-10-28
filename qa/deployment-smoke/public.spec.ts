import { test, expect } from "@playwright/test";

for (const entry of [
  {
    path: "/",
    api: "/api/feed",
    heading: "당신의 이야기에, 딱 맞는 크리에이터.",
  },
  { path: "/works", api: "/api/feed", heading: "작품 피드" },
  { path: "/campaigns", api: "/api/projects", heading: "공개 모집" },
]) {
  test(`배포 공개 조회: ${entry.heading}`, async ({ page }) => {
    const mockRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/__mock__")) mockRequests.push(r.url());
    });
    const response = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === entry.api &&
        r.request().method() === "GET",
    );
    await page.goto(entry.path);
    const api = await response;
    expect(api.status()).toBe(200);
    expect(Array.isArray((await api.json()).items)).toBe(true);
    await expect(
      page.getByRole("heading", { name: entry.heading, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        entry.api === "/api/feed"
          ? "작품을 불러오고 있어요."
          : "모집 목록을 불러오고 있어요.",
        { exact: true },
      ),
    ).toHaveCount(0);
    expect(mockRequests).toEqual([]);
  });
}

test("배포 이메일 로그인 폼 활성화 (계정 생성·로그인 제출 없음)", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "이메일로 로그인", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("개발용 Mock 인증", { exact: false }),
  ).toHaveCount(0);
});
