import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import { catalogFixture } from "../src/mocks/catalog-model";
import { emptyProposals } from "../src/mocks/proposal-model";
import sendDirect from "../src/mocks/direct-model";

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
