import type { HTMLAttributes } from "react";
import { cx } from "./cx";
import type { BadgeTone } from "./types";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** 상태는 색만으로 전달하지 않는다. children에 항상 텍스트를 넣는다 */
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return <span className={cx("badge", tone !== "neutral" && `badge--${tone}`, className)} {...rest} />;
}
