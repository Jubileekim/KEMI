// Local, disposable visual-QA data. Never imported by the app or deployed.
// Run: node qa/landing/preview-api.cjs (Vite's default /api proxy uses port 4000).
const http = require("node:http");
const rows = [
  ["비 오는 밤 창가", "SNS_SHORTFORM", "rainy-cafe", "노을숏폼랩", 120000],
  ["파도 위를 걷는 둘", "TRAVEL_DAILY", "sunset-couple", "노을숏폼랩", 120000],
  ["자동차와 노을", "WEDDING_COUPLE", "sunset-couple", "노을숏폼랩", 120000],
  ["한옥 골목 스케치", "TRAVEL_DAILY", "rainy-cafe", "브루스튜디오", 250000],
  [
    "침대 위 브런치 (세로)",
    "SNS_SHORTFORM",
    "espresso",
    "브루스튜디오",
    250000,
  ],
  ["에스프레소 추출", "OTHER", "espresso", "브루스튜디오", 250000],
  ["반지 클로즈업", "WEDDING_COUPLE", "sunset-couple", "루미필름", 450000],
  ["웨딩 케이크 디테일", "WEDDING_COUPLE", "espresso", "루미필름", 450000],
  ["부케 스냅 오프닝", "WEDDING_COUPLE", "sunset-couple", "루미필름", 450000],
];
let state = "populated";
http
  .createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
    const url = new URL(req.url, "http://127.0.0.1:4000");
    const json = (body, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(body));
    };
    // Shell-only control for manual error/retry checks, bound to loopback.
    if (req.method === "POST" && url.pathname === "/__fixture/state") {
      const next = url.searchParams.get("value");
      if (!["populated", "empty", "error"].includes(next)) return json({}, 400);
      state = next;
      return json({ state });
    }
    if (req.method !== "GET")
      return json({ error: { code: "NOT_FOUND" } }, 404);
    if (url.pathname === "/api/feed") {
      if (state === "error")
        return json({ error: { code: "SERVICE_UNAVAILABLE" } }, 503);
      const purpose = url.searchParams.get("purpose");
      const items = rows
        .map(([title, category, , name, price], i) => ({
          portfolio: {
            id: String(i + 1),
            creatorId: String(i + 101),
            title,
            purpose: category,
            thumbnailFileId: String(i + 201),
            videoFileId: null,
            packageId: null,
            description: "로컬 화면 검증 데이터",
            styles: [],
            roles: [],
            source: "OWN_WORK",
            clientConsent: false,
            status: "PUBLIC",
            publishedAt: null,
            createdAt: "2026-10-28T00:00:00Z",
            updatedAt: "2026-10-28T00:00:00Z",
          },
          creator: { userId: String(i + 101), name: `[미리보기] ${name}` },
          startingPriceKrw: price,
        }))
        .filter((item) => !purpose || item.portfolio.purpose === purpose);
      return json({
        items: state === "empty" ? [] : items,
        total: state === "empty" ? 0 : items.length,
        page: 1,
        pageSize: 12,
      });
    }
    const media = url.pathname.match(/^\/api\/portfolios\/([1-9]\d*)\/media$/);
    if (media && rows[Number(media[1]) - 1]) {
      const image = rows[Number(media[1]) - 1][2];
      return json({
        video: null,
        thumbnail: {
          url: `/landing/${image}.png`,
          expiresAt: "2099-01-01T00:00:00Z",
        },
      });
    }
    return json({ error: { code: "NOT_FOUND" } }, 404);
  })
  .listen(4000, "127.0.0.1", () =>
    console.log(
      "Landing visual-QA fixture: http://127.0.0.1:4000 (not production data)",
    ),
  );
