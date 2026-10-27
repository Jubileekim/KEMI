import { test, expect, type Page } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { login, navigate } from "./proposal-helpers";
import { deliveryRequest } from "./delivery-helpers";
import {
  setupCancellation,
  proposeCancellation,
  confirmCancellation,
  resolutionView,
  resolutionPath,
  resolutionScenario,
} from "./cancellation-helpers";

// Full three-role public recruitment + refund/file/operations journeys.
test.setTimeout(150_000);
async function agree(page: Page, contractId: string) {
  await confirmCancellation(page);
  await expect(page.getByLabel("취소 합의 버전")).toContainText("1/2");
  await login(page);
  await navigate(page, `/contracts/${contractId}/cancellation`);
  await confirmCancellation(page);
  await expect(page.getByLabel("취소 합의 버전")).toContainText("2/2");
}
async function ops(page: Page, contractId: string) {
  await login(page, "ops");
  await page.getByRole("link", { name: "분쟁·보류 검토", exact: true }).click();
  const review = page.getByLabel(`운영 검토 ${contractId}`, { exact: true });
  await expect(review).toBeVisible();
  await review
    .getByLabel("검토·보류 해제 근거")
    .fill("양측 같은 합의 버전·환불 원결제·파일 수령 기록 대조");
  await review
    .getByLabel("다음 안내")
    .fill("당사자가 합의 결과를 재확인해 주세요.");
  return review;
}
test("5-B: 20만원→분쟁·양측합의→12만원 환불→ZIP 인도/수령→근거 해제→7.2만원 정산", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (
      /\/api\/(refund|dispute|settle|cancellation)|toss|supabase/.test(r.url())
    )
      external.push(r.url());
  });
  const { contractId, room } = await setupCancellation(page, 200000);
  await proposeCancellation(page, "80000");
  await page.getByLabel("분쟁 사유", { exact: true }).fill("작업 범위 이견");
  await page
    .getByLabel("증빙·관련 버전·진행 기록", { exact: true })
    .fill("같은 작업방 조건서v1·원결제·편집 내역 대조");
  await page
    .getByRole("button", { name: "분쟁 접수·정산 보류 (Mock)", exact: true })
    .click();
  await page
    .getByRole("link", { name: "이 분쟁 현황 보기", exact: true })
    .click();
  await expect(page.getByLabel("분쟁 현황", { exact: true })).toContainText(
    "담당 미배정",
  );
  await page
    .getByRole("link", {
      name: "같은 작업 공간에서 대화·증빙 확인",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("메시지 (Mock 최대 4,000자)")).toBeEnabled();
  await page
    .getByRole("link", { name: "취소 요청·합의 (Mock)", exact: true })
    .click();
  await agree(page, contractId);
  await expect(
    page.getByRole("button", {
      name: "합의 금액 테스트 환불 확인 (Mock)",
      exact: true,
    }),
  ).toHaveCount(0);
  const before = await resolutionView(page, contractId);
  const versionId = before.state.versions.at(-1)?.id;
  const disputeId = before.state.workflow.disputes.at(-1)?.id;
  if (!versionId || !disputeId) throw new Error("missing agreement/dispute");
  expect(
    (
      await deliveryRequest(page, resolutionPath(contractId), {
        type: "refund",
        id: crypto.randomUUID(),
        revision: before.state.revision,
        versionId,
        orderId: before.orderId,
      })
    ).status,
  ).toBe(409);
  let review = await ops(page, contractId);
  await review
    .getByRole("button", { name: "검토 기록·보류 유지 (Mock)", exact: true })
    .click();
  await expect(review).toContainText("담당 mock-ops");
  await review
    .getByRole("button", {
      name: "합의 근거로 분쟁 보류 해제 (Mock)",
      exact: true,
    })
    .click();
  await expect(review).toContainText("근거 기록 후 합의 흐름 복귀");
  await login(page, "client");
  await navigate(page, `/disputes/${disputeId}`);
  await expect(page.getByLabel("분쟁 현황", { exact: true })).toContainText(
    "담당 mock-ops",
  );
  await page
    .getByRole("link", { name: "취소 합의·환불·파일 확인", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "합의 금액 테스트 환불 확인 (Mock)",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "테스트 환불 성공",
  );
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "취소 완료 아님",
  );
  await expect(
    page.getByRole("button", {
      name: "취소 완료·잔여 모의 정산 확인",
      exact: true,
    }),
  ).toHaveCount(0);
  await login(page);
  await navigate(page, `/contracts/${contractId}/cancellation`);
  const zip = fileURLToPath(
    new URL("./fixtures/kemi-final.zip", import.meta.url),
  );
  await page
    .getByLabel(
      "취소 합의 인도 파일 (MP4/WebM/ZIP·개발 예시 파일당 300MiB/20개)",
      { exact: true },
    )
    .setInputFiles(zip);
  await page
    .getByRole("button", { name: "취소 합의 파일 준비 (Mock)", exact: true })
    .click();
  await expect(
    page.getByLabel("준비한 취소 파일", { exact: true }),
  ).toContainText("kemi-final.zip");
  await page
    .getByLabel("취소 합의 파일 인도 설명", { exact: true })
    .fill("동일 합의 버전의 현재 작업본·원본 ZIP");
  await page
    .getByRole("button", {
      name: "취소 합의 파일 정식 인도 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("인도된 합의 파일", { exact: true }),
  ).toContainText("합의 파일 수령 미확인");
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/cancellation`);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "kemi-final.zip 합의 파일 다운로드",
      exact: true,
    })
    .click();
  const download = await downloading;
  const saved = await download.path();
  if (!saved) throw new Error("missing downloaded ZIP");
  expect(
    createHash("sha256")
      .update(await readFile(saved))
      .digest("hex"),
  ).toBe(
    createHash("sha256")
      .update(await readFile(zip))
      .digest("hex"),
  );
  expect(
    (await resolutionView(page, contractId)).state.workflow.receipt,
  ).toBeNull();
  await page
    .getByLabel("실제 인도 파일·미인도 항목·원본·사용권이 취소 합의와 일치해요")
    .check();
  await page
    .getByRole("button", {
      name: "취소 합의 파일 수령 확인 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("인도된 합의 파일", { exact: true }),
  ).toContainText("전용 수령 기록 있음");
  review = await ops(page, contractId);
  await review
    .getByRole("button", {
      name: "환불·파일 근거로 취소 정산 보류 해제 (Mock)",
      exact: true,
    })
    .click();
  await expect(review).toContainText("취소 정산 보류 해제 근거");
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/cancellation`);
  await page
    .getByRole("button", { name: "취소 완료·잔여 모의 정산 확인", exact: true })
    .click();
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "부분 취소 완료 (Mock)",
  );
  await expect(page.getByLabel("잔여 모의 정산 내역")).toContainText(
    "72,000원",
  );
  const final = await resolutionView(page, contractId);
  expect(final.state.workflow.refunds.at(-1)).toMatchObject({
    amount: 120000,
    status: "SUCCEEDED",
  });
  expect(final.state.workflow.settlement).toMatchObject({
    compensation: 80000,
    fee: 8000,
    net: 72000,
    status: "SUCCEEDED",
  });
  await login(page);
  await navigate(page, `/contracts/${contractId}/cancellation`);
  await expect(page.getByLabel("잔여 모의 정산 내역")).toContainText(
    "72,000원",
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
  await mkdir("../../qa/frontend-5", { recursive: true });
  await page.setViewportSize({
    width: info.project.name.includes("mobile") ? 390 : 1280,
    height: 900,
  });
  await page.screenshot({
    path: `../../qa/frontend-5/partial-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await navigate(page, `/workspace/${room}`);
  await expect(page.getByLabel("메시지 (Mock 최대 4,000자)")).toBeEnabled();
});

test("5-B: 전액 환불·미확정·확정 실패·유실 복구·역할 거부·파일 없는 인도와 근거 해제", async ({
  page,
}) => {
  const { contractId } = await setupCancellation(page);
  await proposeCancellation(page, "0");
  await agree(page, contractId);
  await resolutionScenario(page, "unknown");
  await page
    .getByRole("button", {
      name: "합의 금액 테스트 환불 확인 (Mock)",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "결과 확인 중",
  );
  const view = await resolutionView(page, contractId);
  const versionId = view.state.versions.at(-1)?.id;
  if (!versionId) throw new Error("missing agreement");
  expect(
    (
      await deliveryRequest(page, resolutionPath(contractId), {
        type: "refund",
        id: crypto.randomUUID(),
        revision: view.state.revision,
        versionId,
        orderId: view.orderId,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await deliveryRequest(page, resolutionPath(contractId), {
        type: "refund",
        id: crypto.randomUUID(),
        revision: view.state.revision,
        versionId,
        orderId: view.orderId,
        amount: 1,
        outcome: "SUCCEEDED",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await deliveryRequest(
        page,
        `/__mock__/operations/resolution/${contractId}`,
        {
          type: "release",
          id: crypto.randomUUID(),
          revision: view.state.revision,
          versionId,
          reason: "자가 해제",
        },
      )
    ).status,
  ).toBe(404);
  await resolutionScenario(page, "failed");
  await page
    .getByRole("button", { name: "기존 테스트 환불 결과 확인", exact: true })
    .click();
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "테스트 환불 실패",
  );
  await resolutionScenario(page, "lost-response");
  await page
    .getByRole("button", {
      name: "합의 금액 테스트 환불 확인 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", { name: "같은 취소 요청 재시도" }),
  ).toBeVisible();
  await resolutionScenario(page, "success");
  await page
    .getByRole("button", { name: "취소 상태 재조회", exact: true })
    .click();
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "테스트 환불 성공",
  );
  const after = await resolutionView(page, contractId);
  expect(
    after.state.workflow.refunds.filter((r) => r.status === "SUCCEEDED"),
  ).toHaveLength(1);
  expect(after.state.workflow.refunds.at(-1)?.amount).toBe(100000);
  await page
    .getByLabel(
      "파일 없는 인도로 제시해요 (의뢰인이 합의와 일치하는지 별도 확인)",
    )
    .check();
  await page
    .getByLabel("취소 합의 파일 인도 설명", { exact: true })
    .fill("완료 작업 없음·권리 미부여·인도 파일 없음 제시");
  await page
    .getByRole("button", {
      name: "취소 합의 파일 정식 인도 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("인도된 합의 파일", { exact: true }),
  ).toContainText("인도 파일 없음");
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/cancellation`);
  await page
    .getByLabel("실제 인도 파일·미인도 항목·원본·사용권이 취소 합의와 일치해요")
    .check();
  await page
    .getByRole("button", {
      name: "취소 합의 파일 수령 확인 (Mock)",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("인도된 합의 파일", { exact: true }),
  ).toContainText("전용 수령 기록 있음");
  await navigate(page, "/ops/disputes");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  const review = await ops(page, contractId);
  const opsView = (
    await deliveryRequest(page, `/__mock__/operations/resolution/${contractId}`)
  ).data;
  expect(opsView).toMatchObject({ contractId });
  expect(
    (
      await deliveryRequest(
        page,
        `/__mock__/operations/resolution/${contractId}`,
        {
          type: "confirm",
          id: crypto.randomUUID(),
          revision: after.state.revision,
          versionId,
          consent: true,
        },
      )
    ).status,
  ).toBe(403);
  await review
    .getByRole("button", {
      name: "환불·파일 근거로 취소 정산 보류 해제 (Mock)",
      exact: true,
    })
    .click();
  await expect(review).toContainText("취소 정산 보류 해제 근거");
  await login(page, "client");
  await navigate(page, `/contracts/${contractId}/cancellation`);
  await page
    .getByRole("button", { name: "취소 완료·잔여 모의 정산 확인", exact: true })
    .click();
  await expect(page.getByLabel("테스트 환불·잔여 정산")).toContainText(
    "전액 취소 완료 (Mock)",
  );
  expect(
    (await resolutionView(page, contractId)).state.workflow.settlement,
  ).toMatchObject({ compensation: 0, fee: 0, net: 0 });
});
