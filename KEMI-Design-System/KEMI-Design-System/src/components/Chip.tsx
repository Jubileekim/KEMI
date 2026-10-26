import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  /** 토글형 칩. 지정하면 aria-pressed로 노출 */
  pressed?: boolean;
  /** 적용된 필터처럼 누르면 제거되는 칩. 스크린리더용 "해제" 라벨이 붙는다 */
  removable?: boolean;
}

export function Chip({ children, pressed, removable, className, type = "button", ...rest }: ChipProps) {
  return (
    <button type={type} className={cx("chip", className)} aria-pressed={pressed} {...rest}>
      {children}
      {removable && (
        <>
          <span className="sr-only"> 해제</span>
          <span className="chip__remove"><Icon name="close" size={14} /></span>
        </>
      )}
    </button>
  );
}
