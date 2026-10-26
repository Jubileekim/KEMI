import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.KEMI_PLAYWRIGHT
    ? pathToFileURL(process.env.KEMI_PLAYWRIGHT).href
    : "playwright"
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const origin = process.env.KEMI_URL ?? "http://127.0.0.1:5173";
const results = [],
  errors = [];
await mkdir("qa/pdf-frontend", { recursive: true });
async function run(name, fn) {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
}
async function setup(viewport = { width: 1440, height: 1050 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  return { context, page };
}
const role = async (p, r) => {
  await p.getByLabel("시연 역할", { exact: true }).selectOption(r);
  await p.waitForFunction(
    (value) =>
      document.querySelector(".demo-banner")?.getAttribute("data-demo-role") ===
      value,
    r,
  );
};
const go = (p, path) => p.goto(origin + path);
async function create(p, direct = true) {
  if (direct) {
    await role(p, "client");
    await go(p, "/creators/creator/request");
    await p.getByLabel("프로젝트 제목", { exact: true }).fill("직접 의뢰 시연");
    await p
      .getByLabel("제작 조건과 요청 사항", { exact: true })
      .fill("브랜드 영상 1편 기획 촬영 편집");
    await p
      .getByRole("button", { name: "직접 의뢰 보내기", exact: true })
      .click();
    await p.getByRole("button", { name: "의뢰 현황 보기" }).click();
  } else {
    await role(p, "creator");
    await go(p, "/campaigns/c1/apply");
    await p
      .getByLabel("제안서", { exact: true })
      .fill("공개 모집 영상 제작 제안");
    await p.getByRole("button", { name: "제안서 제출", exact: true }).click();
  }
  await p.locator(".request-row").first().click();
  const id = new URL(p.url()).pathname.split("/").at(-1);
  await role(p, direct ? "creator" : "client");
  await p.getByRole("button", { name: "협의 요청 수락", exact: true }).click();
  await p.getByRole("link", { name: "대화 · 작업 공간 열기" }).click();
  return id;
}
async function contract(p) {
  await p.getByRole("button", { name: "조건서 작성", exact: true }).click();
  await p
    .getByLabel("제작 범위 및 필수 산출물", { exact: true })
    .fill("영상 1편, 기획 촬영 편집, 최종 파일 인도");
  await p.getByRole("button", { name: "새 조건서 저장" }).click();
  await p.getByRole("button", { name: "48시간 확인 요청" }).click();
  await p.getByRole("button", { name: "현재 역할로 v1 서명" }).click();
  await p.getByText("첫 서명 · 아직 미선정", { exact: true }).waitFor();
  const current = await p.getByLabel("시연 역할", { exact: true }).inputValue();
  await role(p, current === "client" ? "creator" : "client");
  await p.getByRole("button", { name: "현재 역할로 v1 서명" }).click();
  await p.getByRole("heading", { name: "양측 서명으로 확정된 계약" }).waitFor();
}
async function pay(p, id) {
  await role(p, "client");
  await go(p, `/contracts/${id}/payment`);
  await p
    .getByRole("button", { name: "시연 결제 시작 · 승인 확인 중" })
    .click();
  await p.getByRole("button", { name: "시연 승인 결과 조회: 실패" }).click();
  await p.getByText("결제 실패", { exact: true }).waitFor();
  await p.getByRole("button", { name: "시연 승인 결과 조회: 성공" }).click();
  await p.getByText("시연 승인 결과: 성공", { exact: true }).waitFor();
}
async function finish(p, id) {
  await go(p, `/workspace/${id}`);
  await p.getByRole("tab", { name: "결제 · 제작 준비" }).click();
  await p.getByRole("button", { name: "준비 상태 저장" }).click();
  await role(p, "creator");
  await p.getByRole("button", { name: "준비 상태 저장" }).click();
  await p
    .getByLabel("시연용 합의 납기", { exact: true })
    .fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 16));
  await p.getByRole("button", { name: "제작 시작 · 납기 기록" }).click();
  await p.locator(".countdown").waitFor();
  await p.getByRole("tab", { name: "납품 · 검토" }).click();
  await p.getByLabel("납품 종류", { exact: true }).selectOption("검토본");
  await p.getByRole("button", { name: "정식 제출하기" }).click();
  await role(p, "client");
  await p
    .getByRole("button", { name: "최신 검토본 승인", exact: true })
    .click();
  await role(p, "creator");
  await p.getByLabel("납품 종류", { exact: true }).selectOption("최종 파일");
  await p.getByRole("button", { name: "정식 제출하기" }).click();
  await role(p, "client");
  const download = p.waitForEvent("download");
  await p.getByRole("link", { name: "시연 최종 파일 다운로드" }).click();
  assert.ok((await download).suggestedFilename().endsWith(".webm"));
  await p.getByRole("button", { name: "최종 수령 확인", exact: true }).click();
  await p.getByRole("tab", { name: "정산 · 리뷰" }).click();
  await p.getByText("180,000원", { exact: true }).waitFor();
  await p
    .getByLabel("거래 리뷰", { exact: true })
    .fill("함께 좋은 영상을 만들었어요.");
  await p.getByRole("button", { name: "리뷰 등록 · 한 번만 가능" }).click();
  await role(p, "creator");
  await p
    .getByLabel("거래 리뷰", { exact: true })
    .fill("원활한 협업이었습니다.");
  await p.getByRole("button", { name: "리뷰 등록 · 한 번만 가능" }).click();
  assert.equal(await p.locator(".review-entry").count(), 2);
}
try {
  const { page: p, context: c } = await setup();
  await run("홈 필터·빈 결과·동영상 재생", async () => {
    assert.equal(await p.locator(".work-card").count(), 6);
    await p.getByRole("button", { name: "웨딩", exact: true }).click();
    await p.waitForFunction(
      () =>
        document.querySelector(".filter-tabs button.active")?.textContent ===
        "웨딩",
    );
    await p.getByLabel("스타일 필터").selectOption("감각적인");
    await p
      .getByRole("heading", { name: "조건에 맞는 공개 작품이 없어요" })
      .waitFor();
    await go(p, "/works/w1");
    await p.locator("video").evaluate((v) => v.play());
    await p.waitForFunction(
      () => document.querySelector("video").currentTime > 0.1,
    );
    await p.locator("video").evaluate((v) => v.pause());
  });
  await run("비회원 보호와 시연 로그인", async () => {
    await go(p, "/me/profile");
    await p.waitForURL("**/login?**");
    await p.getByRole("button", { name: "선택한 역할로 시연 시작" }).click();
    await p
      .getByRole("heading", { name: "당신의 이야기를 소개해 주세요" })
      .waitFor();
  });
  await run("모집 검색·정렬·페이지·AI 실패 시 수동 예산 보존", async () => {
    await go(p, "/campaigns");
    await p.getByRole("button", { name: "2", exact: true }).click();
    await p.waitForURL("**page=2");
    await p.waitForFunction(
      () => document.querySelectorAll(".campaign-card").length === 2,
    );
    assert.equal(await p.locator(".campaign-card").count(), 2);
    await p.getByLabel("캠페인 검색").fill("존재하지않는검색어");
    await p
      .getByRole("heading", { name: "해당하는 캠페인이 없어요" })
      .waitFor();
    await go(p, "/campaigns/new");
    await p.getByLabel("제작 조건", { exact: true }).fill("30초 영상");
    await p.getByLabel("제작 예산 (원)", { exact: true }).fill("340000");
    await p.getByRole("button", { name: "분석 실패 상태 보기" }).click();
    assert.equal(
      await p.getByLabel("제작 예산 (원)", { exact: true }).inputValue(),
      "340000",
    );
    await p.getByRole("button", { name: "예시 분석 결과 보기" }).click();
    assert.equal(
      await p.getByLabel("제작 예산 (원)", { exact: true }).inputValue(),
      "340000",
    );
  });
  let id;
  await run("직접 의뢰·협의·메시지 실패 재전송·양측 조건 서명", async () => {
    id = await create(p);
    await p.getByLabel("대화 메시지", { exact: true }).fill("테스트 메시지");
    await p.getByLabel("전송 실패 시연").check();
    await p.getByRole("button", { name: "메시지 보내기" }).click();
    await p.getByText("전송 실패", { exact: true }).waitFor();
    await p.getByRole("button", { name: "재시도", exact: true }).click();
    assert.equal(await p.getByText("전송 실패", { exact: true }).count(), 0);
    await contract(p);
    await p.screenshot({
      path: "qa/pdf-frontend/workspace-desktop.png",
      fullPage: true,
    });
  });
  await run("직접 거래 결제 실패·조회·제작·납품·수령·양측 리뷰", async () => {
    await pay(p, id);
    await finish(p, id);
  });
  await run("알림 대상 이동과 읽음", async () => {
    await role(p, "client");
    await go(p, "/notifications");
    const row = p.locator(".notification-row.unread").first();
    await row.waitFor();
    await row.click();
    assert.ok(new URL(p.url()).pathname.startsWith("/workspace/"));
  });
  await run("공개 모집 경로 정상 거래", async () => {
    const id2 = await create(p, false);
    await contract(p);
    await pay(p, id2);
    await finish(p, id2);
  });
  await run(
    "직접 의뢰 부분 환불·합의 파일 인도·72,000원 모의 지급",
    async () => {
      const id3 = await create(p);
      await contract(p);
      await pay(p, id3);
      await go(p, `/contracts/${id3}/cancellation`);
      await p.getByLabel("취소 사유", { exact: true }).fill("범위 축소 합의");
      await p
        .getByLabel("인도할 파일 (없으면 없음)", { exact: true })
        .fill("완료된 샘플 파일");
      await p
        .getByLabel("미완성 상태", { exact: true })
        .fill("편집 일부 미완성");
      await p
        .getByLabel("사용권 합의", { exact: true })
        .fill("인도 파일만 사용");
      await p
        .getByRole("button", { name: "취소 합의 작성", exact: true })
        .click();
      await p
        .getByRole("button", { name: "현재 역할로 취소 합의 승인" })
        .click();
      await role(p, "creator");
      await p
        .getByRole("button", { name: "현재 역할로 취소 합의 승인" })
        .click();
      await role(p, "client");
      await p.getByRole("button", { name: "시연 환불 성공 결과 반영" }).click();
      await p
        .getByRole("button", { name: "합의 파일 인도 확인", exact: true })
        .click();
      await p.getByText("72,000원", { exact: true }).waitFor();
      await p.screenshot({
        path: "qa/pdf-frontend/cancellation-desktop.png",
        fullPage: true,
      });
    },
  );
  await run("분쟁 보류·증빙·운영 처리 근거", async () => {
    const id4 = await create(p);
    await contract(p);
    await go(p, `/disputes/${id4}`);
    await p
      .getByLabel("문제 내용과 증빙 설명", { exact: true })
      .fill("파일에 누락이 있습니다.");
    await p.getByRole("button", { name: "신고 · 증빙 기록" }).click();
    await p.getByText("분쟁 보류 · 정산 차단", { exact: true }).waitFor();
    await role(p, "ops");
    await go(p, "/ops/reports");
    await p
      .getByLabel("처리 사유 · 근거", { exact: true })
      .fill("양측 확인 후 보류 해제");
    await p.getByRole("button", { name: "시연 보류 해제 · 근거 기록" }).click();
    await p.getByText("보류 해제 이력 있음", { exact: true }).waitFor();
  });
  await run("새로고침 후 데이터와 시연 역할 보존", async () => {
    await role(p, "client");
    await p.reload();
    assert.equal(
      await p.getByLabel("시연 역할", { exact: true }).inputValue(),
      "client",
    );
    await role(p, "client");
    await go(p, "/requests");
    assert.equal(await p.locator(".request-row").count(), 4);
  });
  await run("개인 의뢰인 브랜드 선택 입력·역할별 프로필 분리", async () => {
    await go(p, "/me/profile");
    await p.getByLabel("표시 이름", { exact: true }).fill("개인 의뢰인 테스트");
    await p.getByLabel("브랜드 정보 (선택)", { exact: true }).fill("");
    await p.getByRole("button", { name: "프로필 저장", exact: true }).click();
    await role(p, "creator");
    assert.equal(
      await p.getByLabel("표시 이름", { exact: true }).inputValue(),
      "스튜디오 모먼트",
    );
  });
  await run("패키지 초안·대표 공개·포트폴리오 비공개", async () => {
    await go(p, "/studio/packages");
    await p.getByLabel("패키지 이름", { exact: true }).fill("새 시연 패키지");
    await p.getByRole("button", { name: "패키지 저장", exact: true }).click();
    await p
      .getByRole("heading", { name: "새 시연 패키지", exact: true })
      .waitFor();
    await p
      .locator(".panel")
      .filter({
        has: p.getByRole("heading", { name: "새 시연 패키지", exact: true }),
      })
      .getByRole("button", { name: "수정", exact: true })
      .click();
    await p.getByLabel("공개 패키지", { exact: true }).check();
    await p.getByLabel("대표 패키지 (하나만 지정)", { exact: true }).check();
    await p.getByRole("button", { name: "패키지 저장", exact: true }).click();
    await go(p, "/studio/portfolio");
    await p.locator(".portfolio-row").first().click();
    await p.getByLabel("공개", { exact: true }).uncheck();
    await p.getByRole("button", { name: "작품 저장", exact: true }).click();
    await go(p, "/works/w1");
    await p
      .getByRole("heading", { name: "공개된 작품을 찾을 수 없어요" })
      .waitFor();
  });
  await run("모집 임시 저장·공개·신규 마감과 무선정 종료", async () => {
    await role(p, "client");
    await go(p, "/campaigns/new");
    await p.getByLabel("모집 제목", { exact: true }).fill("새 모집 테스트");
    await p.getByLabel("제작 조건", { exact: true }).fill("시연 제작 조건");
    await p.getByRole("button", { name: "모집 저장하기", exact: true }).click();
    await p.getByRole("button", { name: "모집 공개", exact: true }).click();
    await p
      .getByRole("button", { name: "신규 제안 마감", exact: true })
      .click();
    await p
      .getByRole("button", {
        name: "무선정 종료 · 기존 협의 종료",
        exact: true,
      })
      .click();
    await p.getByText("브랜드 필름 · 모집 종료", { exact: true }).waitFor();
  });
  await run("소셜 미연결·취소·실패 상태와 역할 보호", async () => {
    await role(p, "guest");
    await go(p, "/login");
    await p.getByRole("button", { name: "Google로 계속하기" }).click();
    await p.getByRole("button", { name: "취소", exact: true }).click();
    await go(p, "/auth/social/callback?result=error");
    await p
      .getByRole("heading", { name: "소셜 로그인에 연결할 수 없어요" })
      .waitFor();
    await role(p, "client");
    await go(p, "/studio/packages");
    await p.getByRole("heading", { name: "다른 역할의 화면이에요" }).waitFor();
  });
  await c.close();
  const { page: m, context: mc } = await setup({ width: 390, height: 844 });
  await run("390px 모바일 홈·메뉴·가로 넘침 검사", async () => {
    await m.screenshot({
      path: "qa/pdf-frontend/home-mobile.png",
      fullPage: true,
    });
    assert.equal(
      await m.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await m.getByRole("button", { name: "메뉴 열기" }).click();
    await m
      .getByRole("navigation", { name: "모바일 메뉴" })
      .getByRole("link", { name: "공개 모집", exact: true })
      .click();
    assert.equal(
      await m.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await m.screenshot({
      path: "qa/pdf-frontend/campaigns-mobile.png",
      fullPage: true,
    });
  });
  await run("모바일 작업 공간 및 오류·로딩·빈 상태 시연", async () => {
    const id = await create(m);
    await contract(m);
    assert.equal(
      await m.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await m.screenshot({
      path: "qa/pdf-frontend/workspace-mobile.png",
      fullPage: true,
    });
    await m.getByText("시연 도구", { exact: true }).click();
    await m.getByLabel("화면 상태 시연").selectOption("error");
    await m.getByRole("button", { name: "다시 시도", exact: true }).click();
    await m.getByLabel("화면 상태 시연").selectOption("loading");
    await m.getByRole("button", { name: "로딩 시연 마치기" }).click();
    await m.getByLabel("화면 상태 시연").selectOption("empty");
    await m.getByRole("button", { name: "원래 화면으로" }).click();
  });
  await mc.close();
  assert.deepEqual(errors, []);
  await writeFile(
    "qa/pdf-frontend/browser-results.json",
    JSON.stringify(
      {
        results,
        errors,
        checkedAt: new Date().toISOString(),
        browser: "Microsoft Edge headless",
        scope: "Local browser demo, not API/PG/DB verification",
      },
      null,
      2,
    ),
  );
  console.log(`${results.length} browser scenarios passed. No page errors.`);
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) {
    for (const [j, page] of context.pages().entries()) {
      await page.screenshot({
        path: `qa/pdf-frontend/failure-${i}-${j}.png`,
        fullPage: true,
      });
      console.log(
        "FAILURE PAGE",
        page.url(),
        (await page.locator("body").innerText()).slice(-6000),
      );
    }
  }
  throw error;
} finally {
  await browser.close();
}
