import type { AuthUser } from "@kemi/shared";
import type { z } from "zod";
import { ProposalError, type ProposalState } from "./proposal-model";
import { directSendSchema, type DirectSend } from "./direct-contract";
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
