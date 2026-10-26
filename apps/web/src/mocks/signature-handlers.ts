import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockProposal, confirmMockContract } from "./proposal-handlers";
import { readMockTerms, renewMockTerms } from "./terms-handlers";
import { participant, hasRoom, ProposalError } from "./proposal-model";
import { canEditTerms } from "./terms-model";
import {
  signatureCommandSchema,
  changeSignatures,
  roundStatus,
  type SignatureRound,
} from "./signature-model";

const records = new Map<string, SignatureRound[]>();
export const readMockSignatureRounds = (id: string) => records.get(id) ?? [];
export function readMockSignedContract(id: string) {
  const entry = [...records.entries()].find(([, rounds]) =>
    rounds.some(
      (round) => round.contractId === id && round.signatures.length === 2,
    ),
  );
  if (!entry) return undefined;
  const [requestId, rounds] = entry;
  const round = rounds.find((r) => r.contractId === id);
  const item = readMockProposal(requestId);
  const version = readMockTerms(requestId)?.versions.find(
    (v) => v.id === round?.versionId,
  );
  if (!item?.contracted || !round || !version) return undefined;
  return {
    id,
    requestId,
    versionId: version.id,
    clientId: item.clientId,
    creatorId: item.creatorId,
    amount: Number(version.values.amount),
    currency: "KRW",
  };
}
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "모의 서명 요청 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/signatures/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/signatures/:requestId", async ({ request, params }) => {
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
    const item = readMockProposal(String(params.requestId));
    if (!item || !participant(item, user) || !hasRoom(item)) return fail(404);
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "409", "500"].includes(selected))
      return fail(Number(selected));
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const doc = readMockTerms(item.id);
    const rounds = records.get(item.id) ?? [];
    if (request.method === "GET")
      return HttpResponse.json({
        rounds,
        now: new Date().toISOString(),
        editable: canEditTerms(item, user),
      });
    if (request.method !== "POST") return fail(405);
    const cmd = signatureCommandSchema.safeParse(raw);
    if (!cmd.success || !doc || cmd.data.requestId !== item.id)
      return fail(400);
    try {
      if (cmd.data.type === "renew") {
        if (!canEditTerms(item, user)) return fail(409);
        const old = rounds.find((r) => r.versionId === cmd.data.versionId);
        if (
          !old ||
          !["EXPIRED", "SUPERSEDED"].includes(roundStatus(old, doc, item))
        )
          return fail(409);
        renewMockTerms(
          item.id,
          cmd.data.versionId,
          cmd.data.revision,
          cmd.data.id,
          user.id,
        );
      } else {
        const next = changeSignatures(rounds, doc, item, user, cmd.data);
        if (next.some((r) => r.contractId)) confirmMockContract(item.id);
        records.set(item.id, next);
      }
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    } catch (error) {
      return fail(error instanceof ProposalError ? error.status : 400);
    }
  }),
];
