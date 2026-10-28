import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import AuthRequiredCta from "../src/components/AuthRequiredCta";

const session = vi.hoisted(() => ({ status: "anonymous" }));
vi.mock("../src/app/session", () => ({ useSession: () => session }));
// Render the normally portalled popup on the server to inspect its link contract.
vi.mock("../src/components/ui/dialog", () => {
  const Container = ({ children }: PropsWithChildren) => children;
  return {
    Dialog: Container,
    DialogContent: Container,
    DialogHeader: Container,
    DialogTitle: Container,
    DialogDescription: Container,
    DialogTrigger: Container,
  };
});
vi.mock("../src/components/ui/button", () => ({
  default: ({ children }: PropsWithChildren) => children,
}));

beforeEach(() => {
  session.status = "anonymous";
});

function render(
  props: Omit<Parameters<typeof AuthRequiredCta>[0], "children">,
) {
  const ctaProps = { ...props, children: "지원하기" };
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(AuthRequiredCta, ctaProps)),
  );
}

it("preserves an application destination and creator signup role with custom copy", () => {
  const html = render({
    returnTo: "/campaigns/12/apply",
    role: "creator",
    title: "지원하려면 로그인",
    description: "크리에이터로 지원하세요",
  });
  expect(html).toContain(
    'href="/signup?returnTo=%2Fcampaigns%2F12%2Fapply&amp;role=creator"',
  );
  expect(html).toContain('href="/login?returnTo=%2Fcampaigns%2F12%2Fapply"');
  expect(html).toContain("지원하려면 로그인");
  expect(html).toContain("크리에이터로 지원하세요");
  expect(html).not.toContain("로그인 없이 둘러보기");
});

it("offers public browsing only when requested and does not default a signup role", () => {
  const html = render({ returnTo: "/campaigns", browseTo: "/campaigns" });
  expect(html).toContain('href="/signup?returnTo=%2Fcampaigns"');
  expect(html).toMatch(/href="\/campaigns"[^>]*>로그인 없이 둘러보기/);
});

it("sends authenticated users directly to the supplied destination", () => {
  session.status = "authenticated";
  const html = render({ returnTo: "/campaigns/12/apply", role: "creator" });
  expect(html).toContain('href="/campaigns/12/apply"');
  expect(html).not.toContain("/signup");
});

it.each(["checking", "logging-out"])("disables the CTA during %s", (status) => {
  session.status = status;
  expect(render({ returnTo: "/campaigns" })).toContain('disabled=""');
});
