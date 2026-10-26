import { test, expect, type Page } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});
const first = "00000000-0000-4000-8000-000000000001";
async function scenario(page: Page, value: string) {
  await page.evaluate(async (selected) => {
    await fetch("/__mock__/discovery/scenario", {
      method: "POST",
      body: selected,
    });
  }, value);
}
async function login(page: Page, role = "client") {
  await page.goto("/login?returnTo=%2Fcampaigns%2Fnew");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill(`${role}@example.test`);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "client" ? "캠페인 작성·임시 저장·공개" : "작업물 관리",
    }),
  ).toBeVisible();
}
async function publish(page: Page) {
  await login(page);
  await page
    .getByLabel("캠페인 제목", { exact: true })
    .fill("내 모의 공개 모집");
  await page.getByLabel("제품·서비스", { exact: true }).fill("가족 영상");
  await page.getByLabel("제작 목적", { exact: true }).fill("기념");
  await page.getByLabel("작업 범위", { exact: true }).fill("편집 1편");
  await page.getByLabel("예산 (원)", { exact: true }).fill("120000");
  await page
    .getByLabel("참고 자료 (선택 텍스트)", { exact: true })
    .fill("PRIVATE_NOTE https://private.example.test");
  await page.getByRole("button", { name: "공개 내용 확인" }).click();
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "모집 상세에서 상태 확인" }).click();
  await expect(
    page.getByRole("heading", { name: "내 모의 공개 모집", exact: true }),
  ).toBeVisible();
}

test("공개 목록: 키워드·제품·예산 교집합·정렬·URL·상세 왕복·뒤로 가기·새로고침", async ({
  page,
}) => {
  await page.goto("/campaigns");
  await expect(page.getByText("검색 결과 8개 · 1 / 2페이지")).toBeVisible();
  await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article")).toHaveCount(2);
  await page.getByLabel("검색어", { exact: true }).fill("제품");
  await page.getByLabel("제품 분야 (Mock 텍스트)").fill("생활");
  await page.getByLabel("최소 예산 (원)").fill("100000");
  await page.getByLabel("최대 예산 (원)").fill("350000");
  await page.getByLabel("정렬", { exact: true }).selectOption("BUDGET_HIGH");
  await page.getByRole("button", { name: "검색 적용" }).click();
  await expect(page.getByText("검색 결과 3개 · 1 / 1페이지")).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText("350,000원");
  const { search } = new URL(page.url());
  await page.getByRole("article").first().getByRole("link").click();
  await expect(
    page.getByRole("heading", { name: "모집 상세", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/한국 시간/).first()).toBeVisible();
  await page.getByRole("link", { name: "모집 목록으로" }).click();
  expect(new URL(page.url()).search).toBe(search);
  await expect(page.getByLabel("검색어", { exact: true })).toHaveValue("제품");
  await page.goBack();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "공개 모집", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("검색 결과 3개 · 1 / 1페이지")).toBeVisible();
  await expect(page.getByLabel("정렬", { exact: true })).toHaveValue(
    "BUDGET_HIGH",
  );
});

test("마감 필터·빈 결과·범위 밖 페이지·잘못된 URL·초안 상세 차단", async ({
  page,
}) => {
  await page.goto("/campaigns?status=CLOSED");
  await expect(page.getByText("검색 결과 1개 · 1 / 1페이지")).toBeVisible();
  await page.getByRole("article").getByRole("link").click();
  await expect(
    page.getByRole("button", { name: "신규 제안 종료" }),
  ).toBeDisabled();
  await page.goto("/campaigns?q=없는결과");
  await expect(
    page.getByText("조건에 맞는 모집이 없어요.", { exact: false }),
  ).toBeVisible();
  await page.goto("/campaigns?page=99");
  await page.getByRole("button", { name: "첫 페이지로" }).click();
  await expect(page.getByText("검색 결과 8개 · 1 / 2페이지")).toBeVisible();
  await page.goto("/campaigns?budgetMin=9&budgetMax=1&page=-1");
  await expect(page.getByRole("alert")).toContainText("검색 조건");
  await page.getByRole("link", { name: "필터 초기화" }).click();
  await expect(page.getByRole("article")).toHaveCount(6);
  await login(page);
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[\w-]+\/edit$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  const result = await page.evaluate(async (value) => {
    const response = await fetch(`/__mock__/discovery/${value}`);
    return response.status;
  }, id);
  expect(result).toBe(404);
  await page.goto("/campaigns/unknown");
  await expect(page.getByRole("alert")).toContainText(
    "공개 공고를 찾을 수 없어요",
  );
});

