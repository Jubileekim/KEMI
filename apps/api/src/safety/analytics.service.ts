import {
  ANALYTICS_EVENT_NAMES,
  analyticsBatchSchema,
  type AnalyticsSummary,
  type AuthUser,
  TEST_EMAIL_DOMAIN,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { PrismaClient } from "../generated/prisma/client.js";

// 행동 기록 (METRIC-01) [제안, D22]
// 이벤트 이름·공개 대상 ID·발생 시각만 저장한다. 시연 계정(@kemi.test) 이벤트는 is_test로 구분해 집계에서 뺀다.
// 기록 실패가 거래 결과를 바꾸지 않도록, 화면은 결과를 기다리지 않고 보낸다.

const SUMMARY_DAYS = 30;
// 발생 시각은 화면 시계라 믿지 않는다. 미래·너무 오래된 값은 받은 시각으로 바꾼다.
const MAX_SKEW_MS = 24 * 60 * 60 * 1000;

export interface AnalyticsService {
  record(user: AuthUser | null, input: unknown): Promise<{ accepted: number }>;
  summary(user: AuthUser): Promise<AnalyticsSummary>;
}

export function createAnalyticsService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): AnalyticsService {
  return {
    async record(user, input) {
      const { events } = analyticsBatchSchema.parse(input);
      const received = now();
      const userId = user ? BigInt(user.id) : null;
      const isTest = !!user?.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`);
      const result = await prisma.analyticsEvent.createMany({
        data: events.map((event) => {
          const at = new Date(event.at);
          const skewed =
            Math.abs(at.getTime() - received.getTime()) > MAX_SKEW_MS;
          return {
            name: event.name,
            objectId: event.objectId,
            userId,
            isTest,
            occurredAt: skewed ? received : at,
          };
        }),
        // 같은 대상에 한 번만 세는 이벤트(요청 발송·계약 확정·거래 완료)의 중복은 조용히 건너뛴다.
        skipDuplicates: true,
      });
      return { accepted: result.count };
    },

    // 운영자 집계: 최근 30일, 시연 계정 제외, 이벤트별 건수와 사용자 수
    async summary(user) {
      if (user.role !== "ADMIN") {
        throw new AppError(403, "FORBIDDEN", "운영자만 볼 수 있습니다.");
      }
      const since = new Date(
        now().getTime() - SUMMARY_DAYS * 24 * 60 * 60 * 1000,
      );
      const rows = await prisma.$queryRaw<
        { name: string; total: number; users: number }[]
      >`
        SELECT name, count(*)::int AS total, count(DISTINCT user_id)::int AS users
        FROM analytics_events
        WHERE is_test = false AND created_at >= ${since}
        GROUP BY name`;
      const byName = new Map(rows.map((r) => [r.name, r]));
      return {
        days: SUMMARY_DAYS,
        counts: ANALYTICS_EVENT_NAMES.map((name) => ({
          name,
          total: byName.get(name)?.total ?? 0,
          users: byName.get(name)?.users ?? 0,
        })),
      };
    },
  };
}
