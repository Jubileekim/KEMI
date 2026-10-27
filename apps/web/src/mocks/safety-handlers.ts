import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { allCampaigns } from "./campaign-handlers";
import { readMockProposal } from "./proposal-handlers";
import { participant, ProposalError } from "./proposal-model";
import { projectPublic } from "./discovery-model";
import { changeSafety, safetyCommandSchema } from "./safety-model";
import {
  mockAccountLimited,
  readMockSafety,
  writeMockSafety,
} from "./safety-store";

let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "신고·운영 응답 확인 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
async function handle({ request }: { request: Request }) {
  const user = actor(request);
  const epoch = session.epoch();
  if (!user) return fail(401);
  const ops = new URL(request.url).pathname.endsWith("/operations");
  if (ops ? user.role !== "ADMIN" : !["CLIENT", "CREATOR"].includes(user.role))
    return fail(403);
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
  try {
    if (request.method === "POST") {
      const cmd = safetyCommandSchema.parse(raw);
      if (ops !== (cmd.type === "operate")) return fail(403);
      let subject: string | undefined;
      if (cmd.type === "report") {
        if (cmd.targetType === "campaign") {
          const item = allCampaigns().find((c) => c.id === cmd.targetId);
          if (!item || !projectPublic(item)) return fail(404);
          subject = item.ownerId;
        } else {
          const item = readMockProposal(cmd.targetId);
          if (!item || !participant(item, user)) return fail(404);
          subject = user.id === item.clientId ? item.creatorId : item.clientId;
        }
      }
      writeMockSafety(changeSafety(readMockSafety(), cmd, user, subject));
      if (selected === "lost-response") return HttpResponse.error();
    } else if (request.method !== "GET") return fail(405);
    return HttpResponse.json({
      reports: readMockSafety().filter((r) => ops || r.reporterId === user.id),
      limited: mockAccountLimited(user.id),
      restrictions: readMockSafety()
        .filter((r) => r.subjectId === user.id)
        .map((r) => ({
          reportId: r.id,
          limited: r.limited,
          history: r.history
            .filter((h) => h.action !== "RECEIVED")
            .map((h) => ({
              id: h.id,
              action: h.action,
              note: h.note,
              at: h.at,
            })),
        })),
    });
  } catch (error) {
    return fail(error instanceof ProposalError ? error.status : 400);
  }
}
export default [
  http.post("/__mock__/safety/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/safety/member", handle),
  http.all("/__mock__/safety/operations", handle),
];
