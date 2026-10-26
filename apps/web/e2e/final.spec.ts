import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { login, navigate } from "./proposal-helpers";
import {
  setupDelivery,
  prepareVideo,
  deliveryView,
  deliveryRequest,
  deliveryPath,
  deliveryScenario,
  shareDraft,
} from "./delivery-helpers";

// New full public-request-to-receipt journeys include all preceding stages.
// Existing suites and the 5-second assertion timeout remain unchanged.
test.setTimeout(60_000);

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture value");
  return value;
}

async function review(page: Page) {
  const result = await setupDelivery(page);
  await prepareVideo(page);
  await page.getByLabel("제출 종류", { exact: true }).selectOption("REVIEW");
  await page.getByLabel("영상 설명", { exact: true }).fill("4-D 검토할 완성본");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await page
    .getByRole("button", { name: "완성 검토본 정식 제출", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v1 · 완성 검토본",
  );
  await login(page, "client");
  await navigate(page, `/contracts/${result.contractId}/deliveries`);
  await expect(page.getByLabel("검토본 승인", { exact: true })).toBeVisible();
  return result;
}
async function approve(page: Page) {
  await page.getByLabel("선택한 검토 버전의 내용을 확인했어요").check();
  await page
    .getByRole("button", { name: "이 검토 버전 승인 (Mock)", exact: true })
    .click();
  await expect(page.getByLabel("검토본 승인", { exact: true })).toContainText(
    "검토 승인 기록",
  );
}
async function prepareFinal(page: Page, contractId: string) {
  await login(page);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await page
    .getByLabel("최종 전달 파일", { exact: true })
    .setInputFiles(
      fileURLToPath(new URL("./fixtures/kemi-final.zip", import.meta.url)),
    );
  await page
    .getByLabel("파일별 설명", { exact: true })
    .fill("승인 v1과 같은 최종 영상 ZIP · 합의한 규격 1개");
  await page
    .getByRole("button", { name: "최종 파일 준비 (Mock 업로드)", exact: true })
    .click();
  await expect(
    page.getByLabel("준비한 최종 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
  await page
    .getByLabel("승인 버전과 일치하는 워터마크 없는 최종 파일을 준비했어요")
    .check();
  await page
    .getByLabel("규격·수량과 합의한 원본 등 계약 파일을 모두 준비했어요")
    .check();
}
async function send(page: Page) {
  await page
    .getByRole("button", {
      name: "계약 최종 파일 정식 전달 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("전달된 최종 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
}
async function clientFiles(page: Page, contractId: string) {
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }),
  ).toBeVisible();
}

test("4-D 통합: 공개 제안→서명/결제/준비/검토→승인→ZIP 전달→다운로드→전용 수령", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(deliver|final|settle)|supabase|toss/.test(r.url()))
      external.push(r.url());
  });
  const { contractId, room } = await review(page);
  const original = (await deliveryView(page, contractId)).state;
  await approve(page);
  expect(
    (await deliveryView(page, contractId)).state.final.delivery,
  ).toBeNull();
  await prepareFinal(page, contractId);
  expect(
    (await deliveryView(page, contractId)).state.final.delivery,
  ).toBeNull();
  await send(page);
  await clientFiles(page, contractId);
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "kemi-final.zip 다운로드", exact: true })
    .click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("kemi-final.zip");
  const local = await download.path();
  if (!local) throw new Error("missing download");
  const bytes = await readFile(
    new URL("./fixtures/kemi-final.zip", import.meta.url),
  );
  expect(
    createHash("sha256")
      .update(await readFile(local))
      .digest("hex"),
  ).toBe(createHash("sha256").update(bytes).digest("hex"));
  expect((await deliveryView(page, contractId)).state.final.receipt).toBeNull();
  const receive = page.getByRole("button", {
    name: "최종 파일 수령 확인 (Mock)",
    exact: true,
  });
  await expect(receive).toBeDisabled();
  await page
    .getByLabel(
      "다운로드한 파일이 승인 내용·계약 조건과 일치하고 미해결 문제가 없어요",
    )
    .check();
  await receive.click();
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }),
  ).toContainText("전용 수령 확인 기록");
  const { state } = await deliveryView(page, contractId);
  expect(state.requests).toEqual(original.requests);
  expect(state).not.toHaveProperty("settled");
  await navigate(page, `/workspace/${room}`);
  const notices = page.getByLabel("승인·최종 전달·수령 시스템 안내", {
    exact: true,
  });
  await expect(notices.getByRole("link")).toHaveCount(3);
  await notices
    .getByRole("link", {
      name: "최종 수령 확인·정산 미실행 바로가기",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `version=${state.final.approval?.versionId}&final=${state.final.delivery?.id}`,
    ),
  );
  const video = page.getByLabel("검토 영상 플레이어").locator("video");
  await expect
    .poll(() =>
      video.evaluate(
        (element) =>
          element instanceof HTMLVideoElement && element.readyState >= 2,
      ),
    )
    .toBe(true);
  await video.evaluate(async (element) => {
    if (element instanceof HTMLVideoElement) {
      await element.play();
      element.pause();
    }
  });
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByLabel("최종 파일 전달", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
  if (process.env.KEMI_CAPTURE_DIR) {
    await mkdir(process.env.KEMI_CAPTURE_DIR, { recursive: true });
    const width = info.project.name === "chromium" ? 1280 : 390;
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/final-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("4-D 유실·조회 실패·같은 ID 재시도는 승인/전달/수령을 중복하지 않는다", async ({
  page,
}) => {
  const { contractId } = await review(page);
  await deliveryScenario(page, "lost-response");
  await page.getByLabel("선택한 검토 버전의 내용을 확인했어요").check();
  await page
    .getByRole("button", { name: "이 검토 버전 승인 (Mock)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 최종 작업 재시도", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "같은 최종 작업 재시도", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 최종 작업 재시도", exact: true }),
  ).toBeEnabled();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(page.getByLabel("검토본 승인", { exact: true })).toContainText(
    "검토 승인 기록",
  );
  await prepareFinal(page, contractId);
  await deliveryScenario(page, "500");
  await page
    .getByRole("button", {
      name: "계약 최종 파일 정식 전달 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 최종 작업 재시도", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("준비한 최종 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
  await deliveryScenario(page, "lost-response");
  await page
    .getByRole("button", { name: "같은 최종 작업 재시도", exact: true })
    .click();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(
    page.getByLabel("전달된 최종 파일", { exact: true }),
  ).toBeVisible();
  await deliveryScenario(page, "malformed");
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(
    page.getByLabel("전달된 최종 파일", { exact: true }),
  ).toBeHidden();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await clientFiles(page, contractId);
  await page
    .getByLabel(
      "다운로드한 파일이 승인 내용·계약 조건과 일치하고 미해결 문제가 없어요",
    )
    .check();
  await deliveryScenario(page, "lost-response");
  await page
    .getByRole("button", { name: "최종 파일 수령 확인 (Mock)", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 최종 작업 재시도", exact: true }),
  ).toBeVisible();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }),
  ).toContainText("전용 수령 확인 기록");
  expect((await deliveryView(page, contractId)).state.receipts).toHaveLength(4);
});

test("4-D 문제 신고는 수령/덮어쓰기 차단·파일 권한·버전/식별자 충돌 검사", async ({
  page,
}) => {
  const { contractId, room } = await review(page);
  const before = (await deliveryView(page, contractId)).state;
  const cmd = {
    type: "approve",
    id: crypto.randomUUID(),
    revision: before.revision,
    versionId: required(before.versions[0]).id,
    confirmed: true,
  };
  expect(
    (
      await deliveryRequest(page, `${deliveryPath(contractId)}/final`, {
        ...cmd,
        revision: 0,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/final`,
        cmd,
        true,
      )
    ).status,
  ).toBe(401);
  await approve(page);
  await prepareFinal(page, contractId);
  await send(page);
  const { state } = await deliveryView(page, contractId);
  const delivery = required(state.final.delivery);
  expect(
    (
      await deliveryRequest(page, `${deliveryPath(contractId)}/final`, {
        type: "receive-final",
        id: crypto.randomUUID(),
        revision: state.revision,
        deliveryId: delivery.id,
        confirmed: true,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/final-files/${required(delivery.files[0]).asset.id}`,
        undefined,
        true,
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(crypto.randomUUID())}/final-files/${required(delivery.files[0]).asset.id}`,
      )
    ).status,
  ).toBe(404);
  await clientFiles(page, contractId);
  await deliveryScenario(page, "malformed");
  await page
    .getByRole("button", { name: "kemi-final.zip 다운로드", exact: true })
    .click();
  await expect(
    page.getByText(
      "다운로드 실패 · 접근 상태를 확인한 뒤 다시 시도해 주세요.",
      { exact: true },
    ),
  ).toBeVisible();
  await deliveryScenario(page, "success");
  await page
    .getByLabel("파일 문제·미해결 분쟁 내용", { exact: true })
    .fill("<img src=x onerror=alert(1)> 손상·워터마크 잔존·미해결 분쟁");
  await page
    .getByRole("button", {
      name: "파일 문제 신고·수령 보류 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }),
  ).toContainText("파일 문제 보류");
  expect(
    (
      await deliveryRequest(page, `${deliveryPath(contractId)}/final`, {
        type: "receive-final",
        id: crypto.randomUUID(),
        revision: state.revision + 1,
        deliveryId: delivery.id,
        confirmed: true,
      })
    ).status,
  ).toBe(409);
  await expect(
    page.getByLabel("최종 수령 확인", { exact: true }).locator("img"),
  ).toHaveCount(0);
  await navigate(page, `/workspace/${room}`);
  await expect(
    page.getByLabel("승인·최종 전달·수령 시스템 안내", { exact: true }),
  ).toContainText("파일 문제·수령 보류 바로가기");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("계약 비당사자");
  await page.getByLabel("이메일 (필수)").fill("other-final@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page
    .getByRole("button", { name: "가입하고 시작하기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/final-files/${required(delivery.files[0]).asset.id}`,
      )
    ).status,
  ).toBe(404);
  expect(
    (await deliveryRequest(page, `/__mock__/final-events/${room}`)).status,
  ).toBe(404);
});

test("4-D 초안 승인 금지·잘못된 전달 URL·새로고침 초기화·지연 로그아웃", async ({
  page,
}) => {
  const result = await setupDelivery(page);
  await shareDraft(page);
  await login(page, "client");
  await navigate(page, `/contracts/${result.contractId}/deliveries`);
  await expect(
    page.getByRole("button", { name: "이 검토 버전 승인 (Mock)", exact: true }),
  ).toHaveCount(0);
  await navigate(
    page,
    `/contracts/${result.contractId}/deliveries?final=${crypto.randomUUID()}`,
  );
  await expect(
    page.getByText(
      "지정한 최종 전달을 찾을 수 없어요. 다른 전달로 바꾸지 않아요.",
      { exact: true },
    ),
  ).toBeVisible();
  await deliveryScenario(page, "delay");
  const reading = deliveryRequest(page, deliveryPath(result.contractId));
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  expect((await reading).status).toBe(401);
  await page.reload();
  await login(page, "client");
  expect(
    (await deliveryRequest(page, deliveryPath(result.contractId))).status,
  ).toBe(404);
});

test("4-D 수정본 연결 통합: 오류 요청→시정 동의→수정본→최신 버전만 승인", async ({
  page,
}) => {
  const { contractId } = await review(page);
  const path = deliveryPath(contractId);
  const { state } = await deliveryView(page, contractId);
  const requestId = crypto.randomUUID();
  expect(
    (
      await deliveryRequest(page, `${path}/requests`, {
        type: "request",
        id: requestId,
        revision: state.revision,
        versionId: required(state.versions[0]).id,
        category: "ERROR",
        scopeConfirmed: false,
        items: [
          {
            id: crypto.randomUUID(),
            seconds: 0,
            area: "EDITING",
            problem: "계약 자막 오류",
            change: "계약 문구로 시정",
            reference: "",
          },
        ],
      })
    ).status,
  ).toBe(200);
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "이 검토 버전 승인 (Mock)", exact: true }),
  ).toBeDisabled();
  await login(page);
  expect(
    (
      await deliveryRequest(page, `${path}/requests`, {
        type: "accept-correction",
        id: crypto.randomUUID(),
        revision: state.revision + 1,
        requestId,
      })
    ).status,
  ).toBe(200);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await prepareVideo(page, "corrected.webm");
  await page.getByLabel("영상 설명", { exact: true }).fill("자막 시정 완료");
  await page.getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요").check();
  await page
    .getByRole("button", { name: "요청 연결 수정본 정식 제출", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v2 · 수정본",
  );
  await login(page, "client");
  await navigate(
    page,
    `/contracts/${contractId}/deliveries?version=${required(state.versions[0]).id}`,
  );
  await expect(
    page.getByRole("button", { name: "이 검토 버전 승인 (Mock)", exact: true }),
  ).toBeDisabled();
  const latest = (await deliveryView(page, contractId)).state;
  await navigate(
    page,
    `/contracts/${contractId}/deliveries?version=${required(latest.versions.at(-1)).id}`,
  );
  await approve(page);
  const approved = (await deliveryView(page, contractId)).state;
  expect(approved.final.approval?.versionId).toBe(latest.versions.at(-1)?.id);
  expect(approved.requests[0]?.resultVersionId).toBe(
    approved.final.approval?.versionId,
  );
  expect(approved.requests[0]?.completedRound).toBeNull();
  expect(approved.final.delivery).toBeNull();
});
