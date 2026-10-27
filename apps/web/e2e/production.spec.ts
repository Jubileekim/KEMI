import { test, expect, type Page } from "@playwright/test";
import { setupPayment, paymentCommand } from "./payments-helpers";
import { login, navigate } from "./proposal-helpers";
import { productionViewSchema } from "../src/mocks/production-model";

async function request(page: Page, id: string, cmd?: object, forged = false) {
  return page.evaluate(
    async ({ contractId, command, bad }) => {
      const path = "/src/app/session.ts";
      const { session } = await import(path);
      const r = await fetch(`/__mock__/production/${contractId}`, {
        method: command ? "POST" : "GET",
        headers: {
          Authorization: bad
            ? "Bearer forged"
            : `Bearer ${await session.getToken()}`,
          "Content-Type": "application/json",
        },
        body: command ? JSON.stringify(command) : undefined,
      });
      return { status: r.status, data: await r.json() };
    },
    { contractId: id, command: cmd, bad: forged },
  );
}
async function view(page: Page, id: string) {
  return productionViewSchema.parse((await request(page, id)).data);
}
async function scenario(page: Page, body: string) {
  await page.evaluate(async (value) => {
    await fetch("/__mock__/production/scenario", {
      method: "POST",
      body: value,
    });
  }, body);
}
async function setup(page: Page, pay = true) {
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
  await navigate(page, `/contracts/${result.contractId}/production`);
  await expect(page.getByLabel("제품·자료 제작 준비")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "준비·납기 재조회", exact: true }),
  ).toBeEnabled();
  return result;
}
async function planAndSupply(page: Page, id: string) {
  await page
    .getByRole("button", { name: "Mock 준비 조건 제안", exact: true })
    .click();
  await expect(page.getByLabel("구조화 Mock 준비 조건")).toContainText(
    "상대 확인 대기",
  );
  await login(page);
  await navigate(page, `/contracts/${id}/production`);
  await page
    .getByRole("button", { name: "표시된 Mock 준비 조건 확인", exact: true })
    .click();
  await expect(page.getByLabel("제품 준비", { exact: true })).toBeVisible();
  await login(page, "client");
  await navigate(page, `/contracts/${id}/production`);
  await page
    .getByLabel("제품 제공·정정 기록 (파일은 자료명만 기록)", { exact: true })
    .fill("샘플 제품 · 정상 발송");
  await page.getByLabel("발송일", { exact: true }).fill("2026-10-01");
  await page.getByLabel("운송장 (선택)").fill("MOCK-TRACKING");
  await page
    .getByRole("button", { name: "제품 발송 등록", exact: true })
    .click();
  await expect(page.getByLabel("제품 준비", { exact: true })).toContainText(
    "MOCK-TRACKING",
  );
  await page
    .getByLabel("필수 파일 제공·정정 기록 (파일은 자료명만 기록)", {
      exact: true,
    })
    .fill("brief.pdf · Mock 자료명");
  await page
    .getByRole("button", { name: "필수 파일 제공 기록", exact: true })
    .click();
  await expect(
    page.getByLabel("필수 파일 준비", { exact: true }),
  ).toContainText("brief.pdf");
  await page
    .getByLabel("병행 정보 제공·정정 기록 (파일은 자료명만 기록)", {
      exact: true,
    })
    .fill("필수 문구·촬영 정보");
  await page
    .getByRole("button", { name: "병행 정보 제공 기록", exact: true })
    .click();
  await expect(
    page.getByLabel("병행 정보 준비", { exact: true }),
  ).toContainText("촬영 정보");
  await login(page);
  await navigate(page, `/contracts/${id}/production`);
}
async function check(page: Page, key: string, ready = true) {
  await page
    .getByLabel(`${key} 확인·문제·정정 사유`, { exact: true })
    .fill(ready ? "정상 확인·누락 없음" : "손상·누락 재확인");
  await page
    .getByRole("button", {
      name: `${key} ${ready ? "정상 확인" : "문제·누락 신고"}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel(`${key} 준비`, { exact: true }).getByRole("heading"),
  ).toContainText(ready ? "정상 준비" : "미완료");
  await expect(
    page.getByRole("button", { name: "준비·납기 재조회", exact: true }),
  ).toBeEnabled();
}

test("4-A 공개 제안 통합: 결제→발송·자료→정상 확인→한 번 시작→정정→양측 납기 승인", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const products: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /\/api\/(production|contracts|payments|materials|deadline)/.test(r.url())
    )
      products.push(r.url());
  });
  const { contractId, room } = await setup(page);
  await planAndSupply(page, contractId);
  await check(page, "제품");
  expect((await view(page, contractId)).state.startedAt).toBeNull();
  await check(page, "필수 파일", false);
  await check(page, "병행 정보");
  await expect(page.getByLabel("제작 상태")).toContainText("제작 시작 전");
  await check(page, "필수 파일");
  await expect(page.getByLabel("제작 상태")).toContainText(
    "제작 중 · 모의 시작 확인",
  );
  const first = await view(page, contractId);
  expect(
    Date.parse(first.state.due ?? "") - Date.parse(first.state.startedAt ?? ""),
  ).toBe(7 * 86400000);
  await check(page, "제품", false);
  await expect(page.getByLabel("제작 상태")).toContainText(
    "시작 후 준비 문제 보류",
  );
  await check(page, "제품");
  const restored = await view(page, contractId);
  expect(restored.state.due).toBe(first.state.due);
  expect(restored.state.startedAt).toBe(first.state.startedAt);
  expect(
    restored.state.history.filter((h) =>
      h.message.includes("모의 제작 시작 1회"),
    ),
  ).toHaveLength(1);
  await page.getByLabel("요청 납기 (한국 시간)").fill("2026-12-20T18:00");
  await page
    .getByLabel("변경 사유", { exact: true })
    .fill("촬영 일정 변경을 상호 확인");
  await page
    .getByRole("button", { name: "납기 변경 요청", exact: true })
    .click();
  await expect(page.getByLabel("납기 변경 이력")).toContainText(
    "상대 응답 대기",
  );
  expect((await view(page, contractId)).state.due).toBe(first.state.due);
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/production`);
  await page
    .getByRole("button", { name: "표시된 납기 변경 승인", exact: true })
    .click();
  await expect(page.getByLabel("납기 변경 이력")).toContainText(
    "양측 승인 · 반영",
  );
  const changed = await view(page, contractId);
  expect(changed.state.due).toBe("2026-12-20T09:00:00.000Z");
  expect(changed.state.originalDue).toBe(first.state.due);
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
    await page.getByLabel("제품·자료 제작 준비").screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/production-${width}.png`,
    });
  }
  await page
    .getByRole("link", { name: "같은 작업 공간으로 돌아가기", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspace/${room}$`));
  await page
    .getByRole("link", { name: "제품·자료 준비와 납기 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("제작 상태")).toContainText("제작 중");
  expect(errors).toEqual([]);
  expect(products).toEqual([]);
});

