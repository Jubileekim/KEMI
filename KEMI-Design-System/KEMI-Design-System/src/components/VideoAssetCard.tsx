import { Badge } from "./Badge";
import { formatDuration, formatMoney } from "./format";
import { Icon } from "./Icon";
import type { AspectRatio, BadgeTone, Money } from "./types";

export type AssetType = "ready-made" | "custom";
export type AssetAvailability = "available" | "reserved" | "unavailable";

export interface VideoAssetCardProps {
  id: string;
  /** 2줄까지, 넘치면 말줄임 */
  title: string;
  posterUrl?: string;
  durationSeconds: number;
  /** 그리드는 9:16 기준. 가로·정방형 소재는 레터박스로 표시 */
  aspectRatio: AspectRatio;
  /** custom이면 가격 대신 "견적 요청" */
  assetType: AssetType;
  /** 가장 낮은 라이선스 기준 가격. 뒤에 "~"가 붙는다. custom이면 null */
  price: Money | null;
  /** 한 줄 요약만. 상세 조건은 LicenseSelector에서 */
  licenseSummary: string;
  /** reserved: 썸네일만 흐리게, 클릭 가능(상세에서 사유 표시). unavailable: 클릭 불가 */
  availability: AssetAvailability;
  /** 기본 배지 문구를 바꿀 때. 예) { tone: "warning", label: "독점은 협의" } */
  status?: { tone: BadgeTone; label: string };
  /** 데이터 계약에만 존재. 검증 기준(권리 증빙 범위·심사 주체)이 확정되기 전까지 UI에 노출하지 않는다 */
  verified?: boolean;
  selected?: boolean;
  saved?: boolean;
  onOpen?: (id: string) => void;
  /** 비교·장바구니 선택. 지정하면 선택 토글 버튼이 생긴다 */
  onSelect?: (id: string) => void;
  onSave?: (id: string) => void;
}

const DEFAULT_STATUS: Record<AssetAvailability, { tone: BadgeTone; label: string }> = {
  available: { tone: "success", label: "● 즉시 구매" },
  reserved: { tone: "warning", label: "● 예약 중" },
  unavailable: { tone: "danger", label: "● 판매 중지" },
};

export function VideoAssetCard(props: VideoAssetCardProps) {
  const { id, title, posterUrl, durationSeconds, aspectRatio, assetType, price, licenseSummary, availability, selected, saved, onOpen, onSelect, onSave } = props;
  const status = props.status ?? (assetType === "custom" && availability === "available" ? { tone: "creative" as const, label: "제작 의뢰" } : DEFAULT_STATUS[availability]);
  const priceLabel = assetType === "custom" || !price ? "견적 요청" : `${formatMoney(price)}~`;
  const disabled = availability === "unavailable";

  return (
    <article className="asset-card" data-ratio={aspectRatio} data-availability={availability} data-selected={selected || undefined}>
      <button type="button" className="asset-card__open" disabled={disabled} onClick={() => onOpen?.(id)}>
        <div className="asset-card__media">
          <div className="thumb" style={posterUrl ? { backgroundImage: `url("${posterUrl}")` } : undefined} />
          <div className="asset-card__overlay">
            <span className="asset-card__pill">{aspectRatio}</span>
            <span className="asset-card__pill">{formatDuration(durationSeconds)}</span>
          </div>
        </div>
        <div className="asset-card__body">
          <h3 className="asset-card__title">{title}</h3>
          <span className="asset-card__price">{priceLabel}</span>
          <span className="asset-card__license">{licenseSummary}</span>
          <div className="asset-card__meta"><Badge tone={status.tone}>{status.label}</Badge></div>
        </div>
      </button>
      {!disabled && (onSelect || onSave) && (
        <div className="asset-card__actions">
          {onSave && (
            <button type="button" className="asset-card__action" aria-pressed={!!saved} aria-label={`${title} 저장`} onClick={() => onSave(id)}>
              <Icon name="bookmark" size={16} />
            </button>
          )}
          {onSelect && (
            <button type="button" className="asset-card__action" aria-pressed={!!selected} aria-label={`${title} 비교 목록에 담기`} onClick={() => onSelect(id)}>
              <Icon name={selected ? "check" : "plus"} size={16} />
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function VideoAssetCardSkeleton() {
  return (
    <div className="asset-card asset-card--loading" aria-busy="true" aria-label="불러오는 중">
      <div className="asset-card__media skeleton" />
      <div className="asset-card__body">
        <div className="skeleton" style={{ height: 14, width: "90%" }} />
        <div className="skeleton" style={{ height: 16, width: "50%" }} />
        <div className="skeleton" style={{ height: 12, width: "70%" }} />
      </div>
    </div>
  );
}
