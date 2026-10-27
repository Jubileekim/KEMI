import { test, expect } from "@playwright/test";
import { login, navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";
import {
  setupCancellation,
  proposeCancellation,
  confirmCancellation,
  resolutionView,
  resolutionPath,
  resolutionScenario,
} from "./cancellation-helpers";

test.setTimeout(90_000);
test("5-A: 기존 계약 링크→요청→양측 동일 버전 확인, 요청만으로 정산·수령 불가", async ({
  page,
}) => {
  const { contractId, room } = await setupCancellation(page);
  await proposeCancellation(page);
  let view = await resolutionView(page, contractId);
  expect(view.state.versions.at(-1)?.refund).toBe(60000);
  await confirmCancellation(page);
  await expect(page.getByLabel("취소 합의 버전")).toContainText(
    "양측 확인 1/2",
  );
  await navigate(page, `/contracts/${contractId}/settlement`);
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "정산 보류",
  );
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await page
    .getByRole("link", { name: "취소 요청·합의 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("취소 합의 버전")).toContainText(
    "광고 1회 사용",
  );
  await confirmCancellation(page);
  await expect(page.getByLabel("취소 합의 버전")).toContainText(
    "양측 확인 2/2",
  );
  view = await resolutionView(page, contractId);
  expect(view.state.versions).toHaveLength(1);
  expect(view.state.versions[0]?.confirmations).toEqual([
    "mock-client",
    "mock-creator",
  ]);
  expect(
    (await deliveryRequest(page, `/__mock__/settlements/${contractId}`)).data,
  ).toMatchObject({ record: null });
});
test("5-A: 구버전·동의 변조·다른 계약·응답 유실 재조회와 중복 차단", async ({
  page,
}) => {
  const { contractId } = await setupCancellation(page);
  await proposeCancellation(page);
  const first = await resolutionView(page, contractId);
  await confirmCancellation(page);
  await expect(page.getByLabel("취소 합의 버전")).toContainText("1/2");
  await proposeCancellation(page, "30000");
  const current = await resolutionView(page, contractId);
  expect(current.state.versions.at(-1)?.confirmations).toEqual([]);
  const cmd = {
    type: "confirm",
    id: crypto.randomUUID(),
    revision: current.state.revision,
    versionId: first.state.versions[0]?.id,
    consent: true,
  };
  expect(
    (await deliveryRequest(page, resolutionPath(contractId), cmd)).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(page, resolutionPath(contractId), {
        ...cmd,
        consent: false,
      })
    ).status,
  ).toBe(400);
  expect(
    (await deliveryRequest(page, resolutionPath(crypto.randomUUID()))).status,
  ).toBe(404);
  await resolutionScenario(page, "lost-response");
  await confirmCancellation(page);
  await expect(
    page.getByRole("button", { name: "같은 취소 요청 재시도" }),
  ).toBeVisible();
  await resolutionScenario(page, "success");
  await page
    .getByRole("button", { name: "취소 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("취소 합의 버전")).toContainText("1/2");
  expect((await resolutionView(page, contractId)).state.versions).toHaveLength(
    2,
  );
  await resolutionScenario(page, "500");
  await page
    .getByRole("button", { name: "취소 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("취소 합의 버전")).toHaveCount(0);
  await resolutionScenario(page, "success");
  await page
    .getByRole("button", { name: "취소 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("취소 합의 버전")).toContainText(
    "광고 1회 사용",
  );
});
