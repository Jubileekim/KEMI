import { z } from "zod";
import type { AuthUser } from "@kemi/shared";
import type { Campaign } from "./campaign-model";
import {
  projectPublic,
  recruitmentStatus,
  listingSchema,
} from "./discovery-model";
import { ProposalError } from "./proposal-model";

export const bookmarkCommandSchema = z.strictObject({
  id: z.string().uuid(),
  saved: z.boolean(),
});
export function changeBookmarks(
  ids: string[],
  raw: unknown,
  user: AuthUser,
  campaigns: Campaign[],
) {
  if (user.role !== "CREATOR" || user.status !== "ACTIVE")
    throw new ProposalError("크리에이터 본인만 저장할 수 있어요.", 403);
  const cmd = bookmarkCommandSchema.parse(raw);
  if (!cmd.saved) return ids.filter((id) => id !== cmd.id);
  if (ids.includes(cmd.id)) return ids;
  const item = campaigns.find((c) => c.id === cmd.id);
  if (!item || !projectPublic(item) || recruitmentStatus(item) !== "OPEN")
    throw new ProposalError("모집 중인 공개 캠페인이 필요해요.", 404);
  return [cmd.id, ...ids];
}
// Campaign has no shared category/style/schedule fields. Match only the explicit
// profile niche label to its product text; do not pretend to match unavailable data.
export function recommendCampaigns(
  campaigns: Campaign[],
  niche: string | null,
  saved: string[],
) {
  const labels: Record<string, string> = {
    BEAUTY: "뷰티",
    FOOD: "식품",
    LIFESTYLE: "생활",
    TECH: "테크",
    OTHER: "기타",
  };
  const word = niche ? labels[niche] : undefined;
  const available = campaigns.flatMap((item) => {
    const projected = projectPublic(item);
    return projected &&
      recruitmentStatus(item) === "OPEN" &&
      !saved.includes(item.id)
      ? [projected]
      : [];
  });
  return {
    sufficient: Boolean(word),
    items: word
      ? available
          .filter((item) => item.product.includes(word))
          .map((item) => ({
            item,
            reason: `프로필 분야 ${word} · 제품·서비스에 같은 표현 포함 (개발 예시)`,
          }))
      : [],
  };
}
export const activityViewSchema = z.strictObject({
  campaigns: z.array(
    z.strictObject({ id: z.string(), title: z.string(), status: z.string() }),
  ),
  requests: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      status: z.string(),
      contractIds: z.array(z.string()),
    }),
  ),
  savedIds: z.array(z.string()),
  bookmarks: z.array(
    z.strictObject({ id: z.string(), item: listingSchema.nullable() }),
  ),
  recommendations: z.strictObject({
    sufficient: z.boolean(),
    items: z.array(z.strictObject({ item: listingSchema, reason: z.string() })),
  }),
});
