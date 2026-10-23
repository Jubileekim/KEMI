import { test, expect, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login?returnTo=%2Fcampaigns%2Fnew");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill("client@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(page.getByLabel("캠페인 제목", { exact: true })).toBeEnabled();
}
async function conditions(page: Page) {
  await page
    .getByLabel("분석용 제작 조건 (선택)")
    .fill("촬영 없이 제공 영상 편집 1편, 자막과 음악 포함, 30초, 납기 7일");
}
async function analyze(page: Page) {
  await page
    .getByRole("button", { name: "참고 제작비 분석", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "참고 리포트", exact: true }),
  ).toBeVisible();
}
async function scenario(page: Page, value: string) {
  await page.evaluate(async (body) => {
    await fetch("/__mock__/pricing/scenario", { method: "POST", body });
  }, value);
}
async function manualFields(page: Page) {
  await page.getByLabel("캠페인 제목", { exact: true }).fill("개인 기념 영상");
  await page.getByLabel("제품·서비스", { exact: true }).fill("가족 영상");
  await page.getByLabel("제작 목적", { exact: true }).fill("기념");
  await page.getByLabel("작업 범위", { exact: true }).fill("편집 1편");
  await page.getByLabel("예산 (원)", { exact: true }).fill("90000");
}
test("AI 미사용은 분석 요청 없이 수동 공개", async ({ page }) => {
  await login(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/pricing/analyze"))
      requests.push(request.url());
  });
  await manualFields(page);
  await page.getByRole("button", { name: "공개 내용 확인" }).click();
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByText("모의 공개 완료 · 모집 중")).toBeVisible();
  expect(requests).toEqual([]);
});
test("지연 분석 중 로그아웃하면 결과·개인 기록 노출 없음", async ({ page }) => {
  await login(page);
  await conditions(page);
  await scenario(page, "delay");
  await page
    .getByRole("button", { name: "참고 제작비 분석", exact: true })
    .click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
  await login(page);
  await expect(
    page.getByRole("heading", { name: "참고 리포트", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/마지막 명시 반영 기록/)).toHaveCount(0);
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue("");
});
test("반영 후 모바일 너비·수동 덮어쓰기와 인증 없는 분석 차단", async ({
  page,
}) => {
  await login(page);
  const unauthenticated = await page.evaluate(
    async () =>
      (
        await fetch("/__mock__/pricing/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: "비회원이 보낸 제작 조건 설명" }),
        })
      ).status,
  );
  expect(unauthenticated).toBe(401);
  await conditions(page);
  await analyze(page);
  const apply = page.getByRole("button", { name: "확인한 금액을 예산에 반영" });
  await apply.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
    "150000",
  );
  await page.getByLabel("예산 (원)", { exact: true }).fill("110000");
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
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
    "110000",
  );
  await expect(page.getByText(/마지막 명시 반영 기록/)).toContainText(
    "150,000원",
  );
});
test("2-B 통합: 선택 분석→금액 조정·명시 반영→초안 재편집→공개", async ({
  page,
}) => {
  await login(page);
  await manualFields(page);
  const sent: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/__mock__/pricing/analyze"))
      sent.push(request.postDataJSON());
  });
  await conditions(page);
  await analyze(page);
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
    "90000",
  );
  expect(sent).toEqual([
    {
      description:
        "촬영 없이 제공 영상 편집 1편, 자막과 음악 포함, 30초, 납기 7일",
    },
  ]);
  await page.getByLabel("예산에 반영할 금액 (원)").fill("120000");
  await page.getByRole("button", { name: "확인한 금액을 예산에 반영" }).click();
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
    "120000",
  );
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[\w-]+\/edit$/);
  await expect(page.getByText(/마지막 명시 반영 기록/)).toContainText(
    "120,000원",
  );
  await page.getByRole("button", { name: "공개 내용 확인" }).click();
  await expect(page.getByRole("dialog")).toContainText("120000");
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByText("모의 공개 완료 · 모집 중")).toBeVisible();
  await expect(page.getByLabel("분석용 제작 조건 (선택)")).toHaveCount(0);
});
test("조건 변경·지연 응답은 반영 차단, 재분석 후 명시 반영", async ({
  page,
}) => {
  await login(page);
  await conditions(page);
  await analyze(page);
  await page.getByLabel("작업 범위", { exact: true }).fill("촬영 추가");
  await expect(
    page.getByRole("button", { name: "확인한 금액을 예산에 반영" }),
  ).toBeDisabled();
  await scenario(page, "delay");
  await page
    .getByRole("button", { name: "참고 제작비 분석", exact: true })
    .click();
  await page
    .getByLabel("분석용 제작 조건 (선택)")
    .fill("촬영 포함 편집 2편으로 제작 조건 변경");
  await expect(
    page.getByRole("heading", { name: "참고 리포트", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "확인한 금액을 예산에 반영" }),
  ).toBeDisabled();
  await scenario(page, "success");
  await analyze(page);
  await page.getByRole("button", { name: "확인한 금액을 예산에 반영" }).click();
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
    "150000",
  );
});
["429", "503", "network", "malformed", "401", "403"].forEach((failure) => {
  test(`분석 ${failure} 실패에도 수동 예산·공개 가능`, async ({ page }) => {
    await login(page);
    await manualFields(page);
    await conditions(page);
    await scenario(page, failure);
    await page
      .getByRole("button", { name: "참고 제작비 분석", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "선택 AI 분석" }).getByRole("alert"),
    ).toBeVisible();
    await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
      "90000",
    );
    await expect(
      page.getByRole("button", { name: "확인한 금액을 예산에 반영" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "공개 내용 확인" }).click();
    await page.getByRole("button", { name: "모의 공개 확정" }).click();
    await expect(page.getByText("모의 공개 완료 · 모집 중")).toBeVisible();
  });
});
test("입력·반영액 경계, 취소·수동 저장과 재시도", async ({ page }) => {
  await login(page);
  await expect(
    page.getByRole("button", { name: "참고 제작비 분석", exact: true }),
  ).toBeDisabled();
  await conditions(page);
  await scenario(page, "delay");
  await page
    .getByRole("button", { name: "참고 제작비 분석", exact: true })
    .click();
  await page.getByRole("button", { name: "분석 취소", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "선택 AI 분석" }).getByRole("alert"),
  ).toBeVisible();
  await scenario(page, "success");
  await analyze(page);
  await ["", "0", "-1", "1.5", "1000000001"].reduce(
    async (previous, amount) => {
      await previous;
      await page.getByLabel("예산에 반영할 금액 (원)").fill(amount);
      await expect(
        page.getByRole("button", { name: "확인한 금액을 예산에 반영" }),
      ).toBeDisabled();
    },
    Promise.resolve(),
  );
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/[\w-]+\/edit$/);
});
