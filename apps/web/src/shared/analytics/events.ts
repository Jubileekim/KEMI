import { z } from "zod";

// D22: no provider, consent assumption, network call or production storage.
// This allowlist is the entire payload: no separate actor/session ids, URLs, briefs or text.
// Creator views use the public creator object id, never private profile fields.
export const analyticsEventSchema = z.strictObject({
  name: z.enum([
    "feed_view",
    "work_play",
    "creator_view",
    "request_sent",
    "contract_confirmed",
    "transaction_completed",
  ]),
  objectId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/),
  at: z.iso.datetime(),
  test: z.literal(true),
});
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export function createAnalyticsRecorder(sink: (event: AnalyticsEvent) => void) {
  const confirmed = new Set<string>();
  return (raw: unknown) => {
    const parsed = analyticsEventSchema.safeParse(raw);
    if (!parsed.success) return false;
    const event = parsed.data;
    const unique = [
      "request_sent",
      "contract_confirmed",
      "transaction_completed",
    ].includes(event.name);
    const key = `${event.name}:${event.objectId}`;
    if (unique && confirmed.has(key)) return false;
    try {
      sink(event);
      if (unique) confirmed.add(key);
      return true;
    } catch {
      // Analytics delivery never changes a transaction result. Return a failure
      // for DEV verification without logging the payload or throwing to a user.
      return false;
    }
  };
}
const records: AnalyticsEvent[] = [];
const record = createAnalyticsRecorder((event) => {
  records.push(event);
});
export function recordMockEvent(
  name: AnalyticsEvent["name"],
  objectId: string,
) {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS !== "true")
    return false;
  return record({ name, objectId, at: new Date().toISOString(), test: true });
}
// Only imported through a DEV lazy screen. Never a production diagnostics API.
export const readMockAnalytics = () => records.map((event) => ({ ...event }));
