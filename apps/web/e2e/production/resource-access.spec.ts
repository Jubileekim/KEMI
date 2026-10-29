import { expect, test } from "@playwright/test";

// Production bundle with controlled API responses; no live DB authorization claim.
[
  "/requests/999",
  "/workspace/999",
  "/contracts/999/payment",
  "/contracts/999/production",
  "/contracts/999/deliveries",
  "/contracts/999/settlement",
  "/contracts/999/cancellation",
].forEach((path) => {
  [403, 404].forEach((status) => {
    test(`${path} blocks private content on ${status}`, async ({ page }) => {
      let chatReads = 0;
      await page.route("**/api/**", (route) => {
        const apiPath = new URL(route.request().url()).pathname;
        const user = {
          id: "1",
          name: "의뢰인",
          email: "client@example.test",
          role: "CLIENT",
          status: "ACTIVE",
        };
        if (apiPath === "/api/auth/refresh")
          return route.fulfill({
            json: {
              accessToken: "fixture-token",
              accessTokenExpiresIn: 3600,
              user,
            },
          });
        if (apiPath === "/api/auth/me")
          return route.fulfill({ json: { user } });
        if (apiPath === "/api/notifications/unread-count")
          return route.fulfill({ json: { count: 0 } });
        if (apiPath === "/api/reports/me")
          return route.fulfill({
            json: { limited: false, reports: [], restrictions: [] },
          });
        if (apiPath.includes("/chat/")) chatReads += 1;
        return route.fulfill({
          status,
          json: { error: { code: status === 403 ? "FORBIDDEN" : "NOT_FOUND" } },
        });
      });
      await page.goto(path);
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", {
          name:
            status === 403
              ? "접근 권한이 없어요"
              : "접근 권한이 없거나 존재하지 않는 페이지예요",
          exact: true,
        }),
      ).toBeVisible();
      await expect(main.getByRole("textbox")).toHaveCount(0);
      await expect(main.getByRole("button")).toHaveCount(0);
      await expect(
        main.getByText("협의가 시작되면 조건서를 쓸 수 있어요."),
      ).toHaveCount(0);
      expect(chatReads).toBe(0);
      await main.getByRole("link", { name: "홈으로", exact: true }).click();
      await expect(page).toHaveURL("/");
    });
  });
});

[false, true].forEach((missingTerms) => {
  test(`a party can open their pending direct request (missing terms: ${missingTerms})`, async ({
    page,
  }) => {
    await page.route("**/api/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      const user = {
        id: "1",
        name: "의뢰인",
        email: "client@example.test",
        role: "CLIENT",
        status: "ACTIVE",
      };
      if (path === "/api/auth/refresh")
        return route.fulfill({
          json: {
            accessToken: "fixture-token",
            accessTokenExpiresIn: 3600,
            user,
          },
        });
      if (path === "/api/auth/me") return route.fulfill({ json: { user } });
      if (path === "/api/notifications/unread-count")
        return route.fulfill({ json: { count: 0 } });
      if (path === "/api/reports/me")
        return route.fulfill({
          json: { limited: false, reports: [], restrictions: [] },
        });
      if (path === "/api/direct-requests/999")
        return route.fulfill({
          json: {
            id: "999",
            clientId: "1",
            clientName: "의뢰인",
            creatorId: "2",
            creatorName: "제작자",
            package: {
              packageId: "1",
              title: "내 의뢰 패키지",
              priceKrw: 100000,
              deliveryDays: 7,
              revisionCount: 1,
              includes: [],
            },
            message: "본인이 보낸 의뢰입니다.",
            purpose: null,
            eventDate: null,
            materialType: null,
            desiredDeliveryDate: null,
            referencePortfolio: null,
            inquiryGroupId: null,
            status: "PENDING",
            stage: "REQUESTED",
            respondDueAt: "2026-11-01T00:00:00Z",
            respondedAt: null,
            createdAt: "2026-10-29T00:00:00Z",
          },
        });
      if (!missingTerms && path.endsWith("/terms"))
        return route.fulfill({
          json: {
            workRequestId: "999",
            workRequestStatus: "PENDING",
            stage: "REQUESTED",
            projectStatus: null,
            reference: null,
            versions: [],
            contract: null,
          },
        });
      return route.fulfill({
        status: 404,
        json: { error: { code: "NOT_FOUND" } },
      });
    });
    await page.goto("/requests/999");
    await expect(
      page.getByRole("heading", { name: "직접 의뢰 · 내 의뢰 패키지" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "의뢰 철회", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /접근 권한이 없/ }),
    ).toHaveCount(0);
  });
});
