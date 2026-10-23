import type { Money } from "./types";

/** UX 라이팅 규칙: 통화 기호 + 천 단위 쉼표. "15만원" 같은 축약 금지. */
export function formatMoney({ amount, currency }: Money): string {
  const n = Math.round(amount);
  return currency === "KRW" ? `₩${n.toLocaleString("ko-KR")}` : `$${n.toLocaleString("en-US")}`;
}

/** 초 → m:ss */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 시작일을 포함하므로 종료일은 하루 전. 2026-10-20 + 6개월 → "2027-04-19" */
export function licenseEndDate(months: number, start: Date = new Date()): string {
  const end = new Date(start.getFullYear(), start.getMonth() + months, start.getDate() - 1);
  return [end.getFullYear(), end.getMonth() + 1, end.getDate()].map((v, i) => (i ? String(v).padStart(2, "0") : v)).join("-");
}

/** UX 라이팅 규칙: 기간은 개월 수 + 종료일. 예) "6개월 · 2027-04-19까지" */
export function formatLicensePeriod(months: number, start: Date = new Date()): string {
  return `${months}개월 · ${licenseEndDate(months, start)}까지`;
}
