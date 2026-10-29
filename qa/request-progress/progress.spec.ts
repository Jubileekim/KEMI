import { expect, test } from "@playwright/test";
import type { ActivityStage } from "@kemi/shared";

for (const role of ["CLIENT", "CREATOR"] as const) {
  test(`${role}: 의뢰 목록·상세·활동이 계약 이후 단계를 따른다`, async ({
    page,
  }) => {
    let stage: ActivityStage | undefined = "PAYMENT_PENDING";
    const date = "2026-10-28T00:00:00Z";
    const user = {
      id: role === "CLIENT" ? "1" : "2",
      name: "회원",
      email: null,
      role,
      status: "ACTIVE",
    };
    const contract = {
      id: "9",
      workRequestId: "3",
      projectId: null,
      termsVersionNo: 1,
      clientId: "1",
      creatorId: "2",
      amountKrw: 100000,
      termsHash: "hash",
      status: "SIGNED",
      signedAt: date,
    };
    let signed = false;
    let signatureCount = 0;
    const version = {
      versionNo: 1,
      status: "SIGNING",
      termsHash: "hash",
      authorId: "1",
      createdAt: date,
      values: {
        amountKrw: 100000,
        specification: "영상",
        scope: "제작",
        materials: "자료",
        deadline: "기한",
        revisions: "1회",
        usageRights: "온라인",
        cancellation: "협의",
      },
      signing: {
        requestedBy: "1",
        requestedAt: date,
        expiresAt: "2099-01-01T00:00:00Z",
      },
      signatures: [
        {
          userId: role === "CLIENT" ? "2" : "1",
          signerName: "상대방",
          signedAt: date,
        },
      ],
    };
    const direct = () => ({
      id: "3",
      clientId: "1",
      clientName: "의뢰인",
      creatorId: "2",
      creatorName: "제작자",
      package: {
        packageId: "1",
        title: "완료 확인 영상",
        priceKrw: 100000,
        deliveryDays: 3,
        revisionCount: 1,
        includes: [],
      },
      message: "영상 의뢰",
      purpose: null,
      eventDate: null,
      materialType: null,
      desiredDeliveryDate: null,
      referencePortfolio: null,
      inquiryGroupId: null,
      status: signed ? "CONTRACTED" : "DISCUSSING",
      stage: signed ? stage : "DISCUSSING",
      respondDueAt: date,
      respondedAt: date,
      createdAt: date,
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith("/api/")) return route.continue();
      const json = (body: unknown, status = 200) =>
        route.fulfill({ status, json: body });
      if (path === "/api/auth/refresh")
        return json({
          accessToken: "fixture-token",
          accessTokenExpiresIn: 3600,
          user,
        });
      if (path === "/api/auth/me") return json({ user });
      if (path === "/api/direct-requests") return json({ items: [direct()] });
      if (path === "/api/direct-requests/3") return json(direct());
      if (
        path === "/api/work-requests/3/terms/versions/1/signatures" &&
        route.request().method() === "POST"
      ) {
        expect(route.request().postDataJSON()).toMatchObject({
          signerName: "회원",
          consent: true,
          termsHash: "hash",
        });
        signed = true;
        signatureCount += 1;
        return json({ contract });
      }
      if (path === "/api/work-requests/3/terms")
        return json({
          workRequestId: "3",
          workRequestStatus: signed ? "CONTRACTED" : "DISCUSSING",
          stage: signed ? stage : "DISCUSSING",
          projectStatus: null,
          reference: null,
          versions: signed ? [] : [version],
          contract: signed ? contract : null,
        });
      if (path === "/api/activity")
        return json({
          role,
          drafts: [],
          projects: [],
          requests: [
            {
              id: "3",
              type: "DIRECT_REQUEST",
              title: "완료 확인 영상",
              counterpartName: "상대방",
              status: "CONTRACTED",
              stage,
              contractId: "9",
              needsAction: false,
              updatedAt: date,
            },
          ],
          bookmarkCount: 0,
          unreadNotifications: 0,
        });
      if (path === "/api/notifications/unread-count")
        return json({ unreadCount: 0 });
      if (["/api/chat/rooms", "/api/applications/me"].includes(path))
        return json({ items: [] });
      if (path === "/api/analytics/events") return json({ accepted: 1 }, 202);
      return json({ error: { code: "NOT_FOUND", message: "fixture" } }, 404);
    });
    await page.goto("/requests");
    await expect(
      page.getByRole("heading", { name: "의뢰 현황", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: /완료 확인 영상/ }).click();
    const workspace = page.getByRole("main");
    await expect(workspace.getByText("협의 중", { exact: true })).toHaveCount(
      2,
    );
    await page.getByLabel("서명자 이름").fill("회원");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "서명하기", exact: true }).click();
    // 마지막 서명 후 이동·새로고침 없이 두 조회가 함께 갱신되어야 한다.
    await expect(
      workspace.getByText("계약 확정 · 결제 대기", { exact: true }),
    ).toHaveCount(2);
    expect(signatureCount).toBe(1);
    await page.getByRole("link", { name: "의뢰 현황으로" }).click();
    for (const [next, text] of [
      ["PAYMENT_PENDING", "계약 확정 · 결제 대기"],
      ["PREPARING", "제작 준비"],
      ["IN_PROGRESS", "제작 중"],
      ["DELIVERED", "수령 완료 · 정산 대기"],
      ["COMPLETED", "거래 완료"],
      ["CANCELED", "취소됨"],
      ["DISPUTED", "분쟁 처리 중"],
    ] as const) {
      stage = next;
      await page.reload();
      await expect(
        page
          .getByRole("region", { name: "직접 의뢰", exact: true })
          .getByText(text, { exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: /완료 확인 영상/ }).click();
      const main = page.getByRole("main");
      // 의뢰 상세 상단 배지와 직접 의뢰 상태 칸 모두 같은 단계다.
      await expect(
        main.locator('[data-slot="badge"]').getByText(text, { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("region", {
            name: "직접 의뢰 · 완료 확인 영상",
            exact: true,
          })
          .getByRole("definition")
          .filter({ hasText: text }),
      ).toBeVisible();
      await expect(main.getByText("계약 체결", { exact: true })).toHaveCount(0);
      await page.getByRole("link", { name: "의뢰 현황으로" }).click();
      await expect(
        page
          .getByRole("region", { name: "직접 의뢰", exact: true })
          .getByText(text, { exact: true }),
      ).toBeVisible();
    }
    stage = "COMPLETED";
    await page.goto("/me/activity");
    await expect(
      page
        .getByRole("main")
        .locator('[data-slot="badge"]')
        .getByText("거래 완료", { exact: true }),
    ).toBeVisible();
    await page.goto("/requests/3");
    await expect(
      page.getByRole("main").getByText("거래 완료", { exact: true }),
    ).toHaveCount(2);
    await page.reload();
    await expect(
      page.getByRole("main").getByText("거래 완료", { exact: true }),
    ).toHaveCount(2);
    // 백엔드를 먼저 배포하지 못한 경우에도 기존 표시로 호환된다.
    stage = undefined;
    await page.reload();
    await expect(
      page.getByRole("main").getByText("계약 체결", { exact: true }),
    ).toHaveCount(2);
  });
}
