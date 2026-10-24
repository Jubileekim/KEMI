import { test, expect, type Page } from "@playwright/test";
import {
  publish,
  submitProposal,
  discuss,
  login,
  navigate,
  studioFixture,
} from "./proposal-helpers";

async function setup(page: Page) {
  await page.goto("/campaigns");
  const campaignId = await publish(page);
  await submitProposal(page, campaignId);
  await discuss(page, campaignId);
  const room = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await page
    .getByRole("button", { name: "패키지 값 불러오기", exact: true })
    .click();
  await page.getByLabel("취소 조건", { exact: true }).fill("제작 전 상호 협의");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "서명 요청", exact: true }),
  ).toBeEnabled();
  return { room, campaignId };
}
async function request(page: Page) {
  await page.getByRole("button", { name: "서명 요청", exact: true }).click();
  await page
    .getByRole("button", { name: "서명 요청 확정", exact: true })
    .click();
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "0/2명 서명",
  );
  await expect(
    page.getByRole("button", { name: "최신 서명 상태 확인", exact: true }),
  ).toBeEnabled();
}
async function sign(page: Page, name: string) {
  await page.getByLabel("Mock 서명 이름 (최대 100자)").fill(name);
  await page.getByLabel("표시된 동일 버전의 최종 조건에 동의해요").check();
  await page
    .getByRole("button", { name: "동의하고 서명하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "동의하고 서명하기 확정", exact: true })
    .click();
}
async function command(
  page: Page,
  room: string,
  type: "request" | "sign",
  version?: string,
) {
  return page.evaluate(
    async ({ id, action, versionId }) => {
      const path = "/src/app/session.ts";
      const { session } = await import(path);
      const headers = {
        Authorization: `Bearer ${await session.getToken()}`,
        "Content-Type": "application/json",
      };
      const view = await fetch(`/__mock__/terms/${id}`, { headers }).then((r) =>
        r.json(),
      );
      const latest = view.document.versions.at(-1);
      const response = await fetch(`/__mock__/signatures/${id}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: crypto.randomUUID(),
          requestId: id,
          versionId: versionId ?? latest.id,
          revision: view.document.revision,
          type: action,
          name: "모의 본인",
          consent: true,
        }),
      });
      const result = await fetch(`/__mock__/signatures/${id}`, {
        headers,
      }).then((r) => r.json());
      return { status: response.status, result, versionId: latest.id };
    },
    { id: room, action: type, versionId: version },
  );
}
async function scenario(page: Page, value: string) {
  await page.evaluate(async (selected) => {
    await fetch("/__mock__/signatures/scenario", {
      method: "POST",
      body: selected,
    });
  }, value);
}

test("3-B 통합: 고정 버전·첫 서명·양측 서명 선정·기존 대화·결제 경계", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const productRequests: string[] = [];
  page.on("request", (r) => {
    if (
      /\/api\/(projects|applications|contracts|signatures|payments)/.test(
        r.url(),
      )
    )
      productRequests.push(r.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const { room, campaignId } = await setup(page);
  await page.getByLabel("메시지 (Mock 최대 4,000자)").fill("서명 전 협의 이력");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await request(page);
  await expect(
    page.getByRole("button", { name: "동의하고 서명하기", exact: true }),
  ).toBeDisabled();
  await sign(page, "의뢰인 <script>alert(1)</script>");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "1/2명 서명 · 계약 미확정",
  );
  await expect(
    page.getByRole("article").filter({ hasText: "제안 견적" }),
  ).toContainText("계약 미확정");
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await sign(page, "크리에이터");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "양측 서명 완료 · 계약 확정",
  );
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "2/2명 서명",
  );
  await expect(page.getByLabel("메시지 기록")).toContainText(
    "서명 전 협의 이력",
  );
  await expect(
    page.getByLabel("최종 금액 (원)", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "제안 철회", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("메시지 (Mock 최대 4,000자)")
    .fill("계약 후 같은 방 대화");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(page.getByLabel("메시지 기록")).toContainText(
    "계약 후 같은 방 대화",
  );
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
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
    await page.getByLabel("양측 서명", { exact: true }).screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/signatures-${width}.png`,
    });
  }
  await navigate(page, `/campaigns/${campaignId}`);
  await expect(
    page.getByText("모집 마감 · 신규 제안 종료", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(productRequests).toEqual([]);
});

test("3-B 조건 변경: 기존 서명 보존·구버전 서명 차단·새 버전 재확인", async ({
  page,
}) => {
  const { room } = await setup(page);
  await request(page);
  const first = await command(page, room, "sign");
  expect(first.status).toBe(200);
  await page.getByLabel("최종 금액 (원)", { exact: true }).fill("130000");
  await page
    .getByRole("button", { name: "새 작성본 저장", exact: true })
    .click();
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "대체됨",
  );
  expect((await command(page, room, "sign", first.versionId)).status).toBe(409);
  await page.getByRole("button", { name: "서명 요청", exact: true }).click();
  await page
    .getByRole("button", { name: "서명 요청 확정", exact: true })
    .click();
  await expect(page.getByLabel("서명 이력 v2", { exact: true })).toContainText(
    "0/2명 서명",
  );
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "1/2명 서명",
  );
});

test("3-B 타후보 확정: 미선정·읽기 전용·타후보 서명 비공개", async ({
  page,
}) => {
  const { room, campaignId } = await setup(page);
  await request(page);
  await command(page, room, "sign");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("크리에이터", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("다른 후보");
  await page.getByLabel("이메일 (필수)").fill("second@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL("/me/profile");
  await studioFixture(page);
  const rival = await page.evaluate(
    async ({ campaign, hiddenRoom }) => {
      const path = "/src/app/session.ts";
      const { session } = await import(path);
      const headers = {
        Authorization: `Bearer ${await session.getToken()}`,
        "Content-Type": "application/json",
      };
      const id = crypto.randomUUID();
      const response = await fetch("/__mock__/proposals", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "submit",
          id,
          campaignId: campaign,
          values: {
            direction: "다른 후보",
            quote: "90000",
            days: "3",
            workIds: ["proposal-work"],
          },
        }),
      });
      const hidden = await fetch(`/__mock__/signatures/${hiddenRoom}`, {
        headers,
      });
      const denied = await fetch(`/__mock__/signatures/${hiddenRoom}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "sign",
          id: crypto.randomUUID(),
          requestId: hiddenRoom,
          versionId: crypto.randomUUID(),
          revision: 1,
          name: "무단",
          consent: true,
        }),
      });
      return {
        id,
        submitted: response.status,
        hidden: hidden.status,
        denied: denied.status,
      };
    },
    { campaign: campaignId, hiddenRoom: room },
  );
  expect([rival.submitted, rival.hidden, rival.denied]).toEqual([
    200, 404, 404,
  ]);
  await login(page, "client");
  await page.evaluate(async (id) => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    const response = await fetch("/__mock__/proposals", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await session.getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "discuss", id, revision: 0, reason: "" }),
    });
    if (!response.ok) throw new Error("rival discuss failed");
  }, rival.id);
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await sign(page, "제작자");
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "양측 서명 완료",
  );
  await login(page, "client");
  await navigate(page, `/campaigns/${campaignId}/proposals`);
  await expect(
    page.getByRole("article").filter({ hasText: "다른 후보" }),
  ).toContainText("미선정");
  await login(page, "second");
  await navigate(page, `/workspace/${rival.id}`);
  await expect(page.getByLabel("의뢰 대화")).toContainText("읽기 전용");
  await expect(page.getByLabel("메시지 (Mock 최대 4,000자)")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "서명 요청", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toHaveCount(0);
});

test("3-B 만료 정각 차단·새 확인 버전·일반 대화 유지", async ({ page }) => {
  await page.clock.install();
  const { room } = await setup(page);
  await request(page);
  const state = await command(page, room, "request");
  await page.clock.setSystemTime(new Date(state.result.rounds[0].expiresAt));
  await page.clock.runFor(1000);
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "만료",
  );
  expect((await command(page, room, "sign")).status).toBe(409);
  await scenario(page, "lost-response");
  await page
    .getByRole("button", { name: "새 확인 버전 만들기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 서명 요청 재시도", exact: true }),
  ).toBeVisible();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "저장 결과 확인", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 서명 요청 재시도", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "작성본 v2" })).toBeVisible();
  await page.getByRole("button", { name: "서명 요청", exact: true }).click();
  await page
    .getByRole("button", { name: "서명 요청 확정", exact: true })
    .click();
  await expect(page.getByLabel("서명 이력 v2", { exact: true })).toContainText(
    "0/2명 서명",
  );
  await page
    .getByLabel("메시지 (Mock 최대 4,000자)")
    .fill("조건서 만료 후 대화");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(page.getByLabel("메시지 기록")).toContainText(
    "조건서 만료 후 대화",
  );
});

test("3-B 응답 유실: 같은 ID 재전송·결과 조회·서명 중복 없음", async ({
  page,
}) => {
  const { room } = await setup(page);
  await request(page);
  await scenario(page, "lost-response");
  await sign(page, "모의 본인");
  await expect(
    page.getByRole("button", { name: "같은 서명 요청 재시도", exact: true }),
  ).toBeVisible();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "같은 서명 요청 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 서명 요청 재시도", exact: true }),
  ).toHaveCount(0);
  const data = await command(page, room, "request");
  expect(data.result.rounds[0].signatures).toHaveLength(1);
  await scenario(page, "lost-response");
  await login(page);
  await navigate(page, `/workspace/${room}`);
  await sign(page, "제작자");
  await expect(
    page.getByRole("button", { name: "저장 결과 확인", exact: true }),
  ).toBeVisible();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "저장 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "2/2명 서명",
  );
});

test("3-B Bearer·비당사자·지연 로그아웃과 조회 실패 차단", async ({ page }) => {
  const { room } = await setup(page);
  await request(page);
  const unauthorized = await page.evaluate(async (id) => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    const headers = { Authorization: `Bearer ${await session.getToken()}` };
    const noToken = await fetch(`/__mock__/signatures/${id}`);
    const missing = await fetch(`/__mock__/signatures/${crypto.randomUUID()}`, {
      headers,
    });
    return [noToken.status, missing.status];
  }, room);
  expect(unauthorized).toEqual([401, 404]);
  await scenario(page, "malformed");
  await page
    .getByRole("button", { name: "최신 서명 상태 확인", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "동의하고 서명하기", exact: true }),
  ).toBeDisabled();
  await scenario(page, "success");
  await page
    .getByRole("button", { name: "최신 서명 상태 확인", exact: true })
    .click();
  await scenario(page, "delay");
  await sign(page, "지연 본인");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByLabel("양측 서명", { exact: true })).toHaveCount(0);
  await scenario(page, "success");
  await login(page, "client");
  await navigate(page, `/workspace/${room}`);
  await expect(page.getByLabel("서명 이력 v1", { exact: true })).toContainText(
    "0/2명 서명",
  );
});
