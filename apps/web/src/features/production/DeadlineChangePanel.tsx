import { useState } from "react";
import deadlineTime from "./time";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";
import Textarea from "../../components/ui/textarea";

export interface DeadlineChange {
  id: string;
  authorId: string;
  before: string;
  due: string;
  reason: string;
  status: string;
}
export default function DeadlineChangePanel({
  due,
  changes,
  userId,
  disabled,
  propose,
  respond,
}: {
  due: string | null;
  changes: DeadlineChange[];
  userId: string;
  disabled: boolean;
  propose: (due: string, reason: string) => void;
  respond: (id: string, accept: boolean) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section className="grid min-w-0 gap-4" aria-label="납기 변경 합의">
      <h2 className="type-heading-md">납기 변경 합의</h2>
      <p>
        상대방이 승인하기 전에는 기존 납기를 유지해요. 추가금·범위·차감 변경과
        작업 중단 정책(D10)은 조율 중이에요.
      </p>
      {due && <p>현재 납기: {deadlineTime(due)} (한국 시간)</p>}
      <Label htmlFor="new-due">요청 납기 (한국 시간)</Label>
      <Input
        id="new-due"
        type="datetime-local"
        value={date}
        disabled={disabled || !due}
        onChange={(e) => setDate(e.target.value)}
      />
      <Label htmlFor="due-reason">변경 사유</Label>
      <Textarea
        id="due-reason"
        maxLength={1000}
        value={reason}
        disabled={disabled || !due}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        disabled={
          disabled ||
          !due ||
          !date ||
          !reason.trim() ||
          changes.some((c) => c.status === "PENDING")
        }
        onClick={() => {
          const value = new Date(`${date}:00+09:00`);
          if (Number.isFinite(value.getTime()))
            propose(value.toISOString(), reason);
        }}
      >
        납기 변경 요청
      </Button>
      {changes.map((c) => (
        <article
          key={c.id}
          className="grid gap-3 rounded-xl border p-4"
          aria-label="납기 변경 이력"
        >
          <p>
            변경 전: {deadlineTime(c.before)} → 요청: {deadlineTime(c.due)}
          </p>
          <p>{c.reason}</p>
          <p>
            {{
              PENDING: "상대 응답 대기",
              ACCEPTED: "양측 승인 · 반영",
              REJECTED: "거절 · 기존 납기 유지",
            }[c.status] ?? c.status}
          </p>
          {c.status === "PENDING" && c.authorId !== userId && (
            <div className="flex flex-wrap gap-3">
              <Button disabled={disabled} onClick={() => respond(c.id, true)}>
                표시된 납기 변경 승인
              </Button>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => respond(c.id, false)}
              >
                납기 변경 거절
              </Button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
