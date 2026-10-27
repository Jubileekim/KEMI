import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5196/works/sample-work-1");
  await expect(page.getByLabel("공개 샘플 영상")).toBeVisible();
  await page.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  const png = await page.getByLabel("공개 샘플 영상").evaluate((video) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await writeFile(
    new URL(
      "../../apps/web/src/mocks/assets/catalog-poster.png",
      import.meta.url,
    ),
    Buffer.from(png, "base64"),
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:5196/");
    await expect(page.getByRole("article")).toHaveCount(3);
    await page.screenshot({
      path: fileURLToPath(new URL(`./feed-${width}.png`, import.meta.url)),
      fullPage: true,
    });
    console.log(
      width,
      await page.evaluate(() =>
        [...document.querySelectorAll("*")]
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .map((e) => ({
            tag: e.tagName,
            cls: e.className,
            text: e.textContent?.slice(0, 70),
            width: e.getBoundingClientRect().width,
          }))
          .slice(0, 8),
      ),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
} finally {
  await browser.close();
}
