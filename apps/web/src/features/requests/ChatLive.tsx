import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "../../app/session";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { ApiError } from "../../shared/api/client";
import { kemi, newCommandId } from "../../shared/api/kemi";
import { openFile, uploadFile } from "../../shared/api/upload";
import { dateTime } from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import sendPendingMessage, { type PendingMessage } from "./pending-message";

// CHAT-01~05: 요청별 대화방(실제 API). 5초마다 새 메시지를 확인한다.
export default function ChatLive({ requestId }: { requestId: string }) {
  const { user } = useSession();
  const client = useQueryClient();
  const key = ["chat", requestId];
  const messages = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => kemi.chatMessages(requestId, signal),
    refetchInterval: 5000,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const pending = useRef<PendingMessage | null>(null);
  const send = useMutation({
    mutationFn: async () => {
      // 같은 내용을 다시 보내면 같은 식별자를 써서 한 번만 저장되게 한다.
      if (
        !pending.current ||
        pending.current.body !== text ||
        pending.current.file !== file
      )
        pending.current = { id: newCommandId(), body: text, file };
      return sendPendingMessage(
        pending.current,
        async (attachedFile) =>
          (await uploadFile(attachedFile, "CHAT_ATTACHMENT", requestId)).id,
        (body) => kemi.sendMessage(requestId, body),
      );
    },
    onSuccess: () => {
      pending.current = null;
      setText("");
      setFile(null);
      client.invalidateQueries({ queryKey: key });
      client.invalidateQueries({ queryKey: ["chat-rooms"] });
    },
  });
  const lastId = messages.data?.items.at(-1)?.id;
  useEffect(() => {
    if (lastId && (messages.data?.room.unreadCount ?? 0) > 0)
      kemi.readChat(requestId, lastId).catch(() => undefined);
  }, [lastId, messages.data?.room.unreadCount, requestId]);

  if (messages.isPending) return <Loading text="대화를 불러오고 있어요." />;
  if (messages.error)
    return messages.error instanceof ApiError &&
      messages.error.status === 404 ? (
      <Card title="대화">
        <p>협의가 시작되면 대화방이 열려요.</p>
      </Card>
    ) : (
      <Failure error={messages.error} />
    );
  const { room, items } = messages.data;
  return (
    <Card title={`대화 · ${room.counterpartName}`}>
      <ol className="grid max-h-96 gap-3 overflow-y-auto" aria-live="polite">
        {items.map((message) => (
          <li
            key={message.id}
            className={
              message.kind === "SYSTEM"
                ? "text-sm text-muted-foreground"
                : "grid gap-1 rounded-xl border border-input p-3"
            }
          >
            {message.kind === "USER" && (
              <span className="type-label-sm">
                {message.senderId === user?.id ? "나" : room.counterpartName} ·{" "}
                {dateTime(message.createdAt)}
              </span>
            )}
            {message.body && (
              <p className="whitespace-pre-wrap">{message.body}</p>
            )}
            {message.attachments.map((attachment) => (
              <Button
                key={attachment.fileId}
                variant="link"
                className="justify-self-start p-0"
                onClick={() => openFile(attachment.fileId)}
              >
                첨부: {attachment.fileName}
              </Button>
            ))}
          </li>
        ))}
        {items.length === 0 && <li>아직 메시지가 없어요.</li>}
      </ol>
      {room.readOnly ? (
        <p role="status">협의가 끝난 대화방이라 읽기만 할 수 있어요.</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (text.trim() || file) send.mutate();
          }}
        >
          <Textarea
            aria-label="메시지"
            rows={3}
            maxLength={4000}
            value={text}
            disabled={send.isPending}
            onChange={(event) => setText(event.target.value)}
          />
          <Input
            aria-label="첨부 파일"
            type="file"
            disabled={send.isPending}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {send.error && (
            <p role="alert">
              {errorText(send.error, "메시지를 보내지 못했어요.")}
            </p>
          )}
          <Button
            type="submit"
            disabled={send.isPending || (!text.trim() && !file)}
          >
            {send.isPending ? "보내는 중…" : "보내기"}
          </Button>
        </form>
      )}
    </Card>
  );
}
