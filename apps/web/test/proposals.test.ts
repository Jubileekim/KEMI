import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import {
  changeProposals,
  emptyProposals,
  hasRoom,
  participant,
  unreadCount,
  type ProposalState,
  type ProposalCommand,
} from "../src/mocks/proposal-model";
import { discoveryFixtures } from "../src/mocks/discovery-model";
import { emptyStudio } from "../src/mocks/studio-model";
import { emptyWork } from "../src/mocks/portfolio-model";

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("fixture missing");
  return value;
}

const now = new Date("2026-10-24T01:00:00Z");
const campaigns = discoveryFixtures(now);
const campaign = required(campaigns[0]);
const creator: AuthUser = {
  id: "creator",
  name: "제작자",
  email: null,
  role: "CREATOR",
  status: "ACTIVE",
};
const client: AuthUser = {
  ...creator,
  id: campaign.ownerId,
  name: "의뢰인",
  role: "CLIENT",
};
const other = { ...creator, id: "other" };
const studio = {
  ...emptyStudio(),
  service: "PUBLIC" as const,
  works: [
    {
      ...emptyWork,
      id: "work",
      title: "공개 샘플",
      visibility: "PUBLIC" as const,
    },
  ],
};
const id = "10000000-0000-4000-8000-000000000001";
const id2 = "10000000-0000-4000-8000-000000000002";
const mid = "20000000-0000-4000-8000-000000000001";
const values = {
  direction: "제작 방향",
  quote: "120000",
  days: "5",
  workIds: ["work"],
};
const submit: ProposalCommand = {
  type: "submit",
  id,
  campaignId: campaign.id,
  values,
};
const apply = (
  state: ProposalState,
  cmd: ProposalCommand,
  user = creator,
  date = now,
) => changeProposals(state, cmd, user, campaigns, studio, date);
const pending = () => apply(emptyProposals(), submit);
const discussing = () =>
  apply(pending(), { type: "discuss", id, revision: 0, reason: "" }, client);
const send: ProposalCommand = {
  type: "send",
  id,
  messageId: mid,
  text: "확인했어요",
};

