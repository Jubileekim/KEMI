import { Badge } from "./Badge";
import { Button } from "./Button";
import type { BadgeTone } from "./types";

export type OfferState = "pending" | "accepted" | "declined" | "expired";

export interface OfferCardProps {
  price: string;
  terms: string[];
  /** 예) "마감 10/24" */
  deadline: string;
  state: OfferState;
  onAccept?: () => void;
  onNegotiate?: () => void;
}

const STATE: Record<OfferState, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "● 응답 대기" },
  accepted: { tone: "success", label: "● 수락함" },
  declined: { tone: "danger", label: "● 거절됨" },
  expired: { tone: "neutral", label: "만료됨" },
};

/** 제안함은 일반 메시지와 분리된 목록에서 보여준다 */
export function OfferCard({ price, terms, deadline, state, onAccept, onNegotiate }: OfferCardProps) {
  return (
    <article className="card offer-card" data-state={state}>
      <div className="offer-card__head">
        <div>
          <Badge tone={STATE[state].tone}>{STATE[state].label}</Badge>
          <div className="offer-card__price">{price}</div>
        </div>
        <span className="field__hint">{deadline}</span>
      </div>
      {terms.length > 0 && <ul className="offer-card__terms">{terms.map((t) => <li key={t}>{t}</li>)}</ul>}
      {state === "pending" && (
        <div className="offer-card__actions">
          <Button size="sm" onClick={onAccept}>수락하기</Button>
          <Button variant="secondary" size="sm" onClick={onNegotiate}>조건 협의하기</Button>
        </div>
      )}
    </article>
  );
}
