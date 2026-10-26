import { useState } from "react";
import type { AuthUser } from "@kemi/shared";
import Button from "../components/ui/button";
import Textarea from "../components/ui/textarea";
import Label from "../components/ui/label";
import DeliveryNoticesMock from "./DeliveryNoticesMock";
import { campaignTime } from "./campaign-model";
import {
  proposalLabels,
  type Message,
  type Proposal,
  type ProposalCommand,
} from "./proposal-model";

export default function ChatPanelMock({
  item,
  messages,
  user,
  busy,
  error,
  submit,
}: {
  item: Proposal;
  messages: Message[];
  user: AuthUser;
  busy: boolean;
  error: string;
  submit: (command: ProposalCommand, done?: () => void) => void;
}) {
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState<Extract<
    ProposalCommand,
    { type: "send" }
  > | null>(null);
  const closed = item.status !== "DISCUSSING";
  const last = messages.at(-1);
  return (
    <section className="showcase-card grid gap-4" aria-label="의뢰 대화">
      <h2 className="type-heading-md">의뢰 대화</h2>
      <p>
        {item.contracted
          ? "계약 확정 · 기존 대화 유지"
          : proposalLabels[item.status]}
        {closed ? " · 읽기 전용" : " · 일반 대화는 48시간 만료 없음"}
      </p>
      {item.reason && <p>종료 사유: {item.reason}</p>}
      <ol className="grid gap-3" aria-label="메시지 기록">
        {messages.map((message) => (
          <li key={message.id} className="min-w-0 rounded-xl bg-muted p-4">
            <p className="type-label-sm">
              {message.senderId === user.id ? "나" : "상대방"} ·{" "}
              {campaignTime(message.at)}
            </p>
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          </li>
        ))}
      </ol>
      {!messages.length && <p>아직 대화가 없어요.</p>}
      {item.contracted && <DeliveryNoticesMock roomId={item.id} />}
      {last && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            submit({
              type: "read",
              id: item.id,
              through: last.id,
            })
          }
        >
          표시된 메시지 읽음 처리
        </Button>
      )}
      <p className="text-sm text-muted-foreground">
        대화의 동의·답변으로 계약·납품·승인·정산은 처리되지 않아요. 인앱 알림
        읽음은 별도예요. 첨부 업로드는 연결 준비 중이에요.
      </p>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || closed || !draft.trim() || failed) return;
          const command = {
            type: "send" as const,
            id: item.id,
            messageId: crypto.randomUUID(),
            text: draft.trim(),
          };
          setFailed(command);
          submit(command, () => {
            setDraft("");
            setFailed(null);
          });
        }}
      >
        <Label htmlFor="chat-message">메시지 (Mock 최대 4,000자)</Label>
        <Textarea
          id="chat-message"
          value={draft}
          maxLength={4000}
          disabled={busy || closed || !!failed}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          type="submit"
          disabled={busy || closed || !draft.trim() || !!failed}
        >
          {busy ? "전송 처리 중…" : "메시지 전송"}
        </Button>
      </form>
      {failed && !busy && (
        <div role="status">
          <p>
            응답을 확인하지 못했어요. 최신 기록을 확인한 뒤 같은 메시지를
            재시도할 수 있어요.
          </p>
          <Button
            disabled={closed}
            onClick={() =>
              submit(failed, () => {
                setDraft("");
                setFailed(null);
              })
            }
          >
            같은 메시지 재시도
          </Button>
          <Button variant="outline" onClick={() => setFailed(null)}>
            전송 결과 확인 후 새 입력
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
