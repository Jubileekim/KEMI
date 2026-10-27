import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import { mockAccountLimited } from "./safety-store";
import { recordMockEvent } from "../shared/analytics/events";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import { catalogCreator } from "./catalog-handlers";
import { readMockProposals, writeMockProposals } from "./proposal-handlers";
import { directSendSchema, directResponseSchema } from "./direct-contract";
import sendDirect, { expireDirect, respondDirect } from "./direct-model";
import { directNow, setDirectClock } from "./direct-clock";
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
  http.post("/__mock__/direct/clock", async ({ request }) => {
    const parsed = z
      .number()
      .int()
      .nonnegative()
      .max(8640000000000000)
      .nullable()
      .safeParse(await request.json());
    if (!parsed.success) return fail(400, "Mock 시각을 확인해 주세요.");
    setDirectClock(parsed.data);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/__mock__/direct/respond", async ({ request }) => {
    const user = actor(request);
    const epoch = session.epoch();
    if (!user) return fail(401, "로그인이 필요해요.");
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
      return fail(Number(selected), "모의 응답 실패");
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const cmd = directResponseSchema.safeParse(raw);
    if (!cmd.success) return fail(400, "응답 형식을 확인해 주세요.");
    try {
      writeMockProposals(
        expireDirect(readMockProposals(), directNow().getTime()),
      );
      writeMockProposals(
        respondDirect(readMockProposals(), cmd.data, user, directNow()),
      );
      if (selected === "lost-response") return HttpResponse.error();
      return HttpResponse.json({ ok: true, id: cmd.data.id });
    } catch (error) {
      return fail(
        error instanceof ProposalError ? error.status : 400,
        "기한·수신자·최신 상태를 확인해 주세요.",
      );
    }
  }),
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
          directNow(),
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
