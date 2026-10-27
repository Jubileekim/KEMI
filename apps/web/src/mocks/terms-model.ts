import { z } from "zod";
import type { AuthUser } from "@kemi/shared";
import type { Proposal } from "./proposal-model";
import { participant, hasRoom, ProposalError } from "./proposal-model";
import type { Campaign } from "./campaign-model";
import { packageItemSchema, type StudioState } from "./studio-model";

// Local Mock input protection only; D08 and real API contracts remain open.
export const termsFields = {
  amount: "최종 금액 (원)",
  specification: "규격·수량",
  scope: "포함·제외 작업 범위",
  materials: "필요 자료·제공 조건",
  deadline: "납기·작업 기간 기준",
  revisions: "수정 횟수·범위",
  usage: "사용권·원본 제공 조건",
  cancellation: "취소 조건",
} as const;
const text = z.string().trim().max(4000);
export const termsValuesSchema = z.strictObject({
  amount: text.refine(
    (v) => !v || (/^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v))),
    "금액은 안전한 범위의 양의 정수로 입력해 주세요.",
  ),
  specification: text,
  scope: text,
  materials: text,
  deadline: text,
  revisions: text,
  usage: text,
  cancellation: text,
});
export type TermsValues = z.infer<typeof termsValuesSchema>;
export const emptyTerms: TermsValues = {
  amount: "",
  specification: "",
  scope: "",
  materials: "",
  deadline: "",
  revisions: "",
  usage: "",
  cancellation: "",
};
export const termsSourcesSchema = z.strictObject({
  campaign: z
    .strictObject({
      id: z.string(),
      title: text,
      product: text,
      scope: text,
      budget: text,
    })
    .nullable(),
  proposal: z.strictObject({
    id: z.string(),
    direction: text,
    quote: text,
    days: text,
  }),
  package: packageItemSchema.nullable(),
});
export type TermsSources = z.infer<typeof termsSourcesSchema>;
export const termsVersionSchema = z.strictObject({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  authorId: z.string(),
  createdAt: z.iso.datetime(),
  values: termsValuesSchema,
});
export type TermsVersion = z.infer<typeof termsVersionSchema>;
export const termsDocumentSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  sources: termsSourcesSchema,
  versions: z.array(termsVersionSchema),
});
export type TermsDocument = z.infer<typeof termsDocumentSchema>;
export const termsCommandSchema = z.strictObject({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  sources: termsSourcesSchema,
  values: termsValuesSchema,
});
export type TermsCommand = z.infer<typeof termsCommandSchema>;
export function referenceSources(
  item: Proposal,
  campaign: Campaign | null,
  studio: StudioState,
): TermsSources {
  return termsSourcesSchema.parse({
    campaign: campaign
      ? {
          id: campaign.id,
          title: campaign.title,
          product: campaign.product,
          scope: campaign.scope,
          budget: campaign.budget,
        }
      : null,
    proposal: {
      id: item.id,
      direction: item.direction,
      quote: item.quote,
      days: item.days,
    },
    package:
      item.direct?.snapshot ??
      studio.packages.find(
        (p) => p.id === studio.primaryId && p.visibility === "PUBLIC",
      ) ??
      null,
  });
}
export const missingTerms = (values: TermsValues) =>
  Object.entries(termsFields)
    .filter(([key]) => !values[termsValuesSchema.keyof().parse(key)].trim())
    .map(([, label]) => label);
export const sameTerms = (a: TermsValues, b: TermsValues) =>
  Object.keys(termsFields).every(
    (key) =>
      a[termsValuesSchema.keyof().parse(key)] ===
      b[termsValuesSchema.keyof().parse(key)],
  );
export const canEditTerms = (item: Proposal, user: AuthUser) =>
  participant(item, user) &&
  hasRoom(item) &&
  item.status === "DISCUSSING" &&
  !item.contracted;

export function saveTerms(
  document: TermsDocument | undefined,
  raw: TermsCommand,
  user: AuthUser,
  item: Proposal,
  sources: TermsSources,
  now = new Date(),
): TermsDocument {
  const cmd = termsCommandSchema.parse(raw);
  if (!canEditTerms(item, user) || cmd.requestId !== item.id)
    throw new ProposalError("유효한 본인 협의에서만 작성할 수 있어요.", 403);
  const current = document ?? { revision: 0, sources, versions: [] };
  if (JSON.stringify(cmd.sources) !== JSON.stringify(current.sources))
    throw new ProposalError(
      "참조 정보가 바뀌었어요. 최신 상태를 다시 확인해 주세요.",
    );
  const prior = current.versions.find((v) => v.id === cmd.id);
  if (prior) {
    if (prior.authorId === user.id && sameTerms(prior.values, cmd.values))
      return current;
    throw new ProposalError("저장 식별자가 충돌해요.");
  }
  if (cmd.revision !== current.revision)
    throw new ProposalError(
      "다른 작성본이 저장됐어요. 최신 버전을 비교해 주세요.",
    );
  const latest = current.versions.at(-1);
  if (latest && sameTerms(latest.values, cmd.values)) return current;
  return {
    revision: current.revision + 1,
    sources: structuredClone(current.sources),
    versions: [
      ...current.versions,
      {
        id: cmd.id,
        number: current.revision + 1,
        authorId: user.id,
        createdAt: now.toISOString(),
        values: cmd.values,
      },
    ],
  };
}
