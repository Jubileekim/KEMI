import { expect, type Page } from "@playwright/test";
import { setupPayment, confirm } from "./payments-helpers";
import { setupDirectPayment } from "./direct-helpers";
import { navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";
import { resolutionViewSchema } from "../src/mocks/resolution-model";

export const resolutionPath = (id: string) => `/__mock__/resolution/${id}`;
export async function resolutionView(page: Page, id: string) {
  return resolutionViewSchema.parse(
    (await deliveryRequest(page, resolutionPath(id))).data,
  );
}
export async function resolutionScenario(page: Page, value: string) {
  await page.evaluate(async (body) => {
    await fetch("/__mock__/resolution/scenario", { method: "POST", body });
  }, value);
}
export async function setupCancellation(
  page: Page,
  amount = 100000,
  source = "public",
) {
  const result =
    source === "direct"
      ? await setupDirectPayment(page, amount)
      : await setupPayment(page, amount);
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공",
  );
  await navigate(page, `/workspace/${result.room}`);
  await page
    .getByRole("link", { name: "취소 요청·합의 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("취소 요청 작성")).toBeVisible();
  return result;
}
export async function proposeCancellation(page: Page, compensation = "40000") {
  await page
    .getByLabel("취소 사유", { exact: true })
    .fill("일정 변경으로 협의 요청");
  await page
    .getByLabel("현재 진행 내역", { exact: true })
    .fill("편집 일부 완료");
  await page
    .getByLabel("인도할 파일 목록·규격", { exact: true })
    .fill(compensation === "0" ? "인도 파일 없음" : "현재 작업본 ZIP 1개");
  await page
    .getByLabel("미완성 작업 처리", { exact: true })
    .fill("잔여 작업 중단");
  await page
    .getByLabel("촬영 원본·프로젝트 인도 조건", { exact: true })
    .fill(compensation === "0" ? "인도 대상 없음" : "ZIP에 포함");
  await page
    .getByLabel("사용권·이용 범위", { exact: true })
    .fill(compensation === "0" ? "사용권 부여 없음" : "광고 1회 사용");
  await page
    .getByLabel("희망 완료 대가 (원)", { exact: true })
    .fill(compensation);
  await page
    .getByRole("button", { name: "새 취소 조건 제안 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("취소 합의 버전")).toContainText(
    "양측 확인 0/2",
  );
}
export async function confirmCancellation(page: Page) {
  await page
    .getByLabel("표시된 동일 버전의 금액·파일·원본·사용권에 동의해요")
    .check();
  await page
    .getByRole("button", { name: "이 취소 버전 확인 (Mock)", exact: true })
    .click();
}
