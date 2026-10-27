import { useState } from "react";
import Button from "../../components/ui/button";
import Label from "../../components/ui/label";
import Textarea from "../../components/ui/textarea";
import type { DeliveryState } from "../../mocks/delivery-model";
import type { FinalCommand } from "../../mocks/final-model";

export default function FinalReceiptPanel({
  state,
  creator,
  disabled,
  submit,
}: {
  state: DeliveryState;
  creator: boolean;
  disabled: boolean;
  submit: (cmd: FinalCommand) => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const { final } = state;
  if (!final.delivery)
    return <p>최종 파일 전달 후 전용 수령 확인을 할 수 있어요.</p>;
  const deliveryId = final.delivery.id;
  return (
    <section className="grid min-w-0 gap-3" aria-label="최종 수령 확인">
      <h3 className="type-heading-sm">최종 수령 확인</h3>
      <p>
        파일을 내려받아 승인 내용·계약 파일과 일치하는지 확인해 주세요.
        다운로드·채팅 답변·미응답은 수령 확인이 아니에요.
      </p>
      {final.problem && (
        <p role="alert" className="whitespace-pre-wrap">
          파일 문제 보류: {final.problem.reason} · 보완·분쟁 해제 절차는
          정책/API 협의가 필요해요. 수령·정산은 보류해요.
        </p>
      )}
      {final.receipt && (
        <p role="status">
          전용 수령 확인 기록 · {final.receipt.actorId} · {final.receipt.at}
        </p>
      )}
      {!creator && !final.receipt && !final.problem && (
        <>
          <Label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={disabled}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            다운로드한 파일이 승인 내용·계약 조건과 일치하고 미해결 문제가
            없어요
          </Label>
          <Button
            disabled={disabled || !confirmed}
            onClick={() =>
              submit({
                type: "receive-final",
                id: crypto.randomUUID(),
                revision: state.revision,
                deliveryId,
                confirmed: true,
              })
            }
          >
            최종 파일 수령 확인 (Mock)
          </Button>
          <Label htmlFor="final-problem">파일 문제·미해결 분쟁 내용</Label>
          <Textarea
            id="final-problem"
            maxLength={2000}
            value={reason}
            disabled={disabled}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={disabled || !reason.trim()}
            onClick={() =>
              submit({
                type: "report-file",
                id: crypto.randomUUID(),
                revision: state.revision,
                deliveryId,
                reason: reason.trim(),
              })
            }
          >
            파일 문제 신고·수령 보류 (Mock)
          </Button>
        </>
      )}
      <p>
        정산 미실행 · 수령 기록은 정산 선행 조건이에요. 실제 보류·금액 검사와
        모의 정산 결과는 후속 범위예요.
      </p>
    </section>
  );
}
