import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, role = "creator") {
  await page.goto("/login?returnTo=%2Fstudio%2Fpackages");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill(`${role}@example.test`);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
  if (role === "creator")
    await expect(
      page.getByRole("heading", { name: "패키지·서비스 관리", exact: true }),
    ).toBeVisible();
}
async function fillPackage(page: Page, title = "숏폼 패키지") {
  await page.getByRole("button", { name: "새 패키지 만들기" }).click();
  const entries = {
    상품명: title,
    설명: "샘플 소개",
    "가격 (원)": "100000",
    규격: "9:16 30초",
    수량: "1",
    "포함 작업": "촬영·편집",
    "제외 작업": "기획",
    "필요 자료": "제품",
    "기간 (일)": "7",
    "수정 횟수": "1",
    "원본 제공 조건": "합의",
    "사용권·광고 활용 조건": "광고 활용",
  };
  await Object.entries(entries).reduce(async (previous, [label, value]) => {
    await previous;
    await page.getByLabel(label, { exact: true }).fill(value);
  }, Promise.resolve());
  await page.getByLabel("상업 광고 활용 가능한 상품임을 확인했어요").check();
}
async function scenario(page: Page, value: string) {
  await page.evaluate(async (s) => {
    await fetch("/__mock__/studio/scenario", { method: "POST", body: s });
  }, value);
}
async function gate(page: Page) {
  await page.getByText("1-D 개발 전용 시나리오", { exact: true }).click();
  await page.getByLabel("D01 모의 프로필 조건").selectOption("READY");
  await expect(
    page.getByRole("button", { name: "서비스 공개", exact: true }),
  ).toBeEnabled();
}
test("초안→다중 상품→명시적 대표→서비스 공개→수정→비공개 통합", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "새 패키지 만들기" }).click();
  await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("공개 전에");
  await page.getByRole("button", { name: "패키지 저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "제목 없는 초안 · 초안" }),
  ).toBeVisible();
  await fillPackage(page);
  await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
  await expect(
    page.getByRole("heading", { name: "숏폼 패키지 · 공개", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "서비스 공개", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("D01");
  await gate(page);
  await page.getByRole("button", { name: "서비스 공개", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("대표");
  const first = page.getByRole("article", {
    name: "패키지 숏폼 패키지",
    exact: true,
  });
  await first.getByRole("button", { name: "대표로 지정" }).click();
  await expect(first.getByRole("heading")).toContainText("대표");
  await page.getByRole("button", { name: "서비스 공개", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "제작 서비스: 공개" }),
  ).toBeVisible();
  await first.getByRole("button", { name: "모의 계약 참조 보관" }).click();
  await expect(page.getByText("보관된 모의 계약:")).toContainText("100000원");
  await first.getByRole("button", { name: "패키지 수정" }).click();
  await page.getByLabel("가격 (원)", { exact: true }).fill("200000");
  await page.getByRole("button", { name: "패키지 저장", exact: true }).click();
  await expect(first.getByText("200000", { exact: true })).toBeVisible();
  await expect(page.getByText("보관된 모의 계약:")).toContainText("100000원");
  await first.getByRole("button", { name: "패키지 비공개" }).click();
  await expect(page.getByRole("alert")).toContainText("먼저 비공개");
  await fillPackage(page, "추가 상품");
  await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
  const second = page.getByRole("article", {
    name: "패키지 추가 상품",
    exact: true,
  });
  await second.getByRole("button", { name: "대표로 지정" }).click();
  await expect(second.getByRole("heading")).toContainText("대표");
  await expect(first.getByRole("heading")).not.toContainText("대표");
  await first.getByRole("button", { name: "패키지 비공개" }).click();
  await expect(first.getByRole("heading")).toContainText("비공개");
  await page
    .getByRole("button", { name: "서비스 비공개", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "모의 공개 결과" }),
  ).toContainText("공개 노출 상품 없음");
  await expect(page.getByText("보관된 모의 계약:")).toContainText("100000원");
  await page.getByRole("link", { name: "내 프로필 확인" }).click();
  await expect(
    page.getByRole("heading", { name: "제작 서비스 상태: 비공개" }),
  ).toBeVisible();
});
["401", "403", "409", "500", "network", "malformed"].forEach((value) => {
  test(`${value} 실패 입력 보존·명시적 재시도`, async ({ page }) => {
    await login(page);
    await fillPackage(page);
    await scenario(page, value);
    await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("상품명", { exact: true })).toHaveValue(
      "숏폼 패키지",
    );
    await scenario(page, "success");
    await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
    await expect(
      page.getByRole("heading", { name: "내 패키지 (1)" }),
    ).toBeVisible();
  });
});
test("권한·오래된 revision·중복/지연 저장·로그아웃 경계", async ({ page }) => {
  await login(page);
  const result = await page.evaluate(async () => {
    const headers = {
      Authorization: "Bearer mock-access-mock-creator",
      "Content-Type": "application/json",
    };
    const command = { type: "profile-gate", value: "READY" };
    const first = await fetch("/__mock__/studio", {
      method: "POST",
      headers,
      body: JSON.stringify({ revision: 0, command }),
    });
    const second = await fetch("/__mock__/studio", {
      method: "POST",
      headers,
      body: JSON.stringify({ revision: 0, command }),
    });
    const foreign = await fetch("/__mock__/studio", {
      headers: { Authorization: "Bearer other" },
    });
    return [first.status, second.status, foreign.status];
  });
  expect(result).toEqual([200, 409, 401]);
  await fillPackage(page);
  await scenario(page, "delay");
  let writes = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/__mock__/studio") && req.method() === "POST")
      writes += 1;
  });
  await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
  await expect(
    page.getByRole("button", { name: "공개 패키지로 저장" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "로그인", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("숏폼 패키지", { exact: true })).toHaveCount(0);
  expect(writes).toBe(1);
});
test("의뢰인 차단·반응형과 개발 Mock 표시", async ({ page }) => {
  await login(page, "client");
  await page.goto("/studio/packages");
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await login(page);
  await fillPackage(page);
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
});
