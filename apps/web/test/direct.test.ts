import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import { catalogFixture } from "../src/mocks/catalog-model";
import { emptyProposals } from "../src/mocks/proposal-model";
import sendDirect, {
  expireDirect,
  respondDirect,
} from "../src/mocks/direct-model";
import { selectContract } from "../src/mocks/signature-model";
import { referenceSources } from "../src/mocks/terms-model";
import { emptyStudio } from "../src/mocks/studio-model";

const user: AuthUser = {
  id: "client",
  role: "CLIENT",
  status: "ACTIVE",
  name: "개인",
  email: null,
};
const pack = catalogFixture().packages[0];
if (!pack) throw new Error("package fixture");
const creator = {
  id: "creator",
  name: "제작자",
  primaryId: pack.id,
  packages: [pack],
  works: [],
};
const cmd = {
  id: crypto.randomUUID(),
  creatorId: creator.id,
  packageId: pack.id,
  snapshot: pack,
  values: { title: "직접 의뢰", brief: "소개 영상", conditions: "기간 협의" },
};
const now = new Date("2026-10-27T00:00:00Z");
describe("6-B 직접 의뢰 발송", () => {
  it("브랜드 없는 개인도 캠페인 없이 발송,48시간·패키지 사본·미계약 보존", () => {
    const state = sendDirect(emptyProposals(), cmd, user, creator, now);
    expect(state.items[0]).toMatchObject({
      campaignId: null,
      roomCreated: false,
      contracted: false,
      direct: { respondDueAt: "2026-10-29T00:00:00.000Z", snapshot: pack },
    });
    const copy = structuredClone(creator);
    if (copy.packages[0]) copy.packages[0].price = "999";
    expect(state.items[0]?.direct?.snapshot.price).toBe("100000");
    expect(sendDirect(state, cmd, user, null, now)).toBe(state);
    expect(() =>
      sendDirect(
        state,
        { ...cmd, values: { ...cmd.values, brief: "다른 내용" } },
        user,
        creator,
        now,
      ),
    ).toThrow();
  });
  it("같은 요청 ID에서 다른 packageId는 멱등 성공하지 않고 충돌 처리", () => {
    const state = sendDirect(emptyProposals(), cmd, user, creator, now);
    expect(sendDirect(state, cmd, user, null, now)).toBe(state);
    expect(() =>
      sendDirect(
        state,
        { ...cmd, packageId: "different-package" },
        user,
        creator,
        now,
      ),
    ).toThrow("발송 식별자가 충돌해요.");
    expect(state.items).toHaveLength(1);
  });
  it("타 제작자·비공개·변경 패키지와 역할·비활성 발송을 차단", () => {
    expect(() =>
      sendDirect(emptyProposals(), cmd, { ...user, role: "CREATOR" }, creator),
    ).toThrow();
    expect(() =>
      sendDirect(
        emptyProposals(),
        cmd,
        { ...user, status: "RESTRICTED" },
        creator,
      ),
    ).toThrow();
    expect(() =>
      sendDirect(emptyProposals(), cmd, user, { ...creator, id: "other" }),
    ).toThrow();
    expect(() => sendDirect(emptyProposals(), cmd, user, null)).toThrow();
    expect(() =>
      sendDirect(emptyProposals(), cmd, user, { ...creator, packages: [] }),
    ).toThrow();
    expect(() =>
      sendDirect(
        emptyProposals(),
        { ...cmd, snapshot: { ...pack, price: "1" } },
        user,
        creator,
      ),
    ).toThrow();
    expect(() =>
      sendDirect(
        emptyProposals(),
        { ...cmd, packageId: "foreign" },
        user,
        creator,
      ),
    ).toThrow();
  });
});

describe("6-C 수신 응답·48시간과 캠페인 없는 공통 거래", () => {
  const receiver: AuthUser = { ...user, id: creator.id, role: "CREATOR" };
  const response = {
    id: cmd.id,
    revision: 0,
    action: "accept" as const,
    reason: "",
  };
  const sent = () => sendDirect(emptyProposals(), cmd, user, creator, now);
  it("마감 직전 수신자만 수락하며 방 하나·미계약, 응답 기한은 채팅에 적용 안 함", () => {
    const before = new Date(now.getTime() + 48 * 3600000 - 1);
    expect(() => respondDirect(sent(), response, user, before)).toThrow();
    expect(() =>
      respondDirect(sent(), response, { ...receiver, id: "stranger" }, before),
    ).toThrow();
    const accepted = respondDirect(sent(), response, receiver, before);
    expect(accepted.items[0]).toMatchObject({
      status: "DISCUSSING",
      roomCreated: true,
      contracted: false,
      campaignId: null,
    });
    expect(
      respondDirect(
        accepted,
        response,
        receiver,
        new Date(before.getTime() + 60000),
      ),
    ).toBe(accepted);
    expect(expireDirect(accepted, before.getTime() + 60000)).toBe(accepted);
    expect(() =>
      respondDirect(
        accepted,
        { ...response, action: "decline" },
        receiver,
        before,
      ),
    ).toThrow();
  });
  it("정각부터 만료,중복만료 무해·수락/방/계약 불가", () => {
    const due = now.getTime() + 48 * 3600000;
    expect(() =>
      respondDirect(sent(), response, receiver, new Date(due)),
    ).toThrow();
    const expired = expireDirect(sent(), due);
    expect(expired.items[0]).toMatchObject({
      status: "EXPIRED",
      roomCreated: false,
      contracted: false,
    });
    expect(expireDirect(expired, due + 1)).toBe(expired);
    expect(() => selectContract(expired, cmd.id)).toThrow();
  });
  it("거절은 방/계약 없이 종료, 같은 거절 재전송·이후 수락 차단", () => {
    const declined = respondDirect(
      sent(),
      { ...response, action: "decline", reason: "일정 어려움" },
      receiver,
      now,
    );
    expect(declined.items[0]).toMatchObject({
      status: "DECLINED",
      roomCreated: false,
      reason: "일정 어려움",
    });
    expect(
      respondDirect(
        declined,
        { ...response, action: "decline", reason: "일정 어려움" },
        receiver,
        now,
      ),
    ).toBe(declined);
    expect(() => respondDirect(declined, response, receiver, now)).toThrow();
    expect(() =>
      respondDirect(sent(), { ...response, revision: 9 }, receiver, now),
    ).toThrow();
  });
  it("직접 의뢰 두 건과 공개 후보의 선정 분리·발송 시점의 선택 사본 참조", () => {
    let state = sent();
    const second = {
      ...cmd,
      id: crypto.randomUUID(),
      values: { ...cmd.values, title: "별도 의뢰" },
    };
    state = sendDirect(state, second, user, creator, now);
    state = respondDirect(state, response, receiver, now);
    state = respondDirect(state, { ...response, id: second.id }, receiver, now);
    state = selectContract(state, cmd.id);
    expect(state.items[1]).toMatchObject({
      status: "DISCUSSING",
      contracted: false,
    });
    state = selectContract(state, second.id);
    expect(state.items.filter((p) => p.contracted)).toHaveLength(2);
    const item = state.items[0];
    if (!item) throw new Error("request fixture");
    const sources = referenceSources(item, null, emptyStudio());
    expect(sources.campaign).toBeNull();
    expect(sources.package?.price).toBe("100000");
    expect(sources.package?.id).toBe(pack.id);
  });
});
