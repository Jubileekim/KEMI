import { useState } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { cx } from "./cx";
import { Checkbox } from "./Field";
import { InfoTip } from "./InfoTip";
import { SegmentedControl } from "./Tabs";
import type { Option } from "./types";

export interface FilterGroup {
  id: string;
  label: string;
  /** chips·checks: 여러 개 선택 · segment: 하나만 선택, 첫 옵션이 "적용 안 함" */
  kind: "chips" | "checks" | "segment";
  options: Option[];
  /** 그룹 기준 설명(ⓘ) */
  info?: string;
  /** 이 개수를 넘으면 "더보기"로 접는다. 기본 6 */
  maxVisible?: number;
}

/** 그룹 id → 선택된 option value 목록 */
export type FilterValues = Record<string, string[]>;

export interface AppliedFilter {
  groupId: string;
  value: string;
  label: string;
}

const DEFAULT_MAX_VISIBLE = 6;

const isApplied = (group: FilterGroup, value: string) => group.kind !== "segment" || value !== group.options[0]?.value;

export function getAppliedFilters(groups: FilterGroup[], values: FilterValues): AppliedFilter[] {
  return groups.flatMap((g) =>
    (values[g.id] ?? []).filter((v) => isApplied(g, v)).map((v) => ({ groupId: g.id, value: v, label: g.options.find((o) => o.value === v)?.label ?? v })),
  );
}

export interface AssetFilterPanelProps {
  groups: FilterGroup[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  title?: string;
  className?: string;
}

export function AssetFilterPanel({ groups, values, onChange, title = "필터", className }: AssetFilterPanelProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const total = getAppliedFilters(groups, values).length;
  const set = (id: string, next: string[]) => onChange({ ...values, [id]: next });
  const toggle = (id: string, v: string) => {
    const cur = values[id] ?? [];
    set(id, cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };

  return (
    <aside className={cx("filter-panel", className)} aria-label={title}>
      <div className="filter-panel__head">
        <h3 className="filter-panel__title">{title} {total > 0 && <Badge tone="primary">{total}개 적용</Badge>}</h3>
        <Button variant="ghost" size="sm" disabled={total === 0} onClick={() => onChange({})}>초기화</Button>
      </div>
      {groups.map((g) => {
        const selected = values[g.id] ?? [];
        const count = selected.filter((v) => isApplied(g, v)).length;
        const max = g.maxVisible ?? DEFAULT_MAX_VISIBLE;
        const visible = expanded[g.id] || g.kind === "segment" ? g.options : g.options.slice(0, max);
        const hidden = g.options.length - visible.length;
        return (
          <fieldset key={g.id} className="filter-group">
            <legend>
              {g.label}
              {count > 0 && <span className="filter-group__count">{count}</span>}
              {g.info && <InfoTip label={`${g.label} 기준`}>{g.info}</InfoTip>}
            </legend>
            {g.kind === "segment" && (
              <SegmentedControl aria-label={g.label} name={`filter-${g.id}`} items={g.options} value={selected[0] ?? g.options[0].value}
                onChange={(v) => set(g.id, isApplied(g, v) ? [v] : [])} />
            )}
            {g.kind === "chips" && (
              <div className="filter-group__chips">
                {visible.map((o) => <Chip key={o.value} pressed={selected.includes(o.value)} onClick={() => toggle(g.id, o.value)}>{o.label}</Chip>)}
              </div>
            )}
            {g.kind === "checks" && visible.map((o) => (
              <Checkbox key={o.value} label={o.label} checked={selected.includes(o.value)} onChange={() => toggle(g.id, o.value)} />
            ))}
            {g.kind !== "segment" && g.options.length > max && (
              <Button variant="ghost" size="sm" className="filter-group__more" aria-expanded={!!expanded[g.id]}
                onClick={() => setExpanded((e) => ({ ...e, [g.id]: !e[g.id] }))}>
                {expanded[g.id] ? "접기" : `더보기 (${hidden})`}
              </Button>
            )}
          </fieldset>
        );
      })}
    </aside>
  );
}

export interface AppliedFiltersProps {
  items: AppliedFilter[];
  onRemove: (item: AppliedFilter) => void;
  onClearAll: () => void;
}

/** 그리드 위에 적용 조건을 지울 수 있는 칩으로 다시 보여준다 */
export function AppliedFilters({ items, onRemove, onClearAll }: AppliedFiltersProps) {
  if (!items.length) return null;
  return (
    <div className="applied-filters" aria-label="적용된 필터">
      {items.map((item) => (
        <Chip key={`${item.groupId}:${item.value}`} removable className="chip--applied" onClick={() => onRemove(item)}>{item.label}</Chip>
      ))}
      <Button variant="ghost" size="sm" onClick={onClearAll}>모두 지우기</Button>
    </div>
  );
}
