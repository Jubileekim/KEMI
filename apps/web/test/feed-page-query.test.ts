import { expect, it } from "vitest";
import { safeFeedPage } from "../src/features/portfolio/CatalogLive";

it("defaults invalid feed page URLs to the first page", () => {
  for (const value of [null, "", "abc", "-1", "0", "1.5", "2e3", "NaN", "Infinity", "9007199254740992"]) {
    expect(safeFeedPage(value)).toBe(1);
  }
});

it("keeps positive integer page values", () => {
  expect(safeFeedPage("1")).toBe(1);
  expect(safeFeedPage("2")).toBe(2);
  expect(safeFeedPage("100")).toBe(100);
});
