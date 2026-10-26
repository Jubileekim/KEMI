// Self-created test video, no external media or product data.
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent("<html><body></body></html>");
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      document.body.append(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      const stream = canvas.captureStream(10);
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8",
      });
      const chunks = [];
      let frame = 0;
      return new Promise((resolve, reject) => {
        const paint = setInterval(() => {
          frame += 1;
          ctx.fillStyle = "#367345";
          ctx.fillRect(0, 0, 320, 180);
          ctx.fillStyle = "white";
          ctx.font = "30px sans-serif";
          ctx.fillText(`KEMI Mock ${frame}`, 30, 100);
        }, 30);
        const deadline = setTimeout(() => {
          recorder.stop();
          reject(new Error("Fixture encoder produced no frame"));
        }, 10000);
        recorder.ondataavailable = (event) => {
          chunks.push(event.data);
          if (event.data.size > 256 && recorder.state === "recording")
            recorder.stop();
        };
        recorder.onstop = async () => {
          clearTimeout(deadline);
          clearInterval(paint);
          stream.getTracks().forEach((track) => track.stop());
          canvas.remove();
          const blob = new Blob(chunks, { type: "video/webm" });
          resolve(Array.from(new Uint8Array(await blob.arrayBuffer())));
        };
        recorder.start(100);
      });
    });
    const buffer = Buffer.from(bytes);
    expect(buffer.length).toBeGreaterThan(256);
    await page.evaluate((data) => {
      const video = document.createElement("video");
      video.id = "fixture";
      video.src = URL.createObjectURL(
        new Blob([new Uint8Array(data)], { type: "video/webm" }),
      );
      document.body.append(video);
    }, bytes);
    await expect
      .poll(() => page.locator("video").evaluate((video) => video.readyState))
      .toBeGreaterThanOrEqual(1);
    const folder = path.resolve(__dirname, "../../apps/web/e2e/fixtures");
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(path.join(folder, "kemi-review.webm"), buffer);
    process.stdout.write(
      `Playable self-created WebM: ${buffer.length} bytes; SHA256 ${crypto.createHash("sha256").update(buffer).digest("hex")}\n`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
