import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** sheet: 모바일(~599px)에서 바텀시트로 표시. 필터 패널 등 */
  variant?: "dialog" | "sheet";
}

/** 네이티브 <dialog>. Esc·포커스 가두기·배경 비활성화는 브라우저가 처리한다. */
export function Modal({ open, onClose, title, children, actions, variant = "dialog" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={cx("modal", variant === "sheet" && "modal--sheet")} aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId} className="modal__title">{title}</h2>
      {children && <div className={variant === "sheet" ? "modal__content" : "modal__body"}>{children}</div>}
      {actions && <div className="modal__actions">{actions}</div>}
    </dialog>
  );
}
