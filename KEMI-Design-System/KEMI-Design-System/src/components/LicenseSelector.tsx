import { cx } from "./cx";

export interface LicenseOption {
  value: string;
  title: string;
  description?: string;
  /** 예) "×1.6", "₩900,000", "협의 필요" */
  priceLabel?: string;
  disabled?: boolean;
}

export interface LicenseGroup {
  /** 폼 필드 이름. 예) mediaChannels · duration · territories · exclusivity */
  name: string;
  legend: string;
  options: LicenseOption[];
  /** row: 짧은 옵션을 가로로 나열 */
  layout?: "column" | "row";
  /** 다음 half 그룹과 한 줄에 나란히 배치 */
  half?: boolean;
}

export interface LicenseSelectorProps {
  groups: LicenseGroup[];
  value: Record<string, string>;
  onChange: (name: string, value: string) => void;
  className?: string;
}

/** 가격이 달라지는 선택지는 드롭다운이 아니라 라디오 카드로 나열한다(가격이 함께 보이도록). */
export function LicenseSelector({ groups, value, onChange, className }: LicenseSelectorProps) {
  return (
    <div className={cx("license", className)}>
      {groups.map((g) => (
        <fieldset key={g.name} className={cx("license__group", g.half && "license__group--half")}>
          <legend>{g.legend}</legend>
          <div className={cx("license__options", g.layout === "row" && "license__options--row")}>
            {g.options.map((o) => (
              <label key={o.value} className="option">
                <input type="radio" name={g.name} value={o.value} checked={value[g.name] === o.value} disabled={o.disabled}
                  onChange={() => onChange(g.name, o.value)} />
                <span className="option__title">{o.title}</span>
                {o.description && <span className="option__desc">{o.description}</span>}
                {o.priceLabel && <span className="option__price">{o.priceLabel}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
