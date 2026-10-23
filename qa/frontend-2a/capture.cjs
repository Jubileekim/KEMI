// Local MSW visual evidence, never live API evidence.
const { chromium, expect } = require("@playwright/test");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(
        `${process.env.KEMI_QA_URL || "http://127.0.0.1:5182"}/login?returnTo=%2Fcampaigns%2Fnew`,
      );
      await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
      await page.getByLabel("이메일 (필수)").fill("client@example.test");
      await page
        .getByLabel("비밀번호 (필수)", { exact: true })
        .fill("Kemi1234");
      await page.getByRole("button", { name: "이메일로 로그인" }).click();
      await expect(
        page.getByLabel("캠페인 제목", { exact: true }),
      ).toBeEnabled();
      for (const [label, value] of [
        ["캠페인 제목", "우리 가족의 첫 기념 영상"],
        ["제품·서비스", "가족 기념 영상"],
        ["제작 목적", "소중한 순간을 함께 나누기"],
        ["작업 범위", "사진·클립 편집, 자막과 배경 음악, 세로 영상 1편"],
        ["예산 (원)", "150000"],
      ])
        await page.getByLabel(label, { exact: true }).fill(value);
      await page.screenshot({
        path: path.join(__dirname, `editor-${width}.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "공개 내용 확인" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({
        path: path.join(__dirname, `confirm-${width}.png`),
        animations: "disabled",
      });
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
