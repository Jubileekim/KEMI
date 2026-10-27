import { expect, test, type Page } from "@playwright/test";

const user = {
  id: "1",
  name: "제작자",
  email: "creator@example.com",
  role: "CREATOR",
  status: "ACTIVE",
};
const emptyProfile = {
  type: "CREATOR",
  imageFileId: null,
  career: null,
  websiteUrl: null,
  socialUrl: null,
  introduction: null,
  niche: null,
  contentStyles: [],
  productionRoles: [],
  workMethod: null,
  serviceStatus: "DRAFT",
  isAvailable: false,
  availableFrom: null,
};
async function apiFixture(page: Page, member = false) {
  let profile = { name: user.name, profile: { ...emptyProfile } };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body });
    if (path === "/api/auth/refresh")
      return member
        ? json({
            accessToken: "fixture-token",
            accessTokenExpiresIn: 3600,
            user,
          })
        : json({ error: { code: "UNAUTHORIZED" } }, 401);
    if (path === "/api/auth/me") return json({ user });
    if (path === "/api/profiles/me") {
      if (request.method() === "PATCH") {
        const { name, ...fields } = request.postDataJSON();
        profile = {
          name: name ?? profile.name,
          profile: { ...profile.profile, ...fields },
        };
      }
      return json(profile);
    }
    if (path === "/api/feed")
      return json({ items: [], total: 0, page: 1, pageSize: 12 });
    if (path === "/api/notifications")
      return json({ items: [], total: 0, page: 1, pageSize: 20 });
    if (path === "/api/notifications/unread-count") return json({ count: 0 });
    if (path === "/api/reports/me")
      return json({ limited: false, reports: [], restrictions: [] });
    if (path === "/api/analytics/events") return json({}, 202);
    return json({ error: { code: "NOT_FOUND" } }, 404);
  });
}

test("비회원 온보딩은 로그인을 거치고 조회 실패를 빈 피드로 표시하지 않는다", async ({
  page,
}) => {
  await apiFixture(page);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fonboarding$/);
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.route("**/api/feed*", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "SERVICE_UNAVAILABLE" } },
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByText("아직 공개된 작품이 없어요.", { exact: true }),
  ).toHaveCount(0);
});

test("공개 제작자 페이지에서 경력·외부 링크를 볼 수 있다", async ({ page }) => {
  await apiFixture(page);
  await page.route("**/api/creators/1", (route) =>
    route.fulfill({
      json: {
        userId: "1",
        name: "제작자",
        introduction: "영상 제작",
        niche: null,
        contentStyles: [],
        productionRoles: [],
        isAvailable: true,
        career: "영상 제작 3년",
        websiteUrl: "https://example.com",
        socialUrl: "https://social.example.com",
        image: null,
        representativePackage: {
          id: "1",
          title: "숏폼 제작",
          description: null,
          priceKrw: 100000,
          deliveryDays: 7,
          revisionCount: 1,
          includes: [],
          isRepresentative: true,
        },
        packages: [],
        portfolios: [],
        review: { count: 0, averageRating: null },
      },
    }),
  );
  await page.goto("/creators/1");
  await expect(
    page.getByText("경력: 영상 제작 3년", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "웹사이트", exact: true }),
  ).toHaveAttribute("href", "https://example.com");
  await expect(
    page.getByRole("link", { name: "SNS", exact: true }),
  ).toHaveAttribute("rel", "noopener noreferrer");
});

test("빈 피드 안내·필터 초기화·운영 하단 문구", async ({ page }, testInfo) => {
  await apiFixture(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "아직 공개된 작품이 없어요." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "공개 모집 둘러보기" }),
  ).toBeVisible();
  await page.getByLabel("영상 목적").selectOption({ index: 1 });
  await expect(
    page.getByRole("heading", { name: "조건에 맞는 작품이 없어요." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "전체 작품 보기" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("footer")).toContainText("함께 만드는 영상");
  await expect(page.locator("body")).not.toContainText("화면 기반 구성 중");
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
  });
});

test("온보딩에서 프로필로 이동하고 경력·링크 저장·재조회·삭제", async ({
  page,
}) => {
  await apiFixture(page, true);
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/me\/profile$/);
  await page.getByLabel("경력 (선택)").fill("영상 제작 3년");
  await page
    .getByLabel("포트폴리오·웹사이트 주소 (선택)")
    .fill("https://example.com");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("경력 (선택)")).toHaveValue("영상 제작 3년");
  await expect(page.getByLabel("포트폴리오·웹사이트 주소 (선택)")).toHaveValue(
    "https://example.com",
  );
  await page.getByLabel("경력 (선택)").fill("");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("경력 (선택)")).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("저장 계약 준비 중");
});

test("업로드 성공 시 파일 ID 저장, 실패 시 기존 입력 유지", async ({
  page,
}) => {
  await apiFixture(page, true);
  const file = {
    id: "7",
    ownerId: "1",
    purpose: "PROFILE_IMAGE",
    status: "READY",
    mimeType: "image/png",
    kind: "IMAGE",
    fileName: "profile.png",
    sizeBytes: 68,
    rejectionReason: null,
    workRequestId: null,
    createdAt: new Date().toISOString(),
  };
  await page.route("**/api/files", (route) =>
    route.fulfill({
      json: {
        file,
        upload: {
          url: "http://127.0.0.1:5175/fixture-upload",
          token: "fixture",
        },
      },
    }),
  );
  await page.route("**/fixture-upload", (route) =>
    route.fulfill({ status: 200 }),
  );
  await page.route("**/api/files/7/complete", (route) =>
    route.fulfill({ json: file }),
  );
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV1kAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/fixture-image.png", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("**/api/files/7/download", (route) =>
    route.fulfill({
      json: {
        url: "http://127.0.0.1:5175/fixture-image.png",
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
    }),
  );
  await page.goto("/me/profile");
  await page
    .getByLabel("프로필 이미지 (선택)", { exact: true })
    .setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: png });
  await expect(
    page.getByRole("img", { name: "프로필 이미지", exact: true }),
  ).toBeVisible();
  const saved = page.waitForRequest(
    (request) =>
      request.method() === "PATCH" &&
      request.url().endsWith("/api/profiles/me"),
  );
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  expect((await saved).postDataJSON()).toEqual({ imageFileId: "7" });
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("경력 (선택)").fill("유지할 경력");
  await page.getByLabel("프로필 이미지 (선택)", { exact: true }).setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("bad"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "최대 10MB" }),
  ).toBeVisible();
  await expect(page.getByLabel("경력 (선택)")).toHaveValue("유지할 경력");
  await expect(
    page.getByRole("img", { name: "프로필 이미지", exact: true }),
  ).toBeVisible();
});
