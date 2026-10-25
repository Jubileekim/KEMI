import { test, expect } from "@playwright/test";
import { login, navigate } from "./proposal-helpers";
import { productionViewSchema } from "../src/mocks/production-model";
import {
  setupDelivery,
  prepareVideo,
  shareDraft,
  deliveryRequest,
  deliveryPath,
  deliveryView,
  deliveryScenario,
} from "./delivery-helpers";

test("4-B 공개 제안 통합: 제작 시작→초안→완성 검토본→이전 버전 재생·같은 방 안내", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const products: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(deliver|media|video|production)/.test(r.url()))
      products.push(r.url());
  });
  const { contractId, room } = await setupDelivery(page);
  await prepareVideo(page);
  expect((await deliveryView(page, contractId)).state.versions).toHaveLength(0);
  expect(
    (await deliveryRequest(page, `/__mock__/delivery-events/${room}`)).data,
  ).toEqual([]);
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("초안 확인 부탁드려요.");
  await page
    .getByRole("button", { name: "초안 정식 공유", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText("v1 · 초안");
  await expect(page.getByLabel("검토 영상 파일", { exact: true })).toHaveValue(
    "",
  );
  const first = (await deliveryView(page, contractId)).state.versions[0];
  if (!first) throw new Error("missing first version");
  await prepareVideo(page, "kemi-review.webm");
  await page.getByLabel("제출 종류", { exact: true }).selectOption("REVIEW");
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("<img src=x onerror=alert(1)> 완성 검토본 확인 부탁드려요.");
  await expect(
    page.getByRole("button", { name: "완성 검토본 정식 제출", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("영상 자체에 KEMI 워터마크를 넣어 준비했어요", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "완성 검토본 정식 제출", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText(
    "v2 · 완성 검토본 · 검토 중",
  );
  const { state } = await deliveryView(page, contractId);
  expect(state.versions).toHaveLength(2);
  expect(state.versions[0]).toEqual(first);
  await expect(page.getByLabel("영상 제출과 버전").locator("img")).toHaveCount(
    0,
  );
  await login(page, "client");
  await navigate(page, `/workspace/${room}`);
  await expect(
    page.getByLabel("영상 제출 시스템 안내").getByRole("link"),
  ).toHaveCount(2);
  await page
    .getByRole("link", { name: "v1 초안 공유 바로가기", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`version=${first.id}$`));
  await expect(page.getByLabel("영상 제출 작성")).toHaveCount(0);
  const video = page.getByLabel("검토 영상 kemi-watermarked.webm", {
    exact: true,
  });
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate(
        (node) => node instanceof HTMLVideoElement && node.readyState >= 1,
      ),
    )
    .toBe(true);
  await video.evaluate(async (node) => {
    if (node instanceof HTMLVideoElement) {
      await node.play();
      node.pause();
    }
  });
  await expect(
    page.getByRole("button", { name: /다운로드|승인|수령|정산/ }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "v2 · 완성 검토본", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText("검토 중");
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
    const selectedVideo = page.getByLabel("검토 영상 kemi-review.webm", {
      exact: true,
    });
    await expect
      .poll(() =>
        selectedVideo.evaluate(
          (node) => node instanceof HTMLVideoElement && node.readyState >= 2,
        ),
      )
      .toBe(true);
    await selectedVideo.evaluate(async (node) => {
      if (node instanceof HTMLVideoElement) {
        await node.play();
        node.pause();
      }
    });
    const width = info.project.name === "chromium" ? 1280 : 390;
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("영상 제출과 버전").screenshot({
      path: `${process.env.KEMI_CAPTURE_DIR}/delivery-${width}.png`,
    });
  }
  await navigate(
    page,
    `/contracts/${contractId}/deliveries?version=${crypto.randomUUID()}`,
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "지정한 영상 버전을 찾을 수 없어요" }),
  ).toContainText("지정한 영상 버전을 찾을 수 없어요");
  await expect(page.getByLabel("선택한 영상 버전")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(products).toEqual([]);
});

test("4-B 유실 응답 재조회·동일 제출·ID 충돌·이전 revision·동일 파일 차단", async ({
  page,
}) => {
  const { contractId, room } = await setupDelivery(page);
  await prepareVideo(page);
  await page.getByLabel("영상 설명", { exact: true }).fill("유실 응답 예시");
  await deliveryScenario(page, "lost-response");
  await page
    .getByRole("button", { name: "초안 정식 공유", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "제출 결과를 확인하지 못했어요" }),
  ).toContainText("제출 결과를 확인하지 못했어요");
  await expect(
    page.getByRole("button", { name: "초안 정식 공유", exact: true }),
  ).toBeDisabled();
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "같은 영상 제출 재시도", exact: true })
    .click();
  await expect(page.getByLabel("선택한 영상 버전")).toContainText("v1 · 초안");
  const { state } = await deliveryView(page, contractId);
  const receipt = state.receipts[0];
  if (!receipt) throw new Error("missing receipt");
  const cmd: unknown = JSON.parse(receipt.fingerprint);
  if (!cmd || typeof cmd !== "object") throw new Error("missing command");
  expect(
    (await deliveryRequest(page, deliveryPath(contractId), cmd)).status,
  ).toBe(200);
  expect(
    (
      await deliveryRequest(page, deliveryPath(contractId), {
        ...cmd,
        revision: 99,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(page, deliveryPath(contractId), {
        ...cmd,
        id: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(page, deliveryPath(contractId), {
        ...cmd,
        id: crypto.randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (await deliveryRequest(page, `/__mock__/delivery-events/${room}`)).data,
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(page.getByLabel("영상 버전 목록")).toContainText(
    "영상 버전 (1)",
  );
});

test("4-B 입력·업로드 실패 복구·형식/HTTP 오류·미확정 실패는 안내 없음", async ({
  page,
}) => {
  const { contractId, room } = await setupDelivery(page);
  await deliveryScenario(page, "500");
  await page.getByLabel("검토 영상 파일", { exact: true }).setInputFiles({
    name: "kemi.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("invalid codec"),
  });
  await page
    .getByRole("button", { name: "영상 준비 (Mock 업로드)", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "영상 준비에 실패했어요" }),
  ).toContainText("영상 준비에 실패했어요");
  await deliveryScenario(page, "success");
  await page
    .getByRole("button", { name: "영상 준비 재시도", exact: true })
    .click();
  await expect(page.getByText(/준비된 파일: kemi.webm/)).toBeVisible();
  await page
    .getByLabel("영상 설명", { exact: true })
    .fill("잘못된 코덱 재생 예시");
  await page
    .getByRole("button", { name: "초안 정식 공유", exact: true })
    .click();
  await expect(
    page.getByText(
      "영상을 재생하지 못했어요. 지원 코덱과 파일 손상을 확인해 주세요.",
    ),
  ).toBeVisible();
  await ["401", "403", "409", "500", "malformed", "network"].reduce(
    async (prev, value) => {
      await prev;
      await deliveryScenario(page, value);
      await page
        .getByRole("button", { name: "영상 버전 재조회", exact: true })
        .click();
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "제출 결과를 확인하지 못했어요" }),
      ).toContainText("제출 결과를 확인하지 못했어요");
      await expect(page.getByLabel("선택한 영상 버전")).toHaveCount(0);
      await deliveryScenario(page, "success");
      await page
        .getByRole("button", { name: "영상 버전 재조회", exact: true })
        .click();
      await expect(page.getByLabel("선택한 영상 버전")).toBeVisible();
    },
    Promise.resolve(),
  );
  await prepareVideo(page);
  await page.getByLabel("영상 설명", { exact: true }).fill("실패 제출");
  await deliveryScenario(page, "409");
  await page
    .getByRole("button", { name: "초안 정식 공유", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "제출 결과를 확인하지 못했어요" }),
  ).toContainText("제출 결과를 확인하지 못했어요");
  await deliveryScenario(page, "success");
  expect(
    (await deliveryRequest(page, `/__mock__/delivery-events/${room}`)).data,
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "재조회 상태로 다시 작성", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "재조회 상태로 다시 작성", exact: true })
    .click();
  await expect(page.getByLabel("영상 설명", { exact: true })).toHaveValue(
    "실패 제출",
  );
  expect((await deliveryView(page, contractId)).state.versions).toHaveLength(1);
});

test("4-B 미결제·미시작·의뢰인 쓰기·위조 Bearer·타인 미디어/안내 차단", async ({
  page,
}) => {
  const { contractId, room } = await setupDelivery(page, false, false);
  await expect(
    page.getByRole("button", { name: "영상 준비 (Mock 업로드)", exact: true }),
  ).toBeDisabled();
  const cmd = {
    id: crypto.randomUUID(),
    revision: 0,
    assetId: crypto.randomUUID(),
    kind: "DRAFT",
    description: "위조",
    watermarkConfirmed: false,
  };
  expect(
    (await deliveryRequest(page, deliveryPath(contractId), cmd)).status,
  ).toBe(409);
  expect(
    (await deliveryRequest(page, deliveryPath(contractId), undefined, true))
      .status,
  ).toBe(401);
  expect(
    (await deliveryRequest(page, deliveryPath(crypto.randomUUID()))).status,
  ).toBe(404);
  await login(page, "client");
  expect(
    (await deliveryRequest(page, deliveryPath(contractId), cmd)).status,
  ).toBe(403);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await navigate(page, "/signup");
  await page.getByLabel("의뢰인", { exact: true }).check();
  await page.getByLabel("표시 이름 (필수)").fill("타인 영상 사용자");
  await page.getByLabel("이메일 (필수)").fill("other-delivery@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByLabel("비밀번호 확인 (필수)").fill("Kemi1234");
  await page
    .getByRole("button", { name: "가입하고 시작하기", exact: true })
    .click();
  await expect(page).toHaveURL("/me/profile");
  expect((await deliveryRequest(page, deliveryPath(contractId))).status).toBe(
    404,
  );
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/media/${crypto.randomUUID()}`,
      )
    ).status,
  ).toBe(404);
  expect(
    (await deliveryRequest(page, `/__mock__/delivery-events/${room}`)).status,
  ).toBe(404);
});

test("4-B 지연 제출 로그아웃·새로고침은 메모리 복원하지 않음", async ({
  page,
}) => {
  const { contractId, room } = await setupDelivery(page);
  await prepareVideo(page);
  await page.getByLabel("영상 설명", { exact: true }).fill("늦은 제출");
  await deliveryScenario(page, "delay");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(deliveryPath(contractId)) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "초안 정식 공유", exact: true })
    .click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  expect((await response).status()).toBe(401);
  await expect(page.getByLabel("영상 제출과 버전")).toHaveCount(0);
  await login(page);
  await deliveryScenario(page, "success");
  expect((await deliveryView(page, contractId)).state.versions).toHaveLength(0);
  expect(
    (await deliveryRequest(page, `/__mock__/delivery-events/${room}`)).data,
  ).toEqual([]);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await shareDraft(page);
  const version = (await deliveryView(page, contractId)).state.versions[0];
  if (!version) throw new Error("missing version");
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "제출 결과를 확인하지 못했어요" }),
  ).toContainText("제출 결과를 확인하지 못했어요");
  await expect(page.getByLabel("선택한 영상 버전")).toHaveCount(0);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/media/${version.id}`,
      )
    ).status,
  ).toBe(404);
});

