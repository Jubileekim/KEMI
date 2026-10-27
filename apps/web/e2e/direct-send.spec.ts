import { test, expect } from "@playwright/test";
import { login, navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";

async function fillDirect(page: import("@playwright/test").Page) {
  await page
    .getByLabel("의뢰 제목", { exact: true })
    .fill("6단계 직접 영상 의뢰");
  await page
    .getByLabel("제작 브리프", { exact: true })
    .fill("개인 프로젝트의 차분한 소개 영상");
  await page
    .getByLabel("희망 조건", { exact: true })
    .fill("일정과 사용권은 함께 협의해요");
  await page
    .getByRole("button", { name: "의뢰 내용 검토", exact: true })
    .click();
}
test("6-B 비회원 피드→영상→제작자→패키지→로그인 복귀→개인 의뢰 발송", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("article").first().getByRole("link").first().click();
  await page.getByRole("link", { name: "제작자·공개 패키지 보기" }).click();
  await page.getByRole("link", { name: "로그인하고 이 패키지로 의뢰" }).click();
  await expect(page).toHaveURL(/login\?returnTo=/);
  await page.getByLabel("이메일 (필수)").fill("client@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(page).toHaveURL(
    /creators\/mock-creator\/request\?packageId=sample-package$/,
  );
  await fillDirect(page);
  await expect(page.getByRole("dialog")).toContainText("48시간");
  await page
    .getByRole("button", { name: "모의 직접 의뢰 발송", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "내 의뢰에서 발송 결과 확인" }).click();
  await expect(page.getByRole("article")).toContainText("직접 의뢰");
  await expect(page.getByRole("article")).toContainText("계약 미확정");
  await expect(page.getByRole("article")).toContainText(
    "발송 당시 패키지: 브랜드 영상 편집",
  );
  await expect(page.getByRole("article")).toContainText("48시간");
  await expect(
    page.getByRole("link", { name: "대화·작업 공간 열기" }),
  ).toHaveCount(0);
});

test("6-B 응답 유실 같은ID 복구·타 패키지/역할·Bearer·지연 로그아웃 차단", async ({
  page,
}) => {
  await page.goto("/");
  await login(page, "client");
  await navigate(
    page,
    "/creators/mock-creator/request?packageId=sample-package",
  );
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", {
      method: "POST",
      body: "lost-response",
    }),
  );
  await fillDirect(page);
  await page
    .getByRole("button", { name: "모의 직접 의뢰 발송", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText("입력");
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", { method: "POST", body: "success" }),
  );
  await page
    .getByRole("button", { name: "같은 발송 다시 확인", exact: true })
    .click();
  await page.getByRole("link", { name: "내 의뢰에서 발송 결과 확인" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await navigate(page, "/creators/mock-creator/request?packageId=foreign");
  await expect(page.getByRole("alert")).toContainText(
    "공개 패키지를 확인할 수 없어요",
  );
  await navigate(
    page,
    "/creators/mock-creator/request?packageId=sample-package",
  );
  await fillDirect(page);
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", { method: "POST", body: "delay" }),
  );
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/__mock__/direct") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "모의 직접 의뢰 발송", exact: true })
    .click();
  await page.keyboard.press("Escape");
  // The modal keeps busy writes isolated; use existing session logout API to race the handler.
  await page.evaluate(async () => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    await session.logout();
  });
  expect((await response).status()).toBe(401);
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", { method: "POST", body: "success" }),
  );
  await login(page);
  await navigate(
    page,
    "/creators/mock-creator/request?packageId=sample-package",
  );
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  expect((await deliveryRequest(page, "/__mock__/direct", {})).status).toBe(
    403,
  );
  const forged = await page.evaluate(() =>
    fetch("/__mock__/direct", {
      method: "POST",
      headers: {
        Authorization: "Bearer forged",
        "Content-Type": "application/json",
      },
      body: "{}",
    }).then((r) => r.status),
  );
  expect(forged).toBe(401);
});
