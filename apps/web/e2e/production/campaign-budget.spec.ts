import { expect, test } from "@playwright/test";

test("모집 예산은 최대 999,999,999원까지 입력하고 임시 저장한다", async ({
  page,
}) => {
  const user = {
    id: "1",
    name: "의뢰인",
    email: "client@example.com",
    role: "CLIENT",
    status: "ACTIVE",
  };
  const writes: Record<string, unknown>[] = [];
  let draft: unknown;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown) => route.fulfill({ json: body });
    if (path === "/api/auth/me") return json({ user });
    if (path === "/api/auth/refresh")
      return json({
        user,
        accessToken: "fixture-token",
        accessTokenExpiresIn: 3600,
      });
    if (path === "/api/notifications/unread-count") return json({ count: 0 });
    if (path === "/api/project-drafts") {
      if (request.method() === "POST") {
        const values = request.postDataJSON();
        writes.push(values);
        draft = {
          id: "1",
          values,
          recruitmentDays: 7,
          publishedProjectId: null,
          createdAt: "2026-10-29T00:00:00Z",
          updatedAt: "2026-10-29T00:00:00Z",
        };
        return json(draft);
      }
      return json({ items: draft ? [draft] : [] });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/campaigns/new");
  const budget = page.getByLabel("예산 (원)", { exact: true });
  await expect(budget).toHaveAttribute("max", "999999999");
  await budget.fill("999999999");
  await expect(budget).toHaveValue("999999999");
  await budget.press("End");
  await budget.press("9");
  await expect(budget).toHaveValue("999999999");
  // fill emits an input event for replacing the complete value, as paste does.
  await budget.fill("123456789012345");
  await expect(budget).toHaveValue("999999999");
  await budget.fill("");
  await expect(budget).toHaveValue("");
  await budget.fill("50000");
  await expect(budget).toHaveValue("50000");
  await budget.fill("1000000000");
  await expect(budget).toHaveValue("999999999");
  await page.getByRole("button", { name: "임시 저장", exact: true }).click();
  await expect(page).toHaveURL(/draft=1/);
  expect(writes).toEqual([expect.objectContaining({ budget: 999_999_999 })]);
  await expect(page.getByLabel("예산 (원)", { exact: true })).toHaveValue(
    "999999999",
  );
});
