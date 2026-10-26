import { test, expect, type Page } from "@playwright/test";
import {
  navigate,
  login,
  publish,
  submitProposal,
  discuss,
  proposalScenario,
  studioFixture,
} from "./proposal-helpers";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
  await page.goto("/campaigns");
});

test("후보별 응답·방 권한: 두 후보 유지·타후보 메시지 조회/전송 금지", async ({
  page,
}) => {
  const id = await publish(page);
  await submitProposal(page, id);
  await discuss(page, id);
  const firstRoom = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await page
    .getByLabel("메시지 (Mock 최대 4,000자)")
    .fill("첫 후보 비공개 협의");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("크리에이터", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("두 번째 후보");
  await page.getByLabel("이메일 (필수)").fill("second@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page.getByRole("button", { name: "가입하고 시작하기" }).click();
  await expect(page).toHaveURL("/me/profile");
  await studioFixture(page);
  const result = await page.evaluate(
    async ({ campaignId, roomId }) => {
      const modulePath = "/src/app/session.ts";
      const { session } = await import(modulePath);
      const headers = {
        Authorization: `Bearer ${await session.getToken()}`,
        "Content-Type": "application/json",
      };
      const proposalId = crypto.randomUUID();
      const submitted = await fetch("/__mock__/proposals", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "submit",
          id: proposalId,
          campaignId,
          values: {
            direction: "두 번째 제안",
            quote: "99000",
            days: "3",
            workIds: ["proposal-work"],
          },
        }),
      });
      const hidden = await fetch(`/__mock__/proposals?roomId=${roomId}`, {
        headers,
      });
      const denied = await fetch("/__mock__/proposals", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "send",
          id: roomId,
          messageId: crypto.randomUUID(),
          text: "무단 전송",
        }),
      });
      const own = await fetch("/__mock__/proposals", { headers }).then(
        (response) => response.json(),
      );
      return {
        submitted: submitted.status,
        hidden: hidden.status,
        denied: denied.status,
        own: JSON.stringify(own),
        count: own.items.length,
      };
    },
    { campaignId: id, roomId: firstRoom },
  );
  expect(result.submitted).toBe(200);
  expect(result.hidden).toBe(404);
  expect(result.denied).toBe(404);
  expect(result.count).toBe(1);
  expect(result.own).not.toContain("첫 후보 비공개 협의");
  await login(page, "client");
  await navigate(page, `/campaigns/${id}/proposals`);
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(
    page.getByRole("article").filter({ hasText: "두 번째 후보" }),
  ).toContainText("계약 미확정");
  await expect(
    page.getByRole("button", { name: "협의 요청", exact: true }),
  ).toHaveCount(1);
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

