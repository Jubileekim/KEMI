import { expect, type Page } from "@playwright/test";

export async function navigate(page: Page, path: string) {
  // SPA URL navigation preserves the explicitly single-tab Mock data store.
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
export async function login(page: Page, role = "creator") {
  const logout = page.getByRole("button", { name: "로그아웃", exact: true });
  if (await logout.isVisible()) await logout.click();
  await page.getByRole("link", { name: "로그인", exact: true }).click();
  await page.getByLabel("이메일 (필수)").fill(`${role}@example.test`);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await expect(logout).toBeVisible();
}
export async function studioFixture(page: Page) {
  // Existing validated Mock commands only: no server or actual media upload.
  await page.evaluate(async () => {
    const sessionPath = "/src/app/session.ts";
    const { session } = await import(sessionPath);
    const studioPath = "/src/mocks/studio-model.ts";
    const { emptyPackage } = await import(studioPath);
    const workPath = "/src/mocks/portfolio-model.ts";
    const { emptyWork } = await import(workPath);
    const token = await session.getToken();
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const state = await fetch("/__mock__/studio", { headers }).then(
      (response) => response.json(),
    );
    let { revision } = state;
    const commands = [
      {
        type: "save-package",
        id: "proposal-package",
        visibility: "PUBLIC",
        values: {
          ...Object.fromEntries(
            Object.keys(emptyPackage).map((key) => [key, "합의 조건"]),
          ),
          title: "모의 상품",
          price: "100000",
          quantity: "1",
          days: "7",
          revisions: "1",
          commercial: true,
        },
      },
      { type: "primary", id: "proposal-package" },
      { type: "profile-gate", value: "READY" },
      { type: "service", public: true },
      {
        type: "save-work",
        id: "proposal-work",
        visibility: "PUBLIC",
        values: {
          ...emptyWork,
          title: "내 공개 샘플",
          description: "직접 제작",
          roles: ["EDITING"],
          style: "자연",
          workType: "영상",
          source: "자작",
          rights: true,
          asset: {
            name: "sample.webm",
            mime: "video/webm",
            size: 1349,
            ready: true,
          },
        },
      },
    ];
    await commands.reduce(async (previous, command) => {
      await previous;
      const response = await fetch("/__mock__/studio", {
        method: "POST",
        headers,
        body: JSON.stringify({ revision, command }),
      });
      if (!response.ok)
        throw new Error(
          `Mock setup ${response.status}: ${await response.text()}`,
        );
      ({ revision } = await response.json());
    }, Promise.resolve());
  });
}
export async function publish(page: Page) {
  await login(page, "client");
  await page.getByRole("link", { name: "캠페인 작성", exact: true }).click();
  await page.getByLabel("캠페인 제목", { exact: true }).fill("2-D 통합 모집");
  await page.getByLabel("제품·서비스", { exact: true }).fill("생활용품");
  await page.getByLabel("제작 목적", { exact: true }).fill("소개");
  await page.getByLabel("작업 범위", { exact: true }).fill("영상 편집");
  await page.getByLabel("예산 (원)", { exact: true }).fill("150000");
  await page.getByRole("button", { name: "공개 내용 확인" }).click();
  await page.getByRole("button", { name: "모의 공개 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "모집 상세에서 상태 확인" }).click();
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
}
export async function submitProposal(page: Page, campaignId: string) {
  await login(page);
  await studioFixture(page);
  await navigate(page, `/campaigns/${campaignId}/apply`);
  await page.getByLabel("제작 방향", { exact: true }).fill("분리된 제안 방향");
  await page.getByLabel("제안 견적 (원)").fill("120000");
  await page.getByLabel("작업 기간 (일)").fill("5");
  await page.getByLabel("내 공개 샘플", { exact: true }).check();
  await page.getByRole("button", { name: "제안 내용 검토" }).click();
  await page.getByRole("button", { name: "제안 제출", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "제안 제출", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "제안 제출 확정", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "내 제안·협의", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
}
export async function discuss(page: Page, campaignId: string) {
  await login(page, "client");
  await navigate(page, `/campaigns/${campaignId}/proposals`);
  await page.getByRole("button", { name: "협의 요청", exact: true }).click();
  await page.getByRole("button", { name: "협의 요청 확정" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "대화·작업 공간 열기" }).click();
  await expect(
    page.getByRole("heading", { name: "협의 작업 공간" }),
  ).toBeVisible();
}
export async function proposalScenario(page: Page, value: string) {
  await page.evaluate(async (selected) => {
    await fetch("/__mock__/proposals/scenario", {
      method: "POST",
      body: selected,
    });
  }, value);
}
