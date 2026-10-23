import { z } from "zod";
import { pricingApplicationSchema } from "./pricing-model";

// D04 candidate checks and local input protection; never a shared API contract.
export const campaignFields = [
  ["title", "캠페인 제목"],
  ["product", "제품·서비스"],
  ["purpose", "제작 목적"],
  ["scope", "작업 범위"],
  ["budget", "예산 (원)"],
  ["references", "참고 자료 (선택 텍스트)"],
] as const;
const text = z.string().max(4000);
export const campaignValuesSchema = z.strictObject({
  title: text,
  product: text,
  purpose: text,
  scope: text,
  budget: text,
  references: text,
  days: z.enum(["3", "7", "14"]),
  pricingApplication: pricingApplicationSchema.optional(),
});
export type CampaignValues = z.infer<typeof campaignValuesSchema>;
export const emptyCampaign: CampaignValues = {
  title: "",
  product: "",
  purpose: "",
  scope: "",
  budget: "",
  references: "",
  days: "7",
};
export const campaignSchema = campaignValuesSchema.extend({
  id: z.string().uuid(),
  ownerId: z.string(),
  status: z.enum(["DRAFT", "OPEN"]),
  publishedAt: z.iso.datetime().nullable(),
  recruitmentEndAt: z.iso.datetime().nullable(),
});
export const campaignStateSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  items: z.array(campaignSchema),
});
export type Campaign = z.infer<typeof campaignSchema>;
export type CampaignState = z.infer<typeof campaignStateSchema>;
export const campaignCommandSchema = z.strictObject({
  type: z.enum(["save", "publish"]),
  id: z.string().uuid(),
  values: campaignValuesSchema,
});
export type CampaignCommand = z.infer<typeof campaignCommandSchema>;
export const campaignEnvelope = z.strictObject({
  revision: z.number().int().nonnegative(),
  command: campaignCommandSchema,
});
export const emptyCampaignState = (): CampaignState => ({
  revision: 0,
  items: [],
});
export function campaignProblems(values: CampaignValues) {
  const problems = campaignFields
    .filter(([key]) => key !== "references" && !values[key].trim())
    .map(([, label]) => `${label}을 입력해 주세요.`);
  if (
    values.budget.trim() &&
    (!/^\d+$/.test(values.budget.trim()) ||
      !Number.isSafeInteger(Number(values.budget)) ||
      Number(values.budget) < 1)
  )
    problems.push(
      "예산은 안전한 범위의 양의 정수로 입력해 주세요. (D04 모의 기준)",
    );
  return problems;
}
export function campaignDeadline(now: Date, days: CampaignValues["days"]) {
  return new Date(
    now.getTime() + Number(days) * 24 * 60 * 60 * 1000,
  ).toISOString();
}
export function campaignTime(value: string) {
  return `${new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value))} (한국 시간)`;
}
export class CampaignConflict extends Error {}
export function applyCampaign(
  state: CampaignState,
  raw: unknown,
  owner: { id: string; role: string; status: string },
  now = new Date(),
): CampaignState {
  if (owner.role !== "CLIENT" || owner.status !== "ACTIVE")
    throw new Error("활성 의뢰인 본인만 저장·공개할 수 있어요.");
  const { command, revision } = campaignEnvelope.parse(raw);
  const item = state.items.find((candidate) => candidate.id === command.id);
  if (item && item.ownerId !== owner.id)
    throw new Error("본인 캠페인이 아니에요.");
  // Idempotent publish: neither content nor the first deadline may be reset.
  if (item?.status === "OPEN" && command.type === "publish") return state;
  if (item?.status === "OPEN") throw new Error("공개 후 수정은 후속 범위예요.");
  if (revision !== state.revision)
    throw new CampaignConflict("최신 값 확인 후 다시 저장해 주세요.");
  if (command.type === "publish") {
    const problems = campaignProblems(command.values);
    if (problems.length) throw new Error(problems.join(" "));
  }
  const published = command.type === "publish";
  const next: Campaign = {
    ...command.values,
    id: command.id,
    ownerId: owner.id,
    status: published ? "OPEN" : "DRAFT",
    publishedAt: published ? now.toISOString() : null,
    recruitmentEndAt: published
      ? campaignDeadline(now, command.values.days)
      : null,
  };
  return {
    revision: state.revision + 1,
    items: [
      ...state.items.filter((candidate) => candidate.id !== command.id),
      next,
    ],
  };
}
export function publicCampaigns(state: CampaignState) {
  return state.items.filter((item) => item.status === "OPEN");
}
