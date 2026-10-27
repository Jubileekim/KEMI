import { delay, http, HttpResponse } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { readMockSignedContract } from "./signature-handlers";
import { readMockPaidOrder } from "./payment-handlers";
import { readMockSettlement } from "./settlement-handlers";
import {
  cancellationCommandSchema,
  changeCancellation,
} from "./resolution-model";
import { readResolution, saveResolution } from "./resolution-store";
import { ProposalError } from "./proposal-model";

let scenario = "success";
const fail = (status: number) =>
  HttpResponse.json({ message: "취소 Mock 요청 확인 실패" }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/resolution/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/resolution/:contractId", async ({ request, params }) => {
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
    const order = readMockPaidOrder(contract.id);
    const paidAmount =
      order?.currency === contract.currency ? order.amount : null;
    const blocked =
      readMockSettlement(contract.id) &&
      readMockSettlement(contract.id)?.status !== "FAILED"
        ? "기존 정산 처리·완료 기록이 있어요. 완료 후 취소 정책 D13 조율이 필요해요."
        : "";
    if (request.method === "POST") {
      if (blocked) return fail(409);
      const cmd = cancellationCommandSchema.safeParse(raw);
      if (!cmd.success) return fail(400);
      try {
        saveResolution(
          contract.id,
          changeCancellation(
            readResolution(contract.id),
            cmd.data,
            user.id,
            contract.amount,
            paidAmount,
            new Date().toISOString(),
          ),
        );
      } catch (error) {
        return fail(error instanceof ProposalError ? error.status : 400);
      }
      if (selected === "lost-response") return HttpResponse.error();
    } else if (request.method !== "GET") return fail(405);
    return HttpResponse.json({
      contractId: contract.id,
      requestId: contract.requestId,
      clientId: contract.clientId,
      creatorId: contract.creatorId,
      amount: contract.amount,
      paidAmount,
      blocked,
      state: readResolution(contract.id),
    });
  }),
];
