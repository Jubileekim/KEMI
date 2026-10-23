import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, role = "client") {
  await page.goto("/login?returnTo=%2Fme%2Fprofile");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill(`${role}@example.test`);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(page.getByLabel("표시 이름 (필수)")).toBeVisible();
}
async function scenario(page: Page, value: string) {
  await page.evaluate(async (selected) => {
    await fetch("/__mock__/profiles/scenario", {
      method: "POST",
      body: selected,
    });
  }, value);
}
async function save(page: Page) {
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toBeVisible();
}
test("개인 의뢰인은 브랜드 없이 이름만 저장하고 재조회한다", async ({
  page,
}) => {
  const writes: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH") writes.push(request.postDataJSON());
  });
  await login(page);
  await expect(
    page.getByText("모두 선택이에요.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("표시 이름 (필수)").fill("개인 의뢰인");
  await save(page);
  expect(writes).toEqual([{ name: "개인 의뢰인" }]);
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await page.getByRole("link", { name: "내 프로필", exact: true }).click();
  await expect(page.getByLabel("표시 이름 (필수)")).toHaveValue("개인 의뢰인");
  await expect(page.getByLabel("브랜드명 (선택)")).toHaveValue("");
  await expect(page.getByLabel("이메일", { exact: true })).toHaveCount(0);
});
test("의뢰인 선택값 저장·삭제와 URL 오류 연결", async ({ page }) => {
  await login(page);
  await page
    .getByLabel("자사몰 주소 (선택)")
    .fill(["javascript", "alert(1)"].join(":"));
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(page.getByLabel("자사몰 주소 (선택)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#profile-websiteUrl-error")).toBeVisible();
  await page.getByLabel("자사몰 주소 (선택)").fill("https://example.test");
  await page.getByLabel("브랜드명 (선택)").fill(" 케미 ");
  await page.getByLabel("제품 분야 (선택)").selectOption("BEAUTY");
  await save(page);
  await expect(page.getByLabel("브랜드명 (선택)")).toHaveValue("케미");
  await page.getByLabel("브랜드명 (선택)").fill("");
  await page.getByLabel("제품 분야 (선택)").selectOption("");
  await page.getByLabel("자사몰 주소 (선택)").fill("");
  await save(page);
  await page.reload();
  await expect(page.getByLabel("브랜드명 (선택)")).toHaveValue("");
  // Mock profiles deliberately reset on full reload; database persistence is not asserted.
});
test("크리에이터는 미완성 저장·복수 선택 해제·날짜 삭제 후에도 초안이다", async ({
  page,
}) => {
  await login(page, "creator");
  await page.getByLabel("소개 (선택)").fill("간단한 소개");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "제작 서비스 상태: 초안" }),
  ).toBeVisible();
  await page.getByLabel("모던", { exact: true }).check();
  await page.getByLabel("촬영", { exact: true }).check();
  await page.getByLabel("편집", { exact: true }).check();
  await page.getByLabel("작업 가능일 (선택)").fill("2026-11-01");
  await page.getByLabel("현재 작업 가능", { exact: true }).check();
  await save(page);
  await page.getByLabel("모던", { exact: true }).uncheck();
  await page.getByLabel("촬영", { exact: true }).uncheck();
  await page.getByLabel("편집", { exact: true }).uncheck();
  await page.getByLabel("작업 가능일 (선택)").fill("");
  await save(page);
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await page.getByRole("link", { name: "내 프로필", exact: true }).click();
  await expect(page.getByLabel("모던", { exact: true })).not.toBeChecked();
  await expect(page.getByLabel("작업 가능일 (선택)")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "서비스 공개", exact: true }),
  ).toHaveCount(0);
});
["400", "403", "409", "500", "network"].forEach((value) => {
  test(`저장 ${value} 실패 후 입력 보존·명시적 재시도`, async ({ page }) => {
    await login(page);
    await scenario(page, value);
    await page.getByLabel("브랜드명 (선택)").fill("보존할 입력");
    await page
      .getByRole("button", { name: "프로필 저장", exact: true })
      .click();
    await expect(
      page.getByText("입력은 유지했어요.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel("브랜드명 (선택)")).toHaveValue("보존할 입력");
    await scenario(page, "success");
    await save(page);
  });
});
test("조회 실패·잘못된 응답은 편집을 열지 않고 재조회한다", async ({
  page,
}) => {
  await login(page);
  await ["500", "malformed"].reduce(async (previous, selected) => {
    await previous;
    await scenario(page, selected);
    await page.getByRole("link", { name: "내 활동", exact: true }).click();
    await page.getByRole("link", { name: "내 프로필", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "프로필을 불러오지 못했어요" }),
    ).toBeVisible();
    await expect(page.getByLabel("표시 이름 (필수)")).toHaveCount(0);
    await scenario(page, "success");
    await page.getByRole("button", { name: "프로필 다시 불러오기" }).click();
    await expect(page.getByLabel("표시 이름 (필수)")).toBeVisible();
  }, Promise.resolve());
});
test("지연 저장 중 중복 제출 차단·취소 복원·화면 너비", async ({ page }) => {
  await login(page);
  await page.getByLabel("브랜드명 (선택)").fill("취소할 입력");
  await page.getByRole("button", { name: "변경 취소", exact: true }).click();
  await expect(page.getByLabel("브랜드명 (선택)")).toHaveValue("");
  await scenario(page, "delay");
  await page.getByLabel("소개 (선택)").fill("느린 저장");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "저장 중…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("표시 이름 (필수)")).toBeDisabled();
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toBeVisible();
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
test("로그아웃·다른 역할 로그인 시 개인 폼과 Mock 추가 정보 제거", async ({
  page,
}) => {
  await login(page, "creator");
  await page.getByLabel("소개 (선택)").fill("다른 계정에 보이면 안 됨");
  await page.getByLabel("경력 (선택 · Mock)").fill("임시 경력");
  await page.getByRole("button", { name: "추가 정보 Mock 확인" }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByLabel("이메일 (필수)")).toBeVisible();
  await login(page);
  await expect(page.getByLabel("소개 (선택)")).toHaveValue("");
  await expect(page.getByLabel("경력 (선택 · Mock)")).toHaveCount(0);
  await expect(page.getByLabel("브랜드명 (선택)")).toBeVisible();
});
test("추가 Mock 이미지·링크는 실제 PATCH에 섞이지 않고 화면 이동 시 폐기", async ({
  page,
}) => {
  await login(page, "creator");
  const requests: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "PATCH") requests.push(request.postDataJSON());
  });
  await page.getByLabel("프로필 이미지 (선택 · Mock)").setInputFiles({
    name: "mock.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(
    page.getByText("미리보기는 PNG·JPEG·WebP만 지원해요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "이미지 비우기" }).click();
  await page.getByLabel("프로필 이미지 (선택 · Mock)").setInputFiles({
    name: "mock.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.getByAltText("선택한 이미지 Mock 미리보기")).toBeVisible();
  await page.getByLabel("경력 (선택 · Mock)").fill("임시 경력");
  await page.getByLabel("링크 (선택 · Mock)").fill("https://example.test");
  await page.getByRole("button", { name: "추가 정보 Mock 확인" }).click();
  await page.getByLabel("소개 (선택)").fill("기본 소개");
  await save(page);
  expect(requests).toEqual([{ introduction: "기본 소개" }]);
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await page.getByRole("link", { name: "내 프로필", exact: true }).click();
  await expect(page.getByLabel("경력 (선택 · Mock)")).toHaveValue("");
});

test("만료된 저장 요청은 갱신 뒤 자동 재전송하지 않고 입력을 보존한다", async ({
  page,
}) => {
  await login(page);
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() === "PATCH") writes += 1;
  });
  await scenario(page, "expired");
  await page.getByLabel("브랜드명 (선택)").fill("만료 후 보존");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByText("세션을 다시 확인했어요.", { exact: false }),
  ).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByLabel("브랜드명 (선택)")).toHaveValue("만료 후 보존");
  await scenario(page, "success");
  await save(page);
  expect(writes).toBe(2);
});

test("지연 저장 응답이 로그아웃 뒤 새 역할의 프로필을 덮어쓰지 않는다", async ({
  page,
}) => {
  await login(page, "creator");
  await scenario(page, "delay");
  await page.getByLabel("소개 (선택)").fill("이전 계정의 늦은 저장");
  const response = page.waitForResponse(
    (item) => item.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "저장 중…", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByLabel("이메일 (필수)")).toBeVisible();
  await response;
  await scenario(page, "success");
  await login(page);
  await expect(page.getByLabel("소개 (선택)")).toHaveValue("");
  await expect(page.getByLabel("브랜드명 (선택)")).toBeVisible();
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toHaveCount(0);
});
