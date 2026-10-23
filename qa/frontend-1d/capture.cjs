const { chromium, expect } = require("@playwright/test");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    baseURL: process.env.KEMI_QA_URL || "http://127.0.0.1:5180",
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login?returnTo=%2Fstudio%2Fpackages");
  await expect(page.getByLabel("이메일 (필수)")).toBeEnabled();
  await page.getByLabel("이메일 (필수)").fill("creator@example.test");
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill("Kemi1234");
  await page.getByRole("button", { name: "이메일로 로그인" }).click();
  await page.getByRole("button", { name: "새 패키지 만들기" }).click();
  const fields = {
    상품명: "제품의 이야기를 담는 숏폼",
    설명: "사용 장면을 자연스럽게 담아내는 제품 영상 패키지예요.",
    "가격 (원)": "150000",
    규격: "9:16 · 30초",
    수량: "1",
    "포함 작업": "촬영 · 편집 · 기본 자막",
    "제외 작업": "기획안 별도 제작 · 추가 출연",
    "필요 자료": "제품 · 브랜드 소개",
    "기간 (일)": "7",
    "수정 횟수": "1",
    "원본 제공 조건": "최종 계약에서 합의",
    "사용권·광고 활용 조건": "온라인 광고 활용 가능 · 기간은 최종 합의",
  };
  for (const [name, value] of Object.entries(fields))
    await page.getByLabel(name, { exact: true }).fill(value);
  await page.getByLabel("상업 광고 활용 가능한 상품임을 확인했어요").check();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: path.join(__dirname, `package-editor-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "공개 패키지로 저장" }).click();
  await page.getByRole("button", { name: "대표로 지정" }).click();
  await expect(
    page.getByRole("heading", { name: /제품의 이야기를.*대표/ }),
  ).toBeVisible();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: path.join(__dirname, `package-list-${width}.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  await browser.close();
  process.stdout.write("4 captures; page errors 0\n");
})().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
