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

interface MessageRow {
  id: bigint;
  kind: string;
  senderId: bigint | null;
  body: string;
  createdAt: Date;
}

function toMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id.toString(),
    kind: chatMessageKindSchema.parse(row.kind),
    senderId: row.senderId?.toString() ?? null,
    body: row.body,
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
  messages: { orderBy: { id: "desc" }, take: 1 },
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
  async function unreadCount(db: Db, roomId: bigint, userId: bigint) {
    const read = await db.chatRead.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    return db.chatMessage.count({
      where: {
        roomId,
        id: { gt: read?.lastReadMessageId ?? 0n },
        // 내가 보낸 메시지는 읽지 않은 것으로 세지 않는다.
        OR: [{ senderId: null }, { senderId: { not: userId } }],
      },
    });
  }

  async function toSummary(
    db: Db,
    room: RoomRow,
    userId: bigint,
  ): Promise<ChatRoomSummary> {
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
      unreadCount: await unreadCount(db, room.id, userId),
    };
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
      const items = await Promise.all(
        rooms.map((room) => toSummary(prisma, room, userId)),
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
    async send(user, workRequestId, input) {
      const data = chatMessageCreateSchema.parse(input);
      const { room, userId } = await findRoom(prisma, user, workRequestId);
      if (CLOSED_REQUEST_STATUSES.has(room.workRequest.status)) {
        throw new AppError(
          409,
          "CONFLICT",
          "협의가 종료된 대화방에는 메시지를 보낼 수 없습니다.",
        );
      }
      const dedupeKey = `user:${userId}:${data.clientMessageId}`;
      try {
        const created = await prisma.chatMessage.create({
          data: {
            roomId: room.id,
            kind: "USER",
            senderId: userId,
            body: data.body,
            dedupeKey,
          },
        });
        return { created: true, message: toMessage(created) };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const existing = await prisma.chatMessage.findUniqueOrThrow({
            where: { roomId_dedupeKey: { roomId: room.id, dedupeKey } },
          });
          if (existing.body !== data.body) {
            throw new AppError(
              409,
              "CONFLICT",
              "같은 메시지 식별자로 다른 내용을 보낼 수 없습니다.",
            );
          }
          return { created: false, message: toMessage(existing) };
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
