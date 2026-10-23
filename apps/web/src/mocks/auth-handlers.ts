import { http, HttpResponse, delay } from "msw";
import type { AuthUser } from "@kemi/shared";
import { loginRequestSchema } from "@kemi/shared";
import { signupFormSchema } from "../features/auth/contracts";

// UI fixtures only: no credentials or tokens are persisted. This marker is not authentication.
const users: Record<string, AuthUser> = {
  client: {
    id: "mock-client",
    email: "client@example.test",
    name: "예시 의뢰인",
    role: "CLIENT",
    status: "ACTIVE",
  },
  creator: {
    id: "mock-creator",
    email: "creator@example.test",
    name: "예시 크리에이터",
    role: "CREATOR",
    status: "ACTIVE",
  },
};
let currentUser: AuthUser | undefined;
const registrations = new Map<string, { user: AuthUser; digest: string }>();
async function passwordDigest(password: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
let scenario = "success";
function failure(status: number, code: string) {
  return HttpResponse.json(
    { error: { code, message: "개발용 Mock 응답" } },
    { status },
  );
}
function authResponse(user: AuthUser) {
  return {
    accessToken: `mock-access-${user.id}`,
    accessTokenExpiresIn: 900,
    user,
  };
}
function setMarker(value: string) {
  document.cookie = `kemi_mock_session=${value}; Path=/; SameSite=Lax`;
}
function readUser() {
  if (currentUser) return currentUser;
  const marker = document.cookie
    .split("; ")
    .find((item) => item.startsWith("kemi_mock_session="))
    ?.split("=")[1];
  return (
    Object.values(users).find((user) => user.id === marker) ??
    Array.from(registrations.values()).find((entry) => entry.user.id === marker)
      ?.user
  );
}
const authHandlers = [
  http.post("/__mock__/auth/scenario", async ({ request }) => {
    scenario = await request.text();
    return new HttpResponse(null, { status: 204 });
  }),
  http.post("/api/auth/signup", async ({ request }) => {
    const body: unknown = await request.json();
    const password: unknown =
      typeof body === "object" && body !== null
        ? Reflect.get(body, "password")
        : undefined;
    const parsed = signupFormSchema.safeParse(
      typeof body === "object" && body !== null
        ? { ...body, passwordConfirm: password }
        : body,
    );
    if (!parsed.success) return failure(400, "VALIDATION_FAILED");
    if (
      Object.values(users).some((user) => user.email === parsed.data.email) ||
      registrations.has(parsed.data.email)
    )
      return failure(409, "EMAIL_ALREADY_EXISTS");
    const digest = await passwordDigest(parsed.data.password);
    if (registrations.has(parsed.data.email))
      return failure(409, "EMAIL_ALREADY_EXISTS");
    currentUser = {
      id: `mock-signup-${registrations.size + 1}`,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      status: "ACTIVE",
    };
    registrations.set(parsed.data.email, { user: currentUser, digest });
    setMarker(currentUser.id);
    await delay(300);
    return HttpResponse.json(authResponse(currentUser), { status: 201 });
  }),
  http.post("/api/auth/login", async ({ request }) => {
    const input = loginRequestSchema.safeParse(await request.json());
    await delay(scenario === "delay" ? 1500 : 150);
    if (scenario === "network") return HttpResponse.error();
    if (scenario === "server") return failure(500, "INTERNAL_ERROR");
    if (scenario === "restricted") return failure(403, "FORBIDDEN");
    if (scenario === "rate") return failure(429, "RATE_LIMITED");
    const registered = input.success
      ? registrations.get(input.data.email)
      : undefined;
    const user =
      registered?.user ??
      Object.values(users).find(
        (item) => input.success && item.email === input.data.email,
      );
    if (
      !input.success ||
      !user ||
      (registered
        ? (await passwordDigest(input.data.password)) !== registered.digest
        : input.data.password !== "Kemi1234") ||
      scenario === "invalid"
    )
      return failure(401, "INVALID_CREDENTIALS");
    currentUser = user;
    setMarker(user.id);
    return HttpResponse.json(authResponse(user));
  }),
  http.post("/api/auth/refresh", () => {
    const user = readUser();
    if (!user || scenario === "expired") {
      currentUser = undefined;
      setMarker("");
      return failure(401, "SESSION_REVOKED");
    }
    return HttpResponse.json(authResponse(user));
  }),
  http.get("/api/auth/me", ({ request }) => {
    const user = readUser();
    if (
      !user ||
      !request.headers.get("Authorization") ||
      scenario === "expired"
    )
      return failure(401, "SESSION_REVOKED");
    return HttpResponse.json({ user });
  }),
  http.post("/api/auth/logout", () => {
    if (scenario === "logout-error") return failure(500, "INTERNAL_ERROR");
    currentUser = undefined;
    setMarker("");
    return new HttpResponse(null, { status: 204 });
  }),
];
export default authHandlers;
