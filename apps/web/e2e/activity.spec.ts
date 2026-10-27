import { test, expect } from "@playwright/test";
import { login, navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";
import { activityViewSchema } from "../src/mocks/activity-model";

test("7-A 메뉴→모집 저장→본인 목록·추천·역할 제한·재조회", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await navigate(page, "/campaigns/00000000-0000-4000-8000-000000000001");
  await page.getByRole("button", { name: "캠페인 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "캠페인 저장 해제", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "저장 목록 확인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "저장한 캠페인", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /모의 제품 소개 영상 1/ }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "저장 해제", exact: true }).click();
  await expect(
    page.getByText("저장한 캠페인이 없어요.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "추천 캠페인", exact: true })
    .click();
  await expect(
    page.getByText("추천 정보가 부족해요. 프로필 분야를 먼저 입력해 주세요."),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "내 활동", exact: true })
    .click();
  await expect(page.getByText("진행 중인 의뢰가 없어요.")).toBeVisible();
  await login(page, "client");
  await navigate(page, "/me/activity");
  await expect(
    page.getByRole("heading", { name: "내 모집·초안" }),
  ).toBeVisible();
  await navigate(page, "/bookmarks");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
});

test("7-A 위조·중복·계정 변경·프로필 추천 이유·조회 오류", async ({ page }) => {
  await page.goto("/");
  await login(page);
  const id = "00000000-0000-4000-8000-000000000001";
  expect(
    (await deliveryRequest(page, "/__mock__/activity", undefined, true)).status,
  ).toBe(401);
  const saved = await Promise.all([
    deliveryRequest(page, "/__mock__/activity", { id, saved: true }),
    deliveryRequest(page, "/__mock__/activity", { id, saved: true }),
  ]);
  expect(saved.map((r) => r.status)).toEqual([200, 200]);
  expect(activityViewSchema.parse(saved[1]?.data).savedIds).toEqual([id]);
  expect(
    (
      await deliveryRequest(page, "/__mock__/activity", {
        id,
        saved: true,
        userId: "other",
      })
    ).status,
  ).toBe(400);
  await page.evaluate(async () => {
    const mod = "/src/shared/api/client.ts";
    const { api } = await import(mod);
    await api.patch("/api/profiles/me", { niche: "LIFESTYLE" });
  });
  await navigate(page, "/recommendations");
  await expect(
    page.getByText(/프로필 분야 생활 · 제품·서비스에 같은 표현 포함/).first(),
  ).toBeVisible();
  await page.evaluate(() =>
    fetch("/__mock__/activity/scenario", { method: "POST", body: "500" }),
  );
  await page.getByRole("button", { name: "활동 다시 확인" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "활동 응답을 확인하지 못했어요.",
  );
  await expect(
    page.getByText(/프로필 분야 생활 · 제품·서비스에 같은 표현 포함/),
  ).toHaveCount(0);
  await page.evaluate(() =>
    fetch("/__mock__/activity/scenario", { method: "POST", body: "success" }),
  );
  await page.getByRole("button", { name: "활동 다시 확인" }).click();
  await expect(
    page.getByText(/프로필 분야 생활 · 제품·서비스에 같은 표현 포함/).first(),
  ).toBeVisible();
  await login(page, "client");
  expect(
    (await deliveryRequest(page, "/__mock__/activity", { id, saved: false }))
      .status,
  ).toBe(403);
  expect(
    activityViewSchema.parse(
      (await deliveryRequest(page, "/__mock__/activity")).data,
    ).savedIds,
  ).toEqual([]);
});
