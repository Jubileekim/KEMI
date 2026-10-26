import { writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(
  process.env.KEMI_PLAYWRIGHT
    ? pathToFileURL(process.env.KEMI_PLAYWRIGHT).href
    : "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  const base64 = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(24);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1000000,
    });
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    const result = new Promise((resolve) => {
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(blob);
      };
    });
    recorder.start();
    const start = performance.now();
    await new Promise((resolve) => {
      function frame(now) {
        const t = (now - start) / 1000;
        const g = ctx.createLinearGradient(0, 0, 960, 540);
        g.addColorStop(0, "#263c2d");
        g.addColorStop(0.65, "#b6bf94");
        g.addColorStop(1, "#e6ddbd");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 960, 540);
        ctx.fillStyle = "#526c42";
        ctx.beginPath();
        ctx.ellipse(140 + Math.sin(t) * 30, 300, 220, 400, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ece5cb";
        ctx.beginPath();
        ctx.ellipse(620 + Math.sin(t) * 20, 300, 90, 150, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f7f3e5";
        ctx.font = "12px sans-serif";
        ctx.fillText("K E M I   S T U D I O", 60, 65);
        ctx.font = "54px Georgia";
        ctx.fillText("A moment, together.", 60, 415);
        ctx.font = "13px sans-serif";
        ctx.fillText("SYNTHETIC DEMO FILM / NO CUSTOMER FOOTAGE", 60, 480);
        ctx.fillRect(60, 500, 840 * Math.min(t / 3, 1), 2);
        if (t < 3) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    return result;
  });
  await mkdir("apps/web/public", { recursive: true });
  await writeFile("apps/web/public/demo.webm", Buffer.from(base64, "base64"));
  const colors = [
    ["#334a2e", "#b4bc91", "#e4d9b8"],
    ["#503024", "#aa7552", "#dcc3a3"],
    ["#173a40", "#6f9c97", "#c3d8cd"],
    ["#656b51", "#b9bca0", "#e9e3ce"],
  ];
  for (let i = 0; i < 4; i++) {
    const [dark, mid, light] = colors[i];
    await writeFile(
      `apps/web/public/art-${i}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g"><stop stop-color="${dark}"/><stop offset=".65" stop-color="${mid}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs><path fill="url(#g)" d="M0 0h960v540H0z"/><ellipse cx="140" cy="300" rx="220" ry="400" fill="${dark}" transform="rotate(20 140 300)"/><ellipse cx="620" cy="300" rx="90" ry="150" fill="${light}" transform="rotate(-12 620 300)"/><text x="60" y="65" font-size="12" fill="#f7f3e5" font-family="sans-serif" letter-spacing="4">KEMI STUDIO</text><text x="60" y="415" font-size="54" fill="#f7f3e5" font-family="Georgia">A moment, together.</text><text x="60" y="480" font-size="13" fill="#f7f3e5" font-family="sans-serif">SYNTHETIC DEMO FILM / NO CUSTOMER FOOTAGE</text></svg>`,
    );
  }
  console.log("Generated synthetic 3-second video and four SVG posters.");
} finally {
  await browser.close();
}
