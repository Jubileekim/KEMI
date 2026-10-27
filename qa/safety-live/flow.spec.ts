import { test, expect, type Page } from "@playwright/test";

const password = "BrowserTest1234";

test("실제 API: 임시 저장 → 활동에서 이어쓰기 → 공개 실패 후 같은 초안 재시도", async ({
  page,
  request,
}, info) => {
  const email = `draft-${Date.now()}-${info.project.name}@example.test`;
  const signup = await request.post("/api/auth/signup", {
    data: { email, password, name: "초안 검증", role: "CLIENT" },
  });
  expect(signup.status()).toBe(201);
  const user = await signup.json();
  const headers = { Authorization: `Bearer ${user.accessToken}` };
  await login(page, email);
  await page.goto("/campaigns/new");
  const title = `실제 초안 ${info.project.name}`;
  await page.getByLabel("제목", { exact: true }).fill(title);
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/draft=\d+/);
  await page.goto("/me/activity");
  await page
    .getByRole("link", { name: `${title} · 이어 쓰기`, exact: true })
    .click();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(title);
  await page
    .getByLabel("설명", { exact: true })
    .fill("임시 저장하고 이어 쓴 실제 API 검증용 영상 제작 공고입니다.");
  await page.getByLabel("영상 목적", { exact: true }).selectOption("OTHER");
  await page.getByLabel("예산 (원)", { exact: true }).fill("150000");
  await page.getByLabel("모집 기간", { exact: true }).selectOption("3");
  await page
    .getByLabel("희망 납품일", { exact: true })
    .fill(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  // 스타일이 없으면 공개에 실패하지만 입력과 저장된 초안은 남는다.
  await page.getByRole("button", { name: "모집 공개", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("제목", { exact: true })).toHaveValue(title);
  expect(
    (await (await request.get("/api/project-drafts", { headers })).json())
      .items,
  ).toHaveLength(1);
  await page.locator("#draft-style-CLEAN").check();
  await page.getByRole("button", { name: "모집 공개", exact: true }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  expect(
    (await (await request.get("/api/project-drafts", { headers })).json())
      .items,
  ).toHaveLength(0);
  await page.goto("/me/activity?stage=COMPLETED");
  await expect(page.getByLabel("거래 단계")).toHaveValue("COMPLETED");
  await page.reload();
  await expect(page.getByLabel("거래 단계")).toHaveValue("COMPLETED");
});

test("실제 API: 알림 페이지·미확인 필터 URL 복원·읽음·조회 실패 후 재시도", async ({
  page,
}, info) => {
  await login(page, `notices-${info.project.name}@kemi.test`);
  await page.goto("/notifications?unread=true&page=2");
  await expect(page.getByLabel("미확인만 보기", { exact: true })).toBeChecked();
  await expect(
    page.getByRole("navigation", { name: "알림 페이지", exact: true }),
  ).toContainText("2 / 2");
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "알림 페이지", exact: true }),
  ).toContainText("2 / 2");
  const choices = page.getByRole("checkbox", {
    name: /페이지 검증 알림 .* 선택/,
  });
  await expect(choices).toHaveCount(20);
  await choices.first().check();
  await page
    .getByRole("button", { name: "선택한 1개 읽음", exact: true })
    .click();
  await expect(choices).toHaveCount(19);
  await page.getByRole("button", { name: "이전 알림", exact: true }).click();
  await expect(page).toHaveURL(/unread=true.*page=1/);
  await page.goBack();
  await expect(
    page.getByRole("navigation", { name: "알림 페이지", exact: true }),
  ).toContainText("2 / 2");
  await page.route("**/api/notifications?**", (route) =>
    route.fulfill({
      status: 500,
      json: { error: { code: "INTERNAL_ERROR", message: "테스트 오류" } },
    }),
  );
  await page
    .getByRole("button", { name: "알림 다시 확인", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(choices).toHaveCount(0);
  await page.unroute("**/api/notifications?**");
  await page
    .getByRole("button", { name: "알림 다시 확인", exact: true })
    .click();
  await expect(choices).toHaveCount(19);
  await page.getByRole("button", { name: "모두 읽음", exact: true }).click();
  await expect(
    page.getByText("표시할 알림이 없어요.", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/unread=true.*page=1/);
});

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("이메일 (필수)", { exact: true }).fill(email);
  await page.getByLabel("비밀번호 (필수)", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "이메일로 로그인", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "로그아웃", exact: true }),
  ).toBeVisible();
}

