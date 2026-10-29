import { expect, it } from "vitest";
import toggleCampaignStyle from "../src/features/campaigns/style-selection";

it("blocks a sixth campaign style and duplicate selections", () => {
  const five = ["a", "b", "c", "d", "e"];
  expect(toggleCampaignStyle(five, "f", true)).toEqual(five);
  expect(toggleCampaignStyle(five, "a", true)).toEqual(five);
});

it("allows removing a style and then choosing another", () => {
  const five = ["a", "b", "c", "d", "e"];
  const four = toggleCampaignStyle(five, "c", false);
  expect(toggleCampaignStyle(four, "f", true)).toEqual([
    "a",
    "b",
    "d",
    "e",
    "f",
  ]);
});
