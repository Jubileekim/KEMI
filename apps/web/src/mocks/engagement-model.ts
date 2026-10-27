import { z } from "zod";
import { ProposalError } from "./proposal-model";

export const reviewInputSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  content: z.string().trim().min(1).max(2000),
  tags: z.array(z.string().trim().min(1).max(30)).max(5),
});
export const reviewSchema = reviewInputSchema.extend({
  contractId: z.string().uuid(),
  authorId: z.string(),
  targetId: z.string(),
  at: z.iso.datetime(),
});
export type Review = z.infer<typeof reviewSchema>;
export function submitReview(
  records: Review[],
  raw: unknown,
  context: {
    contractId: string;
    authorId: string;
    targetId: string;
    participant: boolean;
    complete: boolean;
    cancelled: boolean;
  },
) {
  const values = reviewInputSchema.parse(raw);
  if (!context.participant || context.authorId === context.targetId)
    throw new ProposalError("계약 상대방만 평가할 수 있어요.", 403);
  if (!context.complete || context.cancelled)
    throw new ProposalError("정상 수령 완료 거래만 리뷰를 작성할 수 있어요.");
  const prior = records.find(
    (r) =>
      r.contractId === context.contractId && r.authorId === context.authorId,
  );
  if (prior) {
    if (
      prior.rating === values.rating &&
      prior.content === values.content &&
      JSON.stringify(prior.tags) === JSON.stringify(values.tags)
    )
      return records;
    throw new ProposalError("이미 작성한 리뷰예요.");
  }
  return [
    ...records,
    {
      ...values,
      contractId: context.contractId,
      authorId: context.authorId,
      targetId: context.targetId,
      at: new Date().toISOString(),
    },
  ];
}
export const noticeSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  path: z.string(),
  at: z.iso.datetime(),
  read: z.boolean(),
});
export const notificationsViewSchema = z.strictObject({
  items: z.array(noticeSchema),
  unreadCount: z.number().int().nonnegative(),
});
export const reviewViewSchema = z.strictObject({
  contractId: z.string().uuid(),
  eligible: z.boolean(),
  reason: z.string(),
  own: reviewSchema.nullable(),
});
export const readCommandSchema = z.strictObject({
  ids: z.array(z.string().min(1).max(200)).min(1).max(200),
});
export function readNotices(
  items: z.infer<typeof noticeSchema>[],
  raw: unknown,
) {
  const { ids } = readCommandSchema.parse(raw);
  if (ids.some((id) => !items.some((item) => item.id === id)))
    throw new ProposalError("본인 알림을 확인해 주세요.", 404);
  return items.map((item) =>
    ids.includes(item.id) ? { ...item, read: true } : item,
  );
}
