import { z } from "zod";

// 탐색·거래 행동 기록 (METRIC-01) [제안, D22]
// 이벤트 이름과 공개 대상 ID, 발생 시각만 받는다. 이메일·이름·자유 입력·URL은 받지 않는다(스키마가 전부다).
// 시연 계정(@kemi.test)의 이벤트는 저장하되 운영 집계에서 뺀다.
export const ANALYTICS_EVENT_NAMES = [
  "feed_view",
  "work_play",
  "creator_view",
  "request_sent",
  "contract_confirmed",
  "transaction_completed",
] as const;
export const analyticsEventNameSchema = z.enum(ANALYTICS_EVENT_NAMES);
export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>;

// 같은 대상에 한 번만 세는 이벤트(사용자별)
export const ONCE_PER_OBJECT_EVENTS: readonly AnalyticsEventName[] = [
  "request_sent",
  "contract_confirmed",
  "transaction_completed",
];

export const analyticsEventSchema = z.strictObject({
  name: analyticsEventNameSchema,
  objectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
  at: z.iso.datetime(),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const analyticsBatchSchema = z.strictObject({
  events: z.array(analyticsEventSchema).min(1).max(20),
});
export type AnalyticsBatchRequest = z.input<typeof analyticsBatchSchema>;

export interface AnalyticsSummary {
  // 최근 days일, 시연 계정 제외
  days: number;
  counts: { name: AnalyticsEventName; total: number; users: number }[];
}
