import { http, HttpResponse, delay } from "msw";
import { mockAccountLimited } from "./safety-store";
import { recordMockEvent } from "../shared/analytics/events";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { catalogCreator } from "./catalog-handlers";
import { readMockProposals, writeMockProposals } from "./proposal-handlers";
import { directSendSchema } from "./direct-contract";
import sendDirect from "./direct-model";
import { ProposalError } from "./proposal-model";

let scenario = "success";
const fail = (status: number, message: string) =>
  HttpResponse.json({ message }, { status });
function actor(request: Request) {
  const user = readMockUser();
  return user?.status === "ACTIVE" &&
    request.headers.get("Authorization") === `Bearer mock-access-${user.id}`
    ? user
    : undefined;
}
export default [
  http.post("/__mock__/direct/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/__mock__/direct", async ({ request }) => {
    const user = actor(request);
    const epoch = session.epoch();
    if (!user) return fail(401, "로그인이 필요해요.");
    if (user.role !== "CLIENT") return fail(403, "의뢰인만 발송할 수 있어요.");
    const selected = scenario;
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return fail(400, "입력을 확인해 주세요.");
    }
    await delay(selected === "delay" ? 1500 : 80);
    if (epoch !== session.epoch() || actor(request)?.id !== user.id)
      return fail(401, "계정이 바뀌었어요.");
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "404", "409", "500"].includes(selected))
      return fail(Number(selected), "모의 발송 실패");
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const cmd = directSendSchema.safeParse(raw);
    if (!cmd.success) return fail(400, "발송 형식을 확인해 주세요.");
    if (
      !readMockProposals().items.some((p) => p.id === cmd.data.id) &&
      (mockAccountLimited(user.id) || mockAccountLimited(cmd.data.creatorId))
    )
      return fail(
        403,
        "개발용 제한 중 신규 발송을 보류해요. 기존 거래·이의는 유지돼요.",
      );
    try {
      writeMockProposals(
        sendDirect(
          readMockProposals(),
          cmd.data,
          user,
          catalogCreator(cmd.data.creatorId),
        ),
      );
      recordMockEvent("request_sent", cmd.data.id);
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true, id: cmd.data.id });
    } catch (error) {
      return fail(
        error instanceof ProposalError ? error.status : 400,
        error instanceof Error ? error.message : "발송 실패",
      );
    }
  }),
];
