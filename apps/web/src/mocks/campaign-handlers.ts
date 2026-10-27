import { z } from "zod";
import { http, HttpResponse, delay } from "msw";
import { mockAccountLimited } from "./safety-store";
import {
  browseCampaigns,
  closeCampaign,
  discoveryFixtures,
  projectPublic,
} from "./discovery-model";
import { readMockUser } from "./auth-handlers";
import { session } from "../app/session";
import {
  applyCampaign,
  campaignEnvelope,
  CampaignConflict,
  emptyCampaignState,
  type CampaignState,
} from "./campaign-model";

const states = new Map<string, CampaignState>();
const fail = (status: number, message: string) =>
  HttpResponse.json({ message }, { status });
let scenario = "success";
let discoveryScenario = "success";
const fixtures = discoveryFixtures();
export const allCampaigns = () => [
  ...fixtures,
  ...Array.from(states.values()).flatMap((state) => state.items),
];
export function endMockCampaign(id: string, userId: string) {
  const state = states.get(userId);
  if (!state) throw new Error("본인 공고를 찾을 수 없어요.");
  states.set(userId, {
    revision: state.revision + 1,
    items: state.items.map((item) =>
      item.id === id
        ? {
            ...item,
            status: "CLOSED",
            closedAt: item.closedAt ?? new Date().toISOString(),
          }
        : item,
    ),
  });
}
async function discoveryFailure() {
  const selected = discoveryScenario;
  await delay(selected === "delay" ? 1500 : 80);
  if (selected === "network") return HttpResponse.error();
  if (["401", "403", "404", "409", "500"].includes(selected))
    return fail(Number(selected), "모의 조회 실패");
  if (selected === "malformed") return HttpResponse.json({ invalid: true });
  return undefined;
}
function owner(request: Request) {
  const user = readMockUser();
  return user &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/discovery/scenario", async ({ request }) => {
    discoveryScenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/__mock__/discovery", async ({ request }) => {
    const failure = await discoveryFailure();
    if (failure) return failure;
    try {
      return HttpResponse.json(
        browseCampaigns(
          allCampaigns(),
          Object.fromEntries(new URL(request.url).searchParams),
        ),
      );
    } catch {
      return fail(400, "검색 조건을 확인해 주세요.");
    }
  }),
  http.get("/__mock__/discovery/:id", async ({ request, params }) => {
    const failure = await discoveryFailure();
    if (failure) return failure;
    const item = allCampaigns().find((candidate) => candidate.id === params.id);
    const projected = item && projectPublic(item);
    if (!projected) return fail(404, "공개 공고를 찾을 수 없어요.");
    const user = owner(request);
    return HttpResponse.json({
      item: projected,
      revision:
        user?.id === item.ownerId
          ? (states.get(user.id)?.revision ?? null)
          : null,
    });
  }),
  http.post("/__mock__/discovery/:id/close", async ({ request, params }) => {
    const user = owner(request);
    const epoch = session.epoch();
    if (!user) return fail(401, "로그인이 필요해요.");
    if (user.role !== "CLIENT" || user.status !== "ACTIVE")
      return fail(403, "활성 의뢰인만 마감할 수 있어요.");
    const raw: unknown = await request.json();
    const selected = discoveryScenario;
    const failure = await discoveryFailure();
    if (failure) return failure;
    if (
      epoch !== session.epoch() ||
      owner(request)?.id !== user.id ||
      owner(request)?.status !== "ACTIVE"
    )
      return fail(401, "계정이 바뀌었어요.");
    const parsed = z
      .strictObject({ revision: z.number().int().nonnegative() })
      .safeParse(raw);
    const state = states.get(user.id);
    const item = state?.items.find(
      (candidate) =>
        candidate.id === params.id && candidate.ownerId === user.id,
    );
    if (!item || !state || item.status === "DRAFT")
      return fail(404, "본인 공개 공고를 찾을 수 없어요.");
    if (!parsed.success) return fail(400, "형식을 확인해 주세요.");
    try {
      const next = closeCampaign(state, item.id, parsed.data.revision, user);
      states.set(user.id, next);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({
        item: projectPublic(
          next.items.find((candidate) => candidate.id === item.id) ?? item,
        ),
        revision: next.revision,
      });
    } catch (error) {
      return fail(
        error instanceof CampaignConflict ? 409 : 400,
        "최신 상태를 확인해 주세요.",
      );
    }
  }),
  http.post("/__mock__/campaigns/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/campaigns", async ({ request }) => {
    const user = owner(request);
    if (!user) return fail(401, "로그인이 필요해요.");
    if (user.role !== "CLIENT" || user.status !== "ACTIVE")
      return fail(403, "활성 의뢰인만 관리할 수 있어요.");
    const selected = scenario;
    const epoch = session.epoch();
    const raw: unknown =
      request.method === "POST" ? await request.json() : null;
    await delay(selected === "delay" ? 1500 : 80);
    if (
      epoch !== session.epoch() ||
      owner(request)?.id !== user.id ||
      owner(request)?.status !== "ACTIVE"
    )
      return fail(401, "계정이 바뀌었어요.");
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "409", "500"].includes(selected))
      return fail(Number(selected), "모의 요청 실패예요.");
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const state = states.get(user.id) ?? emptyCampaignState();
    if (request.method === "GET") return HttpResponse.json(state);
    if (request.method !== "POST")
      return fail(405, "지원하지 않는 동작이에요.");
    const parsed = campaignEnvelope.safeParse(raw);
    if (!parsed.success) return fail(400, "입력 형식을 확인해 주세요.");
    if (
      parsed.data.command.type === "publish" &&
      mockAccountLimited(user.id) &&
      !state.items.some(
        (c) => c.id === parsed.data.command.id && c.status === "OPEN",
      )
    )
      return fail(
        403,
        "개발용 제한 중 신규 공개를 보류해요. 기존 거래·이의는 이용 안내에서 확인해 주세요.",
      );
    try {
      const next = applyCampaign(state, parsed.data, user);
      states.set(user.id, next);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json(next);
    } catch (error) {
      return fail(
        error instanceof CampaignConflict ? 409 : 400,
        error instanceof Error ? error.message : "모의 저장 실패",
      );
    }
  }),
];