test("4-B 결제 후 미시작·준비 문제 보류는 제출 차단, 기존 영상 접근은 유지", async ({
  page,
}) => {
  const { contractId } = await setupDelivery(page, false, true);
  const productionPath = `/__mock__/production/${contractId}`;
  await expect(page.getByLabel("영상 제출과 버전")).toContainText(
    "제작 시작 전",
  );
  const missing = {
    id: crypto.randomUUID(),
    revision: 0,
    assetId: crypto.randomUUID(),
    kind: "DRAFT",
    description: "미시작",
    watermarkConfirmed: false,
  };
  expect(
    (await deliveryRequest(page, deliveryPath(contractId), missing)).status,
  ).toBe(409);
  await login(page, "client");
  expect(
    (
      await deliveryRequest(page, productionPath, {
        id: crypto.randomUUID(),
        revision: 0,
        action: {
          type: "plan",
          plan: { days: 7, product: false, file: true, info: false },
        },
      })
    ).status,
  ).toBe(200);
  await login(page);
  expect(
    (
      await deliveryRequest(page, productionPath, {
        id: crypto.randomUUID(),
        revision: 1,
        action: { type: "agree-plan" },
      })
    ).status,
  ).toBe(200);
  await login(page, "client");
  expect(
    (
      await deliveryRequest(page, productionPath, {
        id: crypto.randomUUID(),
        revision: 2,
        action: { type: "supply", key: "file", value: "촬영 정보" },
      })
    ).status,
  ).toBe(200);
  await login(page);
  expect(
    (
      await deliveryRequest(page, productionPath, {
        id: crypto.randomUUID(),
        revision: 3,
        action: {
          type: "check",
          key: "file",
          ready: true,
          reason: "정상 확인",
        },
      })
    ).status,
  ).toBe(200);
  await navigate(page, `/contracts/${contractId}/deliveries`);
  await shareDraft(page);
  const { state } = await deliveryView(page, contractId);
  const [version] = state.versions;
  if (!version) throw new Error("missing version");
  const before = productionViewSchema.parse(
    (await deliveryRequest(page, productionPath)).data,
  );
  expect(
    (
      await deliveryRequest(page, productionPath, {
        id: crypto.randomUUID(),
        revision: 4,
        action: {
          type: "check",
          key: "file",
          ready: false,
          reason: "제작 시작 후 누락 발견",
        },
      })
    ).status,
  ).toBe(200);
  await page
    .getByRole("button", { name: "영상 버전 재조회", exact: true })
    .click();
  await expect(page.getByLabel("영상 제출과 버전")).toContainText(
    "준비 문제 보류",
  );
  await expect(
    page.getByRole("button", { name: "영상 준비 (Mock 업로드)", exact: true }),
  ).toBeDisabled();
  expect(
    (
      await deliveryRequest(page, deliveryPath(contractId), {
        ...missing,
        id: crypto.randomUUID(),
        revision: state.revision,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(
        page,
        `${deliveryPath(contractId)}/media/${version.id}`,
      )
    ).status,
  ).toBe(200);
  const after = productionViewSchema.parse(
    (await deliveryRequest(page, productionPath)).data,
  );
  expect(after.state.startedAt).toBe(before.state.startedAt);
  expect(after.state.due).toBe(before.state.due);
  expect((await deliveryView(page, contractId)).state.versions).toHaveLength(1);
});
