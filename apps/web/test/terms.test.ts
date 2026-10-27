import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import {
  emptyTerms,
  referenceSources,
  saveTerms,
  termsCommandSchema,
  termsDocumentSchema,
  missingTerms,
  type TermsCommand,
} from "../src/mocks/terms-model";
import { emptyStudio, emptyPackage } from "../src/mocks/studio-model";
import { emptyCampaign } from "../src/mocks/campaign-model";
import type { Proposal } from "../src/mocks/proposal-model";

const client: AuthUser = {
  id: "client",
  role: "CLIENT",
  name: "의뢰인",
  email: null,
  status: "ACTIVE",
};
const creator: AuthUser = { ...client, id: "creator", role: "CREATOR" };
const item: Proposal = {
  id: "10000000-0000-4000-8000-000000000001",
  campaignId: "campaign",
  clientId: "client",
  creatorId: "creator",
  creatorName: "제작자",
  clientName: "의뢰인",
  title: "공고",
  direction: "협의 방향",
  quote: "120000",
  days: "5",
  works: [],
  status: "DISCUSSING",
  reason: "",
  revision: 1,
  createdAt: "2026-10-24T00:00:00Z",
  contracted: false,
  roomCreated: true,
};
const campaign = {
  ...emptyCampaign,
  id: "campaign",
  ownerId: "client",
  status: "CLOSED" as const,
  publishedAt: null,
  recruitmentEndAt: null,
  title: "원본 공고",
  scope: "촬영",
  budget: "150000",
  references: "비공개 참고 자료",
};
const studio = {
  ...emptyStudio(),
  primaryId: "package",
  packages: [
    {
      ...emptyPackage,
      id: "package",
      visibility: "PUBLIC" as const,
      price: "100000",
      title: "원본 상품",
    },
  ],
};
const sources = referenceSources(item, campaign, studio);
const cmd: TermsCommand = {
  id: "20000000-0000-4000-8000-000000000001",
  requestId: item.id,
  revision: 0,
  sources,
  values: { ...emptyTerms, amount: "110000" },
};
const nextId = "20000000-0000-4000-8000-000000000002";
const first = () => saveTerms(undefined, cmd, client, item, sources);

