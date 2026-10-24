import { z } from "zod";
import { projectSortSchema } from "@kemi/shared";
import {
  campaignSchema,
  CampaignConflict,
  type Campaign,
  type CampaignState,
} from "./campaign-model";

// A deliberately smaller public projection: no references, pricing reports or drafts.
export const listingSchema = campaignSchema.pick({
  id: true,
  ownerId: true,
  title: true,
  product: true,
  purpose: true,
  scope: true,
  budget: true,
  days: true,
  status: true,
  publishedAt: true,
  recruitmentEndAt: true,
  closedAt: true,
});
export type Listing = z.infer<typeof listingSchema>;
export function recruitmentStatus(
  item: Pick<Campaign, "status" | "recruitmentEndAt">,
  now = Date.now(),
) {
  if (item.status === "DRAFT") return "DRAFT";
  return item.status === "CLOSED" ||
    !item.recruitmentEndAt ||
    Date.parse(item.recruitmentEndAt) <= now
    ? "CLOSED"
    : "OPEN";
}
export function projectPublic(item: Campaign): Listing | undefined {
  return item.status === "DRAFT"
    ? undefined
    : listingSchema.strip().parse(item);
}
const money = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().safe().positive())
  .optional();
export const browseQuerySchema = z
  .strictObject({
    q: z.string().trim().max(100).default(""),
    product: z.string().trim().max(100).default(""),
    budgetMin: money,
    budgetMax: money,
    status: z.enum(["OPEN", "CLOSED", "ALL"]).default("OPEN"),
    sort: projectSortSchema.default("LATEST"),
    page: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .pipe(z.number().int().max(100000))
      .default(1),
  })
  .refine(
    (v) =>
      v.budgetMin === undefined ||
      v.budgetMax === undefined ||
      v.budgetMin <= v.budgetMax,
    "예산 범위를 확인해 주세요.",
  );
export const browseResultSchema = z.strictObject({
  items: z.array(listingSchema),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  page: z.number().int().positive(),
});
export function browseCampaigns(
  items: Campaign[],
  raw: unknown,
  now = Date.now(),
) {
  const query = browseQuerySchema.parse(raw);
  const matches = items
    .filter((item) => {
      if (item.status === "DRAFT") return false;
      const status = recruitmentStatus(item, now);
      return (
        (query.status === "ALL" || status === query.status) &&
        `${item.title} ${item.product} ${item.purpose} ${item.scope}`
          .toLocaleLowerCase()
          .includes(query.q.toLocaleLowerCase()) &&
        item.product
          .toLocaleLowerCase()
          .includes(query.product.toLocaleLowerCase()) &&
        (query.budgetMin === undefined ||
          Number(item.budget) >= query.budgetMin) &&
        (query.budgetMax === undefined ||
          Number(item.budget) <= query.budgetMax)
      );
    })
    .sort((a, b) => {
      let order =
        Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "");
      if (query.sort === "DEADLINE")
        order =
          Date.parse(a.recruitmentEndAt ?? "") -
          Date.parse(b.recruitmentEndAt ?? "");
      if (query.sort === "BUDGET_LOW")
        order = Number(a.budget) - Number(b.budget);
      if (query.sort === "BUDGET_HIGH")
        order = Number(b.budget) - Number(a.budget);
      return order || a.id.localeCompare(b.id);
    });
  const size = 6; // Mock presentation size, not a product policy.
  return {
    items: matches
      .slice((query.page - 1) * size, query.page * size)
      .map((item) => listingSchema.strip().parse(item)),
    total: matches.length,
    totalPages: Math.ceil(matches.length / size),
    page: query.page,
  };
}
export function closeCampaign(
  state: CampaignState,
  id: string,
  revision: number,
  user: { id: string; role: string; status: string },
  now = new Date(),
): CampaignState {
  if (user.role !== "CLIENT" || user.status !== "ACTIVE")
    throw new Error("활성 의뢰인만 마감할 수 있어요.");
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item || item.ownerId !== user.id || item.status === "DRAFT")
    throw new Error("본인 공개 공고가 아니에요.");
  if (item.status === "CLOSED") return state;
  if (state.revision !== revision)
    throw new CampaignConflict("최신 상태를 확인해 주세요.");
  return {
    revision: state.revision + 1,
    items: state.items.map((candidate) =>
      candidate.id === id
        ? { ...candidate, status: "CLOSED", closedAt: now.toISOString() }
        : candidate,
    ),
  };
}
export function discoveryFixtures(now = new Date()): Campaign[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ownerId: "fixture-client",
    title: `모의 ${index % 2 ? "가족 기념" : "제품 소개"} 영상 ${index + 1}`,
    product: index % 2 ? "가족 영상" : "생활용품",
    purpose: "소개·기념",
    scope: "편집 영상 1편",
    budget: String((index + 1) * 50000),
    references: "PRIVATE_FIXTURE_REFERENCE",
    days: "7",
    status: "OPEN",
    publishedAt: new Date(now.getTime() - index * 1000).toISOString(),
    recruitmentEndAt: new Date(
      now.getTime() + (index === 8 ? -1 : index + 1) * 86400000,
    ).toISOString(),
  }));
}
