import { z } from "zod";
import { ProposalError } from "./proposal-model";

const text = z.string().trim().min(1).max(1000);
export const readinessKeys = ["product", "file", "info"] as const;
const keySchema = z.enum(readinessKeys);
export const preparationSchema = z.strictObject({
  days: z.number().int().min(1).max(365),
  product: z.boolean(),
  file: z.boolean(),
  info: z.boolean(),
});
export const productionCommandSchema = z.strictObject({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  action: z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("plan"), plan: preparationSchema }),
    z.strictObject({ type: z.literal("agree-plan") }),
    z.strictObject({
      type: z.literal("supply"),
      key: keySchema,
      value: text,
      shippedOn: z.iso.date().optional(),
      tracking: z.string().trim().max(100).optional(),
    }),
    z.strictObject({
      type: z.literal("check"),
      key: keySchema,
      ready: z.boolean(),
      reason: text,
    }),
    z.strictObject({
      type: z.literal("propose"),
      due: z.iso.datetime(),
      reason: text,
    }),
    z.strictObject({
      type: z.literal("respond"),
      changeId: z.string().uuid(),
      accept: z.boolean(),
    }),
  ]),
});
export type ProductionCommand = z.infer<typeof productionCommandSchema>;
export type Preparation = z.infer<typeof preparationSchema>;
const requirementSchema = z.strictObject({
  value: z.string(),
  shippedOn: z.string(),
  tracking: z.string(),
  ready: z.boolean(),
});
export const productionStateSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  plan: preparationSchema.nullable(),
  agreed: z.boolean(),
  requirements: z.strictObject({
    product: requirementSchema,
    file: requirementSchema,
    info: requirementSchema,
  }),
  startedAt: z.iso.datetime().nullable(),
  originalDue: z.iso.datetime().nullable(),
  due: z.iso.datetime().nullable(),
  changes: z.array(
    z.strictObject({
      id: z.string().uuid(),
      authorId: z.string(),
      before: z.iso.datetime(),
      due: z.iso.datetime(),
      reason: text,
      status: z.enum(["PENDING", "ACCEPTED", "REJECTED"]),
    }),
  ),
  history: z.array(
    z.strictObject({
      id: z.string().uuid(),
      actorId: z.string(),
      at: z.iso.datetime(),
      message: z.string(),
    }),
  ),
  receipts: z.array(
    z.strictObject({
      id: z.string().uuid(),
      actorId: z.string(),
      fingerprint: z.string(),
    }),
  ),
});
export type ProductionState = z.infer<typeof productionStateSchema>;
export const productionViewSchema = z.strictObject({
  contractId: z.string().uuid(),
  requestId: z.string().uuid(),
  clientId: z.string(),
  creatorId: z.string(),
  paid: z.boolean(),
  now: z.iso.datetime(),
  terms: z.strictObject({ materials: z.string(), deadline: z.string() }),
  state: productionStateSchema,
});
export function emptyProduction(): ProductionState {
  const requirement = () => ({
    value: "",
    shippedOn: "",
    tracking: "",
    ready: false,
  });
  return {
    revision: 0,
    plan: null,
    agreed: false,
    requirements: {
      product: requirement(),
      file: requirement(),
      info: requirement(),
    },
    startedAt: null,
    originalDue: null,
    due: null,
    changes: [],
    history: [],
    receipts: [],
  };
}
export const allPrepared = (state: ProductionState) =>
  Boolean(
    state.plan &&
    state.agreed &&
    readinessKeys.every(
      (key) => !state.plan?.[key] || state.requirements[key].ready,
    ),
  );

