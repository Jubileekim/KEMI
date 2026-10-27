import { expect, test } from "@playwright/test";
import { login } from "./proposal-helpers";

test("홈에서 회원가입·로그인과 공개 모집 상세로 이동한다", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByRole("navigation", { name: "화면 이동 안내" });
  await expect(guide.getByRole("link")).toHaveCount(3);
  await guide.getByRole("link", { name: /회원가입 시작하기/ }).click();
  await expect(page).toHaveURL("/signup");
  await page.getByRole("link", { name: "KEMI 홈" }).click();
  await guide.getByRole("link", { name: /로그인하고 이어가기/ }).click();
  await expect(page).toHaveURL("/login");
  await page.getByRole("link", { name: "KEMI 홈" }).click();
  await guide.getByRole("link", { name: /공개 모집 둘러보기/ }).click();
  await expect(page).toHaveURL("/campaigns");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("공개 모집");
  await page.getByRole("article").first().getByRole("link").click();
  await page.getByRole("link", { name: "제안 제출하기" }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel("이메일 (필수)").fill("creator@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/apply$/);
});

test("의뢰인 로그인 도착점에서 초안·프로필·협의로 이어간다", async ({
  page,
}) => {
  await page.goto("/");
  await login(page, "client");
  await expect(page).toHaveURL("/me/activity");
  const guide = page.getByRole("navigation", { name: "화면 이동 안내" });
  await expect(guide.getByRole("link")).toHaveCount(4);
  await guide.getByRole("link", { name: /캠페인 작성·저장한 초안/ }).click();
  await page.getByLabel("캠페인 제목", { exact: true }).fill("접근 경로 초안");
  await page.getByRole("button", { name: /임시 저장/ }).click();
  await expect(page).toHaveURL(/\/campaigns\/[^/]+\/edit$/);
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await guide.getByRole("link", { name: /캠페인 작성·저장한 초안/ }).click();
  await page.getByRole("link", { name: "초안 이어 쓰기" }).click();
  await expect(page.getByLabel("캠페인 제목", { exact: true })).toHaveValue(
    "접근 경로 초안",
  );
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await guide.getByRole("link", { name: /프로필 확인·수정/ }).click();
  await expect(
    page.getByRole("heading", { name: "내 프로필", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("navigation", { name: "제작 관리" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await guide.getByRole("link", { name: /내 제안·협의 이어가기/ }).click();
  await expect(page).toHaveURL("/requests");
});

test("크리에이터는 홈·프로필에서 제작 관리로 이동하고 의뢰인 경로는 차단된다", async ({
  page,
}) => {
  await page.goto("/");
  await login(page);
  await page.getByRole("link", { name: "KEMI 홈" }).click();
  const guide = page.getByRole("navigation", { name: "화면 이동 안내" });
  await expect(guide.getByRole("link")).toHaveCount(5);
  await guide.getByRole("link", { name: /프로필 확인·수정/ }).click();
  const studio = page.getByRole("navigation", { name: "제작 관리" });
  await studio.getByRole("link", { name: "패키지·제작 서비스 관리" }).click();
  await expect(page).toHaveURL("/studio/packages");
  await page.getByRole("link", { name: "내 프로필 확인" }).click();
  await studio.getByRole("link", { name: "내 작업물 관리하기" }).click();
  await expect(page).toHaveURL("/studio/portfolio");
  await page.getByRole("link", { name: "내 활동", exact: true }).click();
  await guide.getByRole("link", { name: /내 제안·협의 이어가기/ }).click();
  await expect(page).toHaveURL("/requests");
  // A forged URL still uses the original guard; no role tool or session bypass.
  await page.evaluate(() => {
    window.history.pushState({}, "", "/campaigns/new");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: "접근 권한이 없어요" }),
  ).toBeVisible();
});

test("의뢰인은 다른 모집에서 크리에이터 전용 제출 행동을 보지 않는다", async ({
  page,
}) => {
  await page.goto("/");
  await login(page, "client");
  await page
    .getByRole("navigation", { name: "화면 이동 안내" })
    .getByRole("link", { name: /공개 모집 둘러보기/ })
    .click();
  await page.getByRole("article").first().getByRole("link").click();
  await expect(
    page.getByRole("heading", { name: "모집 상세", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "제안 제출하기" })).toHaveCount(
    0,
  );
});
