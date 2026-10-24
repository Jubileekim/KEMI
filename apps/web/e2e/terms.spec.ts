import { test, expect, type Page } from "@playwright/test";
import {
  navigate,
  login,
  publish,
  submitProposal,
  discuss,
} from "./proposal-helpers";

async function setup(page: Page) {
  await page.goto("/campaigns");
  const id = await publish(page);
  await submitProposal(page, id);
  await discuss(page, id);
  const room = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await expect(
    page.getByLabel("최종 금액 (원)", { exact: true }),
  ).toBeEnabled();
  return { campaignId: id, room };
}
async function scenario(page: Page, value: string) {
  await page.evaluate(async (selected) => {
    await fetch("/__mock__/terms/scenario", { method: "POST", body: selected });
  }, value);
}
async function save(page: Page, version: number) {
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `작성본 v${version} · 서명 요청 전` }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "새 작성본 저장", exact: true }),
  ).toBeDisabled();
}
async function current(page: Page, room: string) {
  return page.evaluate(async (id) => {
    const modulePath = "/src/app/session.ts";
    const { session } = await import(modulePath);
    const response = await fetch(`/__mock__/terms/${id}`, {
      headers: { Authorization: `Bearer ${await session.getToken()}` },
    });
    if (!response.ok) throw new Error(`Mock terms GET ${response.status}`);
    return response.json();
  }, room);
}

test("3-A 통합: 패키지 불러오기·최종 값·불완전/새 버전·양측 조회·이전 값·종료 기록", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { room, campaignId } = await setup(page);
  await page
    .getByRole("button", { name: "패키지 값 불러오기", exact: true })
    .click();
  await expect(page.getByLabel("최종 금액 (원)", { exact: true })).toHaveValue(
    "100000",
  );
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("125000");
  await save(page, 1);
  await expect(
    page.getByText("미입력 조건: 취소 조건", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "서명 요청 · 후속 범위", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("취소 조건", { exact: true }).fill("제작 전 상호 협의");
  await save(page, 2);
  await expect(
    page.getByText("이전 값: 미입력", { exact: true }),
  ).toBeVisible();
  const before = await current(page, room);
  expect(before.document.sources.package.price).toBe("100000");
  expect(before.document.versions[0].values.amount).toBe("125000");
  expect(before.document.versions).toHaveLength(2);
  if (process.env.KEMI_CAPTURE_DIR && info.project.name === "chromium") {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page
      .getByLabel("최종 조건서", { exact: true })
      .screenshot({ path: `${process.env.KEMI_CAPTURE_DIR}/terms-1280.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByLabel("최종 조건서", { exact: true })
      .screenshot({ path: `${process.env.KEMI_CAPTURE_DIR}/terms-390.png` });
  }
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await expect(
    page.getByRole("heading", { name: "작성본 v2 · 서명 요청 전" }),
  ).toBeVisible();
  await page.getByLabel("저장된 버전 이력").selectOption("1");
  await expect(page.getByLabel("작성본 v1", { exact: true })).toContainText(
    "미입력",
  );
  await page
    .getByRole("button", { name: "선택 버전을 편집기에 불러오기", exact: true })
    .click();
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("135000");
  await save(page, 3);
  const after = await current(page, room);
  expect(after.document.versions[0]).toEqual(before.document.versions[0]);
  expect(after.document.sources).toEqual(before.document.sources);
  await page
    .getByLabel("메시지 (Mock 최대 4,000자)")
    .fill("조건서 작성본 확인");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(page.getByLabel("메시지 기록")).toContainText(
    "조건서 작성본 확인",
  );
  await page.getByRole("button", { name: "제안 철회", exact: true }).click();
  await page.getByLabel("종료 사유 (필수)").fill("협의 종료");
  await page.getByRole("button", { name: "제안 철회 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByLabel("최종 금액 (원)", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("저장된 버전 이력").locator("option"),
  ).toHaveCount(3);
  await expect(page.getByLabel("메시지 기록")).toContainText(
    "조건서 작성본 확인",
  );
  await login(page, "client");
  await navigate(page, `/campaigns/${campaignId}/proposals`);
  await expect(page.getByRole("article")).toContainText("철회");
  expect(errors).toEqual([]);
});

test("3-A 편집 충돌: 최신 재조회도 입력을 보존하고 명시적 기준 갱신 후 저장", async ({
  page,
}) => {
  const { room } = await setup(page);
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("121000");
  await page.evaluate(async (id) => {
    const modulePath = "/src/app/session.ts";
    const { session } = await import(modulePath);
    const headers = {
      Authorization: `Bearer ${await session.getToken()}`,
      "Content-Type": "application/json",
    };
    const view = await fetch(`/__mock__/terms/${id}`, { headers }).then((r) =>
      r.json(),
    );
    const valuesPath = "/src/mocks/terms-model.ts";
    const { emptyTerms } = await import(valuesPath);
    const response = await fetch(`/__mock__/terms/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        requestId: id,
        revision: 0,
        sources: view.document.sources,
        values: { ...emptyTerms, amount: "122000" },
      }),
    });
    if (!response.ok) throw new Error("concurrent Mock setup failed");
  }, room);
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("저장 충돌");
  await page
    .getByRole("button", { name: "최신 조건서 확인", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "작성본 v1 · 서명 요청 전" }),
  ).toBeVisible();
  await expect(page.getByLabel("최종 금액 (원)", { exact: true })).toHaveValue(
    "121000",
  );
  await expect(
    page.getByRole("button", { name: "새 작성본 저장", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "최신 버전 기준으로 다시 검토", exact: true })
    .click();
  await save(page, 2);
  const view = await current(page, room);
  expect(
    view.document.versions.map(
      (v: { values: { amount: string } }) => v.values.amount,
    ),
  ).toEqual(["122000", "121000"]);
});

