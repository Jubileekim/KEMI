import { test, expect } from "@playwright/test";

for (const role of ["CLIENT", "CREATOR"] as const) {
  test(`실제 API: ${role} 가입 → 온보딩 저장 → 세션 복원`, async ({
    page,
  }, info) => {
    const mockRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/__mock__")) mockRequests.push(request.url());
    });
    await page.goto("/signup");
    await page
      .getByLabel(role === "CLIENT" ? "의뢰인" : "크리에이터", { exact: true })
      .check();
    await page
      .getByLabel("표시 이름 (필수)", { exact: true })
      .fill("가입 검증");
    await page
      .getByLabel("이메일 (필수)", { exact: true })
      .fill(`onboard-${role}-${info.project.name}-${Date.now()}@example.test`);
    await page
      .getByLabel("비밀번호 (필수)", { exact: true })
      .fill("BrowserTest1234");
    await page
      .getByLabel("비밀번호 확인 (필수)", { exact: true })
      .fill("BrowserTest1234");
    const signup = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/signup") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "가입하고 시작하기", exact: true })
      .click();
    expect((await signup).status()).toBe(201);
    await expect(page).toHaveURL(/\/me\/profile$/);
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: "프로필 완성하기", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("표시 이름 (필수)", { exact: true })
      .fill("저장된 이름");
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/profiles/me") &&
        r.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "프로필 저장", exact: true })
      .click();
    expect((await saved).status()).toBe(200);
    await page.reload();
    await expect(
      page.getByLabel("표시 이름 (필수)", { exact: true }),
    ).toHaveValue("저장된 이름");
    await expect(
      page.getByRole("link", {
        name: role === "CLIENT" ? "첫 모집 작성하기" : "모집 둘러보기",
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      role === "CLIENT" ? "/campaigns/new" : "/campaigns",
    );
    expect(mockRequests).toEqual([]);
  });
}