test("2-C 통합: 작성 공개→목록→상세→키보드 취소/확정 마감→목록 상태·재공개 차단", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (
      req.url().includes("/api/projects") ||
      req.url().includes("private.example.test")
    )
      requests.push(req.url());
  });
  await publish(page);
  const id = new URL(page.url()).pathname.split("/")[2];
  const body = await page.evaluate(
    async (value) => (await fetch(`/__mock__/discovery/${value}`)).text(),
    id,
  );
  expect(body).not.toContain("PRIVATE_NOTE");
  expect(body).not.toContain("references");
  expect(body).not.toContain("pricingApplication");
  await page.getByRole("link", { name: "모집 목록으로" }).click();
  await page
    .getByRole("link", { name: "내 모의 공개 모집", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "모집 마감하기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "모집 마감하기" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText(
    "기존 협의·서명·계약은 유지",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "모집 마감하기" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "모의 마감 확정" }).click();
  await expect(
    page.getByRole("button", { name: "신규 제안 종료" }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "모집 목록으로" }).click();
  await expect(
    page.getByRole("link", { name: "내 모의 공개 모집", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("모집 상태", { exact: true }).selectOption("CLOSED");
  await page.getByRole("button", { name: "검색 적용" }).click();
  await page
    .getByRole("link", { name: "내 모의 공개 모집", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "모집 마감하기" })).toHaveCount(
    0,
  );
  expect(requests).toEqual([]);
});

