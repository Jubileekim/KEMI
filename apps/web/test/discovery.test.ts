import { describe, it, expect } from "vitest";
import {
  listingSchema,
  browseCampaigns,
  browseQuerySchema,
  closeCampaign,
  discoveryFixtures,
  projectPublic,
  recruitmentStatus,
} from "../src/mocks/discovery-model";
import {
  applyCampaign,
  emptyCampaign,
  emptyCampaignState,
} from "../src/mocks/campaign-model";

const now = new Date("2026-12-31T15:00:00Z");
const fixtures = discoveryFixtures(now);
const owner = { id: "owner", role: "CLIENT", status: "ACTIVE" };
const id = "11111111-1111-4111-8111-111111111111";
const values = {
  ...emptyCampaign,
  title: "개인 영상",
  product: "가족",
  purpose: "기념",
  scope: "편집",
  budget: "100",
};
const state = applyCampaign(
  emptyCampaignState(),
  { revision: 0, command: { type: "publish", id, values } },
  owner,
  now,
);
describe("2-C 명시적 Mock", () => {
  it("공개 예시도 3/7/14일 간격·과거 공개·만료 예시를 일관되게 유지", () => {
    expect(new Set(fixtures.map((item) => item.days))).toEqual(
      new Set(["3", "7", "14"]),
    );
    fixtures.forEach((item) => {
      expect(
        Date.parse(item.recruitmentEndAt ?? "") -
          Date.parse(item.publishedAt ?? ""),
      ).toBe(Number(item.days) * 86400000);
      expect(Date.parse(item.publishedAt ?? "")).toBeLessThanOrEqual(
        now.getTime(),
      );
    });
  });
  it("공개 응답의 초안 상태·빈 마감·금액 오류도 거부", () => {
    const item = fixtures[0];
    if (!item) throw new Error("fixture");
    const projected = projectPublic(item);
    expect(
      listingSchema.safeParse({ ...projected, status: "DRAFT" }).success,
    ).toBe(false);
    expect(
      listingSchema.safeParse({ ...projected, recruitmentEndAt: null }).success,
    ).toBe(false);
    expect(
      listingSchema.safeParse({ ...projected, budget: "NaN" }).success,
    ).toBe(false);
  });
  it("초안·참고 자료·AI 분석 입력은 공개하지 않음", () => {
    const draft = applyCampaign(
      emptyCampaignState(),
      { revision: 0, command: { type: "save", id, values } },
      owner,
      now,
    );
    expect(
      projectPublic(
        draft.items[0] ??
          fixtures[0] ??
          (() => {
            throw new Error("fixture");
          })(),
      ),
    ).toBeUndefined();
    expect(
      browseCampaigns([...fixtures, ...draft.items], {}, now.getTime()).total,
    ).toBe(8);
    expect(
      JSON.stringify(browseCampaigns(fixtures, {}, now.getTime())),
    ).not.toContain("PRIVATE");
    expect(
      projectPublic(
        state.items[0] ??
          fixtures[0] ??
          (() => {
            throw new Error("fixture");
          })(),
      ),
    ).not.toHaveProperty("pricingApplication");
  });
  it("키워드·제품·예산·상태의 교집합 및 페이지 결과 일치", () => {
    const result = browseCampaigns(
      fixtures,
      {
        q: "제품",
        product: "생활",
        budgetMin: "100000",
        budgetMax: "350000",
        sort: "BUDGET_HIGH",
      },
      now.getTime(),
    );
    expect(result.items.map((item) => item.budget)).toEqual([
      "350000",
      "250000",
      "150000",
    ]);
    const first = browseCampaigns(fixtures, {}, now.getTime());
    expect(first.nextDeadline).toBe(fixtures[0]?.recruitmentEndAt);
    expect(
      browseCampaigns(fixtures, { status: "CLOSED", page: "99" }, now.getTime())
        .nextDeadline,
    ).toBe(first.nextDeadline);
    const second = browseCampaigns(fixtures, { page: "2" }, now.getTime());
    expect(first.total).toBe(8);
    expect(second.totalPages).toBe(2);
    expect(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
    ).toBe(8);
    expect(
      browseCampaigns(fixtures, { page: "99" }, now.getTime()).items,
    ).toEqual([]);
    expect(
      browseCampaigns(fixtures, { status: "CLOSED" }, now.getTime()).total,
    ).toBe(1);
    expect(
      browseCampaigns(fixtures, { q: "없는결과" }, now.getTime()).total,
    ).toBe(0);
  });
  it("마감임박·최신 정렬과 동률 ID 순서 안정", () => {
    expect(
      browseCampaigns(fixtures, { sort: "DEADLINE" }, now.getTime()).items[0]
        ?.id,
    ).toBe(fixtures[0]?.id);
    const tied = fixtures.map((item) => ({
      ...item,
      publishedAt: now.toISOString(),
    }));
    expect(
      browseCampaigns(tied.reverse(), {}, now.getTime()).items[0]?.id,
    ).toBe(fixtures[0]?.id);
  });
  it("잘못된 URL·예산 역전·NaN·과도한 페이지 거부", () => {
    [
      { page: "-1" },
      { page: "1e3" },
      { page: "100001" },
      { budgetMin: "NaN" },
      { budgetMin: "9", budgetMax: "1" },
      { status: "DRAFT" },
      { q: "a".repeat(101) },
    ].forEach((query) =>
      expect(browseQuerySchema.safeParse(query).success).toBe(false),
    );
  });
  it("3/7/14일 마감 직전 허용·정각과 직후 차단", () => {
    ["3", "7", "14"].forEach((days) => {
      const published = applyCampaign(
        emptyCampaignState(),
        {
          revision: 0,
          command: { type: "publish", id, values: { ...values, days } },
        },
        owner,
        now,
      ).items[0];
      if (!published || !published.recruitmentEndAt) throw new Error("fixture");
      const deadline = Date.parse(published.recruitmentEndAt);
      expect(recruitmentStatus(published, deadline - 1)).toBe("OPEN");
      expect(recruitmentStatus(published, deadline)).toBe("CLOSED");
      expect(recruitmentStatus(published, deadline + 1)).toBe("CLOSED");
    });
  });
  it("본인만 수동 마감·revision 충돌·멱등·재공개 차단·내용 보존", () => {
    expect(() => closeCampaign(state, id, 0, owner, now)).toThrow("최신");
    expect(() =>
      closeCampaign(state, id, 1, { ...owner, id: "other" }, now),
    ).toThrow("본인");
    expect(() =>
      closeCampaign(state, id, 1, { ...owner, role: "CREATOR" }, now),
    ).toThrow("의뢰인");
    expect(() =>
      closeCampaign(state, id, 1, { ...owner, status: "SUSPENDED" }, now),
    ).toThrow("활성");
    const closed = closeCampaign(state, id, 1, owner, now);
    expect(closed.items[0]).toMatchObject({
      ...state.items[0],
      status: "CLOSED",
      closedAt: now.toISOString(),
    });
    expect(closeCampaign(closed, id, 0, owner, now)).toBe(closed);
    expect(
      applyCampaign(
        closed,
        { revision: 2, command: { type: "publish", id, values } },
        owner,
      ),
    ).toBe(closed);
    expect(state.items[0]?.status).toBe("OPEN");
  });
});
