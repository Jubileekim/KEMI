import { emptyResolution, type ResolutionState } from "./resolution-model";

const records = new Map<string, ResolutionState>();
export const readResolution = (id: string) =>
  records.get(id) ?? emptyResolution();
export const saveResolution = (id: string, state: ResolutionState) =>
  records.set(id, state);
// A request is a hold, never a payment/refund or a unilateral completion.
export const resolutionHeld = (id: string) =>
  readResolution(id).versions.length > 0;
