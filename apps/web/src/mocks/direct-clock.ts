// DEV-only deterministic clock for the initial-response deadline. Does not affect chat/signatures.
let fixed: number | null = null;
export const directNow = () => new Date(fixed ?? Date.now());
export function setDirectClock(value: number | null) {
  fixed = value;
}
