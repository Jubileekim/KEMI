import { test, expect } from "@playwright/test";
import { setupSettlement, settlementView } from "./settlement-helpers";
import { login, navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";
import {
  setupCancellation,
  proposeCancellation,
  resolutionView,
  resolutionPath,
  resolutionScenario,
} from "./cancellation-helpers";

test.setTimeout(120_000);
test("5-C 공개 모집 정상 전체 흐름: 실제 메뉴·서명·결제·준비·검토·파일·수령·정산과 취소 역행 차단", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { contractId, room } = await setupSettlement(page);
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(
    "90,000원",
  );
  expect((await settlementView(page, contractId)).record?.status).toBe(
    "SUCCEEDED",
  );
  await page
    .getByRole("link", { name: "취소 요청·합의 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("취소 협의", { exact: true })).toContainText(
    "완료 후 취소 정책 D13",
  );
  await expect(
    page.getByRole("button", { name: "새 취소 조건 제안 (Mock)", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await deliveryRequest(page, resolutionPath(contractId), {
        type: "propose",
        id: crypto.randomUUID(),
        revision: 0,
        values: {
          reason: "완료 후",
          progress: "완료",
          compensation: 0,
          files: "없음",
          unfinished: "없음",
          originals: "없음",
          rights: "없음",
        },
      })
    ).status,
  ).toBe(409);
  await page
    .getByRole("link", { name: "같은 작업 공간으로 돌아가기", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspace/${room}$`));
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await page
    .getByLabel("모의 정산 시스템 안내", { exact: true })
    .getByRole("link")
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(
    "90,000원",
  );
  expect(errors).toEqual([]);
});
test("5-C 공개 모집 오류 경계: 지연 로그아웃·위조 Bearer·타회원·운영 제한·새로고침 초기화", async ({
  page,
}) => {
  const { contractId } = await setupCancellation(page);
  await proposeCancellation(page);
  const before = await resolutionView(page, contractId);
  const fake = await page.evaluate(async (id) => {
    const response = await fetch(`/__mock__/resolution/${id}`, {
      headers: { Authorization: "Bearer forged" },
    });
    return response.status;
  }, contractId);
  expect(fake).toBe(401);
  await resolutionScenario(page, "delay");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes(`/__mock__/resolution/${contractId}`) &&
      r.request().method() === "POST",
  );
  await page
    .getByLabel("표시된 동일 버전의 금액·파일·원본·사용권에 동의해요")
    .check();
  await page
    .getByRole("button", { name: "이 취소 버전 확인 (Mock)", exact: true })
    .click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  expect((await response).status()).toBe(401);
  await resolutionScenario(page, "success");
  await login(page, "client");
  expect((await resolutionView(page, contractId)).state.revision).toBe(
    before.state.revision,
  );
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  // Another real Mock member through existing signup, not a changed ownership fixture.
  await page.getByRole("link", { name: "회원가입", exact: true }).click();
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page
    .getByLabel("이메일 (필수)")
    .fill(`stranger-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("표시 이름 (필수)").fill("다른 의뢰인");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page
    .getByRole("button", { name: "가입하고 시작하기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  expect((await deliveryRequest(page, resolutionPath(contractId))).status).toBe(
    404,
  );
  await navigate(page, "/ops/disputes");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  await page.reload();
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/cancellation`);
  await expect(page.getByLabel("취소 협의", { exact: true })).toContainText(
    "응답을 확인하지 못했어요",
  );
  await expect(page.getByLabel("취소 합의 버전")).toHaveCount(0);
});
