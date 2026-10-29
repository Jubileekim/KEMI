import { createElement } from "react";
import { jsx } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "../src/features/auth/session-controller";
import { screens, type Role, type Screen } from "../src/app/routes";
import { Guard } from "../src/app/route-pages";

const fixture = vi.hoisted<{
  enabled: boolean;
  state: Pick<SessionState, "status" | "role">;
}>(() => ({
  enabled: true,
  state: { status: "authenticated", role: "client" },
}));
vi.mock("../src/app/session", () => ({
  useSession: () => fixture.state,
  mockEnabled: false,
  session: { epoch: () => 0, bootstrap: vi.fn(), logout: vi.fn() },
}));
vi.mock("../src/features/auth/config", () => ({
  get authEnabled() {
    return fixture.enabled;
  },
}));
// Render the guard in Node without coupling its behavior to button styling.
vi.mock("../src/components/ui/button", () => ({
  default: ({ children }: { children: unknown }) => children,
}));

function screenAt(path: string): Screen {
  const screen = screens.find((entry) => entry.path === path);
  if (!screen) throw new Error(`Missing screen: ${path}`);
  return screen;
}

function render(screen: Screen) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/campaigns/new?draft=1"] },
      jsx(Guard, {
        screen,
        children: createElement("div", null, "PRIVATE_CONTENT"),
      }),
    ),
  );
}
beforeEach(() => {
  fixture.enabled = true;
  fixture.state = { status: "authenticated", role: "client" };
});

describe("protected page access", () => {
  screens
    .filter((entry) => entry.roles)
    .forEach((screen) => {
      it.each<Role>(["guest", "client", "creator", "ops"])(
        `${screen.path} checks %s`,
        (role) => {
          fixture.state.role = role;
          const html = render(screen);
          expect(html.includes("PRIVATE_CONTENT")).toBe(
            role !== "guest" && Boolean(screen.roles?.includes(role)),
          );
          if (role !== "guest" && !screen.roles?.includes(role)) {
            expect(html).toContain("접근 권한이 없어요");
            expect(html).toContain('href="/"');
            expect(html).toContain("다른 계정으로 로그인");
          }
        },
      );
    });
  it.each<SessionState["status"]>([
    "checking",
    "error",
    "guest",
    "logging-out",
    "logout-error",
  ])(
    "never mounts private content during %s even with a remembered allowed role",
    (status) => {
      fixture.state.status = status;
      expect(render(screenAt("/campaigns/new"))).not.toContain(
        "PRIVATE_CONTENT",
      );
    },
  );
  it("does not mount private content when authentication is disabled", () => {
    fixture.enabled = false;
    expect(render(screenAt("/campaigns/new"))).not.toContain("PRIVATE_CONTENT");
  });
  it("keeps public pages available to guests", () => {
    fixture.state = { status: "guest", role: "guest" };
    expect(render(screenAt("/"))).toContain("PRIVATE_CONTENT");
  });
  it("explains the required and current roles", () => {
    fixture.state.role = "creator";
    const html = render(screenAt("/campaigns/new"));
    expect(html).toContain("의뢰인");
    expect(html).toContain("크리에이터");
  });
});
