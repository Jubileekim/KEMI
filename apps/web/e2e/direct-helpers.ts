import { expect, type Page } from "@playwright/test";
import { login, navigate } from "./proposal-helpers";
import { confirm } from "./payments-helpers";

export async function fillDirect(page: Page) {
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
export async function sendDirectRequest(page: Page) {
  await navigate(
    page,
    "/creators/mock-creator/request?packageId=sample-package",
  );
  await fillDirect(page);
  await page
    .getByRole("button", { name: "모의 직접 의뢰 발송", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "내 의뢰에서 발송 결과 확인" }).click();
  await expect(
    page.getByRole("heading", { name: "의뢰 상세", exact: true }),
  ).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
}
export async function setupDirectPayment(page: Page, amount = 100000) {
  await page.goto("/");
  await login(page, "client");
  const room = await sendDirectRequest(page);
  await login(page);
  await page.getByRole("link", { name: "내 제안·협의", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("응답 대기");
  await confirm(page, "직접 의뢰 협의 수락");
  await page
    .getByRole("link", { name: "대화·작업 공간 열기", exact: true })
    .click();
  await expect(page.getByLabel("최종 조건서", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "전액 테스트 결제 확인 (Mock)",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "패키지 값 불러오기", exact: true })
    .click();
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill(String(amount));
  await page.getByLabel("취소 조건", { exact: true }).fill("제작 전 상호 협의");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "서명 요청", exact: true }),
  ).toBeEnabled();
  await confirm(page, "서명 요청");
  await page.getByLabel("Mock 서명 이름 (최대 100자)").fill("제작자");
  await page.getByLabel("표시된 동일 버전의 최종 조건에 동의해요").check();
  await confirm(page, "동의하고 서명하기");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "1/2명 서명",
  );
  await login(page, "client");
  await navigate(page, `/workspace/${room}`);
  await page.getByLabel("Mock 서명 이름 (최대 100자)").fill("의뢰인");
  await page.getByLabel("표시된 동일 버전의 최종 조건에 동의해요").check();
  await confirm(page, "동의하고 서명하기");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "2/2명 서명",
  );
  await page
    .getByRole("link", { name: "전액 테스트 결제 확인 (Mock)", exact: true })
    .click();
  await expect(
    page.getByText(
      `고정 계약 금액: ${amount.toLocaleString("ko-KR")}원 · KRW · 전액`,
      { exact: true },
    ),
  ).toBeVisible();
  const contractId = new URL(page.url()).pathname.split("/").at(-2) ?? "";
  return { room, contractId, campaignId: null };
}