test("3-A 응답 유실: 같은 ID 재전송·재조회·중복 방지·텍스트 이스케이프", async ({
  page,
}) => {
  const { room } = await setup(page);
  await page
    .getByLabel("포함·제외 작업 범위", { exact: true })
    .fill("<script>window.termsInjected=true</script>");
  await scenario(page, "lost-response");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 저장 재시도", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("포함·제외 작업 범위", { exact: true }),
  ).toBeDisabled();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "같은 저장 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "작성본 v1 · 서명 요청 전" }),
  ).toBeVisible();
  await expect(page.getByLabel("작성본 v1", { exact: true })).toContainText(
    "<script>",
  );
  expect((await current(page, room)).document.versions).toHaveLength(1);
  expect(
    await page.evaluate(() => Reflect.get(window, "termsInjected")),
  ).toBeUndefined();
  await page.getByLabel("취소 조건", { exact: true }).fill("상호 확인");
  await scenario(page, "lost-response");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 저장 재시도", exact: true }),
  ).toBeVisible();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "최신 조건서 확인", exact: true })
    .click();
  await expect(
    page.getByText(
      "저장된 작성본을 재조회해 확인했어요. 중복 저장하지 않아요.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await current(page, room)).document.versions).toHaveLength(2);
});

test("3-A 조회 실패·잘못된 응답·저장 실패 후 수동 회복과 반응형/키보드", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("-1");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByLabel("최종 금액 (원)", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByLabel("최종 금액 (원)", { exact: true }),
  ).toBeFocused();
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("150000");
  await scenario(page, "500");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 저장 재시도", exact: true }),
  ).toBeVisible();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "같은 저장 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "작성본 v1 · 서명 요청 전" }),
  ).toBeVisible();
  await page.getByLabel("규격·수량", { exact: true }).fill("보존할 입력");
  await scenario(page, "malformed");
  await page
    .getByRole("button", { name: "최신 조건서 확인", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("규격·수량", { exact: true })).toBeDisabled();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "최신 조건서 확인", exact: true })
    .click();
  await expect(page.getByLabel("규격·수량", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("규격·수량", { exact: true })).toHaveValue(
    "보존할 입력",
  );
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
});

test("3-A 유실된 응답 이후 새 작성본이 있으면 기준을 자동 갱신하지 않는다", async ({
  page,
}) => {
  const { room } = await setup(page);
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("170000");
  await scenario(page, "lost-response");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 저장 재시도", exact: true }),
  ).toBeVisible();
  await scenario(page, "success");
  await page.evaluate(async (id) => {
    const modulePath = "/src/app/session.ts";
    const { session } = await import(modulePath);
    const headers = {
      Authorization: `Bearer ${await session.getToken()}`,
      "Content-Type": "application/json",
    };
    const { document } = await fetch(`/__mock__/terms/${id}`, { headers }).then(
      (r) => r.json(),
    );
    const response = await fetch(`/__mock__/terms/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: crypto.randomUUID(),
        requestId: id,
        revision: document.revision,
        sources: document.sources,
        values: { ...document.versions[0].values, amount: "180000" },
      }),
    });
    if (!response.ok) throw new Error("second Mock editor failed");
  }, room);
  await page
    .getByRole("button", { name: "같은 저장 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "작성본 v2 · 서명 요청 전" }),
  ).toBeVisible();
  await expect(page.getByLabel("최종 금액 (원)", { exact: true })).toHaveValue(
    "170000",
  );
  await expect(
    page.getByRole("button", {
      name: "최신 버전 기준으로 다시 검토",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "새 작성본 저장", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "최신 버전 기준으로 다시 검토", exact: true })
    .click();
  await save(page, 3);
  expect((await current(page, room)).document.versions).toHaveLength(3);
});

test("3-A 권한·지연 로그아웃: Bearer/타방 차단과 계정 변경 후 저장 취소", async ({
  page,
}) => {
  const { room } = await setup(page);
  const denied = await page.evaluate(async (id) => {
    const modulePath = "/src/app/session.ts";
    const { session } = await import(modulePath);
    const headers = { Authorization: `Bearer ${await session.getToken()}` };
    return Promise.all([
      fetch(`/__mock__/terms/${id}`).then((r) => r.status),
      fetch("/__mock__/terms/10000000-0000-4000-8000-000000000099", {
        headers,
      }).then((r) => r.status),
    ]);
  }, room);
  expect(denied).toEqual([401, 404]);
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("160000");
  await scenario(page, "delay");
  const started = page.waitForRequest(
    (r) => r.url().endsWith(`/__mock__/terms/${room}`) && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await started;
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await login(page);
  await scenario(page, "success");
  await navigate(page, `/workspace/${room}`);
  await expect(
    page.getByLabel("저장된 버전 이력").locator("option"),
  ).toHaveText(["저장된 작성본 없음"]);
  await expect(page.getByLabel("최종 금액 (원)", { exact: true })).toHaveValue(
    "",
  );
});