describe("2-D 명시적 Mock 제안·협의", () => {
  it("공개 서비스·본인 공개 작업물만 제출하고 제목 사본만 보관", () => {
    const state = pending();
    expect(state.items[0]?.works).toEqual([{ id: "work", title: "공개 샘플" }]);
    required(studio.works[0]).title = "변경한 제목";
    expect(state.items[0]?.works[0]?.title).toBe("공개 샘플");
    required(studio.works[0]).title = "공개 샘플";
    expect(() =>
      changeProposals(
        emptyProposals(),
        submit,
        creator,
        campaigns,
        emptyStudio(),
        now,
      ),
    ).toThrow(/공개 서비스/);
    expect(() =>
      apply(emptyProposals(), {
        ...submit,
        values: { ...values, workIds: ["private"] },
      }),
    ).toThrow(/공개 작업물/);
  });
  it("정확한 마감 시각·초안·본인 공고·비활성·역할 차단", () => {
    expect(() =>
      apply(
        emptyProposals(),
        submit,
        creator,
        new Date(required(campaign.recruitmentEndAt)),
      ),
    ).toThrow(/마감/);
    expect(() =>
      apply(emptyProposals(), submit, { ...creator, id: campaign.ownerId }),
    ).toThrow(/본인 공고/);
    expect(() => apply(emptyProposals(), submit, client)).toThrow();
    expect(() =>
      apply(emptyProposals(), submit, { ...creator, status: "RESTRICTED" }),
    ).toThrow();
    expect(() =>
      changeProposals(
        emptyProposals(),
        submit,
        creator,
        [{ ...campaign, status: "DRAFT" }],
        studio,
        now,
      ),
    ).toThrow();
  });
  it("중복 클릭은 같은 제출 재사용, 새 식별자의 중복·종료 후 재지원은 D06 대기", () => {
    const state = pending();
    expect(apply(state, submit)).toBe(state);
    expect(() => apply(state, { ...submit, id: id2 })).toThrow(/이미 제출/);
    expect(() =>
      apply(state, { ...submit, values: { ...values, quote: "99" } }),
    ).toThrow(/충돌/);
    const closed = apply(state, {
      type: "withdraw",
      id,
      revision: 0,
      reason: "일정 변경",
    });
    expect(() => apply(closed, { ...submit, id: id2 })).toThrow(/D06/);
    expect(hasRoom(required(closed.items[0]))).toBe(false);
  });
  it("협의는 다른 후보 유지·계약 미확정, 반복 협의는 같은 방", () => {
    let state = apply(pending(), { ...submit, id: id2 }, other);
    state = apply(
      state,
      { type: "discuss", id, revision: 0, reason: "" },
      client,
    );
    expect(state.items.map((item) => item.status)).toEqual([
      "DISCUSSING",
      "PENDING",
    ]);
    expect(state.items.every((item) => !item.contracted)).toBe(true);
    expect(
      apply(state, { type: "discuss", id, revision: 0, reason: "" }, client),
    ).toBe(state);
    expect(hasRoom(required(state.items[0]))).toBe(true);
  });
  it("비당사자·잘못된 역할·오래된 revision 변경 차단", () => {
    expect(participant(required(pending().items[0]), other)).toBe(false);
    expect(() =>
      apply(pending(), { type: "discuss", id, revision: 0, reason: "" }, other),
    ).toThrow();
    expect(() =>
      apply(pending(), { type: "discuss", id, revision: 0, reason: "" }),
    ).toThrow();
    expect(() =>
      apply(discussing(), {
        type: "withdraw",
        id,
        revision: 0,
        reason: "일정",
      }),
    ).toThrow(/최신/);
  });
  it("후보별·의뢰별 대화 격리 및 일반 대화 48시간 만료 없음", () => {
    let state = apply(discussing(), {
      ...submit,
      id: id2,
      campaignId: required(campaigns[1]).id,
    });
    state = apply(
      state,
      { type: "discuss", id: id2, revision: 0, reason: "" },
      client,
    );
    state = apply(state, send, creator, new Date(now.getTime() + 3 * 86400000));
    expect(state.messages[id]?.length).toBe(1);
    expect(state.messages[id2]).toBeUndefined();
    expect(() => apply(state, { ...send, id: id2 }, other)).toThrow();
  });
  it("마감 후 기존 협의 전송 유지", () => {
    const state = changeProposals(
      discussing(),
      send,
      creator,
      [{ ...campaign, status: "CLOSED" }],
      studio,
      now,
    );
    expect(state.messages[id]?.length).toBe(1);
  });
  it("같은 메시지 ID 수동 재시도는 중복 없음·다른 내용 거부", () => {
    const state = apply(discussing(), send);
    expect(apply(state, send)).toBe(state);
    expect(() => apply(state, { ...send, text: "다른 내용" })).toThrow(/충돌/);
    expect(() => apply(state, { ...send, text: "  " })).toThrow();
  });
  it("방 읽음은 상대 메시지만 집계하고 오래된 읽음으로 되돌아가지 않음", () => {
    let state = apply(discussing(), send);
    expect(unreadCount(state, required(state.items[0]), client)).toBe(1);
    expect(unreadCount(state, required(state.items[0]), creator)).toBe(0);
    state = apply(state, { type: "read", id, through: mid }, client);
    expect(unreadCount(state, required(state.items[0]), client)).toBe(0);
    state = apply(state, { ...send, messageId: id2, text: "두 번째" });
    state = apply(state, { type: "read", id, through: id2 }, client);
    expect(apply(state, { type: "read", id, through: mid }, client)).toBe(
      state,
    );
  });
  it.each(["withdraw", "decline"] as const)(
    "%s 사유·기록 보존, 읽음 허용·종료 방 전송 차단",
    (type) => {
      const state = apply(
        apply(discussing(), send),
        { type, id, revision: 1, reason: "일정 변경" },
        type === "withdraw" ? creator : client,
      );
      expect(state.items[0]?.reason).toBe("일정 변경");
      expect(state.messages[id]?.length).toBe(1);
      expect(() => apply(state, { ...send, messageId: id2 })).toThrow(
        /읽기 전용/,
      );
      expect(() =>
        apply(state, { type: "read", id, through: mid }, client),
      ).not.toThrow();
    },
  );
  it("무선정은 남은 제안 일괄 종료·신규 제출 차단·방 기록 보존", () => {
    let state = apply(discussing(), { ...submit, id: id2 }, other);
    state = apply(
      state,
      { type: "end", campaignId: campaign.id, reason: "기획 보류" },
      client,
    );
    expect(state.items.map((item) => item.status)).toEqual(["ENDED", "ENDED"]);
    expect(hasRoom(required(state.items[1]))).toBe(false);
    expect(() =>
      apply(state, { ...submit, id: mid }, { ...other, id: "third" }),
    ).toThrow();
    expect(() => apply(state, send)).toThrow(/읽기 전용/);
  });
  it("확정 계약은 거절·철회·무선정 종료 금지", () => {
    const state = discussing();
    required(state.items[0]).contracted = true;
    expect(() =>
      apply(
        state,
        { type: "decline", id, revision: 1, reason: "취소" },
        client,
      ),
    ).toThrow(/취소 절차/);
    expect(() =>
      apply(state, { type: "withdraw", id, revision: 1, reason: "취소" }),
    ).toThrow(/취소 절차/);
    expect(() =>
      apply(
        state,
        { type: "end", campaignId: campaign.id, reason: "취소" },
        client,
      ),
    ).toThrow(/취소 절차/);
  });
});
