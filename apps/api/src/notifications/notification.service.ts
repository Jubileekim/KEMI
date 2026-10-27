import {
  type AuthUser,
  type Notification,
  type NotificationListResponse,
  notificationListQuerySchema,
  notificationTypeSchema,
  type UnreadCountResponse,
  notificationReadManySchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { PrismaClient } from "../generated/prisma/client.js";

interface NotificationRow {
  id: bigint;
  eventType: string;
  title: string;
  body: string;
  projectId: bigint | null;
  workRequestId: bigint | null;
  readAt: Date | null;
  createdAt: Date;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id.toString(),
    type: notificationTypeSchema.parse(row.eventType),
    title: row.title,
    body: row.body,
    projectId: row.projectId?.toString() ?? null,
    applicationId: row.workRequestId?.toString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface NotificationService {
  list(user: AuthUser, input: unknown): Promise<NotificationListResponse>;
  unreadCount(user: AuthUser): Promise<UnreadCountResponse>;
  markRead(user: AuthUser, notificationId: bigint): Promise<Notification>;
  markAllRead(user: AuthUser): Promise<UnreadCountResponse>;
  markManyRead(user: AuthUser, input: unknown): Promise<UnreadCountResponse>;
}

// 인앱 알림 조회·읽음 처리 (NOTI-01). 본인 알림만 다룬다.
export function createNotificationService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): NotificationService {
  const unread = (recipientUserId: bigint) =>
    prisma.notification.count({ where: { recipientUserId, readAt: null } });

  return {
    async list(user, input) {
      const recipientUserId = BigInt(user.id);
      const query = notificationListQuerySchema.parse(input);
      const where = {
        recipientUserId,
        ...(query.unread === "true" ? { readAt: null } : {}),
      };
      const [rows, total, unreadCount] = await prisma.$transaction([
        prisma.notification.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { recipientUserId, readAt: null } }),
      ]);
      return {
        items: rows.map(toNotification),
        unreadCount,
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    },

    async unreadCount(user) {
      return { unreadCount: await unread(BigInt(user.id)) };
    },

    // 이미 읽은 알림은 처음 읽은 시각을 유지한다.
    async markRead(user, notificationId) {
      const recipientUserId = BigInt(user.id);
      await prisma.notification.updateMany({
        where: { id: notificationId, recipientUserId, readAt: null },
        data: { readAt: now() },
      });
      const row = await prisma.notification.findFirst({
        where: { id: notificationId, recipientUserId },
      });
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "알림을 찾을 수 없습니다.");
      }
      return toNotification(row);
    },

    // NOTI-02: 고른 알림만 읽음. 남의 알림이 섞이면 404이고 아무것도 바꾸지 않는다(존재를 드러내지 않음).
    async markManyRead(user, input) {
      const { ids } = notificationReadManySchema.parse(input);
      const recipientUserId = BigInt(user.id);
      const unique = [...new Set(ids)].map(BigInt);
      return prisma.$transaction(async (tx) => {
        const owned = await tx.notification.count({
          where: { id: { in: unique }, recipientUserId },
        });
        if (owned !== unique.length) {
          throw new AppError(404, "NOT_FOUND", "알림을 찾을 수 없습니다.");
        }
        await tx.notification.updateMany({
          where: { id: { in: unique }, recipientUserId, readAt: null },
          data: { readAt: now() },
        });
        return {
          unreadCount: await tx.notification.count({
            where: { recipientUserId, readAt: null },
          }),
        };
      });
    },

    async markAllRead(user) {
      const recipientUserId = BigInt(user.id);
      await prisma.notification.updateMany({
        where: { recipientUserId, readAt: null },
        data: { readAt: now() },
      });
      return { unreadCount: await unread(recipientUserId) };
    },
  };
}
