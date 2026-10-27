import { Badge } from "./Badge";
import type { BadgeTone } from "./types";

export type PaymentStatus = "pending" | "paid" | "refunded" | "failed";

export interface PaymentLine {
  label: string;
  /** 포맷된 금액 또는 "협의 후 확정" 같은 문구 */
  value: string;
}

export interface PaymentSummaryProps {
  /** 숨은 비용이 없도록 수수료·세금은 별도 줄로 */
  lines: PaymentLine[];
  total: string;
  totalLabel?: string;
  /** pending이면 배지를 표시하지 않는다 */
  status?: PaymentStatus;
  note?: string;
}

const STATUS: Record<Exclude<PaymentStatus, "pending">, { tone: BadgeTone; label: string }> = {
  paid: { tone: "success", label: "● 결제 완료" },
  refunded: { tone: "neutral", label: "환불됨" },
  failed: { tone: "danger", label: "● 결제 실패" },
};

export function PaymentSummary({ lines, total, totalLabel = "총 결제 금액", status = "pending", note }: PaymentSummaryProps) {
  return (
    <div className="payment" data-status={status} aria-live="polite">
      {status !== "pending" && <div className="payment__status"><Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge></div>}
      <dl className="payment__list">
        {lines.map((l) => (
          <div key={l.label} className="payment__row"><dt>{l.label}</dt><dd>{l.value}</dd></div>
        ))}
        <div className="payment__row payment__row--total"><dt>{totalLabel}</dt><dd>{total}</dd></div>
      </dl>
      {note && <p className="payment__note">{note}</p>}
    </div>
  );
}
