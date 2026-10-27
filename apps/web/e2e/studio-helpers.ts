import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

export async function loginStudio(page: Page) {
  await page.goto("/login?returnTo=%2Fstudio%2Fportfolio");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill("creator@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(
    page.getByRole("heading", { name: "작업물 관리", exact: true }),
  ).toBeVisible();
}
export async function localVideo(page: Page) {
  // A tiny synthetic muted WebM, reproducible with qa/frontend-1d/create-video-fixture.cjs.
  const bytes = await readFile(
    new URL("./fixtures/local-preview.webm", import.meta.url),
  );
  await page.getByLabel("영상 파일 (로컬 Mock)").setInputFiles({
    name: "sample.webm",
    mimeType: "video/webm",
    buffer: bytes,
  });
  await expect(
    page.getByRole("button", { name: "Mock 업로드 완료 처리" }),
  ).toBeEnabled();
  const video = page.getByLabel("선택한 영상 미리보기");
  await video.evaluate(async (element) => {
    if (!(element instanceof HTMLVideoElement))
      throw new Error("Video missing");
    await element.play();
  });
  await expect
    .poll(() =>
      video.evaluate((element) =>
        element instanceof HTMLVideoElement ? element.currentTime : 0,
      ),
    )
    .toBeGreaterThan(0);
  await video.evaluate((element) => {
    if (element instanceof HTMLVideoElement) element.pause();
  });
}
export async function workFields(page: Page, title = "개인 샘플") {
  await page.getByRole("button", { name: "새 작업물 만들기" }).click();
  await page.getByLabel("작업물 제목", { exact: true }).fill(title);
  await page
    .getByLabel("작업물 설명", { exact: true })
    .fill("직접 촬영하고 편집한 영상");
  await page.getByLabel("스타일 (임시 자유 입력)").fill("자연스러운");
  await page.getByLabel("작업유형 (임시 자유 입력)").fill("숏폼");
  await page.getByLabel("작업물 출처", { exact: true }).fill("직접 제작");
  await page.getByLabel("촬영", { exact: true }).check();
  await page.getByLabel("편집", { exact: true }).check();
  await page.getByLabel("본인에게 공개 권한이 있어요").check();
}
