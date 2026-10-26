import {
  type AuthUser,
  type FeedResponse,
  type MetricsSummary,
  TEST_EMAIL_DOMAIN,
  feedQuerySchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { toPortfolio } from "../catalog/catalog.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FeedService {
  feed(query: unknown): Promise<FeedResponse>;
  metrics(user: AuthUser): Promise<MetricsSummary>;
}

// 시드·시연 계정은 지표에서 뺀다. 소셜 전용 회원(이메일 없음)은 실제 회원으로 센다.
const realUser = {
  OR: [
    { email: null },
    { NOT: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } } },
  ],
} satisfies Prisma.UserWhereInput;

const ratio = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 1000) / 1000;

export function createFeedService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): FeedService {
  return {
    // FEED-01~03: 공개 서비스의 공개 작업물. 최근 공개순 [제안, D21]. 고객 납품물은 자동으로 올라오지 않는다.
    async feed(raw) {
      const query = feedQuerySchema.parse(raw);
      const where: Prisma.PortfolioWhereInput = {
        status: "PUBLIC",
        creator: {
          status: "ACTIVE",
          creatorProfile: { serviceStatus: "PUBLIC" },
        },
        ...(query.purpose ? { purpose: query.purpose } : {}),
        ...(query.styles ? { styles: { hasSome: query.styles } } : {}),
        ...(query.roles ? { roles: { hasSome: query.roles } } : {}),
      };
      const [total, rows] = await Promise.all([
        prisma.portfolio.count({ where }),
        prisma.portfolio.findMany({
          where,
          orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                servicePackages: {
                  where: { isRepresentative: true },
                  select: { priceKrw: true },
                },
              },
            },
          },
        }),
      ]);
      return {
        items: rows.map((row) => {
          const price = row.creator.servicePackages[0]?.priceKrw;
          return {
            portfolio: toPortfolio(row),
            creator: {
              userId: row.creator.id.toString(),
              name: row.creator.name,
            },
            startingPriceKrw:
              price === undefined || price === null ? null : Number(price),
          };
        }),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    // METRIC-01: 운영 지표. 거래 테이블에서 계산한다 [제안, D22]. 운영자(ADMIN)만.
    async metrics(user) {
      if (user.role !== "ADMIN") {
        throw new AppError(403, "FORBIDDEN", "운영자만 볼 수 있습니다.");
      }
      const byRealClient = { client: realUser };
      const [
        projectsPublished,
        applications,
        directRequests,
        contracts,
        paymentsSucceeded,
        completedDeals,
        deliverables,
        revisedDeliverables,
        received,
        aiAnalyses,
        aiBudgetsApplied,
      ] = await Promise.all([
        prisma.project.count({ where: byRealClient }),
        prisma.workRequest.count({
          where: { requestType: "PROJECT_APPLICATION", ...byRealClient },
        }),
        prisma.workRequest.count({
          where: { requestType: "DIRECT_REQUEST", ...byRealClient },
        }),
        prisma.contract.count({ where: byRealClient }),
        prisma.payment.count({
          where: { status: "SUCCEEDED", contract: byRealClient },
        }),
        prisma.production.count({
          where: { status: "COMPLETED", contract: byRealClient },
        }),
        prisma.deliverable.count({
          where: { production: { contract: byRealClient } },
        }),
        prisma.deliverable.count({
          where: {
            production: { contract: byRealClient },
            revisionRequests: { some: {} },
          },
        }),
        prisma.deliverable.findMany({
          where: { status: "RECEIVED", production: { contract: byRealClient } },
          select: {
            receivedAt: true,
            production: { select: { startedAt: true } },
          },
        }),
        prisma.aiReport.count({ where: { user: realUser } }),
        prisma.aiReport.count({
          where: { user: realUser, appliedAt: { not: null } },
        }),
      ]);
      const durations = received.flatMap(({ receivedAt, production }) =>
        receivedAt && production.startedAt
          ? [(receivedAt.getTime() - production.startedAt.getTime()) / DAY_MS]
          : [],
      );
      const totalDays = durations.reduce((sum, days) => sum + days, 0);
      return {
        generatedAt: now().toISOString(),
        projectsPublished,
        applications,
        directRequests,
        contracts,
        paymentsSucceeded,
        completedDeals,
        revisionRequestRate: ratio(revisedDeliverables, deliverables),
        averageProductionDays:
          durations.length === 0
            ? null
            : Math.round((totalDays / durations.length) * 10) / 10,
        aiAnalyses,
        aiBudgetsApplied,
      };
    },
  };
}