describe("3-A explicit Mock terms versions", () => {
  it("불완전 초안을 저장하고 누락을 별도 표시하며 서명/계약 상태를 만들지 않는다", () => {
    const doc = first();
    expect(doc.revision).toBe(1);
    expect(missingTerms(doc.versions[0]?.values ?? emptyTerms)).toHaveLength(7);
    expect(doc).not.toHaveProperty("signatures");
    expect(item.contracted).toBe(false);
    expect(item.status).toBe("DISCUSSING");
  });
  it("양 당사자가 새 버전만 추가하며 이전 값·저장자·시각·사본을 보존한다", () => {
    const doc = first();
    const before = structuredClone(doc);
    const next = saveTerms(
      doc,
      {
        ...cmd,
        id: nextId,
        revision: 1,
        values: { ...cmd.values, amount: "130000" },
      },
      creator,
      item,
      sources,
      new Date("2026-10-24T01:00:00Z"),
    );
    expect(doc).toEqual(before);
    expect(next.versions).toHaveLength(2);
    expect(next.versions[0]).toEqual(doc.versions[0]);
    expect(next.versions[1]).toMatchObject({
      number: 2,
      authorId: creator.id,
      createdAt: "2026-10-24T01:00:00.000Z",
    });
    expect(next.sources).toEqual(sources);
  });
  it("오래된 revision 덮어쓰기를 거절하고 명시적 최신 기준 저장만 허용한다", () => {
    const doc = first();
    const stale = {
      ...cmd,
      id: nextId,
      values: { ...cmd.values, scope: "편집" },
    };
    expect(() => saveTerms(doc, stale, creator, item, sources)).toThrow(
      "다른 작성본",
    );
    expect(
      saveTerms(doc, { ...stale, revision: 1 }, creator, item, sources)
        .versions,
    ).toHaveLength(2);
  });
  it("응답 유실 재전송은 동일 객체로 처리하고 ID/내용·저장자 충돌은 거절한다", () => {
    const doc = first();
    expect(saveTerms(doc, cmd, client, item, sources)).toBe(doc);
    expect(() =>
      saveTerms(doc, { ...cmd, values: emptyTerms }, client, item, sources),
    ).toThrow("식별자");
    expect(() => saveTerms(doc, cmd, creator, item, sources)).toThrow("식별자");
  });
  it("같은 값의 새 요청도 중복 버전을 만들지 않는다", () => {
    const doc = first();
    expect(
      saveTerms(
        doc,
        { ...cmd, id: nextId, revision: 1 },
        client,
        item,
        sources,
      ),
    ).toBe(doc);
  });
  it.each([
    { ...client, id: "outsider" },
    { ...client, role: "CREATOR" as const },
    { ...client, status: "RESTRICTED" as const },
  ])("비당사자/역할/비활성 저장 차단: $id/$role/$status", (user) => {
    expect(() => saveTerms(undefined, cmd, user, item, sources)).toThrow();
  });
  it.each(["PENDING", "DECLINED", "WITHDRAWN", "ENDED"] as const)(
    "종료·미협의 %s는 쓰기 차단",
    (status) => {
      expect(() =>
        saveTerms(undefined, cmd, client, { ...item, status }, sources),
      ).toThrow();
    },
  );
  it("방 미생성·확정 계약·다른 의뢰 ID 쓰기 차단", () => {
    expect(() =>
      saveTerms(
        undefined,
        cmd,
        client,
        { ...item, roomCreated: false },
        sources,
      ),
    ).toThrow();
    expect(() =>
      saveTerms(undefined, cmd, client, { ...item, contracted: true }, sources),
    ).toThrow();
    expect(() =>
      saveTerms(
        undefined,
        { ...cmd, requestId: nextId },
        client,
        item,
        sources,
      ),
    ).toThrow();
  });
  it("공개 참조만 투영하고 첫 저장 후 원본 가격·공고 변경과 독립한다", () => {
    expect(JSON.stringify(sources)).not.toContain("비공개 참고 자료");
    expect(
      referenceSources(item, campaign, {
        ...studio,
        packages: [
          {
            ...studio.packages[0],
            ...emptyPackage,
            id: "package",
            visibility: "PRIVATE",
          },
        ],
      }).package,
    ).toBeNull();
    const doc = first();
    if (!sources.campaign) throw new Error("campaign fixture missing");
    const changed = {
      ...sources,
      campaign: { ...sources.campaign, budget: "999999" },
    };
    const next = saveTerms(
      doc,
      {
        ...cmd,
        id: nextId,
        revision: 1,
        values: { ...cmd.values, scope: "최종 범위" },
      },
      client,
      item,
      changed,
    );
    expect(next.sources.campaign?.budget).toBe("150000");
    expect(next.sources.package?.price).toBe("100000");
    expect(next.versions[0]?.values.amount).toBe("110000");
    expect(() => saveTerms(undefined, cmd, client, item, changed)).toThrow(
      "참조",
    );
  });
  it("입력/응답 스키마는 추가 서명·악성 금액·과대 입력·형식 오류를 차단한다", () => {
    expect(
      termsCommandSchema.safeParse({ ...cmd, signature: "forged" }).success,
    ).toBe(false);
    expect(
      termsCommandSchema.safeParse({
        ...cmd,
        values: { ...cmd.values, amount: "-1" },
      }).success,
    ).toBe(false);
    expect(
      termsCommandSchema.safeParse({
        ...cmd,
        values: { ...cmd.values, amount: "9007199254740992" },
      }).success,
    ).toBe(false);
    expect(
      termsCommandSchema.safeParse({
        ...cmd,
        values: { ...cmd.values, scope: "x".repeat(4001) },
      }).success,
    ).toBe(false);
    expect(termsDocumentSchema.safeParse({ invalid: true }).success).toBe(
      false,
    );
  });
});
