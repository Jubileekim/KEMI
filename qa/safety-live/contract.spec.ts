import { test, expect, type Page } from "@playwright/test";

test("실제 API: 공고 작성 → 지원 → 협의 → 양측 서명 → 계약", async ({
  page,
  browser,
}, info) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4198",
  });
  const creator = await context.newPage();
  const suffix = `${Date.now()}-${info.project.name}`;
  async function login(target: Page, role: "CLIENT" | "CREATOR") {
    await target.goto("/login");
    await target
      .getByLabel("이메일 (필수)", { exact: true })
      .fill(`contract-${role.toLowerCase()}-${info.project.name}@kemi.test`);
    await target
      .getByLabel("비밀번호 (필수)", { exact: true })
      .fill("BrowserTest1234");
    await target
      .getByRole("button", { name: "이메일로 로그인", exact: true })
      .click();
    await expect(
      target.getByRole("button", { name: "로그아웃", exact: true }),
    ).toBeVisible();
  }
  try {
    await login(page, "CLIENT");
    await login(creator, "CREATOR");
    await page.goto("/campaigns/new");
    await page.getByLabel("제목", { exact: true }).fill(`실제 계약 ${suffix}`);
    await page
      .getByLabel("설명", { exact: true })
      .fill("실제 API와 DB를 사용하는 계약 브라우저 검증용 공고입니다.");
    await page.getByLabel("영상 목적", { exact: true }).selectOption("OTHER");
    await page.getByLabel("예산 (원)", { exact: true }).fill("200000");
    await page.getByLabel("모집 기간", { exact: true }).selectOption("3");
    await page
      .getByLabel("희망 납품일", { exact: true })
      .fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
    await page.locator("#draft-style-CLEAN").check();
    await page.getByRole("button", { name: "모집 공개", exact: true }).click();
    await expect(page).toHaveURL(/\/campaigns\/\d+$/);
    const projectPath = new URL(page.url()).pathname;
    await creator.goto(`${projectPath}/apply`);
    await creator
      .getByLabel("제안 내용", { exact: true })
      .fill("요청하신 영상 제작을 진행하겠습니다.");
    await creator.getByLabel("제안 금액 (원)", { exact: true }).fill("200000");
    await creator.getByLabel("예상 작업 일수", { exact: true }).fill("7");
    await creator
      .getByRole("button", { name: "지원서 제출", exact: true })
      .click();
    await expect(creator).toHaveURL(/\/requests$/);
    await page.goto(`${projectPath}/proposals`);
    await page.getByRole("button", { name: "협의 요청", exact: true }).click();
    await page
      .getByRole("link", { name: "대화·조건 협의", exact: true })
      .click();
    const requestPath = new URL(page.url()).pathname;
    await page
      .getByRole("button", { name: "조건서 작성", exact: true })
      .click();
    await page.getByLabel("최종 금액 (원)", { exact: true }).fill("200000");
    for (const field of [
      "영상 사양",
      "작업 범위",
      "제공 자료",
      "납품 기한",
      "수정 횟수",
      "사용 범위",
      "취소·환불",
    ]) {
      await page.getByLabel(field, { exact: true }).fill(`${field} 합의 내용`);
    }
    await page
      .getByRole("button", { name: "새 버전으로 저장", exact: true })
      .click();
    await page
      .getByRole("button", { name: "이 버전으로 서명 요청", exact: true })
      .click();
    async function sign(target: Page, name: string) {
      await target.getByLabel("서명자 이름", { exact: true }).fill(name);
      await target
        .getByRole("checkbox", { name: /조건에 동의하고 서명합니다/ })
        .check();
      await target
        .getByRole("button", { name: "서명하기", exact: true })
        .click();
    }
    await sign(page, "계약 의뢰인");
    await expect(
      page.getByText("상대방의 서명을 기다리고 있어요.", { exact: true }),
    ).toBeVisible();
    await creator.goto(requestPath);
    await sign(creator, "계약 제작자");
    await expect(
      creator.getByRole("heading", { name: "계약", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "계약", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "테스트 결제", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "테스트 결제", exact: true }),
    ).toBeVisible();
    // No fake payment success: external Toss/Storage require a separate deployed acceptance run.
    await expect(
      page.getByText("200,000원", { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
