import { test, expect } from "@playwright/test";
import { setupSettlement, settlementScenario } from "./settlement-helpers";
import { deliveryRequest } from "./delivery-helpers";
import { login, navigate } from "./proposal-helpers";
import {
  notificationsViewSchema,
  reviewViewSchema,
} from "../src/mocks/engagement-model";

test.setTimeout(90000);
test("7-B 정상 거래→부재중 알림→읽음/중복→완료 리뷰 양측·본인만 조회", async ({
  page,
}) => {
  const { contractId } = await setupSettlement(page);
  await navigate(page, `/contracts/${contractId}/review`);
  await expect(page.getByText(/정상 수령 완료 거래만 가능해요/)).toBeVisible();
  await navigate(page, `/contracts/${contractId}/settlement`);
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toBeVisible();
  await navigate(page, "/me/activity");
  await page.getByRole("link", { name: "완료 거래 리뷰", exact: true }).click();
  await page.getByLabel("리뷰 내용 (필수)").fill("성실하게 작업했어요.");
  await page.getByLabel("태그 (선택·쉼표로 구분)").fill("소통,일정");
  await page.evaluate(() =>
    fetch("/__mock__/engagement/scenario", {
      method: "POST",
      body: "lost-response",
    }),
  );
  await page
    .getByRole("button", { name: "상대방 리뷰 작성", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "리뷰 응답을 확인하지 못했어요.",
  );
  await expect(page.getByLabel("리뷰 내용 (필수)")).toHaveValue(
    "성실하게 작업했어요.",
  );
  await page.evaluate(() =>
    fetch("/__mock__/engagement/scenario", { method: "POST", body: "success" }),
  );
  await page.getByRole("button", { name: "리뷰 상태 다시 확인" }).click();
  await expect(page.getByLabel("내 리뷰", { exact: true })).toContainText(
    "성실하게 작업했어요.",
  );
  const input = {
    rating: 5,
    content: "성실하게 작업했어요.",
    tags: ["소통", "일정"],
  };
  expect(
    (await deliveryRequest(page, `/__mock__/reviews/${contractId}`, input))
      .status,
  ).toBe(200);
  expect(
    (
      await deliveryRequest(page, `/__mock__/reviews/${contractId}`, {
        ...input,
        rating: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(
        page,
        `/__mock__/reviews/${contractId}`,
        undefined,
        true,
      )
    ).status,
  ).toBe(401);
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: /^알림 ·/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "알림", exact: true }),
  ).toBeVisible();
  const first = notificationsViewSchema.parse(
    (await deliveryRequest(page, "/__mock__/notifications")).data,
  );
  expect(first.unreadCount).toBeGreaterThan(0);
  const again = notificationsViewSchema.parse(
    (await deliveryRequest(page, "/__mock__/notifications")).data,
  );
  expect(again.items.map((n) => n.id)).toEqual(first.items.map((n) => n.id));
  expect(
    (await deliveryRequest(page, "/__mock__/notifications", { ids: ["other"] }))
      .status,
  ).toBe(404);
  await page
    .getByRole("button", {
      name: "미확인 알림 읽음 처리 (최대 200개)",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "주 메뉴" })
      .getByRole("link", { name: "알림 · 0", exact: true }),
  ).toBeVisible();
  expect(
    (
      await deliveryRequest(page, "/__mock__/notifications", {
        ids: first.items.map((n) => n.id),
      })
    ).status,
  ).toBe(200);
  await login(page);
  await navigate(page, `/contracts/${contractId}/review`);
  await expect(page.getByLabel("리뷰 내용 (필수)")).toBeVisible();
  await expect(
    page.getByText("성실하게 작업했어요.", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("리뷰 내용 (필수)").fill("요청을 명확히 전달했어요.");
  await page
    .getByRole("button", { name: "상대방 리뷰 작성", exact: true })
    .click();
  await expect(page.getByLabel("내 리뷰", { exact: true })).toContainText(
    "요청을 명확히 전달했어요.",
  );
  const own = reviewViewSchema.parse(
    (await deliveryRequest(page, `/__mock__/reviews/${contractId}`)).data,
  );
  expect(own.own?.authorId).toBe("mock-creator");
});
test("7-B 수령 완료만으로는 리뷰 불가, 정산 실패·UNKNOWN에도 차단", async ({ page }) => {
  const { contractId } = await setupSettlement(page);
  const url = `/__mock__/reviews/${contractId}`;
  const review = { rating: 5, content: "정산 전 작성 시도", tags: [] };
  await navigate(page, `/contracts/${contractId}/review`);
  await expect(page.getByLabel("리뷰 내용 (필수)")).toHaveCount(0);
  expect((await deliveryRequest(page, url, review)).status).toBe(409);
  await navigate(page, `/contracts/${contractId}/settlement`);
  await settlementScenario(page, "failed");
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "모의 정산 실패",
  );
  expect((await deliveryRequest(page, url, review)).status).toBe(409);
  await settlementScenario(page, "unknown");
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "모의 정산 결과 확인 중",
  );
  expect((await deliveryRequest(page, url, review)).status).toBe(409);
});

test("7-B 미완료 리뷰·잘못된 대상·조회 실패·입력 보존", async ({ page }) => {
  const { contractId } = await setupSettlement(page, false);
  await navigate(page, `/contracts/${contractId}/review`);
  await expect(page.getByText(/정상 수령 완료 거래만 가능해요/)).toBeVisible();
  await expect(page.getByLabel("리뷰 내용 (필수)")).toHaveCount(0);
  expect(
    (
      await deliveryRequest(page, `/__mock__/reviews/${contractId}`, {
        rating: 5,
        content: "bad",
        tags: [],
      })
    ).status,
  ).toBe(409);
  await navigate(page, "/notifications");
  await page.evaluate(() =>
    fetch("/__mock__/engagement/scenario", { method: "POST", body: "500" }),
  );
  await page.getByRole("button", { name: "알림 다시 확인" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "알림 응답을 확인하지 못했어요.",
  );
  await expect(
    page.getByRole("button", { name: "이 알림 읽음 처리", exact: true }),
  ).toHaveCount(0);
});
