import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { resolutionHeld } from "./resolution-store";
import {
  readMockSignedContract,
  readMockSignatureRounds,
} from "./signature-handlers";
import { readMockProposal } from "./proposal-handlers";
import { participant, ProposalError } from "./proposal-model";
import { readMockDelivery } from "./delivery-handlers";
import { readMockPaidOrder } from "./payment-handlers";
import { readMockProduction } from "./production-handlers";
import { allPrepared } from "./production-model";
import {
  reconcileSettlement,
  settlementBlock,
  settlementCommandSchema,
  type SettlementRecord,
} from "./settlement-model";

const records = new Map<string, SettlementRecord[]>();
export const readMockSettlement = (id: string) => records.get(id)?.at(-1);
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "모의 정산 확인 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.get("/__mock__/work-events/:requestId", ({ request, params }) => {
    const user = actor(request);
    if (!user) return fail(401);
    const item = readMockProposal(String(params.requestId));
    if (!item || !participant(item, user)) return fail(404);
    if (scenario === "events-error") return fail(500);
    return HttpResponse.json(
      readMockSignatureRounds(item.id).flatMap((round) => [
        ...round.signatures.map((signature) => ({
          id: `${round.versionId}:${signature.userId}`,
          at: signature.at,
          label: "조건 버전 서명 확인",
          path: `/workspace/${item.id}#signature-${round.versionId}`,
        })),
        ...(round.contractId
          ? readMockProduction(round.contractId).history.map((entry) => ({
              id: entry.id,
              at: entry.at,
              label: entry.message,
              path: `/contracts/${round.contractId}/production#production-${entry.id}`,
            }))
          : []),
      ]),
    );
  }),
  http.post("/__mock__/settlements/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/__mock__/settlement-events/:requestId", ({ request, params }) => {
    const user = actor(request);
    if (!user) return fail(401);
    const item = readMockProposal(String(params.requestId));
    if (!item || !participant(item, user)) return fail(404);
    if (scenario === "events-error") return fail(500);
    return HttpResponse.json(
      [...records.entries()].flatMap(([id, values]) =>
        readMockSignedContract(id)?.requestId === item.id
          ? values
              .filter((r) => r.status === "SUCCEEDED")
              .map((record) => ({ contractId: id, record }))
          : [],
      ),
    );
  }),
  http.all("/__mock__/settlements/:contractId", async ({ request, params }) => {
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
    const contract = readMockSignedContract(String(params.contractId));
    if (
      !contract ||
      !(
        (user.role === "CLIENT" && user.id === contract.clientId) ||
        (user.role === "CREATOR" && user.id === contract.creatorId)
      )
    )
      return fail(404);
    if (["401", "403", "409", "500"].includes(selected))
      return fail(Number(selected));
    if (selected === "network") return HttpResponse.error();
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const production = readMockProduction(contract.id);
    const order = readMockPaidOrder(contract.id);
    const context = {
      delivery: readMockDelivery(contract.id),
      amount: contract.amount,
      currency: contract.currency,
      paidAmount: order?.currency === contract.currency ? order.amount : null,
      prepared: Boolean(production.startedAt && allPrepared(production)),
      held: selected === "held" || resolutionHeld(contract.id),
    };
    // A mismatch fixture changes evidence, never the signed contract.
    if (selected === "mismatch") context.paidAmount = contract.amount + 1;
    if (request.method === "POST") {
      const cmd = settlementCommandSchema.safeParse(raw);
      if (!cmd.success) return fail(400);
      let outcome: SettlementRecord["status"] = "SUCCEEDED";
      if (selected === "processing") outcome = "PROCESSING";
      if (selected === "unknown") outcome = "UNKNOWN";
      if (selected === "failed") outcome = "FAILED";
      try {
        const next = reconcileSettlement(
          records.get(contract.id) ?? [],
          cmd.data,
          context,
          outcome,
          new Date().toISOString(),
        );
        records.set(contract.id, next);
        if (selected === "lost-response") return HttpResponse.error();
      } catch (error) {
        return fail(error instanceof ProposalError ? error.status : 400);
      }
    } else if (request.method !== "GET") return fail(405);
    return HttpResponse.json({
      contractId: contract.id,
      requestId: contract.requestId,
      amount: contract.amount,
      revision: context.delivery.revision,
      receiptId: context.delivery.final.receipt?.id ?? null,
      reason: settlementBlock(context),
      record: records.get(contract.id)?.at(-1) ?? null,
    });
  }),
];
