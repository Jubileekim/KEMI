import { expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { login, navigate } from "./proposal-helpers";
import { prepareVideo, deliveryRequest } from "./delivery-helpers";
import { setupPayment, confirm } from "./payments-helpers";
import { setupDirectPayment } from "./direct-helpers";
import { settlementViewSchema } from "../src/mocks/settlement-model";

export const settlementPath = (id: string) => `/__mock__/settlements/${id}`;
export async function settlementView(page: Page, id: string) {
  return settlementViewSchema.parse(
    (await deliveryRequest(page, settlementPath(id))).data,
  );
}
export async function settlementScenario(page: Page, value: string) {
  await page.evaluate(async (body) => {
    await fetch("/__mock__/settlements/scenario", { method: "POST", body });
  }, value);
}
export async function setupSettlement(
  page: Page,
  receive = true,
  source = "public",
) {
  const result =
    source === "direct"
      ? await setupDirectPayment(page)
      : await setupPayment(page);
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공 · 모의 검증 확인",
  );
  await navigate(page, `/contracts/${result.contractId}/production`);
  await page.getByLabel("제품 필수", { exact: true }).uncheck();
  await page.getByLabel("필수 파일 필수", { exact: true }).uncheck();
  await page.getByLabel("병행 정보 필수", { exact: true }).uncheck();
  await page
    .getByRole("button", { name: "Mock 준비 조건 제안", exact: true })
    .click();
  await expect(page.getByLabel("구조화 Mock 준비 조건")).toContainText(
    "상대 확인 대기",
  );
  await login(page);
  await navigate(page, `/contracts/${result.contractId}/production`);
  await page
    .getByRole("button", { name: "표시된 Mock 준비 조건 확인", exact: true })
    .click();
  await expect(page.getByLabel("제작 상태")).toContainText("제작 중");
  await page
    .getByRole("link", {
      name: "초안·완성 검토본과 영상 버전 (Mock)",
      exact: true,
    })
    .click();
  await prepareVideo(page);
  await page.getByLabel("제출 종류", { exact: true }).selectOption("REVIEW");
  await page.getByLabel("영상 설명", { exact: true }).fill("4-E 완성 검토본");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await page
    .getByRole("button", { name: "완성 검토본 정식 제출", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v1 · 완성 검토본",
  );
  await login(page, "client");
  await navigate(page, `/contracts/${result.contractId}/deliveries`);
  await page.getByLabel("선택한 검토 버전의 내용을 확인했어요").check();
  await page
    .getByRole("button", { name: "이 검토 버전 승인 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("검토본 승인", { exact: true })).toContainText(
    "검토 승인 기록",
  );
  await login(page);
  await navigate(page, `/contracts/${result.contractId}/deliveries`);
  await page
    .getByLabel("최종 전달 파일", { exact: true })
    .setInputFiles(
      fileURLToPath(new URL("./fixtures/kemi-final.zip", import.meta.url)),
    );
  await page
    .getByLabel("파일별 설명", { exact: true })
    .fill("승인 v1 규격과 일치하는 최종 영상 ZIP");
  await page
    .getByRole("button", { name: "최종 파일 준비 (Mock 업로드)", exact: true })
    .click();
  await expect(
    page.getByLabel("준비한 최종 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
  await page
    .getByLabel("승인 버전과 일치하는 워터마크 없는 최종 파일을 준비했어요")
    .check();
  await page
    .getByLabel("규격·수량과 합의한 원본 등 계약 파일을 모두 준비했어요")
    .check();
  await page
    .getByRole("button", {
      name: "계약 최종 파일 정식 전달 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("전달된 최종 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
  await login(page, "client");
  await navigate(page, `/contracts/${result.contractId}/deliveries`);
  if (receive) {
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "kemi-final.zip 다운로드", exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe("kemi-final.zip");
    await page
      .getByLabel(
        "다운로드한 파일이 승인 내용·계약 조건과 일치하고 미해결 문제가 없어요",
      )
      .check();
    await page
      .getByRole("button", { name: "최종 파일 수령 확인 (Mock)", exact: true })
      .click();
    await expect(
      page.getByLabel("최종 수령 확인", { exact: true }),
    ).toContainText("전용 수령 확인 기록");
  }
  await page
    .getByRole("link", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "정산 상태 재조회", exact: true }),
  ).toBeEnabled();
  return result;
}
