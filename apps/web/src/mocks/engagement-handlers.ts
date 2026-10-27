import { http, HttpResponse, delay } from "msw";
import type { z } from "zod";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockSignedContract } from "./signature-handlers";
import { readMockDelivery } from "./delivery-handlers";
import { readMockSettlement } from "./settlement-handlers";
import { resolutionHeld } from "./resolution-store";
import { ProposalError } from "./proposal-model";
import {
  submitReview,
  readNotices,
  type Review,
  noticeSchema,
} from "./engagement-model";
import engagementEvents from "./engagement-events";

let reviews: Review[] = [];
const notices = new Map<string, z.infer<typeof noticeSchema>[]>();
let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "알림·리뷰 응답 확인 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    ["CLIENT", "CREATOR"].includes(user.role) &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
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
  let raw: unknown;
  try {
    raw = request.method === "POST" ? await request.json() : null;
  } catch {
    return fail(400);
  }
  await delay(selected === "delay" ? 1500 : 60);
  if (epoch !== session.epoch() || actor(request)?.id !== user.id)
    return fail(401);
  if (["403", "500"].includes(selected)) return fail(Number(selected));
  if (selected === "network") return HttpResponse.error();
  if (selected === "malformed") return HttpResponse.json({ invalid: true });
  if (!["GET", "POST"].includes(request.method)) return fail(405);
  try {
    if (!params.id) {
      const previous = notices.get(user.id) ?? [];
      const existing = new Set(previous.map((n) => n.id));
      let items = [
        ...previous,
        ...engagementEvents(user).filter((n) => !existing.has(n.id)),
      ];
      if (request.method === "POST") items = readNotices(items, raw);
      notices.set(user.id, items);
      if (selected === "lost-response" && request.method === "POST")
        return HttpResponse.error();
      return HttpResponse.json({
        items: items.toSorted((a, b) => b.at.localeCompare(a.at)),
        unreadCount: items.filter((n) => !n.read).length,
      });
    }
    const contract = readMockSignedContract(String(params.id));
    if (
      !contract ||
      ![contract.clientId, contract.creatorId].includes(user.id) ||
      (user.role === "CLIENT" ? contract.clientId : contract.creatorId) !==
        user.id
    )
      return fail(404);
    const cancelled = resolutionHeld(contract.id);
    const complete =
      Boolean(readMockDelivery(contract.id).final.receipt) &&
      !readMockDelivery(contract.id).final.problem &&
      readMockSettlement(contract.id)?.status === "SUCCEEDED";
    if (request.method === "POST")
      reviews = submitReview(reviews, raw, {
        contractId: contract.id,
        authorId: user.id,
        targetId:
          user.id === contract.clientId
            ? contract.creatorId
            : contract.clientId,
        participant: true,
        complete,
        cancelled,
      });
    if (selected === "lost-response" && request.method === "POST")
      return HttpResponse.error();
    return HttpResponse.json({
      contractId: contract.id,
      eligible: complete && !cancelled,
      reason:
        complete && !cancelled
          ? "정상 수령 완료 · 모의 정산 성공"
          : "정상 수령 완료 거래만 가능해요. 모의 정산 성공 확인도 필요해요. 취소·분쟁 거래의 리뷰는 D14 조율 중이에요.",
      own:
        reviews.find(
          (r) => r.contractId === contract.id && r.authorId === user.id,
        ) ?? null,
    });
  } catch (error) {
    return fail(error instanceof ProposalError ? error.status : 400);
  }
}
export default [
  http.post("/__mock__/engagement/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/notifications", handle),
  http.all("/__mock__/reviews/:id", handle),
];
