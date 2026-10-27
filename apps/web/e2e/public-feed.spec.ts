import { test, expect } from "@playwright/test";
import { login, navigate, studioFixture } from "./proposal-helpers";

test("6-A 비회원 작품→영상, 가격 없음·필터/페이지·뒤로가기·실패 복구", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(page.getByRole("article").first()).not.toContainText("원");
  await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByLabel("스타일", { exact: true }).selectOption("차분한");
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("article").first().getByRole("link").first().click();
  await expect(page.getByLabel("공개 샘플 영상")).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByLabel("공개 샘플 영상")
        .evaluate((v) => v instanceof HTMLVideoElement && v.readyState),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByText("자작 샘플 · 거래 실적 아님", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("담당 역할: 편집", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("공개 샘플 영상")
    .evaluate((v) => v.dispatchEvent(new Event("error")));
  await expect(page.getByText(/영상 재생을 확인하지 못했어요/)).toBeVisible();
  await page.getByRole("button", { name: "최신 공개 상태 확인" }).click();
  await expect(page.getByLabel("공개 샘플 영상")).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("스타일", { exact: true })).toHaveValue(
    "차분한",
  );
  await navigate(page, "/?style=없는분류");
  await expect(page.getByText(/조건에 맞는 공개 작품이 없어요/)).toBeVisible();
});

test("6-A 공개 상태 재검사·서비스 비공개/삭제·조회 실패와 재시도", async ({
  page,
}) => {
  await page.goto("/");
  await login(page);
  await studioFixture(page);
  await page.getByRole("link", { name: "작품", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("article").getByRole("link").first().click();
  await expect(page.getByText(/영상 재생을 확인하지 못했어요/)).toBeVisible();
  await page.evaluate(async () => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await session.getToken()}`,
    };
    const s = await fetch("/__mock__/studio", { headers }).then((r) =>
      r.json(),
    );
    await fetch("/__mock__/studio", {
      method: "POST",
      headers,
      body: JSON.stringify({
        revision: s.revision,
        command: { type: "service", public: false },
      }),
    });
  });
  await page.getByRole("button", { name: "최신 공개 상태 확인" }).click();
  await expect(page.getByRole("alert")).toContainText("비공개");
  await navigate(page, "/");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.evaluate(() =>
    fetch("/__mock__/catalog/scenario", { method: "POST", body: "500" }),
  );
  await page.getByRole("button", { name: "최신 공개 상태 확인" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.evaluate(() =>
    fetch("/__mock__/catalog/scenario", { method: "POST", body: "success" }),
  );
  await page.getByRole("button", { name: "최신 공개 상태 확인" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
