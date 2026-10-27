import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import {
  changeBookmarks,
  recommendCampaigns,
} from "../src/mocks/activity-model";
import { discoveryFixtures } from "../src/mocks/discovery-model";

const creator: AuthUser = {
  id: "c",
  name: "제작자",
  email: null,
  role: "CREATOR",
  status: "ACTIVE",
};
describe("7-A 저장·추천 경계", () => {
  const campaigns = discoveryFixtures();
  const first = campaigns[0];
  const closed = campaigns[8];
  if (!first || !closed) throw new Error("fixture");
  const { id } = first;
  it("중복 저장·중복 해제는 멱등이며 본인 상태만 갱신", () => {
    const saved = changeBookmarks([], { id, saved: true }, creator, campaigns);
    expect(
      changeBookmarks(saved, { id, saved: true }, creator, campaigns),
    ).toEqual([id]);
    expect(
      changeBookmarks(saved, { id, saved: false }, creator, campaigns),
    ).toEqual([]);
    expect(
      changeBookmarks([], { id, saved: false }, creator, campaigns),
    ).toEqual([]);
  });
  it("의뢰인/제한·비공개·마감·사용자ID 주입 거부", () => {
    expect(() =>
      changeBookmarks(
        [],
        { id, saved: true },
        { ...creator, role: "CLIENT" },
        campaigns,
      ),
    ).toThrow();
    expect(() =>
      changeBookmarks([], { id, saved: true }, creator, [
        { ...first, status: "DRAFT" },
      ]),
    ).toThrow();
    expect(() =>
      changeBookmarks([], { id: closed.id, saved: true }, creator, campaigns),
    ).toThrow();
    expect(() =>
      changeBookmarks(
        [],
        { id, saved: true, userId: "other" },
        creator,
        campaigns,
      ),
    ).toThrow();
  });
  it("정보 부족을 최신 추천으로 위장하지 않고 이유가 실제 표현과 일치", () => {
    expect(recommendCampaigns(campaigns, null, [])).toEqual({
      sufficient: false,
      items: [],
    });
    expect(recommendCampaigns(campaigns, "FOOD", [])).toEqual({
      sufficient: true,
      items: [],
    });
    const result = recommendCampaigns(campaigns, "LIFESTYLE", [id]);
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.every(
        (r) =>
          r.item.product.includes("생활") &&
          r.reason.includes("생활") &&
          r.item.id !== id,
      ),
    ).toBe(true);
  });
});