test("4-A 미결제·위조 필드·권한·알 수 없는 계약·Bearer 차단", async ({
  page,
}) => {
  const { contractId } = await setup(page, false);
  await expect(
    page.getByRole("button", { name: "Mock 준비 조건 제안", exact: true }),
  ).toBeDisabled();
  const cmd = {
    id: crypto.randomUUID(),
    revision: 0,
    action: {
      type: "plan",
      plan: { days: 7, product: true, file: true, info: true },
    },
  };
  expect((await request(page, contractId, cmd)).status).toBe(409);
  expect((await request(page, contractId, { ...cmd, paid: true })).status).toBe(
    400,
  );
  expect((await request(page, contractId, undefined, true)).status).toBe(401);
  expect((await request(page, crypto.randomUUID())).status).toBe(404);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("다른 준비 의뢰인");
  await page.getByLabel("이메일 (필수)").fill("other-production@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL("/me/profile");
  expect((await request(page, contractId)).status).toBe(404);
});

test("4-A 유실·동일 요청·충돌·최신 재조회 후 복구", async ({ page }) => {
  const { contractId } = await setup(page);
  await scenario(page, "lost-response");
  await page
    .getByRole("button", { name: "Mock 준비 조건 제안", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "결과를 확인하지 못했어요",
  );
  await expect(
    page.getByRole("button", { name: "Mock 준비 조건 제안", exact: true }),
  ).toBeDisabled();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "같은 준비 요청 재시도", exact: true })
    .click();
  await expect(page.getByLabel("구조화 Mock 준비 조건")).toContainText(
    "상대 확인 대기",
  );
  await expect(
    page.getByRole("button", { name: "같은 준비 요청 재시도", exact: true }),
  ).toHaveCount(0);
  const { state } = await view(page, contractId);
  expect(state.history).toHaveLength(1);
  const receipt = state.receipts[0];
  if (!receipt) throw new Error("missing receipt");
  const cmd: unknown = JSON.parse(receipt.fingerprint);
  if (!cmd || typeof cmd !== "object") throw new Error("missing command");
  expect((await request(page, contractId, cmd)).status).toBe(200);
  expect(
    (await request(page, contractId, { ...cmd, revision: 55 })).status,
  ).toBe(409);
  expect((await view(page, contractId)).state.history).toHaveLength(1);
});

