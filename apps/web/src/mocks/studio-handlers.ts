import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import { readMockUser } from "./auth-handlers";
import { setMockServiceStatus } from "./profile-handlers";
import {
  applyStudio,
  commandSchema,
  emptyStudio,
  type StudioState,
} from "./studio-model";

const states = new Map<string, StudioState>();
let scenario = "success";
const fail = (status: number, message: string) =>
  HttpResponse.json({ message }, { status });
function owner(request: Request) {
  const user = readMockUser();
  if (
    !user ||
    request.headers.get("Authorization") !== `Bearer mock-access-${user.id}`
  )
    return undefined;
  return user;
}
const envelope = z.object({
  revision: z.number().int(),
  command: commandSchema,
});
export default [
  http.post("/__mock__/studio/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.all("/__mock__/studio", async ({ request }) => {
    const user = owner(request);
    if (!user) return fail(401, "로그인이 필요해요.");
    if (user.role !== "CREATOR")
      return fail(403, "크리에이터 본인만 관리할 수 있어요.");
    const selected = scenario;
    const input: unknown =
      request.method === "POST" ? await request.json() : null;
    await delay(selected === "delay" ? 1500 : 80);
    // Never change another account after a delayed response or logout.
    if (owner(request)?.id !== user.id)
      return fail(401, "계정이 변경되어 요청을 취소했어요.");
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "409", "500"].includes(selected))
      return fail(
        Number(selected),
        "모의 요청 실패예요. 입력은 유지되며 자동 재전송하지 않아요.",
      );
    if (selected === "malformed") return HttpResponse.json({ invalid: true });
    const state = states.get(user.id) ?? emptyStudio();
    if (request.method === "GET") return HttpResponse.json(state);
    if (request.method !== "POST")
      return fail(405, "허용되지 않은 동작이에요.");
    const parsed = envelope.safeParse(input);
    if (!parsed.success) return fail(400, "모의 입력 형식을 확인해 주세요.");
    if (parsed.data.revision !== state.revision)
      return fail(
        409,
        "최신 상태와 달라요. 최신 값 확인 후 다시 저장해 주세요.",
      );
    try {
      const next = applyStudio(state, parsed.data.command);
      states.set(user.id, next);
      setMockServiceStatus(user.id, next.service);
      return HttpResponse.json(next);
    } catch (error) {
      return fail(
        400,
        error instanceof Error ? error.message : "모의 변경 실패예요.",
      );
    }
  }),
];
