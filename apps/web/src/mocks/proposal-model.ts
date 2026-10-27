import { z } from "zod";
import type { AuthUser } from "@kemi/shared";
import type { Campaign } from "./campaign-model";
import type { StudioState } from "./studio-model";
import { recruitmentStatus } from "./discovery-model";
import { directMetadataSchema } from "./direct-contract";

// D06/D07 candidate limits. These are deliberately not shared API contracts.
const text = z.string().trim().min(1).max(4000);
export const proposalInputSchema = z.strictObject({
  direction: text,
  quote: z
    .string()
    .regex(/^[1-9]\d*$/)
    .refine((v) => Number.isSafeInteger(Number(v))),
  days: z
    .string()
    .regex(/^[1-9]\d*$/)
    .refine((v) => Number.isSafeInteger(Number(v))),
  workIds: z.array(z.string()).min(1).max(20),
});
export const proposalSchema = z.strictObject({
  id: z.string().uuid(),
  campaignId: z.string().nullable(),
  direct: directMetadataSchema.optional(),
  clientId: z.string(),
  creatorId: z.string(),
  creatorName: text,
  clientName: text,
  title: text,
  direction: text,
  quote: z.string(),
  days: z.string(),
  works: z.array(z.strictObject({ id: z.string(), title: text })),
  status: z.enum([
    "PENDING",
    "DISCUSSING",
    "DECLINED",
    "WITHDRAWN",
    "ENDED",
    "NOT_SELECTED",
  ]),
  reason: z.string(),
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  contracted: z.boolean(),
  roomCreated: z.boolean(),
});
export type Proposal = z.infer<typeof proposalSchema>;
export const messageSchema = z.strictObject({
  id: z.string().uuid(),
  senderId: z.string(),
  text,
  at: z.iso.datetime(),
});
export type Message = z.infer<typeof messageSchema>;
export const proposalCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("submit"),
    id: z.string().uuid(),
    campaignId: z.string(),
    values: proposalInputSchema,
  }),
  z.strictObject({
    type: z.enum(["discuss", "decline", "withdraw"]),
    id: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    reason: z.string().trim().max(4000),
  }),
  z.strictObject({
    type: z.literal("end"),
    campaignId: z.string(),
    reason: text,
  }),
  z.strictObject({
    type: z.literal("send"),
    id: z.string().uuid(),
    messageId: z.string().uuid(),
    text,
  }),
  z.strictObject({
    type: z.literal("read"),
    id: z.string().uuid(),
    through: z.string().uuid(),
  }),
]);
export type ProposalCommand = z.infer<typeof proposalCommandSchema>;
export interface ProposalState {
  items: Proposal[];
  messages: Record<string, Message[]>;
  reads: Record<string, Record<string, string>>;
  ended: string[];
}
export const emptyProposals = (): ProposalState => ({
  items: [],
  messages: {},
  reads: {},
  ended: [],
});
export function participant(item: Proposal, user: AuthUser) {
  return (
    user.status === "ACTIVE" &&
    ((user.role === "CLIENT" && item.clientId === user.id) ||
      (user.role === "CREATOR" && item.creatorId === user.id))
  );
}
export const hasRoom = (item: Proposal) => item.roomCreated;
export class ProposalError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
export function changeProposals(
  state: ProposalState,
  raw: ProposalCommand,
  user: AuthUser,
  campaigns: Campaign[],
  studio: StudioState,
  now = new Date(),
): ProposalState {
  const cmd = proposalCommandSchema.parse(raw);
  if (user.status !== "ACTIVE")
    throw new ProposalError("활성 계정이 필요해요.", 403);
  if (cmd.type === "submit") {
    if (user.role !== "CREATOR" || studio.service !== "PUBLIC")
      throw new ProposalError(
        "공개 서비스의 크리에이터만 제출할 수 있어요.",
        403,
      );
    const campaign = campaigns.find((item) => item.id === cmd.campaignId);
    if (
      !campaign ||
      campaign.ownerId === user.id ||
      state.ended.includes(campaign.id) ||
      state.items.some(
        (item) => item.campaignId === campaign.id && item.contracted,
      ) ||
      recruitmentStatus(campaign, now.getTime()) !== "OPEN"
    )
      throw new ProposalError("모집 마감·본인 공고·공개 상태를 확인해 주세요.");
    const prior = state.items.find((item) => item.id === cmd.id);
    if (prior) {
      if (
        prior.creatorId === user.id &&
        prior.campaignId === cmd.campaignId &&
        prior.direction === cmd.values.direction &&
        prior.quote === cmd.values.quote &&
        prior.days === cmd.values.days &&
        prior.works.map((w) => w.id).join() ===
          [...new Set(cmd.values.workIds)].join()
      )
        return state;
      throw new ProposalError("제출 식별자가 충돌해요.");
    }
    if (
      state.items.some(
        (item) => item.campaignId === campaign.id && item.creatorId === user.id,
      )
    )
      throw new ProposalError(
        "이미 제출한 제안이 있어요. 종료 후 재지원은 D06 결정 대기예요.",
      );
    const works = [...new Set(cmd.values.workIds)].map((id) => {
      const work = studio.works.find(
        (item) => item.id === id && item.visibility === "PUBLIC",
      );
      if (!work)
        throw new ProposalError("본인의 공개 작업물만 연결해 주세요.", 403);
      return { id: work.id, title: work.title };
    });
    return {
      ...state,
      items: [
        ...state.items,
        {
          id: cmd.id,
          campaignId: campaign.id,
          clientId: campaign.ownerId,
          creatorId: user.id,
          creatorName: user.name,
          clientName: "공고 의뢰인",
          title: campaign.title,
          direction: cmd.values.direction,
          quote: cmd.values.quote,
          days: cmd.values.days,
          works,
          status: "PENDING",
          reason: "",
          revision: 0,
          createdAt: now.toISOString(),
          contracted: false,
          roomCreated: false,
        },
      ],
    };
  }
  if (cmd.type === "end") {
    const campaign = campaigns.find((item) => item.id === cmd.campaignId);
    if (
      user.role !== "CLIENT" ||
      !campaign ||
      campaign.ownerId !== user.id ||
      campaign.status === "DRAFT"
    )
      throw new ProposalError("본인 공개 공고만 종료할 수 있어요.", 403);
    if (
      state.items.some(
        (item) => item.campaignId === campaign.id && item.contracted,
      )
    )
      throw new ProposalError("확정 계약은 취소 절차를 이용해 주세요.");
    if (state.ended.includes(campaign.id)) return state;
    return {
      ...state,
      ended: [...state.ended, campaign.id],
      items: state.items.map((item) =>
        item.campaignId === campaign.id &&
        ["PENDING", "DISCUSSING"].includes(item.status)
          ? {
              ...item,
              status: "ENDED",
              reason: cmd.reason,
              revision: item.revision + 1,
            }
          : item,
      ),
    };
  }
  const item = state.items.find((candidate) => candidate.id === cmd.id);
  if (!item || !participant(item, user))
    throw new ProposalError("본인 의뢰를 찾을 수 없어요.", 404);
  if (cmd.type === "read" || cmd.type === "send") {
    if (!hasRoom(item)) throw new ProposalError("협의방이 없어요.", 404);
    const messages = state.messages[item.id] ?? [];
    if (cmd.type === "read") {
      if (!messages.some((message) => message.id === cmd.through))
        throw new ProposalError("읽음 대상이 없어요.");
      const old = state.reads[item.id]?.[user.id];
      const through = messages.findIndex(
        (message) => message.id === cmd.through,
      );
      if (messages.findIndex((message) => message.id === old) >= through)
        return state;
      return {
        ...state,
        reads: {
          ...state.reads,
          [item.id]: { ...state.reads[item.id], [user.id]: cmd.through },
        },
      };
    }
    if (item.status !== "DISCUSSING")
      throw new ProposalError("종료된 협의는 읽기 전용이에요.");
    const previous = messages.find((message) => message.id === cmd.messageId);
    if (previous) {
      if (previous.senderId === user.id && previous.text === cmd.text)
        return state;
      throw new ProposalError("메시지 식별자가 충돌해요.");
    }
    return {
      ...state,
      messages: {
        ...state.messages,
        [item.id]: [
          ...messages,
          {
            id: cmd.messageId,
            senderId: user.id,
            text: cmd.text,
            at: now.toISOString(),
          },
        ],
      },
    };
  }
  if (item.contracted)
    throw new ProposalError("확정 계약은 취소 절차를 이용해 주세요.");
  if (item.direct)
    throw new ProposalError("직접 의뢰 전용 응답을 이용해 주세요.");
  if (
    cmd.type === "discuss" &&
    user.role === "CLIENT" &&
    item.status === "DISCUSSING"
  )
    return state;
  if (item.revision !== cmd.revision)
    throw new ProposalError("상태가 바뀌었어요. 최신 값을 확인해 주세요.");
  if (
    cmd.type === "discuss"
      ? user.role !== "CLIENT" || item.status !== "PENDING"
      : !cmd.reason ||
        !["PENDING", "DISCUSSING"].includes(item.status) ||
        (cmd.type === "decline"
          ? user.role !== "CLIENT"
          : user.role !== "CREATOR")
  )
    throw new ProposalError("역할·진행 상태·종료 사유를 확인해 주세요.", 403);
  const status = (
    {
      discuss: "DISCUSSING",
      decline: "DECLINED",
      withdraw: "WITHDRAWN",
    } as const
  )[cmd.type];
  return {
    ...state,
    items: state.items.map((candidate) =>
      candidate.id === item.id
        ? {
            ...candidate,
            status,
            roomCreated: candidate.roomCreated || cmd.type === "discuss",
            reason: cmd.type === "discuss" ? "" : cmd.reason,
            revision: item.revision + 1,
          }
        : candidate,
    ),
  };
}
export function unreadCount(
  state: ProposalState,
  item: Proposal,
  user: AuthUser,
) {
  const messages = state.messages[item.id] ?? [];
  const index = messages.findIndex(
    (message) => message.id === state.reads[item.id]?.[user.id],
  );
  return messages
    .slice(index + 1)
    .filter((message) => message.senderId !== user.id).length;
}
export const proposalLabels = {
  PENDING: "제안 제출",
  DISCUSSING: "협의 중 · 선정 아님",
  DECLINED: "의뢰인 거절",
  WITHDRAWN: "제작자 철회",
  ENDED: "무선정 종료",
  NOT_SELECTED: "미선정",
};
