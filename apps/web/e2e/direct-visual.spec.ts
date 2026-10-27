import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { login, navigate } from "./proposal-helpers";
import { sendDirectRequest } from "./direct-helpers";
import { confirm } from "./payments-helpers";

test("6단계 실제 라우트 화면·역할 진입과320~1280px 레이아웃", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  const mobile = info.project.name.includes("mobile");
  const capture = async (name: string) => {
    await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
      await previous;
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }, Promise.resolve());
    await page.setViewportSize({ width: mobile ? 390 : 1280, height: 900 });
    await page.locator("#main-content").screenshot({
      path: fileURLToPath(
        new URL(
          `../../../qa/frontend-6/${name}-${mobile ? "390" : "1280"}.png`,
          import.meta.url,
        ),
      ),
      scale: "css",
    });
  };
  await page.goto("/");
  await expect(page.getByRole("article")).toHaveCount(3);
  await capture("feed-final");
  await page.getByRole("article").first().getByRole("link").first().click();
  await expect(page.getByLabel("공개 샘플 영상")).toBeVisible();
  await capture("work-final");
  await page
    .getByRole("link", { name: "제작자·공개 패키지 보기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "예시 크리에이터", exact: true }),
  ).toBeVisible();
  await capture("creator-final");
  await login(page, "client");
  await navigate(
    page,
    "/creators/mock-creator/request?packageId=sample-package",
  );
  await expect(page.getByLabel("제작 브리프", { exact: true })).toBeVisible();
  await capture("request-form-final");
  const id = await sendDirectRequest(page);
  await expect(page.getByRole("article")).toContainText("응답 대기");
  await capture("request-final");
  await login(page);
  await navigate(page, `/requests/${id}`);
  await expect(
    page.getByRole("button", { name: "직접 의뢰 협의 수락", exact: true }),
  ).toBeVisible();
  await capture("inbox-final");
  await confirm(page, "직접 의뢰 협의 수락");
  await page
    .getByRole("link", { name: "대화·작업 공간 열기", exact: true })
    .click();
  await expect(page.getByLabel("최종 조건서", { exact: true })).toBeVisible();
  await capture("workspace-final");
});
