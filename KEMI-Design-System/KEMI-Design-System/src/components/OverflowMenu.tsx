import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export interface OverflowMenuProps {
  /** 버튼의 접근성 이름. 예) "모션랩 더보기" */
  label: string;
  items: MenuItem[];
  className?: string;
}

/** "⋯" 보조 행동 메뉴(저장·차단 등). 터치 기기에서 hover 행동을 대신한다. */
export function OverflowMenu({ label, items, className }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return close();
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = els.indexOf(document.activeElement as HTMLButtonElement);
    els[(at + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div ref={rootRef} className={cx("menu", className)} onKeyDown={onKeyDown}>
      <button ref={buttonRef} type="button" className="btn btn--secondary btn--icon" aria-label={label}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => setOpen((v) => !v)}>
        <Icon name="more" />
      </button>
      {open && (
        <ul id={menuId} role="menu" className="menu__list">
          {items.map((item) => (
            <li key={item.label} role="none">
              <button type="button" role="menuitem" tabIndex={-1} className={cx("menu__item", item.danger && "menu__item--danger")}
                onClick={() => { item.onSelect(); close(); }}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
