import { test, expect } from "@playwright/test";
import {
  confirm,
  setupPayment,
  paymentScenario,
  paymentCommand,
} from "./payments-helpers";
import { login, navigate } from "./proposal-helpers";

test("3-C 공개 제안 통합: 조건·서명·계약 전액·성공·양측 재조회·같은 방", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const products: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(contracts|payments|signatures)/.test(r.url()))
      products.push(r.url());
  });
  const { contractId, room } = await setupPayment(page);
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공 · 모의 검증 확인",
  );
  const orderId = new URL(page.url()).searchParams.get("orderId");
  const view = await paymentCommand(page, contractId);
  expect(view.data.orders).toHaveLength(1);
  expect(
    (await paymentCommand(page, contractId, { type: "verify", id: orderId }))
      .status,
  ).toBe(200);
  expect(
    (
      await paymentCommand(page, contractId, {
        type: "create",
        id: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  await navigate(
    page,
    `/payments/result?contractId=${contractId}&orderId=${orderId}&amount=1&success=false&paymentKey=forged`,
  );
  await page
    .getByRole("button", { name: "기존 결제 재조회", exact: true })
    .click();
  await expect(page.getByLabel("현재 결제 결과")).toContainText("100,000원");
  await [320, 390, 600, 768, 1024, 1280].reduce(async (prev, width) => {
    await prev;
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
  if (process.env.KEMI_CAPTURE_DIR) {
    const width = info.project.name === "chromium" ? 1280 : 390;
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("테스트 결제", { exact: true }).screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/payments-${width}.png`,
    });
  }
  await page
    .getByRole("link", { name: "같은 작업 공간으로 돌아가기", exact: true })
    .click();
  await expect(page).toHaveURL(`/workspace/${room}`);
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await page
    .getByRole("link", { name: "테스트 결제 내역 확인 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공",
  );
  await navigate(
    page,
    `/payments/result?contractId=${contractId}&orderId=${orderId}`,
  );
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공",
  );
  expect(
    (
      await paymentCommand(page, contractId, {
        type: "create",
        id: crypto.randomUUID(),
      })
    ).status,
  ).toBe(403);
  await navigate(page, `/contracts/${contractId}/payment`);
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(products).toEqual([]);
});

test("3-C 금액 불일치·불명확은 새 주문 차단, 기존 주문 조회로만 확정", async ({
  page,
}) => {
  const { contractId } = await setupPayment(page);
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await paymentScenario(page, "mismatch");
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(page.getByLabel("현재 결제 결과")).toContainText("결과 확인 중");
  const orderId = new URL(page.url()).searchParams.get("orderId");
  await navigate(page, `/contracts/${contractId}/payment`);
  await expect(page.getByLabel("현재 결제 결과")).toContainText("결과 확인 중");
  await expect(
    page.getByRole("button", { name: "새 테스트 주문 만들기", exact: true }),
  ).toHaveCount(0);
  expect(
    (
      await paymentCommand(page, contractId, {
        type: "create",
        id: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  await paymentScenario(page, "success");
  await paymentCommand(page, contractId, { type: "verify", id: orderId });
  expect((await paymentCommand(page, contractId)).data.orders[0].status).toBe(
    "UNKNOWN",
  );
  await paymentScenario(page, "settled");
  await page
    .getByRole("button", { name: "기존 결제 재조회", exact: true })
    .click();
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공",
  );
  expect((await paymentCommand(page, contractId)).data.orders).toHaveLength(1);
});

test("3-C 주문 생성·승인 응답 유실: 재조회/같은 ID 재시도, 중복 주문 없음", async ({
  page,
}) => {
  const { contractId } = await setupPayment(page);
  await paymentScenario(page, "lost-response");
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "같은 요청 재시도", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "테스트 주문 만들기", exact: true }),
  ).toBeDisabled();
  await paymentScenario(page, "success");
  await page
    .getByRole("button", { name: "같은 요청 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await paymentScenario(page, "lost-response");
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(
    page.getByRole("button", { name: "같은 요청 재시도", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("현재 결제 결과")).toContainText("결과 확인 중");
  await paymentScenario(page, "success");
  await page
    .getByRole("button", { name: "기존 결제 재조회", exact: true })
    .click();
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 성공",
  );
  await expect(
    page.getByRole("button", { name: "같은 요청 재시도", exact: true }),
  ).toHaveCount(0);
  expect((await paymentCommand(page, contractId)).data.orders).toHaveLength(1);
});

test("3-C 확정 실패·취소 후 명시적 재시도, 이전 주문 재승인·URL 위조 차단", async ({
  page,
}) => {
  const { contractId } = await setupPayment(page);
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await paymentScenario(page, "failed");
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 실패",
  );
  const firstId = new URL(page.url()).searchParams.get("orderId");
  await navigate(page, `/contracts/${contractId}/payment`);
  await confirm(page, "새 테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  await paymentScenario(page, "cancel");
  await confirm(page, "Mock 테스트 결제 진행");
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 취소",
  );
  await paymentScenario(page, "success");
  await paymentCommand(page, contractId, { type: "verify", id: firstId });
  await navigate(
    page,
    `/payments/result?contractId=${contractId}&orderId=${firstId}&success=true&amount=1`,
  );
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 실패",
  );
  expect((await paymentCommand(page, contractId)).data.orders).toHaveLength(2);
  await navigate(
    page,
    `/payments/result?contractId=${contractId}&orderId=${crypto.randomUUID()}&success=true`,
  );
  await expect(
    page.getByText(
      "이 계약에서 해당 주문을 찾지 못했어요. 성공 여부를 확인할 수 없어요.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("현재 결제 결과")).toHaveCount(0);
});

test("3-C 잘못된 계약·본문·Bearer, 지연 로그아웃·타인 조회 차단", async ({
  page,
}) => {
  const { contractId, room } = await setupPayment(page);
  expect((await paymentCommand(page, room)).status).toBe(404);
  expect((await paymentCommand(page, crypto.randomUUID())).status).toBe(404);
  expect(
    (
      await paymentCommand(page, contractId, {
        type: "create",
        id: crypto.randomUUID(),
        amount: 1,
      })
    ).status,
  ).toBe(400);
  expect(
    await page.evaluate(
      async (id) => (await fetch(`/__mock__/payments/${id}`)).status,
      contractId,
    ),
  ).toBe(401);
  await paymentScenario(page, "delay");
  const pending = page.waitForResponse(
    (r) =>
      r.url().includes(`/__mock__/payments/${contractId}`) &&
      r.request().method() === "POST",
  );
  await confirm(page, "테스트 주문 만들기");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  expect((await pending).status()).toBe(401);
  await login(page, "client");
  await paymentScenario(page, "success");
  expect((await paymentCommand(page, contractId)).data.orders).toHaveLength(0);
  // Distinct authenticated client has no access to the contract.
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("다른 의뢰인");
  await page.getByLabel("이메일 (필수)").fill("other-pay@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL("/me/profile");
  expect((await paymentCommand(page, contractId)).status).toBe(404);
  await navigate(
    page,
    `/payments/result?contractId=${contractId}&success=true`,
  );
  await expect(page.getByRole("alert")).toContainText(
    "결과를 확인하지 못했어요",
  );
  await expect(page.getByText("고정 계약 금액:", { exact: false })).toHaveCount(
    0,
  );
});

test("3-C 조회 오류·malformed는 성공 숨김·재조회, 새로고침 메모리 경계", async ({
  page,
}) => {
  const { contractId } = await setupPayment(page);
  await confirm(page, "테스트 주문 만들기");
  await expect(
    page.getByRole("button", { name: "Mock 테스트 결제 진행", exact: true }),
  ).toBeEnabled();
  const view = await paymentCommand(page, contractId);
  const orderId = view.data.orders[0].id;
  await navigate(
    page,
    `/payments/result?contractId=${contractId}&orderId=${orderId}&success=true&paymentKey=forged`,
  );
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 전",
  );
  await ["401", "403", "409", "500", "network", "malformed"].reduce(
    async (prev, value) => {
      await prev;
      await paymentScenario(page, value);
      await page
        .getByRole("button", { name: "기존 결제 재조회", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "결과를 확인하지 못했어요",
      );
      await expect(page.getByLabel("현재 결제 결과")).toHaveCount(0);
    },
    Promise.resolve(),
  );
  await paymentScenario(page, "success");
  await page
    .getByRole("button", { name: "기존 결제 재조회", exact: true })
    .click();
  await expect(page.getByLabel("현재 결제 결과")).toContainText(
    "테스트 결제 전",
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "결과를 확인하지 못했어요",
  );
  await expect(page.getByLabel("현재 결제 결과")).toHaveCount(0);
});
