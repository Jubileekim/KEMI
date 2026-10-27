import { Badge } from "./Badge";
import { cx } from "./cx";
import type { BadgeTone } from "./types";

export type DealStepStatus = "done" | "active" | "blocked" | "todo";

export interface DealStep {
  id: string;
  title: string;
  /** 담당자 · 날짜 등 */
  meta?: string;
  status: DealStepStatus;
}

export interface DealTimelineProps {
  steps: DealStep[];
  /** horizontal: 거래 상세 상단 요약용 */
  orientation?: "vertical" | "horizontal";
  "aria-label"?: string;
}

const STEP_LABEL: Record<DealStepStatus, string> = { done: "완료", active: "진행 중", blocked: "확인 필요", todo: "예정" };

export function DealTimeline({ steps, orientation = "vertical", ...rest }: DealTimelineProps) {
  return (
    <ol className={cx("timeline", orientation === "horizontal" && "timeline--horizontal")} aria-label={rest["aria-label"] ?? "거래 단계"}>
      {steps.map((s, i) => (
        <li key={s.id} className="timeline__item" data-status={s.status} aria-current={s.status === "active" ? "step" : undefined}>
          <span className="timeline__dot" aria-hidden="true">{s.status === "done" ? "✓" : s.status === "blocked" ? "!" : i + 1}</span>
          <div>
            <div className="timeline__title">{s.title}<span className="sr-only"> ({STEP_LABEL[s.status]})</span></div>
            {s.meta && <div className="timeline__meta">{s.meta}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export type DealStatus = "active" | "blocked" | "complete" | "disputed";

export interface DealNextActionProps {
  status: DealStatus;
  /** 현재 단계 이름. 예) "제작 중" */
  stageLabel: string;
  /** 누가 · 무엇을 · 언제까지는 항상 함께 표시한다 */
  nextActor: string;
  nextAction: string;
  /** 예) "2026-10-27" */
  dueDate: string;
  /** 남은 일수. URGENT_DAYS 이하이면 경고색 */
  daysLeft?: number;
  /** 결제 후~승인 전 보관 금액 안내 */
  escrowNotice?: string;
}

/** 기한 임박 기준(가정) */
export const URGENT_DAYS = 3;

const STATUS_TONE: Record<DealStatus, BadgeTone> = { active: "primary", blocked: "warning", complete: "success", disputed: "danger" };

export function DealNextAction({ status, stageLabel, nextActor, nextAction, dueDate, daysLeft, escrowNotice }: DealNextActionProps) {
  const urgent = daysLeft !== undefined && daysLeft <= URGENT_DAYS && status !== "complete";
  return (
    <section className="card deal-next" aria-label="다음 할 일">
      <div className="deal-next__head">
        <div className="deal-next__what">
          <Badge tone={STATUS_TONE[status]}>{stageLabel}</Badge>
          <strong>다음 할 일: {nextActor} · {nextAction}</strong>
        </div>
        <span className="deal-next__due" data-urgent={urgent || undefined}>
          기한 {dueDate}{daysLeft !== undefined && ` (D-${daysLeft})`}
        </span>
      </div>
      {escrowNotice && <p className="deal-next__escrow">{escrowNotice}</p>}
    </section>
  );
}
