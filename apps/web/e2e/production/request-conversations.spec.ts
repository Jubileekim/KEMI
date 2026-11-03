import { expect, test, type Page } from "@playwright/test";

const stages = [
  "COMPLETED",
  "IN_PROGRESS",
  "DELIVERED",
  "DISPUTED",
  "CANCELED",
  "CLOSED",
] as const;

async function setup(
  page: Page,
  options: {
    failed?: boolean;
    empty?: boolean;
    completedOnly?: boolean;
    creator?: boolean;
    delay?: Promise<void>;
  } = {},
) {
  let ids = ["1", "2", "3", "4", "5", "6", "7", "8"];
  if (options.completedOnly) ids = ["1"];
  if (options.empty) ids = [];
  const user = {
    id: "1",
    name: "의뢰인",
    email: "client@example.test",
    role: options.creator ? "CREATOR" : "CLIENT",
    status: "ACTIVE",
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ json: body, status });
    if (path === "/api/auth/refresh")
      return json({
        user,
        accessToken: "fixture-token",
        accessTokenExpiresIn: 3600,
      });
    if (path === "/api/auth/me") return json({ user });
    if (path === "/api/notifications/unread-count")
      return json({ unreadCount: 0 });
    if (path === "/api/reports/me")
      return json({ limited: false, reports: [], restrictions: [] });
    if (path === "/api/direct-requests") return json({ items: [] });
    if (path === "/api/applications/me") return json({ items: [] });
    if (path === "/api/chat/rooms")
      return json({
        items: ids.map((id) => ({
          workRequestId: id,
          projectId: id,
          projectTitle: `의뢰 ${id}`,
          clientId: "1",
          creatorId: "2",
          counterpartName: "제작자",
          readOnly: id === "6",
          lastMessage: null,
          unreadCount: id === "1" ? 2 : 0,
        })),
      });
    if (path === "/api/activity") {
      if (options.delay) await options.delay;
      if (options.failed)
        return json(
          { error: { code: "INTERNAL_ERROR", message: "조회 실패" } },
          503,
        );
      return json({
        role: "CLIENT",
        projects: [],
        drafts: [],
        bookmarkCount: 0,
        unreadNotifications: 0,
        requests: ids
          .filter((id) => Number(id) <= 6)
          .map((id) => ({
            id,
            type: "PROJECT_APPLICATION",
            title: `의뢰 ${id}`,
            counterpartName: "제작자",
            status: id === "6" ? "DECLINED" : "CONTRACTED",
            stage: stages[Number(id) - 1],
            contractId: id,
            needsAction: false,
            updatedAt: "2026-11-03T00:00:00Z",
          })),
      });
    }
    if (path === "/api/work-requests/7/terms")
      return json({
        workRequestId: "7",
        workRequestStatus: "CONTRACTED",
        stage: "COMPLETED",
        projectStatus: "CONTRACTED",
        reference: null,
        versions: [],
        contract: null,
      });
    return json({ error: { code: "NOT_FOUND" } }, 404);
  });
  await page.goto("/requests");
  return page.getByRole("region", { name: "대화 내역", exact: true });
}

test("완료된 대화를 분리하고 정산 대기·분쟁·미확인 대화를 유지한다", async ({
  page,
}) => {
  const conversations = await setup(page);
  await expect(
    conversations.getByRole("tab", { name: "진행 중", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    conversations.getByText("제작 중", { exact: true }),
  ).toBeVisible();
  await expect(
    conversations.getByText("수령 완료 · 정산 대기", { exact: true }),
  ).toBeVisible();
  await expect(
    conversations.getByText("분쟁 처리 중", { exact: true }),
  ).toBeVisible();
  await expect(
    conversations.getByText("상태 확인 필요", { exact: true }),
  ).toHaveCount(1);
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toHaveCount(0);
  await expect(
    conversations.getByRole("link", { name: "의뢰 7 · 제작자", exact: true }),
  ).toHaveCount(0);
  await conversations
    .getByRole("tab", { name: "완료·종료", exact: true })
    .click();
  await expect(
    conversations.getByText("거래 완료", { exact: true }),
  ).toHaveCount(2);
  await expect(
    conversations.getByText("취소됨", { exact: true }),
  ).toBeVisible();
  await expect(
    conversations.getByText("거절됨", { exact: true }),
  ).toBeVisible();
  await expect(conversations.getByText("새 메시지 2")).toBeVisible();
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toHaveAttribute("href", "/requests/1");
  await page.screenshot({
    path: test.info().outputPath("conversation-completed.png"),
    fullPage: true,
  });
  // Existing tabs support keyboard navigation on desktop and mobile.
  await conversations
    .getByRole("tab", { name: "완료·종료", exact: true })
    .focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    conversations.getByRole("tab", { name: "전체", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(conversations.getByRole("link")).toHaveCount(8);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("상태 조회 실패 시 안내와 대화 링크를 유지하고 다시 조회한다", async ({
  page,
}) => {
  const conversations = await setup(page, {
    failed: true,
    completedOnly: true,
  });
  await expect(conversations.getByRole("alert")).toContainText(
    "진행 상태를 불러오지 못했어요",
  );
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toBeVisible();
  await expect(
    conversations.getByText("상태 확인 필요", { exact: true }),
  ).toHaveCount(1);
  await page.route("**/api/activity", (route) =>
    route.fulfill({
      json: {
        requests: [{ id: "1", status: "CONTRACTED", stage: "COMPLETED" }],
      },
    }),
  );
  await conversations
    .getByRole("button", { name: "진행 상태 다시 확인" })
    .click();
  await expect(conversations.getByRole("alert")).toHaveCount(0);
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toHaveCount(0);
  await conversations
    .getByRole("tab", { name: "완료·종료", exact: true })
    .click();
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toBeVisible();
});

test("크리에이터도 완료된 대화를 찾을 수 있다", async ({ page }) => {
  const conversations = await setup(page, {
    completedOnly: true,
    creator: true,
  });
  await expect(
    conversations.getByText("진행 중인 대화가 없어요."),
  ).toBeVisible();
  await conversations
    .getByRole("tab", { name: "완료·종료", exact: true })
    .click();
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toBeVisible();
});

test("진행 상태를 기다리는 동안 빈 목록으로 안내하지 않는다", async ({
  page,
}) => {
  let release = () => {};
  const delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  const conversations = await setup(page, { completedOnly: true, delay });
  await expect(
    conversations.getByText("대화의 진행 상태를 확인하고 있어요."),
  ).toBeVisible();
  await expect(
    conversations.getByRole("link", { name: "의뢰 1 · 제작자", exact: true }),
  ).toBeVisible();
  await expect(conversations.getByText("진행 중인 대화가 없어요.")).toHaveCount(
    0,
  );
  release();
  await expect(
    conversations.getByText("진행 중인 대화가 없어요."),
  ).toBeVisible();
  await conversations
    .getByRole("tab", { name: "완료·종료", exact: true })
    .click();
  await expect(
    conversations.getByText("거래 완료", { exact: true }),
  ).toBeVisible();
});

test("대화가 없으면 탭별 빈 상태를 표시한다", async ({ page }) => {
  const conversations = await setup(page, { empty: true });
  await expect(
    conversations.getByText("진행 중인 대화가 없어요."),
  ).toBeVisible();
  await conversations
    .getByRole("tab", { name: "완료·종료", exact: true })
    .click();
  await expect(
    conversations.getByText("완료·종료된 대화가 없어요."),
  ).toBeVisible();
  await conversations.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(conversations.getByText("아직 대화가 없어요.")).toBeVisible();
});
