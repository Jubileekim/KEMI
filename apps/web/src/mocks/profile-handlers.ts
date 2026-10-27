import { http, HttpResponse, delay } from "msw";
import {
  clientProfileUpdateSchema,
  creatorProfileUpdateSchema,
  type MyProfileResponse,
} from "@kemi/shared";
import { readMockUser } from "./auth-handlers";

// Contract-shaped UI fixtures, not a server or a permission implementation.
const profiles = new Map<string, MyProfileResponse>();
const serviceStatuses = new Map<string, "DRAFT" | "PUBLIC" | "PRIVATE">();
export function setMockServiceStatus(
  id: string,
  status: "DRAFT" | "PUBLIC" | "PRIVATE",
) {
  serviceStatuses.set(id, status);
  const profile = profiles.get(id);
  if (profile?.profile.type === "CREATOR")
    profile.profile.serviceStatus = status;
}
let scenario = "success";
const fail = (status: number, code: string) =>
  HttpResponse.json({ error: { code } }, { status });
function ownProfile(request: Request) {
  const user = readMockUser();
  if (
    !user ||
    request.headers.get("Authorization") !== `Bearer mock-access-${user.id}`
  )
    return undefined;
  if (!profiles.has(user.id))
    profiles.set(user.id, {
      name: user.name,
      profile:
        user.role === "CLIENT"
          ? {
              type: "CLIENT",
              brandName: null,
              introduction: null,
              industry: null,
              websiteUrl: null,
              socialUrl: null,
            }
          : {
              type: "CREATOR",
              introduction: null,
              niche: null,
              contentStyles: [],
              productionRoles: [],
              workMethod: null,
              serviceStatus: serviceStatuses.get(user.id) ?? "DRAFT",
              isAvailable: false,
              availableFrom: null,
            },
    });
  return { user, data: profiles.get(user.id) };
}
async function simulate() {
  const selected = scenario;
  await delay(selected === "delay" ? 1500 : 100);
  if (selected === "network") return HttpResponse.error();
  if (selected === "expired") return fail(401, "TOKEN_EXPIRED");
  if (["400", "403", "409", "500"].includes(selected))
    return fail(Number(selected), "MOCK_PROFILE_ERROR");
  if (selected === "malformed")
    return HttpResponse.json({ name: "불완전 응답" });
  return undefined;
}
const profileHandlers = [
  http.post("/__mock__/profiles/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("/api/profiles/me", async ({ request }) => {
    const own = ownProfile(request);
    if (!own) return fail(401, "UNAUTHENTICATED");
    if (own.user.role === "ADMIN") return fail(403, "FORBIDDEN");
    return (await simulate()) ?? HttpResponse.json(own.data);
  }),
  http.patch("/api/profiles/me", async ({ request }) => {
    const own = ownProfile(request);
    if (!own) return fail(401, "UNAUTHENTICATED");
    if (own.user.role === "ADMIN") return fail(403, "FORBIDDEN");
    const error = await simulate();
    if (error) return error;
    const input: unknown = await request.json();
    const schema =
      own.user.role === "CLIENT"
        ? clientProfileUpdateSchema
        : creatorProfileUpdateSchema;
    const result = schema.safeParse(input);
    if (!result.success || !own.data) return fail(400, "VALIDATION_FAILED");
    const { name, ...fields } = result.data;
    const updated = {
      name: name ?? own.data.name,
      profile: { ...own.data.profile, ...fields },
    };
    profiles.set(own.user.id, updated);
    own.user.name = updated.name;
    return HttpResponse.json(updated);
  }),
];
export default profileHandlers;
