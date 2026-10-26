import { z } from "zod";
import type { AuthUser } from "@kemi/shared";
import { canEditTerms, missingTerms, type TermsDocument } from "./terms-model";
import {
  participant,
  ProposalError,
  type Proposal,
  type ProposalState,
} from "./proposal-model";

export const signatureRoundSchema = z.strictObject({
  versionId: z.string().uuid(),
  requestedBy: z.string(),
  requestedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  signatures: z.array(
    z.strictObject({
      userId: z.string(),
      name: z.string(),
      at: z.iso.datetime(),
    }),
  ),
  contractId: z.string().uuid().nullable(),
});
export type SignatureRound = z.infer<typeof signatureRoundSchema>;
export const signatureCommandSchema = z.strictObject({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  versionId: z.string().uuid(),
  type: z.enum(["request", "sign", "renew"]),
  name: z.string().trim().max(100),
  consent: z.boolean(),
});
export type SignatureCommand = z.infer<typeof signatureCommandSchema>;
export function roundStatus(
  round: SignatureRound,
  doc: TermsDocument,
  item: Proposal,
  now = Date.now(),
) {
  if (round.contractId) return "CONFIRMED";
  if (item.status !== "DISCUSSING" || item.contracted) return "CLOSED";
  if (doc.versions.at(-1)?.id !== round.versionId) return "SUPERSEDED";
  // D08 example: equality is expired, based on the Mock handler clock.
  if (now >= Date.parse(round.expiresAt)) return "EXPIRED";
  return "WAITING";
}
export function changeSignatures(
  rounds: SignatureRound[],
  doc: TermsDocument,
  item: Proposal,
  user: AuthUser,
  raw: SignatureCommand,
  now = new Date(),
) {
  const cmd = signatureCommandSchema.parse(raw);
  if (!participant(item, user) || cmd.requestId !== item.id)
    throw new ProposalError("본인 서명만 가능해요.", 403);
  const latest = doc.versions.at(-1);
  const round = rounds.find((r) => r.versionId === cmd.versionId);
  const prior = round?.signatures.find((s) => s.userId === user.id);
  // A confirmed duplicate is harmless; never creates another contract.
  if (
    cmd.type === "sign" &&
    round &&
    prior &&
    prior.name === cmd.name &&
    cmd.consent &&
    (round?.contractId ||
      roundStatus(round, doc, item, now.getTime()) === "WAITING")
  )
    return rounds;
  if (
    !canEditTerms(item, user) ||
    !latest ||
    latest.id !== cmd.versionId ||
    doc.revision !== cmd.revision
  )
    throw new ProposalError("최신 유효 조건서를 확인해 주세요.");
  if (cmd.type === "request") {
    if (round) {
      if (roundStatus(round, doc, item, now.getTime()) === "WAITING")
        return rounds;
      throw new ProposalError("새 확인 버전이 필요해요.");
    }
    if (missingTerms(latest.values).length)
      throw new ProposalError("필수 조건이 누락됐어요.", 400);
    return [
      ...rounds,
      {
        versionId: latest.id,
        requestedBy: user.id,
        requestedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 48 * 3600000).toISOString(),
        signatures: [],
        contractId: null,
      },
    ];
  }
  if (
    cmd.type !== "sign" ||
    !round ||
    roundStatus(round, doc, item, now.getTime()) !== "WAITING" ||
    !cmd.consent ||
    !cmd.name ||
    prior
  )
    throw new ProposalError("동의·서명 입력·버전·기한을 확인해 주세요.");
  return rounds.map((r) =>
    r !== round
      ? r
      : {
          ...r,
          signatures: [
            ...r.signatures,
            { userId: user.id, name: cmd.name, at: now.toISOString() },
          ],
          contractId: r.signatures.length === 1 ? cmd.id : null,
        },
  );
}

export function selectContract(
  state: ProposalState,
  id: string,
): ProposalState {
  const winner = state.items.find((p) => p.id === id);
  if (!winner) throw new ProposalError("협의가 없어요.", 404);
  if (
    state.items.some(
      (p) => p.campaignId === winner.campaignId && p.contracted && p.id !== id,
    )
  )
    throw new ProposalError("이미 다른 후보가 확정됐어요.");
  if (winner.contracted) return state;
  if (winner.status !== "DISCUSSING")
    throw new ProposalError("종료된 협의예요.");
  return {
    ...state,
    items: state.items.map((p) => {
      if (p.id === id)
        return { ...p, contracted: true, revision: p.revision + 1 };
      if (
        p.campaignId === winner.campaignId &&
        ["PENDING", "DISCUSSING"].includes(p.status)
      )
        return {
          ...p,
          status: "NOT_SELECTED",
          reason: "다른 후보와 양측 서명 완료",
          revision: p.revision + 1,
        };
      return p;
    }),
  };
}
