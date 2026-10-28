import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@kemi/shared";
import { createPrismaClient } from "../src/lib/prisma.js";
import {
  dealContractRelations,
  dealStageInclude,
  dealStage,
} from "../src/deal/stage.js";
import { createDirectRequestService } from "../src/direct/direct.service.js";
import { createTermsService } from "../src/terms/terms.service.js";
import { createActivityService } from "../src/safety/activity.service.js";

const contract = {
  id: 9n,
  status: "SIGNED" as const,
  payments: [{ id: 1n }],
  production: { status: "IN_PROGRESS" as const },
  settlement: null,
  disputes: [],
};
const user: AuthUser = {
  id: "2",
  name: "제작자",
  email: null,
  role: "CREATOR",
  status: "ACTIVE",
};

describe("공통 거래 진행 단계", () => {
  it.each(["PENDING", "DISCUSSING"])("계약 전 %s를 보존한다", (status) => {
    expect(dealStage(status, null)).toBe(status);
  });
  it.each(["DECLINED", "WITHDRAWN", "EXPIRED", "NOT_SELECTED"])(
    "%s는 종료다",
    (status) => {
      expect(dealStage(status, null)).toBe("CLOSED");
    },
  );
  it.each<[NonNullable<Parameters<typeof dealStage>[1]>, string]>([
    [{ ...contract, payments: [] }, "PAYMENT_PENDING"],
    [{ ...contract, production: null }, "PREPARING"],
    [{ ...contract, production: { status: "PREPARING" } }, "PREPARING"],
    [contract, "IN_PROGRESS"],
    [{ ...contract, production: { status: "DELIVERED" } }, "DELIVERED"],
    [{ ...contract, production: { status: "COMPLETED" } }, "DELIVERED"],
    [
      { ...contract, settlement: { contractId: 9n, status: "SIMULATED" } },
      "COMPLETED",
    ],
    [
      {
        ...contract,
        status: "CANCELED",
        settlement: { contractId: 9n, status: "SIMULATED" },
      },
      "CANCELED",
    ],
    [{ ...contract, status: "CANCELED", disputes: [{ id: 1n }] }, "DISPUTED"],
    [{ ...contract, production: { status: "CANCELED" } }, "CANCELED"],
  ])("관련 계약 정보로 %s를 계산한다", (value, expected) => {
    expect(dealStage("CONTRACTED", value)).toBe(expected);
  });
});

describe("의뢰 #3 목록·상세·활동 응답", () => {
  it.each(["CLIENT", "CREATOR"] as const)(
    "%s에게 동일한 완료 단계를 반환하고 의뢰 상태는 보존한다",
    async (role) => {
      const party = { ...user, role, id: role === "CLIENT" ? "1" : "2" };
      const date = new Date("2026-10-28T00:00:00Z");
      const row = {
        id: 3n,
        clientId: 1n,
        creatorId: 2n,
        client: { name: "의뢰인" },
        creator: { name: "제작자" },
        requestType: "DIRECT_REQUEST",
        status: "CONTRACTED",
        project: null,
        packageSnapshot: {
          packageId: "1",
          title: "영상",
          priceKrw: 100000,
          deliveryDays: 3,
          revisionCount: 1,
          includes: [],
        },
        message: "의뢰",
        purpose: null,
        eventDate: null,
        materialType: null,
        desiredDeliveryDate: null,
        referencePortfolio: null,
        inquiryGroupId: null,
        respondDueAt: date,
        respondedAt: date,
        createdAt: date,
        updatedAt: date,
        termsVersions: [],
        contract: {
          ...contract,
          workRequestId: 3n,
          projectId: null,
          clientId: 1n,
          creatorId: 2n,
          amountKrw: 100000n,
          termsHash: "hash",
          signedAt: date,
          termsVersion: { versionNo: 1 },
          production: { status: "COMPLETED" },
          settlement: { contractId: 9n, status: "SIMULATED" },
        },
      };
      const findMany = vi.fn(async (args: { select?: unknown }) =>
        args.select ? [] : [row],
      );
      const findUnique = vi.fn(async () => row);
      const tx = {
        workRequest: { findMany, findUnique },
        $queryRaw: vi.fn(async () => []),
      };
      const prisma = Object.assign(
        createPrismaClient({
          DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
          DATABASE_POOL_MAX: 1,
        }),
        {
          ...tx,
          $transaction: async (run: (value: typeof tx) => unknown) => run(tx),
          notification: { count: async () => 0 },
          projectBookmark: { count: async () => 0 },
          project: { findMany: async () => [] },
          projectDraft: { findMany: async () => [] },
        },
      );
      const directs = createDirectRequestService({ prisma });
      expect((await directs.list(party)).items[0]).toMatchObject({
        id: "3",
        status: "CONTRACTED",
        stage: "COMPLETED",
      });
      expect(await directs.get(party, 3n)).toMatchObject({
        id: "3",
        status: "CONTRACTED",
        stage: "COMPLETED",
      });
      expect(
        await createTermsService({ prisma }).getDocument(party, 3n),
      ).toMatchObject({
        workRequestId: "3",
        workRequestStatus: "CONTRACTED",
        stage: "COMPLETED",
      });
      expect(
        (await createActivityService({ prisma }).get(party)).requests[0],
      ).toMatchObject({ id: "3", status: "CONTRACTED", stage: "COMPLETED" });
      // 목록에서도 계약 단계 조회를 포함하므로 의뢰별 별도 조회가 필요 없다.
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            ...dealStageInclude,
          }),
        }),
      );
      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            contract: {
              include: {
                termsVersion: { select: { versionNo: true } },
                ...dealContractRelations,
              },
            },
          }),
        }),
      );
      await expect(
        createTermsService({ prisma }).getDocument({ ...party, id: "999" }, 3n),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        directs.get({ ...party, id: "999" }, 3n),
      ).rejects.toMatchObject({ status: 404 });
    },
  );
});
