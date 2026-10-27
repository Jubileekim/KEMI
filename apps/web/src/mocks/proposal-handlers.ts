import { http, HttpResponse, delay } from "msw";
import { mockAccountLimited } from "./safety-store";
import { recordMockEvent } from "../shared/analytics/events";
import { readMockUser, readMockDisplayName } from "./auth-handlers";
import { allCampaigns, endMockCampaign } from "./campaign-handlers";
import { readMockStudio } from "./studio-handlers";
import { session } from "../app/session";
import { selectContract } from "./signature-model";
import {
  changeProposals,
  emptyProposals,
  hasRoom,
  participant,
  ProposalError,
  proposalCommandSchema,
  unreadCount,
} from "./proposal-model";

let state = emptyProposals();
export const readMockProposals = () => state;
export const writeMockProposals = (next: typeof state) => {
  state = next;
};
export const readMockProposal = (id: string) =>
  state.items.find((item) => item.id === id);
export function confirmMockContract(id: string) {
  const next = selectContract(state, id);
  if (next === state) return;
  const winner = next.items.find((item) => item.id === id);
  if (!winner) throw new ProposalError("협의가 없어요.", 404);
  if (winner.campaignId) endMockCampaign(winner.campaignId, winner.clientId);
  state = next;
}
let scenario = "success";
const fail = (status: number, message: string) =>
  HttpResponse.json({ message }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/proposals/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/proposals", async ({ request }) => {
    const user = actor(request);
    const epoch = session.epoch();
    if (!user) return fail(401, "활성 계정으로 로그인해 주세요.");
    const selected = scenario;
    let raw: unknown;
    try {
      raw = request.method === "POST" ? await request.json() : null;
    } catch {
      return fail(400, "입력을 확인해 주세요.");
    }
    await delay(selected === "delay" ? 1500 : 80);
    if (epoch !== session.epoch() || actor(request)?.id !== user.id)
      return fail(401, "계정이 바뀌었어요.");
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "404", "409", "500"].includes(selected))
      return fail(Number(selected), "모의 요청 실패");
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const params = new URL(request.url).searchParams;
    if (request.method === "GET") {
      const campaignId = params.get("campaignId");
      const roomId = params.get("roomId");
      const campaigns = allCampaigns();
      const campaign = campaigns.find(
        (item) => item.id === campaignId && item.status !== "DRAFT",
      );
      if (
        campaignId &&
        (!campaign || (user.role === "CLIENT" && campaign.ownerId !== user.id))
      )
        return fail(404, "본인 공개 공고를 찾을 수 없어요.");
      const own = state.items.filter((item) => participant(item, user));
      const room = own.find((item) => item.id === roomId && hasRoom(item));
      if (roomId && !room) return fail(404, "본인 협의방을 찾을 수 없어요.");
      const studio = readMockStudio(user.id);
      return HttpResponse.json({
        items: own
          .filter(
            (item) =>
              (!campaignId || item.campaignId === campaignId) &&
              (!roomId || item.id === roomId),
          )
          .map((item) => ({
            ...item,
            clientName: readMockDisplayName(item.clientId),
            unread: unreadCount(state, item, user),
            lastMessage: hasRoom(item)
              ? (state.messages[item.id]?.at(-1)?.text ?? "")
              : "",
          })),
        messages: room ? (state.messages[room.id] ?? []) : [],
        campaign: campaign
          ? {
              id: campaign.id,
              title: campaign.title,
              ended: state.ended.includes(campaign.id),
            }
          : null,
        servicePublic: studio.service === "PUBLIC",
        works:
          user.role === "CREATOR"
            ? studio.works
                .filter((work) => work.visibility === "PUBLIC")
                .map((work) => ({ id: work.id, title: work.title }))
            : [],
      });
    }
    if (request.method !== "POST")
      return fail(405, "지원하지 않는 동작이에요.");
    const parsed = proposalCommandSchema.safeParse(raw);
    if (!parsed.success) return fail(400, "입력 형식을 확인해 주세요.");
    const command = parsed.data;
    if (
      command.type === "submit" &&
      !state.items.some((p) => p.id === command.id) &&
      (mockAccountLimited(user.id) ||
        mockAccountLimited(
          allCampaigns().find(
            (c) => command.type === "submit" && c.id === command.campaignId,
          )?.ownerId ?? "",
        ))
    )
      return fail(
        403,
        "개발용 제한 중 신규 제안을 보류해요. 기존 거래·이의는 유지돼요.",
      );
    try {
      const next = changeProposals(
        state,
        command,
        user,
        allCampaigns(),
        readMockStudio(user.id),
      );
      if (command.type === "end" && next !== state)
        endMockCampaign(command.campaignId, user.id);
      state = next;
      if (command.type === "submit")
        recordMockEvent("request_sent", command.id);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    } catch (error) {
      return fail(
        error instanceof ProposalError ? error.status : 400,
        error instanceof Error ? error.message : "모의 요청 실패",
      );
    }
  }),
];
