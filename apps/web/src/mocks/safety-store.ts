import type { SafetyReport } from "./safety-model";

let records: SafetyReport[] = [];
export const readMockSafety = () => records;
export const writeMockSafety = (next: SafetyReport[]) => {
  records = next;
};
export const mockAccountLimited = (id: string) =>
  records.some((r) => r.subjectId === id && r.limited);
