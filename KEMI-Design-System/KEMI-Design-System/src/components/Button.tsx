import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type BaseProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  /** primary는 화면당 1개 */
  variant?: ButtonVariant;
  /** sm(36px)은 데스크톱 표·툴바 전용. 모바일 터치 대상은 44px 이상 */
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
};

export type ButtonProps =
  | (BaseProps & { iconOnly?: false; "aria-label"?: string })
  | (BaseProps & { iconOnly: true; "aria-label": string });

export function Button({ variant = "primary", size = "md", block, loading, iconOnly, className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("btn", `btn--${variant}`, size !== "md" && `btn--${size}`, block && "btn--block", iconOnly && "btn--icon", className)}
      aria-busy={loading || undefined}
      {...rest}
    />
  );
}
