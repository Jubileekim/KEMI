import { delay, http, HttpResponse } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockSignedContract } from "./signature-handlers";
import { readMockPaidOrder } from "./payment-handlers";
import { readMockSettlement } from "./settlement-handlers";
import {
  resolutionCommandSchema,
  changeCancellation,
} from "./resolution-model";
import {
  changeWorkflow,
  type WorkflowState,
} from "./resolution-workflow-model";
import {
  readResolution,
  saveResolution,
  resolutionEntries,
} from "./resolution-store";
import { finalAssetSchema, type FinalAsset } from "./final-model";
import { ProposalError } from "./proposal-model";

let scenario = "success";
const assets = new Map<
  string,
  { contractId: string; authorId: string; asset: FinalAsset; file: File }
>();
const fail = (status: number) =>
  HttpResponse.json({ message: "취소·환불 Mock 요청 확인 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
function view(id: string) {
  const contract = readMockSignedContract(id);
  if (!contract) return undefined;
  const order = readMockPaidOrder(id);
  return {
    contractId: id,
    requestId: contract.requestId,
    clientId: contract.clientId,
    creatorId: contract.creatorId,
    amount: contract.amount,
    paidAmount: order?.currency === contract.currency ? order.amount : null,
    orderId: order?.id ?? null,
    blocked:
      readMockSettlement(id) && readMockSettlement(id)?.status !== "FAILED"
        ? "기존 정산 처리·완료 기록이 있어요. 완료 후 취소 정책 D13 조율이 필요해요."
        : "",
    state: readResolution(id),
  };
}
function member(
  user: NonNullable<ReturnType<typeof actor>>,
  contract: NonNullable<ReturnType<typeof readMockSignedContract>>,
) {
  return (
    (user.role === "CLIENT" && user.id === contract.clientId) ||
    (user.role === "CREATOR" && user.id === contract.creatorId)
  );
}
async function handle({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | readonly string[] | undefined>;
}) {
  const user = actor(request);
  const epoch = session.epoch();
  const selected = scenario;
  if (!user) return fail(401);
  let raw: unknown;
  try {
    raw = request.method === "POST" ? await request.json() : null;
  } catch {
    return fail(400);
  }
  await delay(selected === "delay" ? 1500 : 50);
  if (epoch !== session.epoch() || actor(request)?.id !== user.id)
    return fail(401);
  const id = String(params.contractId);
  const contract = readMockSignedContract(id);
  const operations = new URL(request.url).pathname.startsWith(
    "/__mock__/operations/",
  );
  if (
    !contract ||
    (operations ? user.role !== "ADMIN" : !member(user, contract))
  )
    return fail(404);
  if (["401", "403", "409", "500"].includes(selected))
    return fail(Number(selected));
  if (selected === "network") return HttpResponse.error();
  if (selected === "malformed") return HttpResponse.json({ invalid: true });
  const currentView = view(id);
  if (!currentView) return fail(404);
  if (request.method === "POST") {
    if (currentView.blocked) return fail(409);
    const parsed = resolutionCommandSchema.safeParse(raw);
    if (!parsed.success) return fail(400);
    const cmd = parsed.data;
    if (operations !== ["review", "release"].includes(cmd.type))
      return fail(403);
    try {
      const state = readResolution(id);
      if (cmd.type === "propose" || cmd.type === "confirm") {
        saveResolution(
          id,
          changeCancellation(
            state,
            cmd,
            user.id,
            contract.amount,
            currentView.paidAmount,
            new Date().toISOString(),
          ),
        );
      } else {
        const fingerprint = JSON.stringify(cmd);
        const prior = state.commands.find((c) => c.id === cmd.id);
        if (
          prior &&
          ((prior.actorId !== user.id &&
            !["refund", "settle"].includes(cmd.type)) ||
            prior.fingerprint !== fingerprint)
        )
          return fail(409);
        const reconciling =
          (cmd.type === "refund" &&
            state.workflow.refunds.some(
              (r) =>
                r.id === cmd.id && ["UNKNOWN", "PROCESSING"].includes(r.status),
            )) ||
          (cmd.type === "settle" &&
            state.workflow.settlement?.id === cmd.id &&
            ["UNKNOWN", "PROCESSING"].includes(
              state.workflow.settlement.status,
            ));
        if (!prior || reconciling) {
          if (!prior && cmd.revision !== state.revision) return fail(409);
          let outcome: NonNullable<WorkflowState["settlement"]>["status"] =
            "SUCCEEDED";
          if (selected === "processing") outcome = "PROCESSING";
          if (selected === "unknown") outcome = "UNKNOWN";
          if (selected === "failed") outcome = "FAILED";
          const workflow = changeWorkflow(state.workflow, cmd, {
            actorId: user.id,
            role: user.role,
            clientId: contract.clientId,
            creatorId: contract.creatorId,
            version: state.versions.at(-1),
            amount: contract.amount,
            paidOrder: readMockPaidOrder(id),
            ownedFiles: [...assets.values()]
              .filter((a) => a.contractId === id && a.authorId === user.id)
              .map((a) => a.asset),
            outcome,
            now: new Date().toISOString(),
          });
          saveResolution(id, {
            ...state,
            workflow,
            revision: state.revision + 1,
            commands: prior
              ? state.commands
              : [
                  ...state.commands,
                  { id: cmd.id, actorId: user.id, fingerprint },
                ],
          });
        }
      }
    } catch (error) {
      return fail(error instanceof ProposalError ? error.status : 400);
    }
    if (selected === "lost-response") return HttpResponse.error();
  } else if (request.method !== "GET") return fail(405);
  return HttpResponse.json(view(id));
}
export default [
  http.post("/__mock__/resolution/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/__mock__/operations/resolution", ({ request }) => {
    if (actor(request)?.role !== "ADMIN") return fail(403);
    if (scenario === "500") return fail(500);
    return HttpResponse.json(
      resolutionEntries()
        .map(([id]) => view(id))
        .filter((v) => v),
    );
  }),
  http.get("/__mock__/disputes/:disputeId", ({ request, params }) => {
    const user = actor(request);
    if (!user) return fail(401);
    const entry = resolutionEntries().find(([, state]) =>
      state.workflow.disputes.some((d) => d.id === params.disputeId),
    );
    const contract = entry && readMockSignedContract(entry[0]);
    if (!entry || !contract || !member(user, contract)) return fail(404);
    return HttpResponse.json(view(entry[0]));
  }),
  http.post(
    "/__mock__/resolution/:contractId/assets",
    async ({ request, params }) => {
      const user = actor(request);
      const epoch = session.epoch();
      const contract = readMockSignedContract(String(params.contractId));
      if (!user) return fail(401);
      if (!contract || !member(user, contract) || user.role !== "CREATOR")
        return fail(403);
      try {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return fail(400);
        const asset = finalAssetSchema.safeParse({
          id: form.get("id"),
          name: file.name,
          mime: file.type,
          size: file.size,
        });
        if (!asset.success || assets.has(asset.data.id)) return fail(400);
        if (epoch !== session.epoch() || actor(request)?.id !== user.id)
          return fail(401);
        const state = readResolution(contract.id);
        if (
          view(contract.id)?.blocked ||
          state.versions.at(-1)?.confirmations.length !== 2 ||
          state.workflow.receipt
        )
          return fail(409);
        assets.set(asset.data.id, {
          contractId: contract.id,
          authorId: user.id,
          asset: asset.data,
          file,
        });
        return HttpResponse.json(asset.data);
      } catch {
        return fail(400);
      }
    },
  ),
  http.get(
    "/__mock__/resolution/:contractId/files/:assetId",
    ({ request, params }) => {
      const user = actor(request);
      const contract = readMockSignedContract(String(params.contractId));
      if (!user) return fail(401);
      if (!contract || !member(user, contract)) return fail(404);
      const stored = assets.get(String(params.assetId));
      if (
        !stored ||
        stored.contractId !== contract.id ||
        !readResolution(contract.id).workflow.handover?.files.some(
          (f) => f.id === stored.asset.id,
        )
      )
        return fail(404);
      return new HttpResponse(stored.file, {
        headers: {
          "Content-Type": stored.asset.mime,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    },
  ),
  http.all("/__mock__/resolution/:contractId", handle),
  http.all("/__mock__/operations/resolution/:contractId", handle),
];
