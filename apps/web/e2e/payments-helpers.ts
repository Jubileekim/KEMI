import { expect, type Page } from "@playwright/test";
import {
  publish,
  submitProposal,
  discuss,
  login,
  navigate,
} from "./proposal-helpers";

export async function confirm(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page
    .getByRole("button", { name: `${label} 확정`, exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
export async function setupPayment(page: Page, amount = 100000) {
  await page.goto("/campaigns");
  const campaignId = await publish(page);
  await submitProposal(page, campaignId);
  await discuss(page, campaignId);
  const room = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await page
    .getByRole("button", { name: "패키지 값 불러오기", exact: true })
    .click();
  await page.getByLabel("취소 조건", { exact: true }).fill("제작 전 상호 협의");
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill(String(amount));
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "서명 요청", exact: true }),
  ).toBeEnabled();
  await confirm(page, "서명 요청");
  await page.getByLabel("Mock 서명 이름 (최대 100자)").fill("의뢰인");
  await page.getByLabel("표시된 동일 버전의 최종 조건에 동의해요").check();
  await confirm(page, "동의하고 서명하기");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "1/2명 서명",
  );
  await expect(
    page.getByRole("link", {
      name: "전액 테스트 결제 확인 (Mock)",
      exact: true,
    }),
  ).toHaveCount(0);
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await page.getByLabel("Mock 서명 이름 (최대 100자)").fill("크리에이터");
  await page.getByLabel("표시된 동일 버전의 최종 조건에 동의해요").check();
  await confirm(page, "동의하고 서명하기");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "2/2명 서명",
  );
  await login(page, "client");
  await navigate(page, `/workspace/${room}`);
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
  return { room, contractId, campaignId };
}
export async function paymentScenario(page: Page, value: string) {
  await page.evaluate(async (body) => {
    await fetch("/__mock__/payments/scenario", { method: "POST", body });
  }, value);
}
export async function paymentCommand(
  page: Page,
  contractId: string,
  command?: object,
) {
  return page.evaluate(
    async ({ id, cmd }) => {
      const path = "/src/app/session.ts";
      const { session } = await import(path);
      const response = await fetch(`/__mock__/payments/${id}`, {
        method: cmd ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${await session.getToken()}`,
          "Content-Type": "application/json",
        },
        body: cmd ? JSON.stringify(cmd) : undefined,
      });
      return { status: response.status, data: await response.json() };
    },
    { id: contractId, cmd: command },
  );
}
