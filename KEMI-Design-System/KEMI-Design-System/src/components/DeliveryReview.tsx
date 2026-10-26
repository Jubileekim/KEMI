import { useState } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Field, Textarea } from "./Field";

export interface DeliveryReviewProps {
  /** 예) "v2". 승인한 버전이 최종 납품본으로 고정된다 */
  version: string;
  submittedAt: string;
  remainingRevisions: number;
  onApprove: () => void;
  onRequestRevision: (note: string) => void;
  /** 거절은 사유 필수, 이후 분쟁 절차 안내로 이어진다 */
  onReject: (reason: string) => void;
}

type Mode = "idle" | "revision" | "reject";

const FORM: Record<Exclude<Mode, "idle">, { label: string; hint: string; error: string; submit: string }> = {
  revision: { label: "수정 요청 내용", hint: "타임코드와 함께 적어 주면 제작자가 빠르게 반영할 수 있어요. 예) 0:07 로고를 더 크게", error: "수정할 내용을 적어 주세요.", submit: "수정 요청 보내기" },
  reject: { label: "거절 사유", hint: "거절하면 분쟁 절차 안내로 이어져요. 결제 금액은 절차가 끝날 때까지 플랫폼이 보관해요.", error: "거절 사유를 적어 주세요.", submit: "거절하기" },
};

export function DeliveryReview({ version, submittedAt, remainingRevisions, onApprove, onRequestRevision, onReject }: DeliveryReviewProps) {
  const [mode, setMode] = useState<Mode>("idle");
  const [text, setText] = useState("");
  const [showError, setShowError] = useState(false);

  const open = (m: Mode) => { setMode(m); setText(""); setShowError(false); };
  const submit = () => {
    if (mode === "idle") return;
    if (!text.trim()) return setShowError(true);
    (mode === "revision" ? onRequestRevision : onReject)(text.trim());
    open("idle");
  };

  return (
    <section className="card review" aria-label="납품물 검수">
      <div className="review__head">
        <Badge tone="primary">검수 대기</Badge>
        <strong>{version} 납품본</strong>
        <span className="field__hint">{submittedAt} 제출</span>
      </div>
      <div className="review__actions">
        <Button onClick={onApprove}>승인하고 정산하기</Button>
        <Button variant="secondary" disabled={remainingRevisions <= 0} aria-expanded={mode === "revision"} onClick={() => open("revision")}>
          {remainingRevisions > 0 ? `수정 요청 (남은 횟수 ${remainingRevisions}회)` : "수정 요청 (남은 횟수 없음)"}
        </Button>
        <Button variant="ghost" aria-expanded={mode === "reject"} onClick={() => open("reject")}>거절</Button>
      </div>
      {mode !== "idle" && (
        <div className="review__form">
          <Field label={FORM[mode].label} hint={FORM[mode].hint} error={showError ? FORM[mode].error : undefined}>
            {(control) => <Textarea {...control} value={text} autoFocus onChange={(e) => setText(e.target.value)} />}
          </Field>
          <div className="review__form-actions">
            <Button variant="secondary" size="sm" onClick={() => open("idle")}>취소</Button>
            <Button variant={mode === "reject" ? "danger" : "primary"} size="sm" onClick={submit}>{FORM[mode].submit}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
