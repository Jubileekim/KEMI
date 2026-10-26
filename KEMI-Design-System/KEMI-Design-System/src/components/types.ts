export type Currency = "KRW" | "USD";

export interface Money {
  amount: number;
  currency: Currency;
}

export type AspectRatio = "9:16" | "16:9" | "1:1";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "creative";

export interface Option<V extends string = string> {
  value: V;
  label: string;
}