test("2-D 통합: 작성·공개→제안→후보·협의→마감 유지→양방향 대화·읽음→거절·기록", async ({
  page,
}, info) => {
  const captureWidth = info.project.name === "chromium" ? 1280 : 390;
  if (process.env.KEMI_CAPTURE_DIR)
    await page.setViewportSize({ width: captureWidth, height: 1000 });
  const productRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(projects|applications|chats)/.test(request.url()))
      productRequests.push(request.url());
  });
  const id = await publish(page);
  await submitProposal(page, id);
  await discuss(page, id);
  const room = new URL(page.url()).pathname;
  await page
    .getByLabel("메시지 (Mock 최대 4,000자)")
    .fill("첫 번째 대화 <script>alert(1)</script>");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(1);
  if (process.env.KEMI_CAPTURE_DIR) {
    await navigate(page, `/campaigns/${id}/proposals`);
    await expect(page.getByRole("article")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "최신 제안·대화 확인" }),
    ).toBeEnabled();
    await page.screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/candidates-${captureWidth}.png`,
      fullPage: true,
    });
    await navigate(page, room);
    await expect(
      page.getByLabel("메시지 기록").getByRole("listitem"),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "최신 제안·대화 확인" }),
    ).toBeEnabled();
    await page.screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/workspace-${captureWidth}.png`,
      fullPage: true,
    });
  }
  await navigate(page, `/campaigns/${id}`);
  await page.getByRole("button", { name: "모집 마감하기" }).click();
  await page.getByRole("button", { name: "모의 마감 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, room);
  await expect(
    page.getByRole("button", { name: "메시지 전송", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("메시지 (Mock 최대 4,000자)")
    .fill("마감 후에도 협의 유지");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(2);
  await login(page);
  await page.getByRole("link", { name: "내 제안·협의", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("미확인 메시지 2개");
  await page.getByRole("link", { name: "대화·작업 공간 열기" }).click();
  await page.getByRole("button", { name: "표시된 메시지 읽음 처리" }).click();
  await expect(page.getByRole("article")).toContainText("미확인 메시지 0개");
  await page.getByLabel("메시지 (Mock 최대 4,000자)").fill("동의합니다");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(3);
  await expect(page.getByRole("article")).toContainText("계약 미확정");
  await login(page, "client");
  await navigate(page, room);
  await page.getByRole("button", { name: "제안 거절", exact: true }).click();
  await page.getByLabel("종료 사유 (필수)").fill("일정 변경");
  await page.getByRole("button", { name: "제안 거절 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("의뢰 대화")).toContainText("읽기 전용");
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(3);
  await expect(page.getByLabel("메시지 (Mock 최대 4,000자)")).toBeDisabled();
  expect(productRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("응답 유실: 전송 중 차단·같은 메시지 재시도 중복 없음", async ({
  page,
}) => {
  const id = await publish(page);
  await submitProposal(page, id);
  await discuss(page, id);
  await proposalScenario(page, "lost-response");
  await page.getByLabel("메시지 (Mock 최대 4,000자)").fill("한 번만 저장");
  await page.getByRole("button", { name: "메시지 전송", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "같은 메시지 재시도" }),
  ).toBeVisible();
  await proposalScenario(page, "success");
  await page.getByRole("button", { name: "최신 제안·대화 확인" }).click();
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "같은 메시지 재시도" }).click();
  await expect(
    page.getByRole("button", { name: "같은 메시지 재시도" }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("메시지 기록").getByRole("listitem"),
  ).toHaveCount(1);
});

test("무선정 종료: 사유·읽기 전용·새 제안 차단", async ({ page }) => {
  const id = await publish(page);
  await submitProposal(page, id);
  await discuss(page, id);
  const room = new URL(page.url()).pathname;
  await navigate(page, `/campaigns/${id}/proposals`);
  await page.getByRole("button", { name: "무선정 종료", exact: true }).click();
  await page.getByLabel("종료 사유 (필수)").fill("프로젝트 보류");
  await page.getByRole("button", { name: "무선정 종료 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigate(page, room);
  await expect(page.getByLabel("의뢰 대화")).toContainText("읽기 전용");
  await expect(page.getByLabel("의뢰 대화")).toContainText("프로젝트 보류");
  await navigate(page, `/campaigns/${id}`);
  await expect(
    page.getByRole("button", { name: "신규 제안 종료" }),
  ).toBeDisabled();
});

test("권한·실패·빈 상태: 타 공고/방·Bearer 없이 조회/변경 금지", async ({
  page,
}) => {
  await login(page, "client");
  await page.getByRole("link", { name: "내 제안·협의", exact: true }).click();
  await expect(page.getByText("표시할 본인 제안·의뢰가 없어요.")).toBeVisible();
  const status = await page.evaluate(
    async () => (await fetch("/__mock__/proposals")).status,
  );
  expect(status).toBe(401);
  await navigate(
    page,
    "/campaigns/00000000-0000-4000-8000-000000000001/proposals",
  );
  await expect(page.getByRole("alert")).toContainText("본인 공고");
  await navigate(page, "/workspace/10000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("alert")).toContainText("본인 공고");
  await proposalScenario(page, "500");
  await page.getByRole("button", { name: "최신 제안·대화 확인" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "응답을 확인하지 못했어요",
  );
});
