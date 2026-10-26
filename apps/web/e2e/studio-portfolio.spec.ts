import { test, expect, type Page } from "@playwright/test";
import { loginStudio, localVideo, workFields } from "./studio-helpers";

async function scenario(page: Page, value: string) {
  await page.evaluate(async (s) => {
    await fetch("/__mock__/studio/scenario", { method: "POST", body: s });
  }, value);
}
test("작업물 초안·동의·파일 준비·수정·비공개·삭제·제출 참조 보존", async ({
  page,
}) => {
  await loginStudio(page);
  await workFields(page);
  await page.getByLabel("작업 출처 구분").selectOption("EXTERNAL");
  await localVideo(page);
  await page.getByRole("button", { name: "공개 작업물로 저장" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "고객 작업물의 공개 동의",
  );
  await expect(page.getByRole("alert")).toContainText("업로드 완료");
  await page
    .getByLabel("고객 작업물의 공개 동의를 받았어요 (고객 작업일 때 필요)")
    .check();
  await page.getByRole("button", { name: "Mock 업로드 완료 처리" }).click();
  await page.getByRole("button", { name: "공개 작업물로 저장" }).click();
  const item = page.getByRole("article", {
    name: "작업물 개인 샘플",
    exact: true,
  });
  await expect(item).toContainText("공개 후보");
  await expect(
    page.getByRole("region", { name: "모의 작업물 공개 목록" }),
  ).toContainText("공개 노출 작업물 없음");
  await item.getByRole("button", { name: "모의 제출 참조 보관" }).click();
  await item.getByRole("button", { name: "작업물 수정" }).click();
  await expect(
    page.getByText("이전 파일의 메타데이터만 있어요.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("작업물 설명", { exact: true }).fill("수정 설명");
  await page.getByRole("button", { name: "작업물 저장", exact: true }).click();
  await expect(item).toContainText("수정 설명");
  await item.getByRole("button", { name: "작업물 비공개" }).click();
  await expect(item.getByRole("heading")).toContainText("비공개");
  await item.getByRole("button", { name: "작업물 삭제", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("모의 제출 참조");
  await page.keyboard.press("Escape");
  await expect(
    item.getByRole("button", { name: "작업물 삭제", exact: true }),
  ).toBeFocused();
  await item.getByRole("button", { name: "작업물 삭제", exact: true }).click();
  await page.getByRole("button", { name: "삭제 취소", exact: true }).click();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "작업물 삭제", exact: true }).click();
  await scenario(page, "500");
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "삭제하지 못했어요",
  );
  await scenario(page, "success");
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(item).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "새 작업물 만들기" }),
  ).toBeFocused();
  await expect(page.getByText("보관된 모의 제출:")).toContainText("개인 샘플");
});
test("빈 초안과 URL D02·위험 URL 차단·외부 전송 없음", async ({ page }) => {
  await loginStudio(page);
  const remote: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("external.example.test")) remote.push(req.url());
  });
  await page.getByRole("button", { name: "새 작업물 만들기" }).click();
  await page.getByRole("button", { name: "작업물 저장", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "제목 없는 초안 · 초안" }),
  ).toBeVisible();
  await workFields(page, "URL 초안");
  await page.getByLabel("영상 준비 방식").selectOption("URL");
  await page
    .getByLabel("외부 영상 URL (초안)")
    .fill(["javascript", "alert(1)"].join(":"));
  await page.getByRole("button", { name: "작업물 저장", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("https");
  await page
    .getByLabel("외부 영상 URL (초안)")
    .fill("https://external.example.test/video");
  await page.getByRole("button", { name: "공개 작업물로 저장" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "공개 전 모의 확인" }),
  ).toContainText("D02");
  await page.getByRole("button", { name: "작업물 저장", exact: true }).click();
  await expect(
    page.getByRole("article", { name: "작업물 URL 초안", exact: true }),
  ).toContainText("초안");
  expect(remote).toEqual([]);
});
test("파일 형식·재생 실패·객체 URL 정리·반응형", async ({ page }) => {
  await page.addInitScript(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    Reflect.set(window, "revokedCount", 0);
    URL.revokeObjectURL = (url) => {
      Reflect.set(
        window,
        "revokedCount",
        Number(Reflect.get(window, "revokedCount")) + 1,
      );
      revoke(url);
    };
  });
  await loginStudio(page);
  await workFields(page);
  await page.getByLabel("영상 파일 (로컬 Mock)").setInputFiles({
    name: "bad.html",
    mimeType: "text/html",
    buffer: Buffer.from("bad"),
  });
  await expect(page.getByRole("alert")).toContainText("MP4/WebM");
  await page.getByLabel("영상 파일 (로컬 Mock)").setInputFiles({
    name: "broken.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("broken"),
  });
  await expect(page.getByRole("alert")).toContainText("재생하지 못했어요");
  await expect(
    page.getByRole("button", { name: "Mock 업로드 완료 처리" }),
  ).toBeDisabled();
  await localVideo(page);
  await [320, 390, 600, 768, 1024, 1280].reduce(async (previous, width) => {
    await previous;
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }, Promise.resolve());
  await page.getByRole("button", { name: "작업물 편집 취소" }).click();
  expect(
    await page.evaluate(() => Number(Reflect.get(window, "revokedCount"))),
  ).toBeGreaterThanOrEqual(2);
});
["409", "500", "network"].forEach((value) => {
  test(`작업물 ${value} 입력 보존·최신 조회 실패에도 편집 유지`, async ({
    page,
  }) => {
    await loginStudio(page);
    await workFields(page);
    await scenario(page, value);
    await page
      .getByRole("button", { name: "작업물 저장", exact: true })
      .click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByText("1-D 개발 전용 시나리오", { exact: true }).click();
    await page
      .getByRole("button", { name: "최신 값 확인", exact: true })
      .click();
    await expect(page.getByLabel("작업물 제목", { exact: true })).toHaveValue(
      "개인 샘플",
    );
    await scenario(page, "success");
    await expect(
      page.getByRole("button", { name: "작업물 저장", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "작업물 저장", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "내 작업물 (1)" }),
    ).toBeVisible();
  });
});
test("1-D 통합: 프로필 저장→패키지→대표→공개→샘플→서비스 비공개", async ({
  page,
}) => {
  await loginStudio(page);
  await page.getByRole("link", { name: "내 프로필 확인", exact: true }).click();
  await page.getByLabel("소개 (선택)").fill("서비스 준비");
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByText("프로필을 저장했어요.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "패키지·서비스", exact: true }).click();
  await page.getByRole("button", { name: "새 패키지 만들기" }).click();
  const fields = {
    상품명: "샘플 패키지",
    설명: "설명",
    "가격 (원)": "100000",
    규격: "30초",
    수량: "1",
    "포함 작업": "촬영",
    "제외 작업": "편집",
    "필요 자료": "제품",
    "기간 (일)": "7",
    "수정 횟수": "1",
    "원본 제공 조건": "합의",
    "사용권·광고 활용 조건": "광고",
  };
  await Object.entries(fields).reduce(async (previous, [label, value]) => {
    await previous;
    await page.getByLabel(label, { exact: true }).fill(value);
  }, Promise.resolve());
  await page.getByLabel("상업 광고 활용 가능한 상품임을 확인했어요").check();
  await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
  await page.getByRole("button", { name: "대표로 지정" }).click();
  await page.getByText("1-D 개발 전용 시나리오", { exact: true }).click();
  await page.getByLabel("D01 모의 프로필 조건").selectOption("READY");
  await expect(
    page.getByRole("button", { name: "서비스 공개", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "서비스 공개", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "제작 서비스: 공개" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "작업물 관리로 이동" }).click();
  await workFields(page);
  await localVideo(page);
  await page.getByRole("button", { name: "Mock 업로드 완료 처리" }).click();
  await page.getByRole("button", { name: "공개 작업물로 저장" }).click();
  const list = page.getByRole("region", { name: "모의 작업물 공개 목록" });
  await expect(list.getByRole("listitem")).toContainText(
    "개인 샘플 · 자작 샘플 · 촬영 · 편집",
  );
  await page
    .getByRole("button", { name: "서비스 비공개", exact: true })
    .click();
  await expect(list).toContainText("공개 노출 작업물 없음");
  await page.getByRole("link", { name: "패키지·서비스로 이동" }).click();
  await expect(
    page.getByRole("heading", { name: "제작 서비스: 비공개" }),
  ).toBeVisible();
});
