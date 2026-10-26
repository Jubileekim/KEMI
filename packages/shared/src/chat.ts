import { z } from "zod";

// 요청별 대화방 (CHAT-01~05). 같은 요청에는 방이 하나뿐이고, 계약 전후에 같은 방·같은 기록을 쓴다.
// 메시지 종류: USER(당사자가 보냄), SYSTEM(계약 체결·결제 완료 같은 작업 사건 안내, WORK-04)
export const CHAT_MESSAGE_KINDS = ["USER", "SYSTEM"] as const;
export const chatMessageKindSchema = z.enum(CHAT_MESSAGE_KINDS);
export type ChatMessageKind = z.infer<typeof chatMessageKindSchema>;

// 메시지 전송. clientMessageId는 화면이 만든 식별자로, 응답을 잃고 다시 보내도 한 번만 저장된다.
// 글자 수 4,000자 [제안, D07]
export const chatMessageCreateSchema = z
  .strictObject({
    clientMessageId: z.uuid(),
    body: z.string().trim().max(4000),
    // 본인이 올려 확인이 끝난 같은 거래의 CHAT_ATTACHMENT 파일(최대 5개)
    attachmentFileIds: z
      .array(z.string().regex(/^[1-9]\d*$/))
      .max(5)
      .default([]),
  })
  .refine(
    (value) => value.body.length > 0 || value.attachmentFileIds.length > 0,
    {
      path: ["body"],
      message: "내용이나 첨부가 필요합니다.",
    },
  );
export type ChatMessageCreateRequest = z.input<typeof chatMessageCreateSchema>;

// 읽음 처리: 화면에 보인 마지막 메시지까지 읽음으로 한다. 뒤로 가지 않는다.
export const chatReadSchema = z.strictObject({
  lastReadMessageId: z.string().regex(/^[1-9]\d*$/),
});

const idQuery = z
  .string()
  .regex(/^[1-9]\d*$/)
  .optional();
export const chatMessageListQuerySchema = z.strictObject({
  // 이 ID보다 오래된 메시지(이전 페이지)
  before: idQuery,
  // 이 ID보다 새 메시지(새로 온 것만 다시 받기)
  after: idQuery,
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export interface ChatAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  kind: ChatMessageKind;
  // SYSTEM 메시지는 null
  senderId: string | null;
  body: string;
  // 다운로드·재생은 GET /api/files/{fileId}/download
  attachments: ChatAttachment[];
  createdAt: string;
}

export interface ChatRoomSummary {
  workRequestId: string;
  projectId: string | null;
  projectTitle: string | null;
  clientId: string;
  creatorId: string;
  // 상대방 표시 이름
  counterpartName: string;
  // 협의가 끝났으면(거절·철회·미선정) 읽기만 할 수 있다(CHAT-05).
  readOnly: boolean;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export interface ChatRoomListResponse {
  items: ChatRoomSummary[];
}

export interface ChatMessagesResponse {
  room: ChatRoomSummary;
  // 오래된 것부터
  items: ChatMessage[];
  // before로 더 이전 메시지를 받을 수 있는지
  hasMore: boolean;
}
