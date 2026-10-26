import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockSignedContract } from "./signature-handlers";
import { readMockTerms } from "./terms-handlers";
import { mockContractPaid } from "./payment-handlers";
import { ProposalError } from "./proposal-model";
import {
  changeProduction,
  emptyProduction,
  productionCommandSchema,
  type ProductionState,
} from "./production-model";

const records = new Map<string, ProductionState>();
export const readMockProduction = (id: string) =>
  records.get(id) ?? emptyProduction();
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "모의 준비 요청 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/production/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/production/:contractId", async ({ request, params }) => {
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
    if (!contract) return fail(404);
    const client = user.role === "CLIENT" && user.id === contract.clientId;
    const creator = user.role === "CREATOR" && user.id === contract.creatorId;
    if (!client && !creator) return fail(404);
    if (["401", "403", "409", "500"].includes(selected))
      return fail(Number(selected));
    if (selected === "network") return HttpResponse.error();
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const state = records.get(contract.id) ?? emptyProduction();
    const paid = mockContractPaid(contract.id);
    const now = new Date().toISOString();
    if (request.method === "GET") {
      const values = readMockTerms(contract.requestId)?.versions.find(
        (v) => v.id === contract.versionId,
      )?.values;
      return HttpResponse.json({
        contractId: contract.id,
        requestId: contract.requestId,
        clientId: contract.clientId,
        creatorId: contract.creatorId,
        paid,
        now,
        terms: {
          materials: values?.materials ?? "",
          deadline: values?.deadline ?? "",
        },
        state,
      });
    }
    if (request.method !== "POST") return fail(405);
    const cmd = productionCommandSchema.safeParse(raw);
    if (!cmd.success) return fail(400);
    try {
      const next = changeProduction(
        state,
        cmd.data,
        { id: user.id, side: client ? "client" : "creator" },
        paid,
        now,
      );
      records.set(contract.id, next);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    } catch (error) {
      return fail(error instanceof ProposalError ? error.status : 400);
    }
  }),
];
