import { http, HttpResponse, delay } from "msw";
import { session } from "../app/session";
import { readMockUser } from "./auth-handlers";
import {
  pricingAnalysisRequestSchema,
  mockPricingResponse,
} from "./pricing-model";

let scenario = "success";
export default [
  http.post("/__mock__/pricing/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/__mock__/pricing/analyze", async ({ request }) => {
    const user = readMockUser();
    const epoch = session.epoch();
    if (
      !user ||
      request.headers.get("Authorization") !== `Bearer mock-access-${user.id}`
    )
      return HttpResponse.json({}, { status: 401 });
    if (user.role !== "CLIENT" || user.status !== "ACTIVE")
      return HttpResponse.json({}, { status: 403 });
    const input = pricingAnalysisRequestSchema.safeParse(await request.json());
    if (!input.success) return HttpResponse.json({}, { status: 400 });
    const selected = scenario;
    await delay(selected === "delay" ? 1500 : 80);
    if (epoch !== session.epoch() || readMockUser()?.id !== user.id)
      return HttpResponse.json({}, { status: 401 });
    if (selected === "network") return HttpResponse.error();
    if (["401", "403", "429", "503"].includes(selected))
      return HttpResponse.json({}, { status: Number(selected) });
    const response = {
      ...mockPricingResponse,
      estimatedBudgetKrw: selected === "malformed" ? 1 : 150000,
    };
    return HttpResponse.json({
      id: crypto.randomUUID(),
      input: input.data,
      response,
      modelVersion: "mock-fixture-v1",
      promptVersion: "mock-no-prompt-v1",
    });
  }),
];
