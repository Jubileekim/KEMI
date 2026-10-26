import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { allCampaigns } from "./campaign-handlers";
import { readMockStudio } from "./studio-handlers";
import { readMockProposal } from "./proposal-handlers";
import { hasRoom, participant, ProposalError } from "./proposal-model";
import {
  canEditTerms,
  referenceSources,
  saveTerms,
  termsCommandSchema,
  type TermsDocument,
} from "./terms-model";

const documents = new Map<string, TermsDocument>();
export const readMockTerms = (id: string) => documents.get(id);
export function renewMockTerms(
  id: string,
  versionId: string,
  revision: number,
  commandId: string,
  authorId: string,
) {
  const doc = documents.get(id);
  if (!doc) throw new ProposalError("작성본이 없어요.");
  const prior = doc.versions.find((v) => v.id === commandId);
  if (prior) {
    if (
      prior.authorId === authorId &&
      prior.number === revision + 1 &&
      doc.versions.find((v) => v.number === revision)?.id === versionId
    )
      return;
    throw new ProposalError("확인 버전 식별자가 충돌해요.");
  }
  const latest = doc.versions.at(-1);
  if (!latest || latest.id !== versionId || doc.revision !== revision)
    throw new ProposalError("최신 버전을 확인해 주세요.");
  documents.set(id, {
    ...doc,
    revision: doc.revision + 1,
    versions: [
      ...doc.versions,
      {
        ...structuredClone(latest),
        id: commandId,
        number: doc.revision + 1,
        authorId,
        createdAt: new Date().toISOString(),
      },
    ],
  });
}
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "모의 조건서 요청 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/terms/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/terms/:requestId", async ({ request, params }) => {
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
    if (session.epoch() !== epoch || actor(request)?.id !== user.id)
      return fail(401);
    const item = readMockProposal(String(params.requestId));
    if (!item || !participant(item, user) || !hasRoom(item)) return fail(404);
    const campaign = allCampaigns().find((c) => c.id === item.campaignId);
    if (!campaign) return fail(404);
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "409", "500"].includes(selected))
      return fail(Number(selected));
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const stored = documents.get(item.id);
    const sources =
      stored?.sources ??
      referenceSources(item, campaign, readMockStudio(item.creatorId));
    if (request.method === "GET")
      return HttpResponse.json({
        document: stored ?? { revision: 0, sources, versions: [] },
        editable: canEditTerms(item, user),
      });
    if (request.method !== "POST") return fail(405);
    const cmd = termsCommandSchema.safeParse(raw);
    if (!cmd.success || cmd.data.requestId !== item.id) return fail(400);
    try {
      documents.set(item.id, saveTerms(stored, cmd.data, user, item, sources));
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    } catch (error) {
      return fail(error instanceof ProposalError ? error.status : 400);
    }
  }),
];
