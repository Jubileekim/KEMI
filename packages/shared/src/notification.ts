import { z } from "zod";
import type { Pagination } from "./application.js";

// 인앱 알림 종류 (NOTI-01)
// - APPLICATION_SUBMITTED: 내 프로젝트에 지원이 들어옴 (의뢰인)
// - APPLICATION_ACCEPTED: 내 지원이 선정됨 (크리에이터)
// - APPLICATION_AUTO_REJECTED: 다른 지원자 선정·프로젝트 삭제로 자동 거절됨 (크리에이터)
// - APPLICATION_DECLINED: 의뢰인이 직접 거절함 (크리에이터)
// - PROJECT_CLOSED: 지원한 프로젝트의 모집이 마감됨 (대기 중인 크리에이터)
// - TERMS_SIGNING_REQUESTED: 상대방이 최종 조건서 서명을 요청함 (결정 기록 13장)
// - CONTRACT_SIGNED: 양측 서명으로 계약이 체결됨 (양측)
export const NOTIFICATION_TYPES = [
  "APPLICATION_SUBMITTED",
  "APPLICATION_ACCEPTED",
  "APPLICATION_AUTO_REJECTED",
  "APPLICATION_DECLINED",
  "PROJECT_CLOSED",
  "TERMS_SIGNING_REQUESTED",
  "CONTRACT_SIGNED",
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

const pageQuery = (max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max))
    .optional();

export const notificationListQuerySchema = z.strictObject({
  unread: z.enum(["true", "false"]).optional(),
  page: pageQuery(100_000).default(1),
  pageSize: pageQuery(50).default(20),
});

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  // 화면 이동용. 프로젝트·지원 상세로 바로 가는 데 쓴다.
  projectId: string | null;
  applicationId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unreadCount: number;
  pagination: Pagination;
}

export interface UnreadCountResponse {
  unreadCount: number;
}
