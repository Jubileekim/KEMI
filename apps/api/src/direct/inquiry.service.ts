import {
  type AuthUser,
  type BulkInquiryResponse,
  type BulkInquiryResult,
  bulkInquiryCreateSchema,
  WORK_BOOKMARK_MAX,
  type WorkBookmarkListResponse,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { toPortfolio } from "../catalog/catalog.service.js";
import { requireNotRestricted } from "../safety/safety.service.js";
import {
  type DirectRow,
  expireOverdueDirect,
  includeParties,
  requestablePackage,
  sendDirectRequest,
  toDirect,
} from "./direct.service.js";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

// 공개 중인 작품(작품 공개 + 크리에이터 활성 + 제작 서비스 공개). 피드와 같은 조건이다.
const publicPortfolio = {
  status: "PUBLIC",
  creator: {
    status: "ACTIVE",
    creatorProfile: { serviceStatus: "PUBLIC" },
  },
} satisfies Prisma.PortfolioWhereInput;

// 작품의 의뢰 패키지: 연결 패키지가 의뢰 가능하면 그것, 아니면 크리에이터의 대표 패키지
const portfolioWithPackages = {
  creator: {
    select: {
      id: true,
      name: true,
      servicePackages: {
        where: { isRepresentative: true, ...requestablePackage },
        take: 1,
      },
    },
  },
  package: true,
} satisfies Prisma.PortfolioInclude;
type PortfolioWithPackages = Prisma.PortfolioGetPayload<{
  include: typeof portfolioWithPackages;
}>;

function requestPackageOf(row: PortfolioWithPackages) {
  const linked = row.package;
  if (
    linked &&
    linked.status === "PUBLIC" &&
    linked.priceKrw !== null &&
    linked.deliveryDays !== null &&
    linked.revisionCount !== null
  ) {
    return linked;
  }
  return row.creator.servicePackages[0] ?? null;
}

const activeStatuses = ["PENDING", "DISCUSSING"];

export interface InquiryService {
  listBookmarks(user: AuthUser): Promise<WorkBookmarkListResponse>;
  saveBookmark(user: AuthUser, portfolioId: bigint): Promise<{ saved: true }>;
  removeBookmark(
    user: AuthUser,
    portfolioId: bigint,
  ): Promise<{ saved: false }>;
  sendBulk(user: AuthUser, input: unknown): Promise<BulkInquiryResponse>;
}

// SAVE-01: 작품 저장함, INQ-01: 저장한 작품의 제작자들에게 같은 조건으로 일괄 문의
export function createInquiryService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): InquiryService {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  function requireActive(user: AuthUser) {
    if (user.status !== "ACTIVE") {
      throw new AppError(403, "FORBIDDEN", "이용이 제한된 계정입니다.");
    }
  }

  // 같은 commandId로 이미 보낸 묶음이면 그 결과를 다시 만든다(새로 보내지 않는다).
  async function replay(
    tx: Tx,
    clientId: bigint,
    groupId: string,
    portfolioIds: bigint[],
  ): Promise<BulkInquiryResponse | null> {
    const sent = await tx.workRequest.findMany({
      where: { clientId, inquiryGroupId: groupId },
      include: includeParties,
    });
    if (sent.length === 0) return null;
    const portfolios = await tx.portfolio.findMany({
      where: { id: { in: portfolioIds } },
      select: { id: true, title: true, creatorId: true },
    });
    const results = portfolioIds.map((id): BulkInquiryResult => {
      const work = portfolios.find((p) => p.id === id);
      const request = sent.find((r) => r.referencePortfolioId === id);
      const sameCreator = sent.find((r) => r.creatorId === work?.creatorId);
      let status: BulkInquiryResult["status"] = "UNAVAILABLE";
      if (request) status = "SENT";
      else if (sameCreator) status = "SAME_CREATOR";
      return {
        portfolioId: id.toString(),
        portfolioTitle: work?.title ?? null,
        creatorName: (request ?? sameCreator)?.creator.name ?? null,
        status,
        request: request ? toDirect(request) : null,
      };
    });
    return { inquiryGroupId: groupId, results };
  }

  return {
    async listBookmarks(user) {
      const rows = await prisma.portfolioBookmark.findMany({
        where: { userId: BigInt(user.id) },
        orderBy: [{ createdAt: "desc" }, { portfolioId: "desc" }],
        take: WORK_BOOKMARK_MAX,
        include: { portfolio: { include: portfolioWithPackages } },
      });
      const live = await prisma.portfolio.findMany({
        where: {
          id: { in: rows.map((r) => r.portfolioId) },
          ...publicPortfolio,
        },
        select: { id: true },
      });
      const liveIds = new Set(live.map((p) => p.id));
      return {
        items: rows.map((row) => {
          const pkg = requestPackageOf(row.portfolio);
          const price =
            row.portfolio.creator.servicePackages[0]?.priceKrw ?? null;
          return {
            portfolio: toPortfolio(row.portfolio),
            creator: {
              userId: row.portfolio.creator.id.toString(),
              name: row.portfolio.creator.name,
            },
            startingPriceKrw: price === null ? null : Number(price),
            savedAt: row.createdAt.toISOString(),
            available: liveIds.has(row.portfolioId) && pkg !== null,
          };
        }),
      };
    },

    // 공개 작품만 저장할 수 있다. 이미 저장했으면 그대로 둔다.
    async saveBookmark(user, portfolioId) {
      requireActive(user);
      const userId = BigInt(user.id);
      return inTransaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
        const work = await tx.portfolio.findFirst({
          where: { id: portfolioId, ...publicPortfolio },
          select: { id: true },
        });
        if (!work) {
          throw new AppError(404, "NOT_FOUND", "작업물을 찾을 수 없습니다.");
        }
        const existing = await tx.portfolioBookmark.findUnique({
          where: { userId_portfolioId: { userId, portfolioId } },
        });
        if (existing) return { saved: true };
        const count = await tx.portfolioBookmark.count({ where: { userId } });
        if (count >= WORK_BOOKMARK_MAX) {
          throw new AppError(
            409,
            "CONFLICT",
            `작품은 ${WORK_BOOKMARK_MAX}개까지 저장할 수 있습니다.`,
          );
        }
        await tx.portfolioBookmark.create({ data: { userId, portfolioId } });
        return { saved: true };
      });
    },

    async removeBookmark(user, portfolioId) {
      await prisma.portfolioBookmark.deleteMany({
        where: { userId: BigInt(user.id), portfolioId },
      });
      return { saved: false };
    },

    // INQ-01: 고른 작품마다 그 제작자에게 같은 조건으로 직접 의뢰를 보낸다(크리에이터당 한 건).
    // 보낼 수 없는 작품은 이유와 함께 결과에 남기고 나머지는 보낸다.
    async sendBulk(user, input) {
      if (user.role !== "CLIENT" || user.status !== "ACTIVE") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "활성 의뢰인 계정만 일괄 문의를 보낼 수 있습니다.",
        );
      }
      const clientId = BigInt(user.id);
      const data = bulkInquiryCreateSchema.parse(input);
      const portfolioIds = data.portfolioIds.map(BigInt);
      const conditions = {
        message: data.message,
        purpose: data.purpose,
        eventDate: data.eventDate,
        materialType: data.materialType,
        desiredDeliveryDate: data.desiredDeliveryDate,
      };
      const run = () =>
        inTransaction(async (tx) => {
          // 같은 의뢰인의 발송을 한 번에 하나씩 처리한다(동시 중복 발송 방지).
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${clientId} FOR UPDATE`;
          const previous = await replay(
            tx,
            clientId,
            data.commandId,
            portfolioIds,
          );
          if (previous) return previous;
          await requireNotRestricted(tx, clientId);
          const rows = await tx.portfolio.findMany({
            where: { id: { in: portfolioIds }, ...publicPortfolio },
            include: portfolioWithPackages,
          });
          const titles = await tx.portfolio.findMany({
            where: { id: { in: portfolioIds } },
            select: { id: true, title: true },
          });
          await expireOverdueDirect(tx, { clientId }, now());
          const sentCreators = new Set<bigint>();
          const results = await portfolioIds.reduce<
            Promise<BulkInquiryResult[]>
          >(async (previousResults, id) => {
            const done = await previousResults;
            const row = rows.find((r) => r.id === id);
            const pkg = row ? requestPackageOf(row) : null;
            const base = {
              portfolioId: id.toString(),
              portfolioTitle: titles.find((t) => t.id === id)?.title ?? null,
              creatorName: row?.creator.name ?? null,
            };
            if (!row || !pkg) {
              return [
                ...done,
                { ...base, status: "UNAVAILABLE", request: null },
              ];
            }
            if (sentCreators.has(row.creatorId)) {
              return [
                ...done,
                { ...base, status: "SAME_CREATOR", request: null },
              ];
            }
            const open = await tx.workRequest.findFirst({
              where: {
                clientId,
                packageId: pkg.id,
                requestType: "DIRECT_REQUEST",
                status: { in: activeStatuses },
              },
              select: { id: true },
            });
            if (open) {
              return [
                ...done,
                { ...base, status: "ALREADY_OPEN", request: null },
              ];
            }
            const created: DirectRow = await sendDirectRequest(tx, {
              clientId,
              pkg,
              conditions,
              referencePortfolioId: id,
              inquiryGroupId: data.commandId,
              now: now(),
            });
            sentCreators.add(row.creatorId);
            return [
              ...done,
              { ...base, status: "SENT", request: toDirect(created) },
            ];
          }, Promise.resolve([]));
          return { inquiryGroupId: data.commandId, results };
        });
      try {
        return await run();
      } catch (err) {
        // 동시에 같은 요청이 들어와 한쪽이 먼저 만들었으면 그 결과를 돌려준다.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const previous = await inTransaction((tx) =>
            replay(tx, clientId, data.commandId, portfolioIds),
          );
          if (previous) return previous;
          throw new AppError(
            409,
            "CONFLICT",
            "다른 요청과 겹쳤습니다. 저장함을 새로 확인한 뒤 다시 보내 주세요.",
          );
        }
        throw err;
      }
    },
  };
}
