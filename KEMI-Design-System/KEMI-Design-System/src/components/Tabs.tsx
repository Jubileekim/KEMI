import { useId, useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

export interface TabItem<V extends string = string> {
  value: V;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<V extends string> {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  "aria-label": string;
  /** 탭이 내용을 바꾸는 패널의 id. 패널에는 role="tabpanel"을 붙인다 */
  panelId?: string;
  className?: string;
}

/** 화면 영역을 전환하는 탭. 값 하나를 고르는 용도면 SegmentedControl을 쓴다. */
export function Tabs<V extends string>({ items, value, onChange, panelId, className, ...rest }: TabsProps<V>) {
  const listRef = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent) => {
    const enabled = items.filter((i) => !i.disabled);
    const at = enabled.findIndex((i) => i.value === value);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: enabled.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const target = enabled[(next + enabled.length) % enabled.length];
    onChange(target.value);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(target.value)}"]`)?.focus();
  };
  return (
    <div ref={listRef} role="tablist" className={cx("tabs", className)} aria-label={rest["aria-label"]} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button key={item.value} type="button" role="tab" className="tabs__item" data-value={item.value}
            aria-selected={selected} aria-controls={panelId} tabIndex={selected ? 0 : -1}
            disabled={item.disabled} onClick={() => onChange(item.value)}>
            {item.label}
            {item.count !== undefined && <span className="tabs__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export interface SegmentedControlProps<V extends string> {
  items: TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  "aria-label": string;
  name?: string;
  className?: string;
}

/** 값 하나를 고르는 알약형 라디오 그룹. 키보드 조작은 네이티브 라디오를 따른다. */
export function SegmentedControl<V extends string>({ items, value, onChange, name, className, ...rest }: SegmentedControlProps<V>) {
  const fallbackName = useId();
  return (
    <div role="radiogroup" className={cx("tabs", className)} aria-label={rest["aria-label"]}>
      {items.map((item) => (
        <label key={item.value} className="tabs__item">
          <input type="radio" name={name ?? fallbackName} value={item.value} checked={item.value === value}
            disabled={item.disabled} onChange={() => onChange(item.value)} />
          {item.label}
          {item.count !== undefined && <span className="tabs__count">{item.count}</span>}
        </label>
      ))}
    </div>
  );
}