export function changeProduction(
  state: ProductionState,
  raw: ProductionCommand,
  actor: { id: string; side: "client" | "creator" },
  paid: boolean,
  now: string,
): ProductionState {
  const cmd = productionCommandSchema.parse(raw);
  const fingerprint = JSON.stringify(cmd);
  const receipt = state.receipts.find((r) => r.id === cmd.id);
  if (receipt) {
    if (receipt.actorId !== actor.id || receipt.fingerprint !== fingerprint)
      throw new ProposalError("요청 식별자 충돌");
    return state;
  }
  if (cmd.revision !== state.revision)
    throw new ProposalError("최신 준비 상태를 재조회해 주세요.");
  if (!paid) throw new ProposalError("확정된 전액 결제가 필요해요.");
  const next = structuredClone(state);
  const a = cmd.action;
  const client = actor.side === "client";
  let message = "";
  if (a.type === "plan") {
    if (!client || next.agreed || next.startedAt)
      throw new ProposalError("준비 조건 변경 불가", 403);
    next.plan = a.plan;
    message = `구조화 Mock 준비 조건 제안: ${JSON.stringify(a.plan)}`;
  } else if (a.type === "agree-plan") {
    if (client || !next.plan || next.agreed)
      throw new ProposalError("상대방의 준비 조건 확인 필요", 403);
    next.agreed = true;
    message = "구조화 Mock 준비 조건 양측 확인";
  } else if (a.type === "supply") {
    if (!client || !next.agreed || !next.plan?.[a.key])
      throw new ProposalError("제공 권한/필수 조건 확인", 403);
    const koreaDate = new Date(Date.parse(now) + 9 * 3600000)
      .toISOString()
      .slice(0, 10);
    if (a.key === "product" && (!a.shippedOn || a.shippedOn > koreaDate))
      throw new ProposalError("발송일을 확인해 주세요.", 400);
    next.requirements[a.key] = {
      value: a.value,
      shippedOn: a.shippedOn ?? "",
      tracking: a.tracking ?? "",
      ready: false,
    };
    message = `${a.key} 제공·정정 사유/발송 기록: ${a.value} · ${a.shippedOn ?? ""} · ${a.tracking ?? ""} (정상 확인 필요)`;
  } else if (a.type === "check") {
    if (
      client ||
      !next.agreed ||
      !next.plan?.[a.key] ||
      !next.requirements[a.key].value
    )
      throw new ProposalError("제공 후 크리에이터 확인 필요", 403);
    next.requirements[a.key].ready = a.ready;
    message = `${a.key} ${a.ready ? "정상 준비 확인" : "문제·누락 보류"}: ${a.reason}`;
  } else if (a.type === "propose") {
    if (
      !next.startedAt ||
      !next.due ||
      next.changes.some((c) => c.status === "PENDING") ||
      Date.parse(a.due) <= Date.parse(now) ||
      Date.parse(a.due) === Date.parse(next.due)
    )
      throw new ProposalError(
        "유효한 새 납기와 기존 요청 상태를 확인해 주세요.",
      );
    next.changes.push({
      id: cmd.id,
      authorId: actor.id,
      before: next.due,
      due: a.due,
      reason: a.reason,
      status: "PENDING",
    });
    message = `납기 변경 요청: ${a.reason}`;
  } else {
    const change = next.changes.find((c) => c.id === a.changeId);
    if (
      !change ||
      change.authorId === actor.id ||
      change.status !== "PENDING" ||
      change.before !== next.due ||
      (a.accept && Date.parse(change.due) <= Date.parse(now))
    )
      throw new ProposalError("상대 요청의 최신 버전만 응답할 수 있어요.");
    change.status = a.accept ? "ACCEPTED" : "REJECTED";
    if (a.accept) next.due = change.due;
    message = `납기 변경 ${a.accept ? "양측 합의 반영" : "거절·기존 납기 유지"}`;
  }
  if (!next.startedAt && allPrepared(next)) {
    next.startedAt = now;
    // D09 unresolved: explicitly labeled development example, never a production policy.
    next.due = new Date(
      Date.parse(now) + (next.plan?.days ?? 0) * 86400000,
    ).toISOString();
    next.originalDue = next.due;
    message += " · 모의 제작 시작 1회";
  }
  next.revision += 1;
  next.history.push({ id: cmd.id, actorId: actor.id, at: now, message });
  next.receipts.push({ id: cmd.id, actorId: actor.id, fingerprint });
  return next;
}
