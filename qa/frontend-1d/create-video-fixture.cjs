// Recreate a tiny synthetic green video fixture. No external media. Requires dev server.
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
  const p = await b.newPage();
  await p.goto(process.env.KEMI_QA_URL || "http://127.0.0.1:5180");
  const r = await p.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    document.body.append(c);
    const x = c.getContext("2d");
    const s = c.captureStream(0);
    const track = s.getVideoTracks()[0];
    const rec = new MediaRecorder(s, { mimeType: "video/webm;codecs=vp8" });
    const ch = [];
    const blob = await new Promise((res) => {
      rec.ondataavailable = (e) => ch.push(e.data);
      rec.onstop = () => res(new Blob(ch, { type: "video/webm" }));
      rec.start();
      let t = 0;
      const timer = setInterval(() => {
        x.fillStyle = t++ % 2 ? "#367345" : "#539863";
        x.fillRect(0, 0, 64, 64);
        track.requestFrame();
      }, 100);
      setTimeout(() => {
        clearInterval(timer);
        rec.stop();
      }, 1500);
    });
    s.getTracks().forEach((t) => t.stop());
    const v = document.createElement("video");
    v.muted = true;
    v.src = URL.createObjectURL(blob);
    const events = [];
    ["loadedmetadata", "loadeddata", "canplay", "error"].forEach((e) =>
      v.addEventListener(e, () => events.push(e)),
    );
    document.body.append(v);
    await new Promise((res) => setTimeout(res, 1000));
    return {
      size: blob.size,
      events,
      bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
    };
  });
  if (!r.events.includes("canplay") || r.size < 150)
    throw new Error(
      "Generated video cannot be decoded; fixture was not replaced",
    );
  await require("fs/promises").writeFile(
    require("path").join(
      __dirname,
      "../../apps/web/e2e/fixtures/local-preview.webm",
    ),
    Buffer.from(r.bytes),
  );
  process.stdout.write(JSON.stringify({ size: r.size, events: r.events }));
  await b.close();
})();
