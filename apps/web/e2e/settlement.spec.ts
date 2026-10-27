import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { login, navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";
import {
  setupSettlement,
  settlementView,
  settlementScenario,
  settlementPath,
} from "./settlement-helpers";

// Full public-request journeys through 4-E; unchanged assertions/retries in existing suites.
test.setTimeout(90_000);

test("4-E 통합: 공개 제안→서명·결제·준비·승인·최종 전달·수령→정산·양측·확정 사건 링크", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(settle|deliver|final)|supabase|toss/.test(r.url()))
      external.push(r.url());
  });
  const { contractId, room } = await setupSettlement(page);
  const view = await settlementView(page, contractId);
  expect(view.record).toBeNull();
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(
    "90,000원",
  );
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "모의 정산 성공 · 작업 완료",
  );
  const { record } = await settlementView(page, contractId);
  if (!record) throw new Error("missing record");
  expect(record).toMatchObject({
    amount: 100000,
    fee: 10000,
    net: 90000,
    clientFee: 0,
  });
  const cmd = {
    id: record.id,
    revision: view.revision,
    receiptId: view.receiptId,
  };
  const results = await Promise.all([
    deliveryRequest(page, settlementPath(contractId), cmd),
    deliveryRequest(page, settlementPath(contractId), {
      ...cmd,
      id: crypto.randomUUID(),
    }),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  await login(page);
  await navigate(page, `/contracts/${contractId}/production`);
  await page
    .getByRole("link", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(record.id);
  await page
    .getByRole("link", { name: "같은 작업 공간으로 돌아가기", exact: true })
    .click();
  const baseEvents = page.getByLabel("서명·준비 시스템 안내", { exact: true });
  await expect(
    baseEvents.getByRole("link", { name: "조건 버전 서명 확인", exact: true }),
  ).toHaveCount(2);
  await baseEvents
    .getByRole("link", { name: "조건 버전 서명 확인", exact: true })
    .first()
    .click();
  const signatureId = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${signatureId}"]`)).toContainText(
    "2/2명 서명",
  );
  await baseEvents.getByRole("link").last().click();
  const preparationId = new URL(page.url()).hash.slice(1);
  await expect(page.locator(`[id="${preparationId}"]`)).toBeVisible();
  await page
    .getByRole("link", { name: "같은 작업 공간으로 돌아가기", exact: true })
    .click();
  const notices = page.getByLabel("모의 정산 시스템 안내", { exact: true });
  await expect(notices.getByRole("link")).toHaveCount(1);
  await notices.getByRole("button", { name: "정산 안내 재조회" }).click();
  await expect(notices.getByRole("link")).toHaveCount(1);
  await notices.getByRole("link").click();
  await expect(page).toHaveURL(
    new RegExp(`/contracts/${contractId}/settlement\\?settlement=${record.id}`),
  );
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(record.id);
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
  await mkdir("../../qa/frontend-4e", { recursive: true });
  await page.setViewportSize({
    width: info.project.name.includes("mobile") ? 390 : 1280,
    height: 900,
  });
  await page.screenshot({
    path: `../../qa/frontend-4e/settlement-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await navigate(page, `/workspace/${room}`);
  expect(
    (await deliveryRequest(page, `/__mock__/settlement-events/${room}`)).status,
  ).toBe(200);
});

test("4-E: 수령 전·문제 보류·금액 불일치는 정산/성공 안내 없음", async ({
  page,
}) => {
  const { contractId, room } = await setupSettlement(page, false);
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "전용 수령 확인 필요",
  );
  await expect(
    page.getByRole("button", { name: "모의 정산 결과 확인", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await deliveryRequest(page, settlementPath(contractId), {
        id: crypto.randomUUID(),
        revision: 0,
        receiptId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await page.getByLabel("파일 문제·미해결 분쟁 내용").fill("최종 파일 손상");
  await page
    .getByRole("button", {
      name: "파일 문제 신고·수령 보류 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }),
  ).toContainText("파일 문제 보류");
  await page
    .getByRole("link", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "정산 보류",
  );
  await navigate(page, `/workspace/${room}`);
  await expect(
    page.getByLabel("모의 정산 시스템 안내", { exact: true }).getByRole("link"),
  ).toHaveCount(0);
});

test("4-E: 처리 중·결과 확인 중·실패는 미완료, 기존 요청 조정·실패 후 새 요청", async ({
  page,
}) => {
  const { contractId, room } = await setupSettlement(page);
  await settlementScenario(page, "mismatch");
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 정산 요청 재시도" }),
  ).toBeVisible();
  expect((await settlementView(page, contractId)).record).toBeNull();
  await settlementScenario(page, "processing");
  await page.getByRole("button", { name: "같은 정산 요청 재시도" }).click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "모의 정산 처리 중",
  );
  const pending = (await settlementView(page, contractId)).record;
  if (!pending) throw new Error("missing pending");
  expect(
    (
      await deliveryRequest(page, settlementPath(contractId), {
        id: crypto.randomUUID(),
        revision: pending.revision,
        receiptId: pending.receiptId,
      })
    ).status,
  ).toBe(409);
  await settlementScenario(page, "unknown");
  await page
    .getByRole("button", { name: "기존 모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "모의 정산 결과 확인 중",
  );
  expect(
    (await deliveryRequest(page, `/__mock__/settlement-events/${room}`)).data,
  ).toEqual([]);
  await settlementScenario(page, "failed");
  await page
    .getByRole("button", { name: "기존 모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "모의 정산 실패",
  );
  await settlementScenario(page, "held");
  await page
    .getByRole("button", { name: "정산 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "정산 보류",
  );
  await expect(page.getByLabel("확정 모의 정산 내역")).toHaveCount(0);
  await settlementScenario(page, "success");
  await page
    .getByRole("button", { name: "정산 상태 재조회", exact: true })
    .click();
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toBeVisible();
  expect((await settlementView(page, contractId)).record?.id).not.toBe(
    pending.id,
  );
});

test("4-E: 응답 유실·재조회·조회 오류·잘못된 정산 링크·객체 권한·초기화", async ({
  page,
}) => {
  const { contractId, room } = await setupSettlement(page);
  await settlementScenario(page, "lost-response");
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 정산 요청 재시도" }),
  ).toBeVisible();
  await expect(page.getByLabel("확정 모의 정산 내역")).toHaveCount(0);
  await settlementScenario(page, "success");
  await page
    .getByRole("button", { name: "정산 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toBeVisible();
  const { record } = await settlementView(page, contractId);
  if (!record) throw new Error("missing success");
  await ["500", "malformed", "network", "401", "403"].reduce(
    async (previous, scenario) => {
      await previous;
      await settlementScenario(page, scenario);
      await page
        .getByRole("button", { name: "정산 상태 재조회", exact: true })
        .click();
      await expect(
        page.getByText("정산 응답을 확인하지 못했어요.", { exact: false }),
      ).toBeVisible();
      await expect(page.getByLabel("확정 모의 정산 내역")).toHaveCount(0);
    },
    Promise.resolve(),
  );
  await settlementScenario(page, "success");
  await navigate(
    page,
    `/contracts/${contractId}/settlement?settlement=${crypto.randomUUID()}`,
  );
  await page
    .getByRole("button", { name: "정산 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("모의 정산", { exact: true })).toContainText(
    "지정한 정산 기록을 찾을 수 없어요",
  );
  expect(
    (await deliveryRequest(page, settlementPath(contractId), undefined, true))
      .status,
  ).toBe(401);
  expect(
    (await deliveryRequest(page, settlementPath(crypto.randomUUID()))).status,
  ).toBe(404);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("정산 비당사자");
  await page.getByLabel("이메일 (필수)").fill("other-settlement@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page
    .getByRole("button", { name: "가입하고 시작하기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  expect((await deliveryRequest(page, settlementPath(contractId))).status).toBe(
    404,
  );
  expect(
    (await deliveryRequest(page, `/__mock__/settlement-events/${room}`)).status,
  ).toBe(404);
  expect(
    (await deliveryRequest(page, `/__mock__/work-events/${room}`)).status,
  ).toBe(404);
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/settlement`);
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(record.id);
  await settlementScenario(page, "events-error");
  await navigate(page, `/workspace/${room}`);
  const notices = page.getByLabel("모의 정산 시스템 안내", { exact: true });
  await expect(notices).toContainText("정산 안내 조회 실패");
  expect((await settlementView(page, contractId)).record?.id).toBe(record.id);
  await settlementScenario(page, "success");
  await notices.getByRole("button", { name: "정산 안내 재조회" }).click();
  await expect(notices.getByRole("link")).toHaveCount(1);
  await settlementScenario(page, "delay");
  const reading = deliveryRequest(page, settlementPath(contractId));
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  expect((await reading).status).toBe(401);
  await settlementScenario(page, "success");
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/settlement`);
  await page.reload();
  await expect(
    page.getByText("정산 응답을 확인하지 못했어요.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("확정 모의 정산 내역")).toHaveCount(0);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/settlement`);
  await expect(
    page.getByText("정산 응답을 확인하지 못했어요.", { exact: false }),
  ).toBeVisible();
});
