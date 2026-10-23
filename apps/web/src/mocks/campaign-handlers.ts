import { http, HttpResponse, delay } from "msw";
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
let scenario = "success";
function owner(request: Request) {
  const user = readMockUser();
  return user &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
const fail = (status: number, message: string) =>
  HttpResponse.json({ message }, { status });
export default [
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
