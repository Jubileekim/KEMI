import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/shared/api/client";
import { Failure } from "../src/features/live/ui";

vi.mock("../src/components/ui/button", () => ({
  default: ({ children }: { children: unknown }) => children,
}));
vi.mock("../src/components/ui/label", () => ({ default: () => null }));

describe("resource access failure", () => {
  it.each([403, 404])("renders a safe access notice for %s", (status) => {
    const error = new ApiError(status, "FORBIDDEN", "PRIVATE_RECORD_DETAILS");
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(Failure, { error })),
    );
    expect(html).toContain("접근 권한이 없");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("PRIVATE_RECORD_DETAILS");
    if (status === 404) expect(html).toContain("존재하지 않는 페이지");
  });
  it("keeps service errors distinct from denied access", () => {
    const html = renderToStaticMarkup(
      createElement(Failure, {
        error: new ApiError(503, "SERVICE_UNAVAILABLE", "server error"),
      }),
    );
    expect(html).toContain("외부 서비스 연결이 준비되지 않았어요");
    expect(html).not.toContain("접근 권한");
  });
});
