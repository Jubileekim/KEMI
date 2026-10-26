import { Badge } from "./Badge";
import { Checkbox } from "./Field";

export interface RightsDisclosureProps {
  permissions: string[];
  restrictions: string[];
  /** 결제 전 확인 체크는 필수 */
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
  title?: string;
  defaultOpen?: boolean;
}

export function RightsDisclosure({ permissions, restrictions, acknowledged, onAcknowledgedChange, title = "포함 권리와 제한 사항", defaultOpen = true }: RightsDisclosureProps) {
  return (
    <details className="rights" open={defaultOpen}>
      <summary>
        <span className="rights__summary-label">{title}{acknowledged && <Badge tone="success">✓ 확인함</Badge>}</span>
      </summary>
      <div className="rights__body">
        <div className="rights__cols">
          <div>
            <p className="rights__heading">포함</p>
            <ul className="rights__list rights__list--allow">{permissions.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <div>
            <p className="rights__heading">제외</p>
            <ul className="rights__list rights__list--deny">{restrictions.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
        <Checkbox className="rights__ack" label="위 권리 범위와 제한 사항을 확인했습니다" checked={acknowledged}
          onChange={(e) => onAcknowledgedChange(e.target.checked)} />
      </div>
    </details>
  );
}
