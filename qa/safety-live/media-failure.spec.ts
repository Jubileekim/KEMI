import { test, expect } from "@playwright/test";

const portfolio = {
  id: "777",
  creatorId: "1",
  title: "미디어 오류 테스트 작품",
  description: "영상 오류와 미등록 영상을 구분합니다.",
  purpose: "OTHER",
  styles: [],
  roles: [],
  packageId: null,
  videoFileId: "file-777",
  thumbnailFileId: null,
};

test("영상 정보 오류와 복구를 구분한다", async ({ page }) => {
  let mediaReads = 0;
  await page.route("**/api/portfolios/777", (route) =>
    route.fulfill({ json: portfolio }),
  );
  await page.route("**/api/portfolios/777/media", (route) => {
    mediaReads += 1;
    if (mediaReads === 1) {
      return route.fulfill({
        status: 503,
        json: { error: { code: "SERVICE_UNAVAILABLE" } },
      });
    }
    return route.fulfill({ json: { video: null, thumbnail: null } });
  });

  await page.goto("/works/777");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("영상 정보를 불러오지 못했어요.");
  await expect(page.getByText("재생할 영상이 없어요.")).toHaveCount(0);

  await page.getByText("영상 정보 다시 불러오기").click();
  await expect(page.getByText("재생할 영상이 없어요.")).toBeVisible();
  expect(mediaReads).toBe(2);
});
