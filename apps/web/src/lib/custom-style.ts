import type { CSSProperties } from "react";

// Validate custom CSS variables without a type assertion or a global React augmentation.
export default function customStyle(
  properties: CSSProperties & Record<`--${string}`, string>,
): CSSProperties {
  return properties;
}
