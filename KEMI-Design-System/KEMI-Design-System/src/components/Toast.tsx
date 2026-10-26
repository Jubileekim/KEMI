import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

export type ToastTone = "info" | "success" | "error";

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
}

interface ToastEntry extends ToastOptions {
  id: number;
}

/** 행동 버튼이 있으면 누를 시간을 더 준다 */
const DURATION_MS = { plain: 4000, withAction: 8000 } as const;
const ICON: Record<ToastTone, string> = { info: "i", success: "✓", error: "!" };

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast는 <ToastProvider> 안에서만 쓸 수 있습니다.");
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...options, id }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => <ToastView key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const { id, message, tone = "info", action } = toast;
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), action ? DURATION_MS.withAction : DURATION_MS.plain);
    return () => clearTimeout(timer);
  }, [id, action, onDismiss]);
  return (
    <div className={cx("toast", `toast--${tone}`)}>
      <span className="toast__icon" aria-hidden="true">{ICON[tone]}</span>
      <span className="toast__msg">{message}</span>
      {action && (
        <button type="button" className="toast__action" onClick={() => { action.onClick(); onDismiss(id); }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
