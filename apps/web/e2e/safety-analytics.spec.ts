import { z } from "zod";
import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { analyticsEventSchema } from "../src/shared/analytics/events";
import { setupSettlement } from "./settlement-helpers";
import { deliveryRequest } from "./delivery-helpers";
import { login, navigate } from "./proposal-helpers";
import { safetyViewSchema } from "../src/mocks/safety-model";

test.setTimeout(90000);
test("7단계 통합: 기존 거래→신고/유실 복구→수동 제한→기존 납품·이의→해제·분석", async ({
  page,
}, info) => {
  const { contractId, room } = await setupSettlement(page);
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toBeVisible();
  await navigate(page, `/requests/${room}`);
  await page
    .getByRole("link", { name: "이 의뢰 상대방 신고", exact: true })
    .click();
  await expect(page.getByLabel("대상 식별 (필수)")).toHaveValue(room);
  await page
    .getByLabel("신고 사유 (필수)")
    .fill("<script>실행하지 않는 검토 요청</script>");
  await page.getByLabel("증빙 설명 (선택)").fill("비공개 증빙 설명");
  await page.evaluate(() =>
    fetch("/__mock__/safety/scenario", {
      method: "POST",
      body: "lost-response",
    }),
  );
  await page
    .getByRole("button", { name: "신고 접수 (Mock)", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("입력을 유지해요.");
  await expect(page.getByLabel("신고 사유 (필수)")).toHaveValue(
    "<script>실행하지 않는 검토 요청</script>",
  );
  await page.evaluate(() =>
    fetch("/__mock__/safety/scenario", { method: "POST", body: "success" }),
  );
  await page
    .getByRole("button", { name: "신고·제한 상태 재조회", exact: true })
    .click();
  const view = safetyViewSchema.parse(
    (await deliveryRequest(page, "/__mock__/safety/member")).data,
  );
  const report = view.reports[0];
  if (!report) throw new Error("missing report");
  expect(view.reports).toHaveLength(1);
  expect(report.limited).toBe(false);
  expect(
    (await deliveryRequest(page, "/__mock__/safety/operations")).status,
  ).toBe(403);
  expect(
    (await deliveryRequest(page, "/__mock__/safety/member", undefined, true))
      .status,
  ).toBe(401);
  await login(page, "ops");
  await page
    .getByRole("navigation", { name: "주 메뉴" })
    .getByRole("link", { name: "신고 검토", exact: true })
    .click();
  const card = page.getByLabel(`신고 ${report.id}`, { exact: true });
  await card.getByLabel("검토·조치", { exact: true }).selectOption("LIMIT");
  await card
    .getByLabel("당사자 안내 근거 (필수)")
    .fill("개발용 신규 거래 제한 근거");
  await card
    .getByRole("button", { name: "운영 조치 기록 (Mock)", exact: true })
    .click();
  await expect(card).toContainText("LIMIT · 개발용 신규 거래 제한 근거");
  await login(page);
  await navigate(page, "/reports/new");
  await expect(
    page.getByRole("heading", { name: "이용 안내 · 제한 중", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("비공개 증빙 설명", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("접수된 신고가 없어요.", { exact: true }),
  ).toBeVisible();
  const own = safetyViewSchema.parse(
    (await deliveryRequest(page, "/__mock__/safety/member")).data,
  );
  expect(own.reports).toHaveLength(0);
  expect(own.limited).toBe(true);
  expect(
    (
      await deliveryRequest(page, "/__mock__/proposals", {
        type: "submit",
        id: crypto.randomUUID(),
        campaignId: "00000000-0000-4000-8000-000000000001",
        values: {
          direction: "새 제안",
          quote: "100000",
          days: "3",
          workIds: ["work-1"],
        },
      })
    ).status,
  ).toBe(403);
  await page
    .getByLabel("이의 내용 (필수)")
    .fill("기존 거래를 유지하며 재검토를 요청해요.");
  await page
    .getByRole("button", { name: "이의 접수 (Mock)", exact: true })
    .click();
  await expect(
    page.getByText("APPEAL · 기존 거래를 유지하며 재검토를 요청해요.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "기존 거래·납품 확인", exact: true })
    .click();
  await page.getByRole("link", { name: "영상·납품 확인", exact: true }).click();
  await expect(
    page.getByLabel("전달된 최종 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "kemi-final.zip 다운로드", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("kemi-final.zip");
  await navigate(page, `/workspace/${room}`);
  await expect(
    page.getByRole("heading", { name: /작업 공간/ }).first(),
  ).toBeVisible();
  await login(page, "ops");
  await navigate(page, "/ops/reports");
  await card.getByLabel("검토·조치", { exact: true }).selectOption("RELEASE");
  await card
    .getByLabel("당사자 안내 근거 (필수)")
    .fill("개발용 검토 후 해제 근거");
  await card
    .getByRole("button", { name: "운영 조치 기록 (Mock)", exact: true })
    .click();
  await expect(card).toContainText("RELEASE · 개발용 검토 후 해제 근거");
  await login(page);
  await navigate(page, "/reports/new");
  await expect(
    page.getByRole("heading", {
      name: "이용 안내 · 해제·경고 이력",
      exact: true,
    }),
  ).toBeVisible();
  await mkdir("qa/frontend-7", { recursive: true });
  await page.screenshot({
    path: `qa/frontend-7/safety-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const raw: unknown = await page.evaluate(async () => {
    const mod = "/src/shared/analytics/events.ts";
    const { readMockAnalytics } = await import(mod);
    return readMockAnalytics();
  });
  const analytics = z.array(analyticsEventSchema).parse(raw);
  expect(
    analytics.filter(
      (e) => e.name === "contract_confirmed" && e.objectId === contractId,
    ),
  ).toHaveLength(1);
  expect(
    analytics.filter(
      (e) => e.name === "transaction_completed" && e.objectId === contractId,
    ),
  ).toHaveLength(1);
  expect(
    analytics.every(
      (e) =>
        e.test && Object.keys(e).sort().join(",") === "at,name,objectId,test",
    ),
  ).toBe(true);
  // Repeat the restriction boundary for the client without changing real auth.
  const clientReportId = crypto.randomUUID();
  expect(
    (
      await deliveryRequest(page, "/__mock__/safety/member", {
        type: "report",
        id: clientReportId,
        targetType: "request",
        targetId: room,
        reason: "의뢰인 검토 요청",
        evidence: "",
      })
    ).status,
  ).toBe(200);
  await login(page, "ops");
  const limit = {
    type: "operate",
    id: crypto.randomUUID(),
    reportId: clientReportId,
    action: "LIMIT",
    note: "의뢰인 DEV 제한 근거",
  };
  expect(
    (await deliveryRequest(page, "/__mock__/safety/operations", limit)).status,
  ).toBe(200);
  await login(page, "client");
  expect(
    safetyViewSchema.parse(
      (await deliveryRequest(page, "/__mock__/safety/member")).data,
    ).limited,
  ).toBe(true);
  expect(
    (
      await deliveryRequest(page, "/__mock__/campaigns", {
        revision: 0,
        command: {
          type: "publish",
          id: crypto.randomUUID(),
          values: {
            title: "새 모집",
            product: "제품",
            purpose: "소개",
            scope: "편집",
            budget: "100000",
            references: "",
            days: "7",
          },
        },
      })
    ).status,
  ).toBe(403);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }),
  ).toContainText("전용 수령 확인 기록");
  expect(
    (
      await deliveryRequest(page, "/__mock__/safety/member", {
        type: "appeal",
        id: crypto.randomUUID(),
        reportId: clientReportId,
        note: "의뢰인 이의 접수",
      })
    ).status,
  ).toBe(200);
});

test("7-C 비회원·운영 접근·입력 검증·지연 로그아웃·실제 제한 인증 경계", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "작품에서 시작하는 새로운 연결",
      exact: true,
    }),
  ).toBeVisible();
  await navigate(page, "/works/sample-work-1");
  await page
    .getByLabel("공개 샘플 영상", { exact: true })
    .evaluate((element) => {
      if (element instanceof HTMLVideoElement) return element.play();
      return undefined;
    });
  await page
    .getByRole("link", { name: "제작자·공개 패키지 보기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "예시 크리에이터", exact: true }),
  ).toBeVisible();
  const names = await page.evaluate(async () => {
    const mod = "/src/shared/analytics/events.ts";
    const { readMockAnalytics } = await import(mod);
    return readMockAnalytics().map((event: { name: string }) => event.name);
  });
  expect(names).toEqual(
    expect.arrayContaining(["feed_view", "work_play", "creator_view"]),
  );
  await navigate(page, "/reports/new");
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
  await login(page);
  await navigate(page, "/reports/new");
  await page
    .getByRole("button", { name: "신고 접수 (Mock)", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("대상 식별과 필수 사유");
  await navigate(page, "/ops/reports");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  const status = await page.evaluate(async () => {
    const mod = "/src/app/session.ts";
    const { session } = await import(mod);
    const token = await session.getToken();
    await fetch("/__mock__/safety/scenario", { method: "POST", body: "delay" });
    const request = fetch("/__mock__/safety/member", {
      headers: { Authorization: `Bearer ${token}` },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
    await session.logout();
    return (await request).status;
  });
  expect(status).toBe(401);
  await page
    .getByRole("combobox", { name: "Mock 인증 응답", exact: true })
    .selectOption("restricted");
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await page.getByLabel("이메일 (필수)").fill("creator@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await expect(page.getByText(/이용이 제한된 계정/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toHaveCount(0);
});
