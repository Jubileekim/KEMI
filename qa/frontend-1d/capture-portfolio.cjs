const { chromium, expect } = require("@playwright/test");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    baseURL: process.env.KEMI_QA_URL || "http://127.0.0.1:5180",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login?returnTo=%2Fstudio%2Fportfolio");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill("creator@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.getByRole("button", { name: "새 작업물 만들기" }).click();
  const fields = {
    "작업물 제목": "일상의 장면을 담은 개인 샘플",
    "작업물 설명": "직접 촬영과 편집을 맡아 완성한 숏폼 영상입니다.",
    "스타일 (임시 자유 입력)": "자연스러운 일상",
    "작업유형 (임시 자유 입력)": "제품 숏폼",
    "작업물 출처": "직접 제작 · 개인 샘플",
  };
  for (const [label, value] of Object.entries(fields))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByLabel("촬영", { exact: true }).check();
  await page.getByLabel("편집", { exact: true }).check();
  await page.getByLabel("본인에게 공개 권한이 있어요").check();
  await page
    .getByLabel("영상 파일 (로컬 Mock)")
    .setInputFiles(
      path.resolve(__dirname, "../../apps/web/e2e/fixtures/local-preview.webm"),
    );
  await expect(
    page.getByRole("button", { name: "Mock 업로드 완료 처리" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Mock 업로드 완료 처리" }).click();
  const video = page.getByLabel("선택한 영상 미리보기");
  await video.evaluate(async (element) => {
    await element.play();
  });
  await expect
    .poll(() => video.evaluate((element) => element.currentTime))
    .toBeGreaterThan(0);
  await video.evaluate((element) => element.pause());
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: path.join(__dirname, `portfolio-editor-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "공개 작업물로 저장" }).click();
  await page.getByRole("button", { name: "작업물 삭제", exact: true }).click();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("dialog").evaluate(async (element) => {
      await Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      );
    });
    await page.screenshot({
      path: path.join(__dirname, `portfolio-delete-${width}.png`),
      fullPage: false,
    });
  }
  expect(errors).toEqual([]);
  await browser.close();
  process.stdout.write("4 portfolio captures; page errors 0\n");
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
