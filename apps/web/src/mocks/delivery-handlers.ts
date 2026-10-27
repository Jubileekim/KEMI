import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockSignedContract } from "./signature-handlers";
import { readMockTerms } from "./terms-handlers";
import { changeRevisions, revisionCommandSchema } from "./revision-model";
import { readMockProposal } from "./proposal-handlers";
import { participant, ProposalError } from "./proposal-model";
import { mockContractPaid } from "./payment-handlers";
import { readMockProduction } from "./production-handlers";
import { allPrepared } from "./production-model";
import {
  changeFinal,
  finalAssetSchema,
  finalCommandSchema,
  type FinalAsset,
} from "./final-model";
import {
  assetSchema,
  deliveryCommandSchema,
  emptyDelivery,
  submitDelivery,
  type DeliveryAsset,
  type DeliveryState,
} from "./delivery-model";

const records = new Map<string, DeliveryState>();
const assets = new Map<
  string,
  { contractId: string; authorId: string; asset: DeliveryAsset; file: File }
>();
let scenario = "success";
const finalAssets = new Map<
  string,
  { contractId: string; authorId: string; asset: FinalAsset; file: File }
>();
const fail = (status: number) =>
  HttpResponse.json({ message: "모의 영상 요청 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
function allowed(id: string) {
  const state = readMockProduction(id);
  return Boolean(mockContractPaid(id) && state.startedAt && allPrepared(state));
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
  if (!user) return fail(401);
  const selected = scenario;
  await delay(selected === "delay" ? 1500 : 80);
  if (epoch !== session.epoch() || actor(request)?.id !== user.id)
    return fail(401);
  const contract = readMockSignedContract(String(params.contractId));
  if (!contract) return fail(404);
  const creator = user.role === "CREATOR" && user.id === contract.creatorId;
  if (!creator && !(user.role === "CLIENT" && user.id === contract.clientId))
    return fail(404);
  if (["401", "403", "409", "500"].includes(selected))
    return fail(Number(selected));
  if (selected === "network") return HttpResponse.error();
  if (selected === "malformed") return HttpResponse.json({ invalid: true });
  const suffix = new URL(request.url).pathname.split("/").slice(4);
  const state = records.get(contract.id) ?? emptyDelivery();
  if (request.method === "GET" && suffix[0] === "final-files") {
    const file = state.final.delivery?.files.find(
      (f) => f.asset.id === suffix[1],
    );
    const stored = file && finalAssets.get(file.asset.id);
    if (!stored || stored.contractId !== contract.id) return fail(404);
    return new HttpResponse(stored.file, {
      headers: {
        "Content-Type": stored.asset.mime,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (request.method === "GET" && suffix[0] === "media") {
    const version = state.versions.find((v) => v.id === suffix[1]);
    const stored = version && assets.get(version.asset.id);
    if (!stored || stored.contractId !== contract.id) return fail(404);
    return new HttpResponse(stored.file, {
      headers: {
        "Content-Type": stored.asset.mime,
        "Cache-Control": "no-store",
      },
    });
  }
  if (request.method === "GET" && !suffix.length)
    return HttpResponse.json({
      contractId: contract.id,
      requestId: contract.requestId,
      creatorId: contract.creatorId,
      canSubmit: creator && allowed(contract.id) && !state.final.approval,
      started: Boolean(readMockProduction(contract.id).startedAt),
      prepared: allowed(contract.id),
      revisionTerms:
        readMockTerms(contract.requestId)?.versions.find(
          (v) => v.id === contract.versionId,
        )?.values.revisions ?? "",
      fileTerms: (() => {
        const values = readMockTerms(contract.requestId)?.versions.find(
          (v) => v.id === contract.versionId,
        )?.values;
        return values
          ? `규격·수량: ${values.specification}\n작업 범위: ${values.scope}\n사용권·원본 조건: ${values.usage}`
          : "";
      })(),
      state,
    });
  if (request.method !== "POST") return fail(405);
  try {
    if (suffix[0] === "final" && suffix.length === 1) {
      const raw: unknown = await request.json();
      const cmd = finalCommandSchema.safeParse(raw);
      if (!cmd.success) return fail(400);
      if (epoch !== session.epoch() || actor(request)?.id !== user.id)
        return fail(401);
      const owned = [...finalAssets.values()]
        .filter((a) => a.contractId === contract.id && a.authorId === user.id)
        .map((a) => a.asset);
      const next = changeFinal(
        records.get(contract.id) ?? emptyDelivery(),
        cmd.data,
        { id: user.id, creator },
        allowed(contract.id),
        owned,
        new Date().toISOString(),
      );
      records.set(contract.id, next);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    }
    if (suffix[0] === "final-assets" && suffix.length === 1) {
      if (!creator) return fail(403);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail(400);
      const parsed = finalAssetSchema.safeParse({
        id: form.get("id"),
        name: file.name,
        size: file.size,
        mime: file.type,
      });
      if (!parsed.success || finalAssets.has(parsed.data.id)) return fail(400);
      if (epoch !== session.epoch() || actor(request)?.id !== user.id)
        return fail(401);
      const current = records.get(contract.id);
      if (
        !allowed(contract.id) ||
        !current?.final.approval ||
        current.final.delivery
      )
        return fail(409);
      finalAssets.set(parsed.data.id, {
        contractId: contract.id,
        authorId: user.id,
        asset: parsed.data,
        file,
      });
      return HttpResponse.json(parsed.data);
    }
    if (suffix[0] === "requests" && suffix.length === 1) {
      const raw: unknown = await request.json();
      const cmd = revisionCommandSchema.safeParse(raw);
      if (!cmd.success) return fail(400);
      if (epoch !== session.epoch() || actor(request)?.id !== user.id)
        return fail(401);
      const next = changeRevisions(
        records.get(contract.id) ?? emptyDelivery(),
        cmd.data,
        { id: user.id, side: creator ? "creator" : "client" },
        allowed(contract.id),
        new Date().toISOString(),
      );
      records.set(contract.id, next);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    }
    if (!creator) return fail(403);
    if (suffix[0] === "assets" && suffix.length === 1) {
      if (!allowed(contract.id) || state.final.approval) return fail(409);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return fail(400);
      const parsed = assetSchema.safeParse({
        id: form.get("id"),
        name: file.name,
        size: file.size,
        mime: file.type,
      });
      if (!parsed.success || assets.has(parsed.data.id)) return fail(400);
      // Reading the request body is asynchronous: recheck identity/state before saving.
      if (epoch !== session.epoch() || actor(request)?.id !== user.id)
        return fail(401);
      if (!allowed(contract.id) || records.get(contract.id)?.final.approval)
        return fail(409);
      assets.set(parsed.data.id, {
        contractId: contract.id,
        authorId: user.id,
        asset: parsed.data,
        file,
      });
      return HttpResponse.json(parsed.data);
    }
    if (suffix.length) return fail(404);
    const raw: unknown = await request.json();
    const cmd = deliveryCommandSchema.safeParse(raw);
    if (!cmd.success) return fail(400);
    if (epoch !== session.epoch() || actor(request)?.id !== user.id)
      return fail(401);
    const stored = assets.get(cmd.data.assetId);
    const asset =
      stored?.contractId === contract.id && stored.authorId === user.id
        ? stored.asset
        : undefined;
    // Re-read after awaiting body parsing so two requests cannot overwrite each other.
    const next = submitDelivery(
      records.get(contract.id) ?? emptyDelivery(),
      cmd.data,
      { id: user.id, creator },
      allowed(contract.id),
      asset,
      new Date().toISOString(),
    );
    records.set(contract.id, next);
    if (selected === "lost-response") return HttpResponse.error();
    return HttpResponse.json({ ok: true });
  } catch (error) {
    return fail(error instanceof ProposalError ? error.status : 400);
  }
}
export default [
  http.get("/__mock__/final-events/:requestId", ({ request, params }) => {
    const user = actor(request);
    if (!user) return fail(401);
    const item = readMockProposal(String(params.requestId));
    if (!item || !participant(item, user)) return fail(404);
    return HttpResponse.json(
      [...records.entries()].flatMap(([id, state]) =>
        readMockSignedContract(id)?.requestId === item.id
          ? [{ contractId: id, final: state.final }]
          : [],
      ),
    );
  }),
  http.post("/__mock__/deliveries/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get(
    "/__mock__/delivery-events/:requestId",
    async ({ request, params }) => {
      const user = actor(request);
      if (!user) return fail(401);
      const item = readMockProposal(String(params.requestId));
      if (!item || !participant(item, user)) return fail(404);
      return HttpResponse.json(
        [...records.entries()].flatMap(([id, state]) =>
          readMockSignedContract(id)?.requestId === item.id
            ? state.versions.map((version) => ({ contractId: id, version }))
            : [],
        ),
      );
    },
  ),
  http.get("/__mock__/revision-events/:requestId", ({ request, params }) => {
    const user = actor(request);
    if (!user) return fail(401);
    const item = readMockProposal(String(params.requestId));
    if (!item || !participant(item, user)) return fail(404);
    return HttpResponse.json(
      [...records.entries()].flatMap(([id, state]) =>
        readMockSignedContract(id)?.requestId === item.id
          ? state.requests.map((revision) => ({ contractId: id, revision }))
          : [],
      ),
    );
  }),
  http.all("/__mock__/deliveries/:contractId/*", handle),
  http.all("/__mock__/deliveries/:contractId", handle),
];
