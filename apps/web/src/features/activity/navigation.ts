export default function readPage(value: string | null): number {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 && page <= 100_000 ? page : 1;
}
