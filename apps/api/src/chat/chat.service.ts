import {
  type AuthUser,
  type ChatMessage,
  type ChatMessagesResponse,
  type ChatRoomListResponse,
  type ChatRoomSummary,
  chatMessageCreateSchema,
  chatMessageKindSchema,
  chatMessageListQuerySchema,
  chatReadSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { requireReadyFiles } from "../files/file.service.js";

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

const DEFAULT_PAGE = 50;

// 협의가 끝난 요청(거절·철회·미선정·만료)의 방은 읽기만 할 수 있다(CHAT-05).
// 모집 마감·조건서 만료만으로는 닫지 않는다.
const CLOSED_REQUEST_STATUSES = new Set([
  "DECLINED",
  "WITHDRAWN",
  "NOT_SELECTED",
  "EXPIRED",
]);

// 협의 요청 때 방을 만든다(이미 있으면 그대로). 요청당 방 하나(chat_rooms.work_request_id UNIQUE).
export async function ensureChatRoom(tx: Tx, workRequestId: bigint) {
  await tx.chatRoom.upsert({
    where: { workRequestId },
    update: {},
    create: { workRequestId },
  });
}

// 작업 사건 안내(WORK-04). 같은 사건 키는 한 번만 남는다. 방이 없으면 만든다.
export async function postSystemMessage(
  tx: Tx,
  workRequestId: bigint,
  eventKey: string,
  body: string,
) {
  const room = await tx.chatRoom.upsert({
    where: { workRequestId },
    update: {},
    create: { workRequestId },
  });
  await tx.chatMessage.createMany({
    data: [
      {
        roomId: room.id,
        kind: "SYSTEM",
        senderId: null,
        body,
        dedupeKey: `system:${eventKey}`,
      },
    ],
    skipDuplicates: true,
  });
}

const includeAttachments = {
  attachments: {
    include: {
      file: {
        select: { id: true, fileName: true, mimeType: true, sizeBytes: true },
      },
    },
  },
} satisfies Prisma.ChatMessageInclude;

type MessageRow = Prisma.ChatMessageGetPayload<{
  include: typeof includeAttachments;
}>;

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id.toString(),
    kind: chatMessageKindSchema.parse(row.kind),
    senderId: row.senderId?.toString() ?? null,
    body: row.body,
    attachments: row.attachments.map(({ file }) => ({
      fileId: file.id.toString(),
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: Number(file.sizeBytes),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

const roomInclude = {
  workRequest: {
    select: {
      clientId: true,
      creatorId: true,
      projectId: true,
      status: true,
      client: { select: { name: true } },
      creator: { select: { name: true } },
      project: { select: { title: true } },
    },
  },
  messages: { orderBy: { id: "desc" }, take: 1, include: includeAttachments },
} satisfies Prisma.ChatRoomInclude;

type RoomRow = Prisma.ChatRoomGetPayload<{ include: typeof roomInclude }>;

function notFound(): AppError {
  return new AppError(404, "NOT_FOUND", "대화방을 찾을 수 없습니다.");
}

export interface ChatService {
  listRooms(user: AuthUser): Promise<ChatRoomListResponse>;
  listMessages(
    user: AuthUser,
    workRequestId: bigint,
    query: unknown,
  ): Promise<ChatMessagesResponse>;
  send(
    user: AuthUser,
    workRequestId: bigint,
    input: unknown,
  ): Promise<{ created: boolean; message: ChatMessage }>;
  markRead(
    user: AuthUser,
    workRequestId: bigint,
    input: unknown,
  ): Promise<ChatRoomSummary>;
}

export function createChatService({
  prisma,
}: {
  prisma: PrismaClient;
}): ChatService {
  // 방 여러 개의 안 읽은 수를 한 번에 센다(방마다 따로 세지 않는다). 내가 보낸 메시지는 세지 않는다.
  async function unreadCounts(
    db: Db,
    roomIds: bigint[],
    userId: bigint,
  ): Promise<Map<bigint, number>> {
    if (roomIds.length === 0) return new Map();
    const rows = await db.$queryRaw<{ roomId: bigint; unread: number }[]>`
      SELECT r.id AS "roomId", count(m.id)::int AS unread
      FROM chat_rooms r
      LEFT JOIN chat_reads cr ON cr.room_id = r.id AND cr.user_id = ${userId}
      LEFT JOIN chat_messages m ON m.room_id = r.id
        AND m.id > COALESCE(cr.last_read_message_id, 0)
        AND (m.sender_id IS NULL OR m.sender_id <> ${userId})
      WHERE r.id IN (${Prisma.join(roomIds)})
      GROUP BY r.id`;
    return new Map(rows.map((row) => [row.roomId, row.unread]));
  }

  function summarize(
    room: RoomRow,
    userId: bigint,
    unreadCount: number,
  ): ChatRoomSummary {
    const request = room.workRequest;
    const last = room.messages[0];
    return {
      workRequestId: room.workRequestId.toString(),
      projectId: request.projectId?.toString() ?? null,
      projectTitle: request.project?.title ?? null,
      clientId: request.clientId.toString(),
      creatorId: request.creatorId.toString(),
      counterpartName:
        request.clientId === userId
          ? request.creator.name
          : request.client.name,
      readOnly: CLOSED_REQUEST_STATUSES.has(request.status),
      lastMessage: last ? toMessage(last) : null,
      unreadCount,
    };
  }

  async function toSummary(
    db: Db,
    room: RoomRow,
    userId: bigint,
  ): Promise<ChatRoomSummary> {
    const counts = await unreadCounts(db, [room.id], userId);
    return summarize(room, userId, counts.get(room.id) ?? 0);
  }

  // 당사자의 방만 연다. 다른 사람·방이 없는 요청은 404(존재를 드러내지 않음).
  async function findRoom(db: Db, user: AuthUser, workRequestId: bigint) {
    const userId = BigInt(user.id);
    const room = await db.chatRoom.findUnique({
      where: { workRequestId },
      include: roomInclude,
    });
    if (
      !room ||
      (room.workRequest.clientId !== userId &&
        room.workRequest.creatorId !== userId)
    ) {
      throw notFound();
    }
    return { room, userId };
  }

  return {
    // CHAT-03: 내 방 목록. 최근 메시지가 있는 방부터.
    async listRooms(user) {
      const userId = BigInt(user.id);
      const rooms = await prisma.chatRoom.findMany({
        where: {
          workRequest: { OR: [{ clientId: userId }, { creatorId: userId }] },
        },
        include: roomInclude,
      });
      const counts = await unreadCounts(
        prisma,
        rooms.map((room) => room.id),
        userId,
      );
      const items = rooms.map((room) =>
        summarize(room, userId, counts.get(room.id) ?? 0),
      );
      const lastAt = (item: ChatRoomSummary) =>
        item.lastMessage?.createdAt ?? "";
      items.sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
      return { items };
    },

    // CHAT-01: 메시지 조회. 기본은 최신 50개(오래된 것부터 정렬해 준다).
    async listMessages(user, workRequestId, query) {
      const {
        before,
        after,
        limit = DEFAULT_PAGE,
      } = chatMessageListQuerySchema.parse(query);
      const { room, userId } = await findRoom(prisma, user, workRequestId);
      const rows = await prisma.chatMessage.findMany({
        where: {
          roomId: room.id,
          id: {
            ...(before ? { lt: BigInt(before) } : {}),
            ...(after ? { gt: BigInt(after) } : {}),
          },
        },
        orderBy: { id: after ? "asc" : "desc" },
        take: limit + 1,
        include: includeAttachments,
      });
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      if (!after) page.reverse();
      return {
        room: await toSummary(prisma, room, userId),
        items: page.map(toMessage),
        hasMore,
      };
    },

    // CHAT-01: 텍스트 메시지 전송. 읽기 전용 방은 409. 같은 clientMessageId의 재전송은 이전 메시지를 준다.
    // 요청 행을 FOR SHARE로 잠근 채 상태를 확인하고 저장한다. 종료·철회·무선정 종료는 같은 행을 UPDATE하므로
    // 확인과 저장 사이에 요청이 끝날 수 없다(전송끼리는 서로 막지 않는다).
    async send(user, workRequestId, input) {
      const data = chatMessageCreateSchema.parse(input);
      const { room, userId } = await findRoom(prisma, user, workRequestId);
      const dedupeKey = `user:${userId}:${data.clientMessageId}`;
      // 첨부는 순서·중복과 관계없이 같은 집합이면 같은 요청으로 본다.
      const byId = (a: bigint, b: bigint) => (a < b ? -1 : 1);
      const fileIds = [...new Set(data.attachmentFileIds)]
        .map(BigInt)
        .sort(byId);
      const sameFiles = (existing: MessageRow) => {
        const saved = existing.attachments
          .map(({ fileId }) => fileId)
          .sort(byId);
        return (
          saved.length === fileIds.length &&
          saved.every((id, index) => id === fileIds[index])
        );
      };
      const replay = (existing: MessageRow) => {
        if (existing.body !== data.body || !sameFiles(existing)) {
          throw new AppError(
            409,
            "CONFLICT",
            "같은 메시지 식별자로 다른 내용이나 첨부를 보낼 수 없습니다.",
          );
        }
        return { created: false, message: toMessage(existing) };
      };
      try {
        return await prisma.$transaction(async (tx) => {
          const existing = await tx.chatMessage.findUnique({
            where: { roomId_dedupeKey: { roomId: room.id, dedupeKey } },
            include: includeAttachments,
          });
          if (existing) return replay(existing);
          const [request] = await tx.$queryRaw<{ status: string }[]>`
            SELECT status FROM work_requests WHERE id = ${room.workRequestId} FOR SHARE`;
          if (!request || CLOSED_REQUEST_STATUSES.has(request.status)) {
            throw new AppError(
              409,
              "CONFLICT",
              "협의가 종료된 대화방에는 메시지를 보낼 수 없습니다.",
            );
          }
          await requireReadyFiles(tx, fileIds, {
            ownerId: userId,
            purpose: "CHAT_ATTACHMENT",
            workRequestId,
          });
          const message = await tx.chatMessage.create({
            data: {
              roomId: room.id,
              kind: "USER",
              senderId: userId,
              body: data.body,
              dedupeKey,
            },
          });
          await tx.chatAttachment.createMany({
            data: fileIds.map((fileId) => ({ messageId: message.id, fileId })),
          });
          const created = await tx.chatMessage.findUniqueOrThrow({
            where: { id: message.id },
            include: includeAttachments,
          });
          return { created: true, message: toMessage(created) };
        });
      } catch (err) {
        // 같은 식별자로 동시에 두 번 보낸 경우: 먼저 저장된 메시지를 기준으로 답한다.
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return replay(
            await prisma.chatMessage.findUniqueOrThrow({
              where: { roomId_dedupeKey: { roomId: room.id, dedupeKey } },
              include: includeAttachments,
            }),
          );
        }
        throw err;
      }
    },

    // CHAT-03: 읽음 위치를 앞으로만 옮긴다(뒤로 가는 요청은 무시).
    async markRead(user, workRequestId, input) {
      const { lastReadMessageId } = chatReadSchema.parse(input);
      const target = BigInt(lastReadMessageId);
      const { room, userId } = await findRoom(prisma, user, workRequestId);
      const message = await prisma.chatMessage.findFirst({
        where: { id: target, roomId: room.id },
      });
      if (!message) {
        throw new AppError(404, "NOT_FOUND", "메시지를 찾을 수 없습니다.");
      }
      await prisma.$executeRaw`
        INSERT INTO chat_reads (room_id, user_id, last_read_message_id, updated_at)
        VALUES (${room.id}, ${userId}, ${target}, now())
        ON CONFLICT (room_id, user_id) DO UPDATE
        SET last_read_message_id = GREATEST(chat_reads.last_read_message_id, EXCLUDED.last_read_message_id),
            updated_at = now()`;
      return toSummary(prisma, room, userId);
    },
  };
}
