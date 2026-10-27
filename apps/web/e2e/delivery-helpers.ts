import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";
import { setupPayment, paymentCommand } from "./payments-helpers";
import { login, navigate } from "./proposal-helpers";
import { deliveryViewSchema } from "../src/mocks/delivery-model";

export async function deliveryRequest(
  page: Page,
  path: string,
  command?: object,
  forged = false,
) {
  return page.evaluate(
    async ({ url, cmd, bad }) => {
      const modulePath = "/src/app/session.ts";
      const { session } = await import(modulePath);
      const response = await fetch(url, {
        method: cmd ? "POST" : "GET",
        headers: {
          Authorization: bad
            ? "Bearer forged"
            : `Bearer ${await session.getToken()}`,
          "Content-Type": "application/json",
        },
        body: cmd ? JSON.stringify(cmd) : undefined,
      });
      const type = response.headers.get("content-type") ?? "";
      const data: unknown = type.includes("application/json")
        ? await response.json()
        : null;
      return { status: response.status, data };
    },
    { url: path, cmd: command, bad: forged },
  );
}
export const deliveryPath = (id: string) => `/__mock__/deliveries/${id}`;
export async function deliveryView(page: Page, id: string) {
  return deliveryViewSchema.parse(
    (await deliveryRequest(page, deliveryPath(id))).data,
  );
}
export async function deliveryScenario(page: Page, value: string) {
  await page.evaluate(async (body) => {
    await fetch("/__mock__/deliveries/scenario", { method: "POST", body });
  }, value);
}
export async function setupDelivery(page: Page, prepare = true, pay = true) {
  const result = await setupPayment(page);
  if (pay) {
    const id = crypto.randomUUID();
    expect(
      (await paymentCommand(page, result.contractId, { type: "create", id }))
        .status,
    ).toBe(200);
    expect(
      (await paymentCommand(page, result.contractId, { type: "verify", id }))
        .status,
    ).toBe(200);
  }
  if (prepare) {
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
  }
  await login(page);
  await navigate(page, `/contracts/${result.contractId}/production`);
  if (prepare) {
    await page
      .getByRole("button", { name: "표시된 Mock 준비 조건 확인", exact: true })
      .click();
    await expect(page.getByLabel("제작 상태")).toContainText("제작 중");
  }
  await page
    .getByRole("link", {
      name: "초안·완성 검토본과 영상 버전 (Mock)",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("영상 제출과 버전")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "영상 버전 재조회", exact: true }),
  ).toBeEnabled();
  return result;
}
export async function prepareVideo(page: Page, name = "kemi-watermarked.webm") {
  const bytes = await readFile(
    new URL("./fixtures/kemi-review.webm", import.meta.url),
  );
  await page.getByLabel("검토 영상 파일", { exact: true }).setInputFiles({
    name,
    mimeType: "video/webm",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "영상 준비 (Mock 업로드)", exact: true })
    .click();
  await expect(
    page.getByText(new RegExp(`준비된 파일: ${name}`)),
  ).toBeVisible();
}
export async function shareDraft(page: Page) {
  await prepareVideo(page);
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("초안 방향과 장면을 확인해 주세요.");
  await page
    .getByRole("button", { name: "초안 정식 공유", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText("v1 · 초안");
}
