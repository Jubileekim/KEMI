import { z } from "zod";
import type { AuthUser } from "@kemi/shared";
import { ProposalError } from "./proposal-model";

const note = z.string().trim().min(1).max(2000);
const eventSchema = z.strictObject({
  id: z.string().uuid(),
  actorId: z.string(),
  action: z.enum(["RECEIVED", "REVIEW", "WARN", "LIMIT", "RELEASE", "APPEAL"]),
  note,
  at: z.iso.datetime(),
});
export const reportSchema = z.strictObject({
  id: z.string().uuid(),
  reporterId: z.string(),
  subjectId: z.string(),
  targetType: z.enum(["campaign", "request"]),
  targetId: z.string().uuid(),
  reason: note,
  evidence: z.string().trim().max(4000),
  status: z.enum(["RECEIVED", "REVIEWING", "RESOLVED"]),
  limited: z.boolean(),
  history: z.array(eventSchema),
});
export type SafetyReport = z.infer<typeof reportSchema>;
export const reportInputSchema = z.strictObject({
  type: z.literal("report"),
  id: z.string().uuid(),
  targetType: z.enum(["campaign", "request"]),
  targetId: z.string().uuid(),
  reason: note,
  evidence: z.string().trim().max(4000),
});
export const safetyCommandSchema = z.discriminatedUnion("type", [
  reportInputSchema,
  z.strictObject({
    type: z.literal("operate"),
    id: z.string().uuid(),
    reportId: z.string().uuid(),
    action: z.enum(["REVIEW", "WARN", "LIMIT", "RELEASE"]),
    note,
  }),
  z.strictObject({
    type: z.literal("appeal"),
    id: z.string().uuid(),
    reportId: z.string().uuid(),
    note,
  }),
]);
export function changeSafety(
  records: SafetyReport[],
  raw: unknown,
  actor: AuthUser,
  subjectId?: string,
) {
  const cmd = safetyCommandSchema.parse(raw);
  if (actor.status !== "ACTIVE")
    throw new ProposalError("계정을 확인해 주세요.", 403);
  if (cmd.type === "report") {
    if (
      !["CLIENT", "CREATOR"].includes(actor.role) ||
      !subjectId ||
      actor.id === subjectId
    )
      throw new ProposalError("신고 대상을 확인해 주세요.", 403);
    const prior = records.find((r) => r.id === cmd.id);
    if (prior) {
      if (
        prior.reporterId === actor.id &&
        prior.targetId === cmd.targetId &&
        prior.targetType === cmd.targetType &&
        prior.reason === cmd.reason &&
        prior.evidence === cmd.evidence
      )
        return records;
      throw new ProposalError("접수 식별이 충돌해요.");
    }
    if (records.some((r) => r.history.some((h) => h.id === cmd.id)))
      throw new ProposalError("접수 식별이 충돌해요.");
    return [
      ...records,
      {
        id: cmd.id,
        reporterId: actor.id,
        subjectId,
        targetType: cmd.targetType,
        targetId: cmd.targetId,
        reason: cmd.reason,
        evidence: cmd.evidence,
        status: "RECEIVED" as const,
        limited: false,
        history: [
          {
            id: cmd.id,
            actorId: actor.id,
            action: "RECEIVED" as const,
            note: "신고 접수 · 자동 제재 없음",
            at: new Date().toISOString(),
          },
        ],
      },
    ];
  }
  const record = records.find((r) => r.id === cmd.reportId);
  if (!record) throw new ProposalError("처리 대상을 확인해 주세요.", 404);
  const previous = records
    .flatMap((r) => r.history)
    .find((h) => h.id === cmd.id);
  if (previous) {
    // Command ids are globally unique. Note contains only the public rationale;
    // never expose/rely on an arbitrary browser-provided actor id.
    if (
      record.history.includes(previous) &&
      previous.actorId === actor.id &&
      previous.action === (cmd.type === "appeal" ? "APPEAL" : cmd.action) &&
      previous.note === cmd.note
    )
      return records;
    throw new ProposalError("처리 식별이 충돌해요.");
  }
  if (cmd.type === "operate" && actor.role !== "ADMIN")
    throw new ProposalError("운영 권한이 필요해요.", 403);
  if (
    cmd.type === "appeal" &&
    (record.subjectId !== actor.id || !record.limited)
  )
    throw new ProposalError("본인의 제한 안내에 이의를 남길 수 있어요.", 403);
  return records.map((r) => {
    if (r.id !== record.id) return r;
    const next = structuredClone(r);
    if (cmd.type === "operate") {
      next.status = cmd.action === "REVIEW" ? "REVIEWING" : "RESOLVED";
      if (cmd.action === "LIMIT") next.limited = true;
      if (cmd.action === "RELEASE") next.limited = false;
    }
    next.history.push({
      id: cmd.id,
      actorId: actor.id,
      action: cmd.type === "appeal" ? "APPEAL" : cmd.action,
      note: cmd.note,
      at: new Date().toISOString(),
    });
    return next;
  });
}
export const safetyViewSchema = z.strictObject({
  reports: z.array(reportSchema),
  limited: z.boolean(),
  restrictions: z.array(
    z.strictObject({
      reportId: z.string().uuid(),
      limited: z.boolean(),
      history: z.array(
        z.strictObject({
          id: z.string(),
          action: z.string(),
          note: z.string(),
          at: z.iso.datetime(),
        }),
      ),
    }),
  ),
});
