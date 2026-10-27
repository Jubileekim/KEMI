import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { allCampaigns } from "./campaign-handlers";
import { readMockProfile } from "./profile-handlers";
import { readMockProposals } from "./proposal-handlers";
import { participant, ProposalError } from "./proposal-model";
import { readMockSignatureRounds } from "./signature-handlers";
import { changeBookmarks, recommendCampaigns } from "./activity-model";
import { projectPublic, recruitmentStatus } from "./discovery-model";

const saved = new Map<string, string[]>();
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "활동 조회·저장 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    ["CLIENT", "CREATOR"].includes(user.role) &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/activity/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/activity", async ({ request }) => {
    const user = actor(request);
    const epoch = session.epoch();
    if (!user) return fail(401);
    const selected = scenario;
    let raw: unknown;
    try {
      raw = request.method === "POST" ? await request.json() : null;
    } catch {
      return fail(400);
    }
    await delay(selected === "delay" ? 1500 : 80);
    if (epoch !== session.epoch() || actor(request)?.id !== user.id)
      return fail(401);
    if (["403", "500"].includes(selected)) return fail(Number(selected));
    if (selected === "network") return HttpResponse.error();
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const campaigns = allCampaigns();
    try {
      if (request.method === "POST")
        saved.set(
          user.id,
          changeBookmarks(saved.get(user.id) ?? [], raw, user, campaigns),
        );
      else if (request.method !== "GET") return fail(405);
      if (selected === "lost-response" && request.method === "POST")
        return HttpResponse.error();
      const ids = user.role === "CREATOR" ? (saved.get(user.id) ?? []) : [];
      const profile = readMockProfile(user.id)?.profile;
      return HttpResponse.json({
        campaigns: campaigns
          .filter((c) => user.role === "CLIENT" && c.ownerId === user.id)
          .map((c) => ({
            id: c.id,
            title: c.title || "제목 없는 초안",
            status: recruitmentStatus(c),
          })),
        requests: readMockProposals()
          .items.filter((p) => participant(p, user))
          .map((p) => ({
            id: p.id,
            title: p.title,
            status: p.contracted ? "계약 확정" : p.status,
            contractIds: readMockSignatureRounds(p.id).flatMap((r) =>
              r.contractId ? [r.contractId] : [],
            ),
          })),
        savedIds: ids,
        bookmarks: ids.map((id) => {
          const item = campaigns.find((c) => c.id === id);
          return { id, item: item ? (projectPublic(item) ?? null) : null };
        }),
        recommendations: recommendCampaigns(
          campaigns,
          profile?.type === "CREATOR" ? profile.niche : null,
          ids,
        ),
      });
    } catch (error) {
      return fail(error instanceof ProposalError ? error.status : 400);
    }
  }),
];
