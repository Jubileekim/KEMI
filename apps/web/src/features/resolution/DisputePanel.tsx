import { useState } from "react";
import { Link } from "react-router";
import type { z } from "zod";
import type { workflowStateSchema } from "../../mocks/resolution-workflow-model";
import Label from "../../components/ui/label";
import Textarea from "../../components/ui/textarea";
import Button from "../../components/ui/button";

export default function DisputePanel({
  workflow,
  disabled,
  hideRecords = false,
  onSubmit,
}: {
  workflow: z.infer<typeof workflowStateSchema>;
  disabled: boolean;
  hideRecords?: boolean;
  onSubmit: (reason: string, evidence: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const open = workflow.disputes.some((d) => !d.released);
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border p-4"
      aria-label="분쟁 접수·기록"
    >
      <h2 className="type-heading-sm">분쟁·증빙·진행 안내</h2>
      <p>
        분쟁 중에도 같은 작업방 대화와 기존 영상·파일 증빙을 열람할 수 있어요.
        무응답·일방 주장으로 지급·환불하지 않아요.
      </p>
      {!hideRecords &&
        workflow.disputes.map((d) => (
          <article className="grid gap-2" key={d.id}>
            <Link to={`/disputes/${d.id}`}>이 분쟁 현황 보기</Link>
            <p>
              {d.reason} · 증빙: {d.evidence}
            </p>
            <p>
              상태:{" "}
              {d.released
                ? "근거 기록 후 합의 흐름 복귀"
                : "운영 검토 대기 · 정산 보류"}{" "}
              · 접수 {d.at}
            </p>
            {!d.reviews.length && (
              <p>
                담당 미배정 · 다음 안내: 양측 합의 조건과 증빙을 확인해 주세요.
                회신 기한 D13 미결정.
              </p>
            )}
            {d.reviews.map((r) => (
              <p key={r.id}>
                담당 {r.actorId} · {r.at} · 검토 근거 {r.note} · 다음 안내{" "}
                {r.nextStep} · {r.release ? "분쟁 보류 해제" : "보류 유지"}
              </p>
            ))}
          </article>
        ))}
      {!open && workflow.settlement?.status !== "SUCCEEDED" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled && reason.trim() && evidence.trim())
              onSubmit(reason.trim(), evidence.trim());
          }}
          className="grid gap-3"
        >
          <Label htmlFor="dispute-reason">분쟁 사유</Label>
          <Textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            disabled={disabled}
            required
          />
          <Label htmlFor="dispute-evidence">증빙·관련 버전·진행 기록</Label>
          <Textarea
            id="dispute-evidence"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            maxLength={2000}
            disabled={disabled}
            required
          />
          <Button
            type="submit"
            disabled={disabled || !reason.trim() || !evidence.trim()}
          >
            분쟁 접수·정산 보류 (Mock)
          </Button>
        </form>
      )}
    </section>
  );
}
