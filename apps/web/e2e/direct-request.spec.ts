import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { setupSettlement, settlementView } from "./settlement-helpers";
import { login, navigate, studioFixture } from "./proposal-helpers";
import { sendDirectRequest } from "./direct-helpers";
import { confirm } from "./payments-helpers";
import { deliveryRequest } from "./delivery-helpers";
import { proposalSchema } from "../src/mocks/proposal-model";
import { termsDocumentSchema } from "../src/mocks/terms-model";

async function directView(page: Page, id: string) {
  return z
    .object({
      items: z.array(
        proposalSchema.extend({ unread: z.number(), lastMessage: z.string() }),
      ),
    })
    .parse(
      (await deliveryRequest(page, `/__mock__/proposals?requestId=${id}`)).data,
    );
}
function dueOf(view: Awaited<ReturnType<typeof directView>>) {
  const due = view.items[0]?.direct?.respondDueAt;
  if (!due) throw new Error("direct deadline fixture missing");
  return Date.parse(due);
}

test("6-C 캠페인 없는 직접 의뢰의 양측 서명→결제→제작→검토/파일·수령→정산", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(feed|direct|contracts|payments)|toss|supabase/.test(r.url()))
      external.push(r.url());
  });
  const { room, contractId, campaignId } = await setupSettlement(
    page,
    true,
    "direct",
  );
  expect(campaignId).toBeNull();
  await page
    .getByRole("button", { name: "모의 정산 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("확정 모의 정산 내역")).toContainText(
    "90,000원",
  );
  expect((await settlementView(page, contractId)).record?.status).toBe(
    "SUCCEEDED",
  );
  await login(page);
  await page.getByRole("link", { name: "내 제안·협의", exact: true }).click();
  await page
    .getByRole("link", { name: "대화·작업 공간 열기", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspace/${room}$`));
  await page
    .getByText("참조 원본 사본 · 최종 조건과 별도", { exact: true })
    .click();
  await expect(
    page.getByText("직접 의뢰 · 연결된 공개 공고 없음", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("발송 당시 선택 패키지 사본", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: fileURLToPath(
      new URL(
        `../../../qa/frontend-6/direct-workspace-${info.project.name}.png`,
        import.meta.url,
      ),
    ),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("6-C 최초 수신 거절·정각 만료·수락 재전송·응답 기한 이후 채팅 유지", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await login(page, "client");
  const first = await sendDirectRequest(page);
  let view = await directView(page, first);
  const due = dueOf(view);
  const cmd = { id: first, revision: 0, action: "accept", reason: "" };
  expect(
    (await deliveryRequest(page, "/__mock__/direct/respond", cmd)).status,
  ).toBe(404);
  await login(page);
  await navigate(page, "/requests");
  await page.getByLabel("거절 사유 (선택·Mock)").fill("일정상 어려워요");
  await confirm(page, "직접 의뢰 거절");
  await expect(page.getByRole("article")).toContainText("제작자 거절");
  expect(
    (await deliveryRequest(page, "/__mock__/direct/respond", cmd)).status,
  ).toBe(409);
  await login(page, "client");
  const second = await sendDirectRequest(page);
  view = await directView(page, second);
  const secondDue = dueOf(view);
  await login(page);
  await page.evaluate(
    (value) =>
      fetch("/__mock__/direct/clock", {
        method: "POST",
        body: JSON.stringify(value),
      }),
    secondDue - 1,
  );
  expect(
    (
      await deliveryRequest(page, "/__mock__/direct/respond", {
        ...cmd,
        id: second,
      })
    ).status,
  ).toBe(200);
  await page.evaluate(
    (value) =>
      fetch("/__mock__/direct/clock", {
        method: "POST",
        body: JSON.stringify(value),
      }),
    secondDue + 1,
  );
  expect(
    (
      await deliveryRequest(page, "/__mock__/direct/respond", {
        ...cmd,
        id: second,
      })
    ).status,
  ).toBe(200);
  await navigate(page, `/workspace/${second}`);
  await expect(page.getByLabel("메시지 (Mock 최대 4,000자)")).toBeEnabled();
  await page.evaluate(() =>
    fetch("/__mock__/direct/clock", { method: "POST", body: "null" }),
  );
  await login(page, "client");
  const third = await sendDirectRequest(page);
  view = await directView(page, third);
  await login(page);
  await page.evaluate(
    (value) =>
      fetch("/__mock__/direct/clock", {
        method: "POST",
        body: JSON.stringify(value),
      }),
    dueOf(view),
  );
  expect(
    (
      await deliveryRequest(page, "/__mock__/direct/respond", {
        ...cmd,
        id: third,
      })
    ).status,
  ).toBe(409);
  await navigate(page, `/requests/${third}`);
  await expect(page.getByRole("article")).toContainText("최초 응답 만료");
  await expect(
    page.getByRole("button", { name: "직접 의뢰 협의 수락", exact: true }),
  ).toHaveCount(0);
  expect(
    (await deliveryRequest(page, `/__mock__/proposals?roomId=${third}`)).status,
  ).toBe(404);
  expect(due).toBeGreaterThan(Date.now() - 1000);
});

test("6-C 공개 패키지 전체·추가 상품 선택 사본·발송 후 비공개·타회원과 새로고침 경계", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await login(page);
  await studioFixture(page);
  await page.evaluate(async () => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    const headers = {
      Authorization: `Bearer ${await session.getToken()}`,
      "Content-Type": "application/json",
    };
    const state = await fetch("/__mock__/studio", { headers }).then((r) =>
      r.json(),
    );
    const response = await fetch("/__mock__/studio", {
      method: "POST",
      headers,
      body: JSON.stringify({
        revision: state.revision,
        command: {
          type: "save-package",
          id: "second-package",
          visibility: "PUBLIC",
          values: {
            ...state.packages[0],
            title: "추가 공개 패키지",
            price: "200000",
          },
        },
      }),
    });
    if (!response.ok) throw new Error("additional package fixture failed");
    await fetch("/api/profiles/me", { headers });
    const profile = await fetch("/api/profiles/me", {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        introduction: "공개 소개 <script>window.__publicInjected=true</script>",
      }),
    });
    if (!profile.ok) throw new Error("public introduction fixture failed");
  });
  await login(page, "client");
  await navigate(page, "/creators/mock-creator");
  await expect(page.getByLabel("공개 제작자 소개")).toHaveText(
    "공개 소개 <script>window.__publicInjected=true</script>",
  );
  expect(
    await page.evaluate(() => Reflect.get(window, "__publicInjected")),
  ).toBeUndefined();
  const publicText = await page.evaluate(() =>
    fetch("/__mock__/catalog?creatorId=mock-creator").then((r) => r.text()),
  );
  expect(publicText).not.toContain("creator@example.test");
  const packages = page.getByRole("article", { name: /^패키지 / });
  await expect(packages).toHaveCount(2);
  await expect(packages.first()).toContainText("대표");
  await packages
    .nth(1)
    .getByRole("link", { name: "이 패키지로 직접 의뢰", exact: true })
    .click();
  await expect(page).toHaveURL(/packageId=second-package$/);
  await page.getByLabel("의뢰 제목", { exact: true }).fill("추가 상품 선택");
  await page.getByLabel("제작 브리프", { exact: true }).fill("영상 편집");
  await page.getByLabel("희망 조건", { exact: true }).fill("개인 사용");
  await page
    .getByRole("button", { name: "의뢰 내용 검토", exact: true })
    .click();
  await page
    .getByRole("button", { name: "모의 직접 의뢰 발송", exact: true })
    .click();
  await page.getByRole("link", { name: "내 의뢰에서 발송 결과 확인" }).click();
  const id = new URL(page.url()).pathname.split("/").at(-1) ?? "";
  await login(page);
  await page.evaluate(async () => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    const headers = {
      Authorization: `Bearer ${await session.getToken()}`,
      "Content-Type": "application/json",
    };
    const state = await fetch("/__mock__/studio", { headers }).then((r) =>
      r.json(),
    );
    await fetch("/__mock__/studio", {
      method: "POST",
      headers,
      body: JSON.stringify({
        revision: state.revision,
        command: { type: "service", public: false },
      }),
    });
  });
  await navigate(page, `/requests/${id}`);
  await expect(page.getByRole("article")).toContainText(
    "발송 당시 패키지: 추가 공개 패키지",
  );
  await expect(page.getByRole("article")).toContainText("200,000원");
  await confirm(page, "직접 의뢰 협의 수락");
  await page
    .getByRole("link", { name: "대화·작업 공간 열기", exact: true })
    .click();
  const terms = z
    .object({ document: termsDocumentSchema })
    .parse(
      (await deliveryRequest(page, `/__mock__/terms/${id}`)).data,
    ).document;
  expect(terms.sources.campaign).toBeNull();
  expect(terms.sources.package?.id).toBe("second-package");
  expect(terms.sources.package?.price).toBe("200000");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await page.getByRole("link", { name: "회원가입", exact: true }).click();
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page
    .getByLabel("이메일 (필수)")
    .fill(`direct-stranger-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("표시 이름 (필수)").fill("다른 의뢰인");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page
    .getByRole("button", { name: "가입하고 시작하기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  expect(
    (await deliveryRequest(page, `/__mock__/proposals?requestId=${id}`)).status,
  ).toBe(404);
  expect((await deliveryRequest(page, `/__mock__/terms/${id}`)).status).toBe(
    404,
  );
  await login(page, "ops");
  expect(
    (await deliveryRequest(page, `/__mock__/proposals?requestId=${id}`)).status,
  ).toBe(404);
  expect((await deliveryRequest(page, `/__mock__/terms/${id}`)).status).toBe(
    404,
  );
  await navigate(page, `/requests/${id}`);
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  await login(page, "client");
  expect(
    (await deliveryRequest(page, `/__mock__/proposals?requestId=${id}`)).status,
  ).toBe(404);
});

test("6-C 수락 응답 유실 재조회·대화방 하나와 지연 응답 중 로그아웃", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await login(page, "client");
  const first = await sendDirectRequest(page);
  await login(page);
  await navigate(page, `/requests/${first}`);
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", {
      method: "POST",
      body: "lost-response",
    }),
  );
  await page
    .getByRole("button", { name: "직접 의뢰 협의 수락", exact: true })
    .click();
  await page
    .getByRole("button", { name: "직접 의뢰 협의 수락 확정", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "응답 여부를 확인하지 못했어요",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "돌아가기", exact: true })
    .click();
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", { method: "POST", body: "success" }),
  );
  await page
    .getByRole("button", { name: "직접 의뢰 최신 응답 확인", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "대화·작업 공간 열기", exact: true }),
  ).toHaveCount(1);
  expect(
    (
      await deliveryRequest(page, "/__mock__/direct/respond", {
        id: first,
        revision: 0,
        action: "accept",
        reason: "",
      })
    ).status,
  ).toBe(200);
  await login(page, "client");
  const second = await sendDirectRequest(page);
  await login(page);
  await navigate(page, `/requests/${second}`);
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", { method: "POST", body: "delay" }),
  );
  await page
    .getByRole("button", { name: "직접 의뢰 협의 수락", exact: true })
    .click();
  const response = page.waitForResponse((r) =>
    r.url().endsWith("/__mock__/direct/respond"),
  );
  await page
    .getByRole("button", { name: "직접 의뢰 협의 수락 확정", exact: true })
    .click();
  await page.evaluate(async () => {
    const path = "/src/app/session.ts";
    const { session } = await import(path);
    await session.logout();
  });
  expect((await response).status()).toBe(401);
  await page.evaluate(() =>
    fetch("/__mock__/direct/scenario", { method: "POST", body: "success" }),
  );
  await login(page);
  await navigate(page, `/requests/${second}`);
  await expect(page.getByRole("article")).toContainText("응답 대기");
  await expect(
    page.getByRole("link", { name: "대화·작업 공간 열기", exact: true }),
  ).toHaveCount(0);
});
