import { Badge } from "./Badge";
import { Button } from "./Button";
import { OverflowMenu, type MenuItem } from "./OverflowMenu";

export type CreatorAvailability =
  | { status: "available" }
  /** 예) label: "대기 2주" */
  | { status: "waitlist"; label: string }
  /** 예) label: "11월 이후 가능" */
  | { status: "paused"; label?: string };

export interface CreatorMatchCardProps {
  name: string;
  /** 지역 · 카테고리 등 한 줄 */
  subtitle: string;
  avatarUrl?: string;
  /** 대표 영상 썸네일. 앞의 3개만 표시 */
  portfolio: string[];
  rating?: number;
  completedCount: number;
  /** 확인 가능한 사실 문장만, 최대 2개. 점수·퍼센트 금지 */
  matchReasons: string[];
  availability: CreatorAvailability;
  /** 데이터 계약에만 존재. 검수 기준이 확정되기 전까지 UI에 노출하지 않는다 */
  verifiedRights?: boolean;
  onRequest?: () => void;
  onNotify?: () => void;
  onPortfolio?: () => void;
  onSave?: () => void;
  onBlock?: () => void;
}

/** 이 건수 미만이면 평점 대신 "평점 없음"(가정 — 운영 데이터로 조정) */
export const MIN_COMPLETED_FOR_RATING = 5;
const MAX_REASONS = 2;

export function CreatorMatchCard(props: CreatorMatchCardProps) {
  const { name, subtitle, avatarUrl, portfolio, rating, completedCount, matchReasons, availability, onRequest, onNotify, onPortfolio, onSave, onBlock } = props;
  const showRating = rating !== undefined && completedCount >= MIN_COMPLETED_FOR_RATING;
  const menu: MenuItem[] = [
    ...(onSave ? [{ label: "저장 목록에 추가", onSelect: onSave }] : []),
    ...(onBlock ? [{ label: "이 제작자 숨기기", onSelect: onBlock, danger: true }] : []),
  ];
  const bg = (url?: string) => (url ? { backgroundImage: `url("${url}")` } : undefined);

  return (
    <article className="card creator-card" data-availability={availability.status}>
      <div className="creator-card__head">
        <div className="creator-card__avatar thumb" style={bg(avatarUrl)} />
        <div>
          <h3 className="creator-card__name">{name}</h3>
          <span className="creator-card__sub">{subtitle}</span>
        </div>
        <div className="creator-card__status">
          {availability.status === "available" && <Badge tone="success">● 의뢰 가능</Badge>}
          {availability.status === "waitlist" && <Badge tone="warning">● {availability.label}</Badge>}
          {availability.status === "paused" && <Badge>{availability.label ?? "의뢰 일시 중지"}</Badge>}
        </div>
      </div>
      <div className="creator-card__portfolio">
        {portfolio.slice(0, 3).map((url, i) => <div key={i} className="thumb" style={bg(url)} />)}
      </div>
      <div className="creator-card__stats">
        {showRating ? <span><strong>{rating.toFixed(1)}</strong> 평점</span> : <span className="text-secondary">평점 없음</span>}
        <span>완료 <strong>{completedCount.toLocaleString("ko-KR")}</strong>건</span>
      </div>
      {matchReasons.length > 0 && (
        <div className="creator-card__reason">
          <strong>추천 이유</strong>
          <ul>{matchReasons.slice(0, MAX_REASONS).map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      <div className="creator-card__actions">
        {availability.status === "paused"
          ? <Button variant="secondary" onClick={onNotify}>일정 알림 받기</Button>
          : <Button onClick={onRequest}>제작 의뢰하기</Button>}
        {onPortfolio && <Button variant="secondary" onClick={onPortfolio}>포트폴리오</Button>}
        {menu.length > 0 && <OverflowMenu label={`${name} 더보기`} items={menu} />}
      </div>
    </article>
  );
}
