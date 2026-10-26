import { expect, test } from "@playwright/test";
import type { HealthResponse } from "@kemi/shared";

const healthRoute = (url: URL) => url.pathname === "/health";

// 브라우저 동작 검증용 응답이다. 실제 백엔드·DB 연결 검증을 대신하지 않는다.
const healthyResponse = {
  status: "ok",
  uptimeSeconds: 42,
  timestamp: "2026-10-19T00:00:00.000Z",
} satisfies HealthResponse;

test("초기 화면과 화면 경로가 표시된다", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("작품 피드 | KEMI");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("작품 피드");
  await expect(
    page.getByRole("link", { name: "공개 모집", exact: true }),
  ).toBeVisible();
  const fitsViewport = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fitsViewport).toBe(true);
});

test("없는 경로를 새로고침해도 안내가 표시되고 홈으로 이동한다", async ({
  page,
}) => {
  await page.goto("/missing-page");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "페이지를 찾을 수 없어요",
  );
  await page.getByRole("link", { name: "홈으로", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("작품 피드");
});

test("확인 중에는 중복 클릭을 막고 응답 후 성공을 표시한다", async ({
  page,
}) => {
  let releaseResponse = () => {};
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  await page.context().route(healthRoute, async (route) => {
    await responseGate;
    await route.fulfill({ json: healthyResponse });
  });
  await page.goto("/__dev/health");
  await page.getByRole("button", { name: "API 연결 확인" }).click();
  await expect(page.getByRole("button", { name: "확인 중…" })).toBeDisabled();
  releaseResponse();
  await expect(page.getByRole("status")).toHaveText(
    "API 연결 성공 · 서버 가동 42초",
  );
  await expect(
    page.getByRole("button", { name: "API 연결 확인" }),
  ).toBeEnabled();
});

test("네트워크 실패 후 다시 확인하면 복구된다", async ({ page }) => {
  await page.context().route(healthRoute, (route) => route.abort("failed"));
  await page.goto("/__dev/health");
  await page.getByRole("button", { name: "API 연결 확인" }).click();
  await expect(page.getByRole("status")).toContainText(
    "서버에 연결하지 못했습니다.",
  );
  await page.context().unroute(healthRoute);
  await page
    .context()
    .route(healthRoute, (route) => route.fulfill({ json: healthyResponse }));
  await page.getByRole("button", { name: "API 연결 확인" }).click();
  await expect(page.getByRole("status")).toContainText("API 연결 성공");
});

test("HTML 응답을 서버 연결 성공으로 표시하지 않는다", async ({ page }) => {
  await page.context().route(healthRoute, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html></html>",
    }),
  );
  await page.goto("/__dev/health");
  await page.getByRole("button", { name: "API 연결 확인" }).click();
  await expect(page.getByRole("status")).toContainText(
    "서버 응답을 확인하지 못했습니다.",
  );
});

test("서버의 공통 오류 메시지를 표시한다", async ({ page }) => {
  await page.context().route(healthRoute, (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "잠시 후 다시 시도해주세요.",
        },
      },
    }),
  );
  await page.goto("/__dev/health");
  await page.getByRole("button", { name: "API 연결 확인" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "잠시 후 다시 시도해주세요.",
  );
});