["500", "network", "malformed", "401", "403", "409"].forEach((value) => {
  test(`${value}: 목록/상세 오류·입력 보존·수동 재시도`, async ({ page }) => {
    await page.goto("/campaigns?q=제품");
    await expect(page.getByRole("article")).toHaveCount(4);
    await scenario(page, value);
    await page.getByRole("button", { name: "목록 다시 확인" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("검색어", { exact: true })).toHaveValue(
      "제품",
    );
    await expect(page.getByRole("article")).toHaveCount(0);
    await scenario(page, "success");
    await page.getByRole("button", { name: "목록 다시 확인" }).click();
    await page.getByRole("article").first().getByRole("link").click();
    await expect(
      page.getByRole("heading", { name: "모집 상세", exact: true }),
    ).toBeVisible();
    await scenario(page, value);
    await page.getByRole("button", { name: "최신 상태 확인" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await scenario(page, "success");
    await page.getByRole("button", { name: "최신 상태 확인" }).click();
    await expect(page.getByRole("article")).toHaveCount(1);
  });
});

test("마감 응답 유실·409 충돌·최신 값 재조회", async ({ page }) => {
  await publish(page);
  await scenario(page, "409");
  await page.getByRole("button", { name: "모집 마감하기" }).click();
  await page.getByRole("button", { name: "모의 마감 확정" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "상태가 변경",
  );
  await page.getByRole("button", { name: "마감 취소" }).click();
  await scenario(page, "success");
  await page.getByRole("button", { name: "최신 상태 확인" }).click();
  await expect(
    page.getByRole("button", { name: "모집 마감하기" }),
  ).toBeEnabled();
  await scenario(page, "lost-response");
  await page.getByRole("button", { name: "모집 마감하기" }).click();
  await page.getByRole("button", { name: "모의 마감 확정" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "응답 유실",
  );
  await page.getByRole("button", { name: "마감 취소" }).click();
  await scenario(page, "success");
  await page.getByRole("button", { name: "최신 상태 확인" }).click();
  await expect(
    page.getByRole("button", { name: "신규 제안 종료" }),
  ).toBeDisabled();
});

test("수동 마감 권한·지연 중 로그아웃·중복 요청 차단", async ({ page }) => {
  await publish(page);
  const id = new URL(page.url()).pathname.split("/")[2];
  const statuses = await page.evaluate(async (value) => {
    const request = (target: string, token: string) =>
      fetch(`/__mock__/discovery/${target}/close`, {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ revision: 1 }),
      });
    return [
      (await request(String(value), "")).status,
      (
        await request(
          "00000000-0000-4000-8000-000000000001",
          "Bearer mock-access-mock-client",
        )
      ).status,
    ];
  }, id);
  expect(statuses).toEqual([401, 404]);
  await scenario(page, "delay");
  await page.getByRole("button", { name: "모집 마감하기" }).click();
  const writes: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/close")) writes.push(req.url());
  });
  const settled = page.waitForResponse((response) =>
    response.url().endsWith("/close"),
  );
  await page.getByRole("button", { name: "모의 마감 확정" }).click();
  await expect(
    page.getByRole("button", { name: "마감 처리 중…" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  // The modal prevents interacting with the background; exercise real session logout via the module.
  await page.evaluate(async () => {
    const modulePath = "/src/app/session.ts";
    const { session } = await import(modulePath);
    await session.logout();
  });
  expect((await settled).status()).toBe(401);
  expect(writes).toHaveLength(1);
  await expect(page.getByRole("button", { name: "모집 마감하기" })).toHaveCount(
    0,
  );
});

test("기한 도달 자동 표시·기존 거래 유지 안내·비회원/creator 변경 차단·반응형", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto(`/campaigns/${first}`);
  await expect(page.getByRole("article")).toBeVisible();
  await expect(page.getByRole("button", { name: "모집 마감하기" })).toHaveCount(
    0,
  );
  await page.clock.fastForward(86401000);
  await expect(
    page.getByRole("button", { name: "신규 제안 종료" }),
  ).toBeDisabled();
  await expect(page.getByRole("article")).toContainText("자동 취소하지 않아요");
  await page.clock.setSystemTime(new Date());
  await login(page, "creator");
  const status = await page.evaluate(
    async () =>
      (
        await fetch(
          "/__mock__/discovery/00000000-0000-4000-8000-000000000001/close",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer mock-access-mock-creator",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ revision: 0 }),
          },
        )
      ).status,
  );
  expect(status).toBe(403);
  await page.getByRole("link", { name: "공개 모집", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(6);
  await [320, 390, 599, 600, 768, 1023, 1024, 1280].reduce(
    async (previous, width) => {
      await previous;
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    },
    Promise.resolve(),
  );
});

test("목록을 열어둔 상태에서 기한 도달 시 결과 수와 카드 재조회", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/campaigns");
  await expect(page.getByText("검색 결과 8개 · 1 / 2페이지")).toBeVisible();
  await page.clock.fastForward(86401000);
  await expect(page.getByText("검색 결과 7개 · 1 / 2페이지")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "모의 제품 소개 영상 1", exact: true }),
  ).toHaveCount(0);
});

test("마감 필터도 목록 밖 공고의 기한 도달 후 재조회", async ({ page }) => {
  await page.clock.install();
  await page.goto("/campaigns?status=CLOSED");
  await expect(page.getByText("검색 결과 1개 · 1 / 1페이지")).toBeVisible();
  await page.clock.fastForward(86401000);
  await expect(page.getByText("검색 결과 2개 · 1 / 1페이지")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "모의 제품 소개 영상 1", exact: true }),
  ).toBeVisible();
});
