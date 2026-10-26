// Visual evidence for local MSW only.
const { chromium, expect } = require("@playwright/test");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(
        `${process.env.KEMI_QA_URL || "http://127.0.0.1:5184"}/campaigns`,
      );
      await expect(page.getByRole("article")).toHaveCount(6);
      await page.screenshot({
        path: path.join(__dirname, `list-${width}.png`),
        fullPage: true,
      });
      await page.getByRole("article").first().getByRole("link").click();
      await expect(page.getByRole("article")).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "최신 상태 확인" }),
      ).toBeEnabled();
      await page.screenshot({
        path: path.join(__dirname, `detail-${width}.png`),
        fullPage: true,
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
