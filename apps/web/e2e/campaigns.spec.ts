import { test, expect, type Page } from "@playwright/test";

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
  if (role === "client")
    await expect(page.getByLabel("캠페인 제목", { exact: true })).toBeEnabled();
}
async function fields(page: Page) {
  await page.getByLabel("캠페인 제목", { exact: true }).fill("개인 기념 영상");
  await page.getByLabel("제품·서비스", { exact: true }).fill("가족 영상");
  await page.getByLabel("제작 목적", { exact: true }).fill("기념일");
  await page
    .getByLabel("작업 범위", { exact: true })
    .fill("촬영 없이 편집 1편");
  await page.getByLabel("예산 (원)", { exact: true }).fill("100000");
}
async function scenario(page: Page, value: string) {
  await page.evaluate(async (selected) => {
    await fetch("/__mock__/campaigns/scenario", {
      method: "POST",
      body: selected,
    });
  }, value);
}
async function openConfirm(page: Page) {
  await page.getByRole("button", { name: "공개 내용 확인" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
test("2-A 통합: 불완전 초안→재편집→개인 공개→재조회·마감 유지", async ({
  page,
}) => {
  const productWrites: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/projects"))
      productWrites.push(request.url());
  });
  await login(page);
  await expect(page.getByLabel("모집 기간", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[\w-]+\/edit$/);
  await expect(
    page.getByRole("region", { name: "내 모의 캠페인" }),
  ).toContainText("비공개 초안");
  await expect(
    page.getByRole("region", { name: "모의 공개 확인" }),
  ).toContainText("모의 공개 캠페인 없음");
  await page.getByRole("link", { name: "새 캠페인 작성", exact: true }).click();
  await page.getByRole("link", { name: "초안 이어 쓰기", exact: true }).click();
  await openConfirm(page);
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "제목",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "공개 내용 확인" }),
  ).toBeFocused();
  await fields(page);
  await page.getByLabel("모집 기간", { exact: true }).selectOption("3");
  await openConfirm(page);
  await expect(page.getByRole("dialog")).toContainText("모집 3일");
  await page.getByRole("button", { name: "공개 취소" }).click();
  await expect(page.getByLabel("캠페인 제목", { exact: true })).toHaveValue(
    "개인 기념 영상",
  );
  await openConfirm(page);
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("모의 공개 완료 · 모집 중", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("캠페인 제목", { exact: true })).toBeDisabled();
  const deadline = await page
    .getByText(/^마감:/)
    .first()
    .textContent();
  expect(deadline).toContain("한국 시간");
  await page.getByRole("button", { name: "최신 값 확인", exact: true }).click();
  await expect(page.getByText(/^마감:/).first()).toHaveText(deadline ?? "");
  await expect(
    page.getByRole("region", { name: "모의 공개 확인" }),
  ).toContainText("개인 기념 영상 · 모집 3일");
  expect(productWrites).toEqual([]);
});
["401", "403", "409", "500", "network", "malformed"].forEach((value) => {
  test(`${value}: 저장 실패·재조회 실패에도 입력 보존·명시적 재시도`, async ({
    page,
  }) => {
    await login(page);
    await fields(page);
    await scenario(page, value);
    await page.getByRole("button", { name: "임시 저장", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(
      page.getByRole("region", { name: "내 모의 캠페인" }),
    ).toContainText("저장한 캠페인이 없어요");
    await page
      .getByRole("button", { name: "최신 값 확인", exact: true })
      .click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "최신 값을 확인하지 못했어요" }),
    ).toBeVisible();
    await expect(page.getByLabel("캠페인 제목", { exact: true })).toHaveValue(
      "개인 기념 영상",
    );
    await scenario(page, "success");
    await page.getByRole("button", { name: "임시 저장", exact: true }).click();
    await expect(page).toHaveURL(/\/campaigns\/[\w-]+\/edit$/);
    await expect(
      page.getByRole("region", { name: "내 모의 캠페인" }).getByRole("article"),
    ).toHaveCount(1);
  });
});
test("공개 응답 유실 후 최신 값으로 성공 확인·중복 생성 없음", async ({
  page,
}) => {
  await login(page);
  await fields(page);
  await openConfirm(page);
  await scenario(page, "lost-response");
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "공개 응답",
  );
  await page.getByRole("button", { name: "공개 취소" }).click();
  await scenario(page, "success");
  await page.getByRole("button", { name: "최신 값 확인", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "내 모의 캠페인" }),
  ).toContainText("모집 중 (Mock)");
  await page.getByRole("link", { name: "공개 결과 확인" }).click();
  await expect(
    page.getByText("모의 공개 완료 · 모집 중", { exact: true }),
  ).toBeVisible();
});
test("Mock endpoint: 비회원·revision 충돌·중복 공개 마감 유지", async ({
  page,
}) => {
  await login(page);
  const result = await page.evaluate(async () => {
    const headers = {
      Authorization: "Bearer mock-access-mock-client",
      "Content-Type": "application/json",
    };
    const id = crypto.randomUUID();
    const values = {
      title: "개인",
      product: "기념",
      purpose: "영상",
      scope: "편집",
      budget: "10",
      references: "",
      days: "14",
    };
    const request = (type: string, revision: number) =>
      fetch("/__mock__/campaigns", {
        method: "POST",
        headers,
        body: JSON.stringify({ revision, command: { type, id, values } }),
      });
    const foreign = await fetch("/__mock__/campaigns", {
      headers: { Authorization: "Bearer other" },
    });
    const draft = await request("save", 0);
    const conflict = await request("save", 0);
    const first = await request("publish", 1);
    const firstData: unknown = await first.json();
    const second = await request("publish", 1);
    const secondData: unknown = await second.json();
    return {
      statuses: [
        foreign.status,
        draft.status,
        conflict.status,
        first.status,
        second.status,
      ],
      firstData,
      secondData,
    };
  });
  expect(result.statuses).toEqual([401, 200, 409, 200, 200]);
  expect(result.firstData).toEqual(result.secondData);
});
test("지연 중 중복 저장·로그아웃 후 쓰기/개인 캐시 차단", async ({ page }) => {
  await login(page);
  await fields(page);
  await scenario(page, "delay");
  const writes: string[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/__mock__/campaigns") && req.method() === "POST")
      writes.push(req.url());
  });
  const settled = page.waitForResponse(
    (response) =>
      response.url().endsWith("/__mock__/campaigns") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "처리 중…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
  expect((await settled).status()).toBe(401);
  expect(writes).toHaveLength(1);
  await login(page);
  await expect(
    page.getByRole("region", { name: "내 모의 캠페인" }),
  ).toContainText("저장한 캠페인이 없어요");
});
test("creator 차단·임의 초안 ID·반응형·참고 URL 외부 요청 없음", async ({
  page,
}) => {
  await login(page, "creator");
  await page.goto("/campaigns/new");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      async () =>
        (
          await fetch("/__mock__/campaigns", {
            headers: { Authorization: "Bearer mock-access-mock-creator" },
          })
        ).status,
    ),
  ).toBe(403);
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await login(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("external.example.test"))
      requests.push(request.url());
  });
  await fields(page);
  await page
    .getByLabel("참고 자료 (선택 텍스트)", { exact: true })
    .fill("https://external.example.test/video");
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[\w-]+\/edit$/);
  expect(requests).toEqual([]);
  await page.goto("/campaigns/unknown/edit");
  await expect(page.getByRole("alert")).toContainText(
    "본인 초안을 찾을 수 없어요",
  );
});
