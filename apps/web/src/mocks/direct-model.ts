import type { AuthUser } from "@kemi/shared";
import type { z } from "zod";
import {
  participant,
  ProposalError,
  type ProposalState,
} from "./proposal-model";
import {
  directSendSchema,
  directResponseSchema,
  type DirectSend,
  type DirectResponse,
} from "./direct-contract";
import type { catalogCreatorSchema } from "./catalog-model";
import { packageItemSchema } from "./studio-model";

export default function sendDirect(
  state: ProposalState,
  raw: DirectSend,
  user: AuthUser,
  creator: z.infer<typeof catalogCreatorSchema> | null,
  now = new Date(),
): ProposalState {
  const cmd = directSendSchema.parse(raw);
  if (
    user.role !== "CLIENT" ||
    user.status !== "ACTIVE" ||
    user.id === cmd.creatorId
  )
    throw new ProposalError("의뢰인 계정으로 상대방에게 발송해 주세요.", 403);
  const prior = state.items.find((p) => p.id === cmd.id);
  if (prior) {
    if (
      prior.clientId === user.id &&
      prior.creatorId === cmd.creatorId &&
      prior.direct &&
      prior.direct.snapshot.id === cmd.packageId &&
      prior.title === cmd.values.title &&
      prior.direction === cmd.values.brief &&
      prior.direct.conditions === cmd.values.conditions &&
      JSON.stringify(prior.direct.snapshot) === JSON.stringify(cmd.snapshot)
    )
      return state;
    throw new ProposalError("발송 식별자가 충돌해요.");
  }
  const pack = creator?.packages.find((p) => p.id === cmd.packageId);
  if (
    !creator ||
    creator.id !== cmd.creatorId ||
    !pack ||
    pack.visibility !== "PUBLIC" ||
    pack.id !== cmd.snapshot.id
  )
    throw new ProposalError(
      "공개 서비스와 해당 제작자의 공개 패키지를 확인해 주세요.",
      404,
    );
  const snapshot = packageItemSchema.parse(pack);
  if (JSON.stringify(snapshot) !== JSON.stringify(cmd.snapshot))
    throw new ProposalError("패키지가 변경됐어요. 최신 내용을 검토해 주세요.");
  return {
    ...state,
    items: [
      ...state.items,
      {
        id: cmd.id,
        campaignId: null,
        clientId: user.id,
        creatorId: creator.id,
        creatorName: creator.name,
        clientName: user.name,
        title: cmd.values.title,
        direction: cmd.values.brief,
        quote: pack.price,
        days: pack.days,
        works: [],
        status: "PENDING",
        reason: "",
        revision: 0,
        createdAt: now.toISOString(),
        contracted: false,
        roomCreated: false,
        direct: {
          snapshot: structuredClone(snapshot),
          conditions: cmd.values.conditions,
          respondDueAt: new Date(now.getTime() + 48 * 3600000).toISOString(),
        },
      },
    ],
  };
}

export function expireDirect(
  state: ProposalState,
  now = Date.now(),
): ProposalState {
  let changed = false;
  const items = state.items.map((p) => {
    if (
      !p.direct ||
      p.status !== "PENDING" ||
      now < Date.parse(p.direct.respondDueAt)
    )
      return p;
    changed = true;
    return {
      ...p,
      status: "EXPIRED" as const,
      reason: "최초 응답 48시간 경과",
      revision: p.revision + 1,
    };
  });
  return changed ? { ...state, items } : state;
}

export function respondDirect(
  state: ProposalState,
  raw: DirectResponse,
  user: AuthUser,
  now = new Date(),
): ProposalState {
  const cmd = directResponseSchema.parse(raw);
  const item = state.items.find((p) => p.id === cmd.id);
  if (!item?.direct || !participant(item, user) || user.role !== "CREATOR")
    throw new ProposalError("본인 수신 의뢰에만 응답할 수 있어요.", 404);
  const { direct } = item;
  if (
    (cmd.action === "accept" && item.status === "DISCUSSING") ||
    (cmd.action === "decline" &&
      item.status === "DECLINED" &&
      item.reason === cmd.reason)
  )
    return state;
  if (
    item.status !== "PENDING" ||
    item.revision !== cmd.revision ||
    now.getTime() >= Date.parse(item.direct.respondDueAt)
  )
    throw new ProposalError("응답 기한·최신 상태를 확인해 주세요.");
  return {
    ...state,
    items: state.items.map((p) =>
      p.id === item.id
        ? {
            ...p,
            status: cmd.action === "accept" ? "DISCUSSING" : "DECLINED",
            roomCreated: cmd.action === "accept",
            reason: cmd.action === "decline" ? cmd.reason : "",
            revision: p.revision + 1,
            direct: { ...direct, respondedAt: now.toISOString() },
          }
        : p,
    ),
  };
}
