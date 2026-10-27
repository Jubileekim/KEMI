import type { z } from "zod";
import memberRequest from "./member-request";
import {
  notificationsViewSchema,
  reviewViewSchema,
  type reviewInputSchema,
} from "./engagement-model";

export async function loadNotifications(signal?: AbortSignal, ids?: string[]) {
  return notificationsViewSchema.parse(
    await memberRequest(
      "/__mock__/notifications",
      signal,
      ids ? { ids } : undefined,
    ),
  );
}
export async function loadReview(
  id: string,
  signal?: AbortSignal,
  input?: z.infer<typeof reviewInputSchema>,
) {
  const view = reviewViewSchema.parse(
    await memberRequest(
      `/__mock__/reviews/${encodeURIComponent(id)}`,
      signal,
      input,
    ),
  );
  if (view.contractId !== id) throw new Error("리뷰 계약이 달라요.");
  return view;
}
