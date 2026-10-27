import tokens from "./tokens.json";

export { tokens };

const layout = tokens["01-primitives"].layout;

/** min-width 기준. 미디어 쿼리 문자열은 CSS에서 리터럴로 쓰고, JS에서는 이 값을 쓴다. */
export const breakpoints = layout.breakpoint;

export const media = {
  tablet: `(min-width: ${breakpoints.tablet}px)`,
  desktop: `(min-width: ${breakpoints.desktop}px)`,
  wide: `(min-width: ${breakpoints.wide}px)`,
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

export const motion = tokens["01-primitives"].motion;

export type Theme = "light" | "dark";
