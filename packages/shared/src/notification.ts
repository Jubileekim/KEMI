import { z } from "zod";
import type { Pagination } from "./application.js";

// 인앱 알림 종류 (NOTI-01)
// - APPLICATION_SUBMITTED: 내 프로젝트에 지원이 들어옴 (의뢰인)
// - APPLICATION_ACCEPTED: (이전 기록 전용) 협의 모델 전 '수락 즉시 선정' 시절의 선정 알림. 새로 만들지 않고 과거 알림을 그대로 보여준다
// - DISCUSSION_REQUESTED: 의뢰인이 내 지원에 협의를 요청함 (크리에이터)
// - APPLICATION_AUTO_REJECTED: 다른 지원자와 계약·프로젝트 삭제로 미선정됨 (크리에이터)
// - APPLICATION_WITHDRAWN: 크리에이터가 지원을 철회함 (의뢰인)
// - PROJECT_ENDED_NO_SELECTION: 의뢰인이 선정 없이 모집을 끝냄 (진행 중이던 크리에이터)
// - APPLICATION_DECLINED: 의뢰인이 직접 거절함 (크리에이터)
// - PROJECT_CLOSED: 지원한 프로젝트의 모집이 마감됨 (대기 중인 크리에이터)
// - TERMS_SIGNING_REQUESTED: 상대방이 최종 조건서 서명을 요청함 (결정 기록 13장)
// - CONTRACT_SIGNED: 양측 서명으로 계약이 체결됨 (양측)
// - PAYMENT_SUCCEEDED: 의뢰인의 테스트 결제가 완료됨 (크리에이터)
export const NOTIFICATION_TYPES = [
  "APPLICATION_SUBMITTED",
  "APPLICATION_ACCEPTED",
  "DISCUSSION_REQUESTED",
  "APPLICATION_AUTO_REJECTED",
  "APPLICATION_DECLINED",
  "PROJECT_CLOSED",
  "APPLICATION_WITHDRAWN",
  "PROJECT_ENDED_NO_SELECTION",
  "TERMS_SIGNING_REQUESTED",
  "CONTRACT_SIGNED",
  "PAYMENT_SUCCEEDED",
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