test("실제 빌드: 비회원 탐색 → 신고 → 운영 제한 → 이의 → 해제·알림 읽음", async ({
  page,
  browser,
  request,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const feedResponse = page.waitForResponse(
    (r) => r.url().includes("/api/feed") && r.request().method() === "GET",
  );
  await page.goto("/");
  expect((await feedResponse).status()).toBe(200);

  const suffix = `${Date.now()}-${info.project.name}`;
  const reason = `공개 모집 내용 확인 ${suffix}`;
  const clientEmail = `client-${suffix}@example.test`;
  const creatorEmail = `creator-${suffix}@example.test`;
  const clientResponse = await request.post("/api/auth/signup", {
    data: { email: clientEmail, password, name: "의뢰인 검증", role: "CLIENT" },
  });
  expect(clientResponse.status()).toBe(201);
  const client = await clientResponse.json();
  expect(
    (
      await request.post("/api/auth/signup", {
        data: {
          email: creatorEmail,
          password,
          name: "제작자 검증",
          role: "CREATOR",
        },
      })
    ).status(),
  ).toBe(201);
  const projectResponse = await request.post("/api/projects", {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: {
      title: `검증 공고 ${suffix}`,
      description: "실제 API 연결 검증용 영상 제작 공고입니다.",
      purpose: "OTHER",
      styles: ["CLEAN"],
      budget: 200000,
      recruitmentEndAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      deliveryDueDate: new Date(Date.now() + 14 * 86400000)
        .toISOString()
        .slice(0, 10),
    },
  });
  expect(projectResponse.status()).toBe(201);
  const project = await projectResponse.json();

  await login(page, creatorEmail);
  await page.goto(`/reports/new?targetType=PROJECT&targetId=${project.id}`);
  await page.getByLabel("신고 사유", { exact: true }).fill(reason);
  await page.getByRole("button", { name: "신고 접수", exact: true }).click();
  await expect(
    page.getByText("신고를 접수했어요.", { exact: true }),
  ).toBeVisible();

  const opsContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4198",
  });
  const ops = await opsContext.newPage();
  await login(ops, "ops-browser@kemi.test");
  await ops.goto("/ops/reports");
  const card = ops.getByRole("listitem").filter({ hasText: reason });
  await card.getByLabel("처리 근거").fill("검증용 제한 근거");
  // 서버 저장 뒤 응답만 유실시켜, 같은 조치 재시도가 중복 이력을 만들지 않는지 확인한다.
  await ops.route(
    "**/api/admin/reports/*/actions",
    async (route) => {
      await route.fetch();
      await route.abort("failed");
    },
    { times: 1 },
  );
  await card.getByRole("button", { name: "이용 제한", exact: true }).click();
  await expect(card.getByRole("alert")).toBeVisible();
  await card.getByRole("button", { name: "이용 제한", exact: true }).click();
  await expect(card.getByText("제한 중", { exact: true })).toBeVisible();
  await expect(
    card.locator("ol li").filter({ hasText: "검증용 제한 근거" }),
  ).toHaveCount(1);

  const subjectContext = await browser.newContext({
    baseURL: "http://127.0.0.1:4198",
  });
  const subject = await subjectContext.newPage();
  await login(subject, clientEmail);
  await subject.goto("/me/activity");
  await expect(
    subject.getByRole("heading", { name: "내 활동", exact: true }),
  ).toBeVisible();
  await expect(subject.getByText(project.title, { exact: true })).toBeVisible();
  await expect(
    subject.getByText("이용 제한 중이에요.", { exact: false }),
  ).toBeVisible();
  await subject.goto("/reports/new");
  await subject.getByLabel("이의 내용").fill("비공개 이의 검토 요청");
  await subject.getByRole("button", { name: "이의 제기", exact: true }).click();
  await expect(subject.getByText(/비공개 이의 검토 요청/)).toBeVisible();

  await ops.reload();
  await card.getByLabel("처리 근거").fill("확인 후 제한 해제");
  await card.getByRole("button", { name: "제한 해제", exact: true }).click();
  await expect(card.getByText("제한 중", { exact: true })).toHaveCount(0);
  await subject.reload();
  await expect(
    subject.getByRole("heading", { name: "이용 제한 중", exact: true }),
  ).toHaveCount(0);

  await page.goto("/notifications");
  await page
    .getByRole("checkbox", { name: / 선택$/ })
    .first()
    .check();
  await page
    .getByRole("button", { name: "선택한 1개 읽음", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "선택한 0개 읽음", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  await subjectContext.close();
  await opsContext.close();
});
