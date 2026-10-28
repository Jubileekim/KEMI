// #92 배포 뒤 API 스모크 테스트: 기존 직접 의뢰 조회, 작품 저장함, 일괄 문의와 중복 전송 방지.
// 사용(PowerShell 예):
//   $env:KEMI_API_URL="https://kemi-api.onrender.com"
//   $env:KEMI_SMOKE_EMAIL="<시연 의뢰인 이메일>"; $env:KEMI_SMOKE_PASSWORD="<비밀번호>"
//   node qa/inquiry-release/smoke.mjs            # 조회·저장함만 (의뢰를 보내지 않음)
//   $env:KEMI_SMOKE_SEND="1"; node qa/inquiry-release/smoke.mjs   # 일괄 문의까지 보내고 바로 철회
// 시연 계정(@kemi.test)만 쓴다. 비밀번호·토큰은 출력하지 않는다. 만든 저장·의뢰는 끝에 되돌린다.
import { randomUUID } from "node:crypto";

const base = (process.env.KEMI_API_URL ?? "http://localhost:4100").replace(
  /\/+$/,
  "",
);
const email = process.env.KEMI_SMOKE_EMAIL ?? "";
const password = process.env.KEMI_SMOKE_PASSWORD ?? "";
const send = process.env.KEMI_SMOKE_SEND === "1";
if (!email.endsWith("@kemi.test") || !password) {
  console.error(
    "KEMI_SMOKE_EMAIL(@kemi.test 시연 의뢰인)과 KEMI_SMOKE_PASSWORD가 필요합니다.",
  );
  process.exit(2);
}

let token = "";
let failed = 0;
const results = [];
async function call(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
function check(name, ok, detail = "") {
  if (!ok) failed += 1;
  results.push(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
}

const ready = await call("GET", "/health/ready");
check(
  "상태 점검 /health/ready",
  ready.status === 200 && ready.body?.checks?.database === "ok",
  JSON.stringify(ready.body?.checks ?? {}),
);

const login = await call("POST", "/api/auth/login", { email, password });
token = login.body?.accessToken ?? "";
check(
  "시연 의뢰인 로그인",
  login.status === 200 && !!token,
  `HTTP ${login.status}`,
);
if (!token) {
  console.log(results.join("\n"));
  process.exit(1);
}

const directs = await call("GET", "/api/direct-requests");
check(
  "기존 직접 의뢰 조회(새 컬럼 포함)",
  directs.status === 200 && Array.isArray(directs.body?.items),
  `${directs.body?.items?.length ?? "?"}건`,
);

const feed = await call("GET", "/api/feed?pageSize=50");
const byCreator = new Map();
(feed.body?.items ?? []).forEach((item) => {
  if (!byCreator.has(item.creator.userId))
    byCreator.set(item.creator.userId, item.portfolio.id);
});
const picks = [...byCreator.values()].slice(0, 2);
check(
  "피드에서 서로 다른 제작자 작품 2개 찾기",
  picks.length === 2,
  picks.join(", "),
);

const before = await call("GET", "/api/me/work-bookmarks");
const alreadySaved = new Set(
  (before.body?.items ?? []).map((i) => i.portfolio.id),
);
const saves = await Promise.all(
  picks.map((id) => call("PUT", `/api/portfolios/${id}/bookmark`)),
);
check(
  "작품 저장",
  saves.every((r) => r.status === 200 && r.body?.saved === true),
);
const saved = await call("GET", "/api/me/work-bookmarks");
const savedIds = new Set((saved.body?.items ?? []).map((i) => i.portfolio.id));
check(
  "저장함 목록에 보임",
  picks.every((id) => savedIds.has(id)),
  `${saved.body?.items?.length ?? "?"}개`,
);

if (send) {
  const body = {
    commandId: randomUUID(),
    portfolioIds: picks,
    message: "[스모크 테스트] 배포 확인용 문의입니다. 곧 철회됩니다.",
    materialType: "PHOTOS_ONLY",
    eventDate: "2026-12-12",
    desiredDeliveryDate: "2026-12-05",
  };
  const first = await call("POST", "/api/direct-inquiries", body);
  const statuses = (first.body?.results ?? []).map((r) => r.status);
  check("일괄 문의 보내기", first.status === 201, statuses.join(", "));
  const again = await call("POST", "/api/direct-inquiries", body);
  const ids = (r) =>
    (r.body?.results ?? [])
      .filter((x) => x.request)
      .map((x) => x.request.id)
      .sort()
      .join(",");
  check(
    "같은 commandId 재전송은 중복 생성 없음",
    again.status === 201 && ids(first) === ids(again),
    ids(first) || "보낸 의뢰 없음",
  );
  const sent = (first.body?.results ?? []).filter((r) => r.request);
  if (sent[0]) {
    check(
      "보낸 의뢰에 공통 조건 저장",
      sent[0].request.materialType === "PHOTOS_ONLY" &&
        sent[0].request.desiredDeliveryDate === "2026-12-05" &&
        !!sent[0].request.referencePortfolio,
    );
  }
  const withdrawn = await Promise.all(
    sent.map((r) =>
      call("POST", `/api/direct-requests/${r.request.id}/withdraw`),
    ),
  );
  check(
    "스모크 의뢰 철회(정리)",
    withdrawn.every((r) => r.status === 200),
    `${withdrawn.length}건`,
  );
}

await Promise.all(
  picks
    .filter((id) => !alreadySaved.has(id))
    .map((id) => call("DELETE", `/api/portfolios/${id}/bookmark`)),
);
results.push(
  `정리: 이번에 저장한 작품 저장 해제${send ? ", 보낸 의뢰 철회" : ""}`,
);

console.log(
  `대상: ${base}\n${results.join("\n")}\n${failed === 0 ? "모두 통과" : `실패 ${failed}건`}`,
);
process.exit(failed === 0 ? 0 : 1);