test("4-A 오류 응답·형식·네트워크·로그아웃 지연·새로고침 복원 금지", async ({
  page,
}) => {
  const { contractId } = await setup(page);
  await ["401", "403", "409", "500", "malformed", "network"].reduce(
    async (prev, value) => {
      await prev;
      await scenario(page, value);
      await page
        .getByRole("button", { name: "준비·납기 재조회", exact: true })
        .click();
      await expect(page.getByRole("alert")).toContainText(
        "결과를 확인하지 못했어요",
      );
      await expect(page.getByLabel("구조화 Mock 준비 조건")).toHaveCount(0);
      await scenario(page, "success");
      await page
        .getByRole("button", { name: "준비·납기 재조회", exact: true })
        .click();
      await expect(page.getByLabel("구조화 Mock 준비 조건")).toBeVisible();
    },
    Promise.resolve(),
  );
  await scenario(page, "delay");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes(`/__mock__/production/${contractId}`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Mock 준비 조건 제안", exact: true })
    .click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  expect((await response).status()).toBe(401);
  await expect(page.getByLabel("제품·자료 제작 준비")).toHaveCount(0);
  await login(page, "client");
  await scenario(page, "success");
  expect((await view(page, contractId)).state.plan).toBeNull();
  await navigate(page, `/contracts/${contractId}/production`);
  await page.reload();
  await expect(page.getByLabel("구조화 Mock 준비 조건")).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "결과를 확인하지 못했어요",
  );
  expect((await request(page, contractId)).status).toBe(404);
});

test("4-A 납기 거절·자기 승인·역할 위조·중복 응답·텍스트 이스케이프", async ({
  page,
}) => {
  const { contractId } = await setup(page);
  const plan = {
    id: crypto.randomUUID(),
    revision: 0,
    action: {
      type: "plan",
      plan: { days: 7, product: false, file: false, info: false },
    },
  };
  expect((await request(page, contractId, plan)).status).toBe(200);
  expect(
    (
      await request(page, contractId, {
        id: crypto.randomUUID(),
        revision: 1,
        action: { type: "agree-plan" },
      })
    ).status,
  ).toBe(403);
  await login(page);
  expect(
    (
      await request(page, contractId, {
        id: crypto.randomUUID(),
        revision: 1,
        action: { type: "supply", key: "file", value: "위조" },
      })
    ).status,
  ).toBe(403);
  const agree = {
    id: crypto.randomUUID(),
    revision: 1,
    action: { type: "agree-plan" },
  };
  expect((await request(page, contractId, agree)).status).toBe(200);
  const original = await view(page, contractId);
  const change = {
    id: crypto.randomUUID(),
    revision: 2,
    action: {
      type: "propose",
      due: "2026-12-21T09:00:00.000Z",
      reason: "<img src=x onerror=window.productionInjected=true>",
    },
  };
  expect((await request(page, contractId, change)).status).toBe(200);
  expect(
    (
      await request(page, contractId, {
        id: crypto.randomUUID(),
        revision: 3,
        action: { type: "respond", changeId: change.id, accept: true },
      })
    ).status,
  ).toBe(409);
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/production`);
  await expect(page.getByLabel("납기 변경 이력")).toContainText(
    change.action.reason,
  );
  await expect(page.getByLabel("납기 변경 이력").locator("img")).toHaveCount(0);
  await page
    .getByRole("button", { name: "납기 변경 거절", exact: true })
    .click();
  await expect(page.getByLabel("납기 변경 이력")).toContainText(
    "거절 · 기존 납기 유지",
  );
  const after = await view(page, contractId);
  expect(after.state.due).toBe(original.state.due);
  expect(
    (
      await request(page, contractId, {
        id: crypto.randomUUID(),
        revision: after.state.revision,
        action: { type: "respond", changeId: change.id, accept: true },
      })
    ).status,
  ).toBe(409);
});
