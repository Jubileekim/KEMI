import { describe, it, expect } from "vitest";
import {
  applyCampaign,
  campaignDeadline,
  campaignProblems,
  campaignTime,
  emptyCampaign,
  emptyCampaignState,
  publicCampaigns,
} from "../src/mocks/campaign-model";

const owner = { id: "owner", role: "CLIENT", status: "ACTIVE" };
const id = "6ed68f45-5b94-419b-9425-f52ca8701c57";
const values = {
  ...emptyCampaign,
  title: "개인 기념 영상",
  product: "가족 영상",
  purpose: "기념",
  scope: "편집 1편",
  budget: "100000",
};
const now = new Date("2026-12-31T15:23:45.000Z");
const save = (v = emptyCampaign) => ({
  revision: 0,
  command: { type: "save", id, values: v },
});
const publish = (v = values, revision = 0) => ({
  revision,
  command: { type: "publish", id, values: v },
});
describe("CAMP-01/02 explicit Mock", () => {
  it("빈 초안 저장·본인 재편집·공개 목록 제외·원본 불변", () => {
    const initial = emptyCampaignState();
    const draft = applyCampaign(initial, save(), owner, now);
    expect(draft.items[0]).toMatchObject({
      status: "DRAFT",
      publishedAt: null,
      recruitmentEndAt: null,
    });
    expect(publicCampaigns(draft)).toEqual([]);
    expect(initial.items).toEqual([]);
    const edited = applyCampaign(
      draft,
      { ...save(values), revision: 1 },
      owner,
      now,
    );
    expect(edited.items[0]?.title).toBe(values.title);
    expect(draft.items[0]?.title).toBe("");
  });
  it("D04 누락·소수·음수·지수·위험 정수 예산 공개 차단", () => {
    expect(() =>
      applyCampaign(emptyCampaignState(), publish(emptyCampaign), owner),
    ).toThrow("입력");
    ["-1", "1.5", "1e4", "Infinity", "9007199254740992", "0"].forEach(
      (budget) => {
        expect(campaignProblems({ ...values, budget })).not.toEqual([]);
      },
    );
    expect(campaignProblems({ ...values, budget: " 100 " })).toEqual([]);
  });
  it("브랜드 프로필과 참고 자료 없이 개인 공개", () => {
    const state = applyCampaign(emptyCampaignState(), publish(), owner, now);
    expect(publicCampaigns(state)).toHaveLength(1);
    expect(state.items[0]?.publishedAt).toBe(now.toISOString());
  });
  it.each(["3", "7", "14"] as const)(
    "P06 %s일·연도 경계·같은 시각·한국 시간",
    (days) => {
      const state = applyCampaign(
        emptyCampaignState(),
        publish({ ...values, days }),
        owner,
        now,
      );
      const expected = campaignDeadline(now, days);
      expect(state.items[0]?.recruitmentEndAt).toBe(expected);
      expect(new Date(expected).getTime() - now.getTime()).toBe(
        Number(days) * 86400000,
      );
      expect(campaignTime(now.toISOString())).toContain("2027. 01. 01.");
      expect(campaignTime(now.toISOString())).toContain("00:23:45");
    },
  );
  it("초안 작성 시간 대신 공개 처리 시각으로 계산", () => {
    const draft = applyCampaign(emptyCampaignState(), save(values), owner, now);
    const later = new Date("2027-02-27T17:59:00Z");
    const state = applyCampaign(draft, publish(values, 1), owner, later);
    expect(state.items[0]?.recruitmentEndAt).toBe("2027-03-06T17:59:00.000Z");
  });
  it("중복 공개는 오래된 revision에도 마감·내용 불변", () => {
    const state = applyCampaign(emptyCampaignState(), publish(), owner, now);
    const duplicate = applyCampaign(
      state,
      publish({ ...values, days: "14" }),
      owner,
      new Date("2027-01-20"),
    );
    expect(duplicate).toBe(state);
    expect(() =>
      applyCampaign(state, { ...save(values), revision: 1 }, owner),
    ).toThrow("후속 범위");
  });
  it("타인·비의뢰인·비활성 차단", () => {
    const state = applyCampaign(emptyCampaignState(), save(), owner);
    expect(() =>
      applyCampaign(
        state,
        { ...save(), revision: 1 },
        { ...owner, id: "other" },
      ),
    ).toThrow("본인");
    expect(() =>
      applyCampaign(emptyCampaignState(), publish(), {
        ...owner,
        role: "CREATOR",
      }),
    ).toThrow("의뢰인");
    expect(() =>
      applyCampaign(emptyCampaignState(), publish(), {
        ...owner,
        status: "SUSPENDED",
      }),
    ).toThrow("활성");
  });
  it("revision 경쟁 충돌과 입력 보호·잘못된 일수 차단", () => {
    const state = applyCampaign(emptyCampaignState(), save(), owner);
    expect(() => applyCampaign(state, save(values), owner)).toThrow("최신");
    expect(() =>
      applyCampaign(
        emptyCampaignState(),
        save({ ...values, title: "a".repeat(4001) }),
        owner,
      ),
    ).toThrow();
    expect(() =>
      applyCampaign(
        emptyCampaignState(),
        {
          revision: 0,
          command: { type: "save", id, values: { ...values, days: "5" } },
        },
        owner,
      ),
    ).toThrow();
  });
});
