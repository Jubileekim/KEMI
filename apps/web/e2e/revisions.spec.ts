import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { login, navigate } from "./proposal-helpers";
import {
  setupDelivery,
  prepareVideo,
  shareDraft,
  deliveryView,
  deliveryRequest,
  deliveryPath,
  deliveryScenario,
} from "./delivery-helpers";

async function setupReview(page: Page, limit = 1) {
  const result = await setupDelivery(page);
  await prepareVideo(page);
  await page.getByLabel("제출 종류", { exact: true }).selectOption("REVIEW");
  await page.getByLabel("영상 설명", { exact: true }).fill("완성 검토본");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await page
    .getByRole("button", { name: "완성 검토본 정식 제출", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v1 · 완성 검토본",
  );
  await page.getByText("구조화 Mock 수정 조건 확인", { exact: true }).click();
  await page
    .getByLabel("Mock 일반 수정 한도", { exact: true })
    .fill(String(limit));
  await page
    .getByLabel("Mock 계약 수정 범위", { exact: true })
    .fill("서명 조건의 편집·자막 범위 확인 예시");
  await page
    .getByRole("button", { name: "입력한 Mock 수정 조건 확인", exact: true })
    .click();
  await expect(page.getByLabel("수정 요청과 회차")).toContainText("creator");
  await login(page, "client");
  await navigate(page, `/contracts/${result.contractId}/deliveries`);
  await page.getByText("구조화 Mock 수정 조건 확인", { exact: true }).click();
  await page
    .getByRole("button", { name: "표시된 Mock 수정 조건 확인", exact: true })
    .click();
  await expect(page.getByLabel("수정 요청과 회차")).toContainText(
    `Mock 합의 한도 ${limit}회`,
  );
  return result;
}
async function fillRequest(page: Page, category = "GENERAL", two = false) {
  const video = page.getByLabel("검토 영상 플레이어").locator("video");
  await video.evaluate(async (element) => {
    if (element instanceof HTMLVideoElement) await element.play();
  });
  await expect
    .poll(() =>
      video.evaluate(
        (element) => element instanceof HTMLVideoElement && element.ended,
      ),
    )
    .toBe(true);
  await page.getByLabel("시간 위치 (초) 1", { exact: true }).fill("0");
  if (category !== "DRAFT")
    await page.getByLabel("요청 분류", { exact: true }).selectOption(category);
  await page.getByLabel("일반 수정은 확인한 계약 범위 안의 요청이에요").check();
  await page
    .getByLabel("문제 1", { exact: true })
    .fill("<img src=x onerror=alert(1)> 자막 오타");
  await page
    .getByLabel("희망 변경 1", { exact: true })
    .fill("합의한 문구로 수정");
  await page
    .getByLabel("참고 메모 1", { exact: true })
    .fill("https://example.invalid/private-reference (자동 열기 없음)");
  await expect(
    page.getByRole("button", { name: "현재 재생 위치 사용 1", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "현재 재생 위치 사용 1", exact: true })
    .click();
  if (two) {
    await page
      .getByRole("button", { name: "체크 항목 추가", exact: true })
      .click();
    await page.getByLabel("문제 2", { exact: true }).fill("색상 확인");
    await page.getByLabel("희망 변경 2", { exact: true }).fill("밝게 수정");
  }
}
async function registerRequest(page: Page) {
  await page
    .getByRole("button", { name: "수정 요청 정식 등록", exact: true })
    .click();
  await expect(
    page.getByLabel("수정 요청 이력").getByRole("heading"),
  ).toHaveCount(1);
}
async function submitRevision(page: Page, contractId: string) {
  await login(page);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await prepareVideo(page, "revision.webm");
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("항목 1 자막·항목 2 색상 수정 완료");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await page
    .getByRole("button", { name: "요청 연결 수정본 정식 제출", exact: true })
    .click();
}
test("4-C 통합: 공개 제안→검토본→2항목 요청→수정본→1회 완료·같은 방 안내", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const products: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(revis|deliver|production)|example.invalid/.test(r.url()))
      products.push(r.url());
  });
  const { contractId, room } = await setupReview(page);
  const before = (await deliveryView(page, contractId)).state;
  await fillRequest(page, "GENERAL", true);
  await registerRequest(page);
  await expect(page.getByLabel("수정 요청과 회차")).toContainText(
    "완료한 일반 수정 0회",
  );
  await expect(page.getByLabel("수정 요청 이력").locator("img")).toHaveCount(0);
  const pending = (await deliveryView(page, contractId)).state;
  expect(pending.requests[0]?.items).toHaveLength(2);
  const seconds = pending.requests[0]?.items[0]?.seconds;
  if (seconds === undefined) throw new Error("missing timestamp");
  await page.getByRole("link", { name: /항목 1 · .*로 이동/ }).click();
  await expect(page).toHaveURL(new RegExp(`&t=${seconds}$`));
  await expect
    .poll(() =>
      page
        .getByLabel("검토 영상 플레이어")
        .locator("video")
        .evaluate((element) =>
          element instanceof HTMLVideoElement
            ? Math.floor(element.currentTime)
            : -1,
        ),
    )
    .toBe(seconds);
  await submitRevision(page, contractId);
  await expect(page.getByLabel("수정 요청과 회차")).toContainText(
    "완료한 일반 수정 1회",
  );
  await expect(page.getByLabel("수정 요청 이력")).toContainText(
    "일반 1회 완료",
  );
  const after = (await deliveryView(page, contractId)).state;
  expect(after.versions).toHaveLength(2);
  expect(after.versions[0]).toEqual(before.versions[0]);
  expect(after.versions[1]?.requestId).toBe(pending.requests[0]?.id);
  await login(page, "client");
  await navigate(page, `/workspace/${room}`);
  await page
    .getByRole("link", { name: "일반 수정 요청 바로가기", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v1 · 완성 검토본",
  );
  await page
    .getByRole("link", { name: "연결된 수정본 보기", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v2 · 수정본",
  );
  await expect(page.getByLabel("수정 요청 이력")).toContainText(
    "항목 1 자막·항목 2 색상 수정 완료",
  );
  // 4-D adds explicit approval; completing a revision must not perform it.
  const review = page.getByLabel("검토본 승인", { exact: true });
  const approval = review.getByRole("button", {
    name: "이 검토 버전 승인 (Mock)",
    exact: true,
  });
  await expect(approval).toBeVisible();
  await expect(approval).toBeDisabled();
  await review.getByLabel("선택한 검토 버전의 내용을 확인했어요").check();
  await expect(approval).toBeEnabled();
  const reviewed = (await deliveryView(page, contractId)).state;
  expect(reviewed.final).toEqual({
    approval: null,
    delivery: null,
    receipt: null,
    problem: null,
  });
  expect(reviewed).not.toHaveProperty("settled");
  await expect(page.getByRole("button", { name: /수령|정산/ })).toHaveCount(0);
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
    const selectedVideo = page
      .getByLabel("검토 영상 플레이어")
      .locator("video");
    await expect
      .poll(() =>
        selectedVideo.evaluate(
          (element) =>
            element instanceof HTMLVideoElement && element.readyState >= 2,
        ),
      )
      .toBe(true);
    await selectedVideo.evaluate(async (element) => {
      if (element instanceof HTMLVideoElement) {
        await element.play();
        element.pause();
      }
    });
    await mkdir(process.env.KEMI_CAPTURE_DIR, { recursive: true });
    const width = info.project.name === "chromium" ? 1280 : 390;
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/revisions-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  expect(products).toEqual([]);
});
test("4-C 한도 소진은 일반 수정 협의·계약 오류는 합의 후 회차 제외", async ({
  page,
}) => {
  const { contractId } = await setupReview(page, 0);
  await fillRequest(page);
  await page
    .getByRole("button", { name: "수정 요청 정식 등록", exact: true })
    .click();
  await expect(
    page.getByLabel("수정 요청 작성").getByRole("alert"),
  ).toContainText("한도 초과는 별도 협의");
  expect((await deliveryView(page, contractId)).state.requests).toHaveLength(0);
  await page.getByLabel("요청 분류", { exact: true }).selectOption("ERROR");
  await registerRequest(page);
  await expect(page.getByLabel("수정 요청 이력")).toContainText(
    "오류 여부 합의 대기·보류",
  );
  await login(page);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await page
    .getByRole("button", {
      name: "계약 오류 시정에 동의 (회차 제외)",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("수정 요청 이력")).toContainText(
    "계약 오류 시정 · 수정 중",
  );
  await prepareVideo(page, "correction.webm");
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("계약 오류 시정 완료");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await page
    .getByRole("button", { name: "요청 연결 수정본 정식 제출", exact: true })
    .click();
  await expect(page.getByLabel("수정 요청과 회차")).toContainText(
    "완료한 일반 수정 0회",
  );
  await expect(page.getByLabel("수정 요청 이력")).toContainText(
    "수정본 제출됨",
  );
});
test("4-C 초안 의견은 조건 한도 없이 요청·연결 제출해도 차감 없음", async ({
  page,
}) => {
  const { contractId } = await setupDelivery(page);
  await shareDraft(page);
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await fillRequest(page, "DRAFT");
  await registerRequest(page);
  await submitRevision(page, contractId);
  await expect(page.getByLabel("수정 요청 이력")).toContainText(
    "초안 의견 · 수정본 제출됨",
  );
  await expect(page.getByLabel("수정 요청과 회차")).toContainText(
    "완료한 일반 수정 0회",
  );
});
test("4-C 유실 요청·수정본 재조회와 동일 ID 충돌·중복 차감 방지", async ({
  page,
}) => {
  const { contractId } = await setupReview(page);
  await fillRequest(page);
  await deliveryScenario(page, "500");
  await page
    .getByRole("button", { name: "수정 요청 정식 등록", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 영상 제출 재시도", exact: true }),
  ).toBeVisible();
  await deliveryScenario(page, "success");
  expect((await deliveryView(page, contractId)).state.requests).toHaveLength(0);
  await deliveryScenario(page, "lost-response");
  await page
    .getByRole("button", { name: "같은 영상 제출 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 영상 제출 재시도", exact: true }),
  ).toBeEnabled();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(
    page.getByLabel("수정 요청 이력").getByRole("heading"),
  ).toHaveCount(1);
  const { state } = await deliveryView(page, contractId);
  const [request] = state.requests;
  if (!request) throw new Error("missing request");
  const receipt = state.receipts.find((r) => r.id === request.id);
  if (!receipt) throw new Error("missing receipt");
  const cmd: unknown = JSON.parse(receipt.fingerprint);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/requests`,
        typeof cmd === "object" && cmd !== null ? cmd : {},
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await deliveryRequest(page, `${deliveryPath(contractId)}/requests`, {
        ...request,
        type: "request",
        revision: state.revision,
      })
    ).status,
  ).toBe(400);
  await login(page);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await prepareVideo(page, "recovered.webm");
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("유실 후 복구 수정본");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await deliveryScenario(page, "lost-response");
  await page
    .getByRole("button", { name: "요청 연결 수정본 정식 제출", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 영상 제출 재시도", exact: true }),
  ).toBeEnabled();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "같은 영상 제출 재시도", exact: true })
    .click();
  await expect(page.getByLabel("수정 요청과 회차")).toContainText(
    "완료한 일반 수정 1회",
  );
  expect((await deliveryView(page, contractId)).state.versions).toHaveLength(2);
});
test("4-C 권한·위조 토큰·구버전·지연 로그아웃·새로고침 경계", async ({
  page,
}) => {
  const { contractId, room } = await setupReview(page);
  const { state } = await deliveryView(page, contractId);
  const [version] = state.versions;
  const versionId = version?.id;
  const cmd = {
    type: "request",
    id: crypto.randomUUID(),
    revision: state.revision,
    versionId,
    category: "GENERAL",
    scopeConfirmed: true,
    items: [
      {
        id: crypto.randomUUID(),
        seconds: 0,
        area: "EDITING",
        problem: "오타",
        change: "수정",
        reference: "",
      },
    ],
  };
  const url = `${deliveryPath(contractId)}/requests`;
  expect((await deliveryRequest(page, url, cmd, true)).status).toBe(401);
  expect(
    (await deliveryRequest(page, url, { ...cmd, revision: 0 })).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(page, url, {
        ...cmd,
        versionId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(crypto.randomUUID())}/requests`,
        cmd,
      )
    ).status,
  ).toBe(404);
  await login(page);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  expect((await deliveryRequest(page, url, cmd)).status).toBe(403);
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await fillRequest(page);
  await deliveryScenario(page, "delay");
  await page
    .getByRole("button", { name: "수정 요청 정식 등록", exact: true })
    .click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await login(page, "client");
  await deliveryScenario(page, "success");
  expect((await deliveryView(page, contractId)).state.requests).toHaveLength(0);
  expect(
    (
      await deliveryRequest(
        page,
        `/__mock__/revision-events/${room}`,
        undefined,
        true,
      )
    ).status,
  ).toBe(401);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await page.reload();
  await expect(
    page.getByLabel("영상 제출과 버전").getByRole("alert"),
  ).toBeVisible();
});
test("4-C 입력 보존·영상 시간/혼합 보류·조회 오류·없는 요청과 버전", async ({
  page,
}) => {
  const { contractId } = await setupReview(page);
  await fillRequest(page, "GENERAL", true);
  await page.getByLabel("시간 위치 (초) 1", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "수정 요청 정식 등록", exact: true })
    .click();
  await expect(
    page.getByLabel("수정 요청 작성").getByRole("alert"),
  ).toContainText("영상 길이 안");
  await page.getByLabel("시간 위치 (초) 1", { exact: true }).fill("0");
  await page
    .getByLabel("작업 분야 2", { exact: true })
    .selectOption("SHOOTING");
  await page
    .getByRole("button", { name: "수정 요청 정식 등록", exact: true })
    .click();
  await expect(
    page.getByLabel("수정 요청 작성").getByRole("alert"),
  ).toContainText("혼합·추가 작업");
  await ["401", "403", "409", "500", "network", "malformed"].reduce(
    async (previous, value) => {
      await previous;
      await deliveryScenario(page, value);
      await page
        .getByRole("button", { name: "영상 버전 재조회", exact: true })
        .click();
      // 같은 영역에 혼합 작업 보류·영상 접근 알림이 함께 뜰 수 있어 재조회 실패 알림만 고른다.
      await expect(
        page
          .getByLabel("영상 제출과 버전")
          .getByRole("alert")
          .filter({ hasText: "제출 결과를 확인하지 못했어요." }),
      ).toBeVisible();
      await deliveryScenario(page, "success");
      await page
        .getByRole("button", { name: "영상 버전 재조회", exact: true })
        .click();
      await expect(page.getByLabel("문제 1", { exact: true })).toHaveValue(
        "<img src=x onerror=alert(1)> 자막 오타",
      );
    },
    Promise.resolve(),
  );
  await navigate(
    page,
    `/contracts/${contractId}/deliveries?version=${crypto.randomUUID()}&request=${crypto.randomUUID()}`,
  );
  await expect(
    page.getByText(
      "지정한 수정 요청을 찾을 수 없어요. 다른 요청으로 바꾸지 않아요.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/지정한 영상 버전을 찾을 수 없어요/),
  ).toBeVisible();
  await expect(page.getByLabel("수정 요청 작성")).toHaveCount(0);
});
