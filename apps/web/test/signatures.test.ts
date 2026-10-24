import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import {
  changeSignatures,
  roundStatus,
  selectContract,
  type SignatureCommand,
} from "../src/mocks/signature-model";
import {
  emptyTerms,
  referenceSources,
  type TermsDocument,
} from "../src/mocks/terms-model";
import {
  emptyProposals,
  changeProposals,
  type Proposal,
} from "../src/mocks/proposal-model";
import { emptyCampaign } from "../src/mocks/campaign-model";
import { emptyStudio } from "../src/mocks/studio-model";

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("fixture missing");
  return value;
}
const client: AuthUser = {
  id: "client",
  name: "의뢰인",
  role: "CLIENT",
  status: "ACTIVE",
  email: null,
};
const creator: AuthUser = { ...client, id: "creator", role: "CREATOR" };
const id = "10000000-0000-4000-8000-000000000001";
const vid = "20000000-0000-4000-8000-000000000001";
const secondId = "10000000-0000-4000-8000-000000000002";
const item: Proposal = {
  id,
  campaignId: "campaign",
  clientId: client.id,
  creatorId: creator.id,
  creatorName: "제작자",
  clientName: "의뢰인",
  title: "공고",
  direction: "작업",
  quote: "100000",
  days: "7",
  works: [],
  status: "DISCUSSING",
  reason: "",
  revision: 1,
  createdAt: "2026-10-24T00:00:00Z",
  contracted: false,
  roomCreated: true,
};
const now = new Date("2026-10-24T00:00:00Z");
const values = {
  ...Object.fromEntries(
    Object.keys(emptyTerms).map((key) => [key, "합의 조건"]),
  ),
  amount: "100000",
};
const doc: TermsDocument = {
  revision: 1,
  sources: referenceSources(
    item,
    {
      ...emptyCampaign,
      id: "campaign",
      ownerId: "client",
      status: "OPEN",
      publishedAt: null,
      recruitmentEndAt: null,
    },
    emptyStudio(),
  ),
  versions: [
    {
      id: vid,
      number: 1,
      authorId: "client",
      createdAt: now.toISOString(),
      values: { ...emptyTerms, ...values },
    },
  ],
};
const cmd: SignatureCommand = {
  id: crypto.randomUUID(),
  requestId: id,
  versionId: vid,
  revision: 1,
  type: "request",
  name: "의뢰인",
  consent: true,
};
const requested = () => changeSignatures([], doc, item, client, cmd, now);
const signed = () =>
  changeSignatures(
    requested(),
    doc,
    item,
    client,
    { ...cmd, type: "sign" },
    now,
  );

describe("3-B explicit Mock signatures", () => {
  it("확인 요청 시 고정 버전·48시간·서명0, 반복 요청은 기한 연장 없음", () => {
    const rounds = requested();
    expect(rounds[0]?.expiresAt).toBe("2026-10-26T00:00:00.000Z");
    expect(rounds[0]?.signatures).toHaveLength(0);
    expect(
      changeSignatures(
        rounds,
        doc,
        item,
        client,
        cmd,
        new Date(now.getTime() + 1000),
      ),
    ).toBe(rounds);
    expect(item.contracted).toBe(false);
  });
  it("누락 작성본·구버전·revision 충돌·종료 협의는 요청 불가", () => {
    const missing = {
      ...doc,
      versions: doc.versions.map((v) => ({ ...v, values: emptyTerms })),
    };
    expect(() =>
      changeSignatures([], missing, item, client, cmd, now),
    ).toThrow();
    expect(() =>
      changeSignatures(
        [],
        doc,
        item,
        client,
        { ...cmd, versionId: crypto.randomUUID() },
        now,
      ),
    ).toThrow();
    expect(() =>
      changeSignatures([], doc, item, client, { ...cmd, revision: 0 }, now),
    ).toThrow();
    expect(() =>
      changeSignatures(
        [],
        doc,
        { ...item, status: "WITHDRAWN" },
        client,
        cmd,
        now,
      ),
    ).toThrow();
  });
  it("첫 서명만 저장·중복 보호·동의 및 이름 필수", () => {
    const rounds = signed();
    expect(rounds[0]?.signatures).toHaveLength(1);
    expect(rounds[0]?.contractId).toBeNull();
    expect(
      changeSignatures(
        rounds,
        doc,
        item,
        client,
        { ...cmd, type: "sign" },
        now,
      ),
    ).toBe(rounds);
    [{ consent: false }, { name: "" }].forEach((input) =>
      expect(() =>
        changeSignatures(
          requested(),
          doc,
          item,
          creator,
          { ...cmd, type: "sign", ...input },
          now,
        ),
      ).toThrow(),
    );
  });
  it("서버 역할/당사자/활성 계정만 서명·대리 입력 차단", () => {
    [
      { ...client, id: "other" },
      { ...client, role: "CREATOR" as const },
      { ...client, status: "RESTRICTED" as const },
    ].forEach((user) =>
      expect(() =>
        changeSignatures(
          requested(),
          doc,
          item,
          user,
          { ...cmd, type: "sign" },
          now,
        ),
      ).toThrow(),
    );
  });
  it("두번째 같은 버전 서명에만 계약 식별 생성·재전송 불변", () => {
    const complete = changeSignatures(
      signed(),
      doc,
      item,
      creator,
      { ...cmd, id: secondId, type: "sign", name: "제작자" },
      now,
    );
    expect(complete[0]?.signatures).toHaveLength(2);
    expect(complete[0]?.contractId).toBe(secondId);
    expect(
      changeSignatures(
        complete,
        doc,
        { ...item, contracted: true },
        creator,
        { ...cmd, id: secondId, type: "sign", name: "제작자" },
        now,
      ),
    ).toBe(complete);
  });
  it("정각 직전 허용·정각 및 이후 거부, 일반 채팅은 유지", () => {
    const rounds = requested();
    const expires = Date.parse(rounds[0]?.expiresAt ?? "");
    expect(
      changeSignatures(
        rounds,
        doc,
        item,
        client,
        { ...cmd, type: "sign" },
        new Date(expires - 1),
      )[0]?.signatures,
    ).toHaveLength(1);
    [0, 1].forEach((offset) =>
      expect(() =>
        changeSignatures(
          rounds,
          doc,
          item,
          client,
          { ...cmd, type: "sign" },
          new Date(expires + offset),
        ),
      ).toThrow(),
    );
    const state = { ...emptyProposals(), items: [item] };
    expect(
      changeProposals(
        state,
        { type: "send", id, messageId: secondId, text: "만료 후 대화" },
        client,
        [],
        emptyStudio(),
        new Date(expires + 1),
      ).messages[id],
    ).toHaveLength(1);
  });
  it("새 버전은 이전 서명을 보존하지만 재사용하지 않고 이전 버전 차단", () => {
    const rounds = signed();
    const next = {
      ...doc,
      revision: 2,
      versions: [
        ...doc.versions,
        { ...required(doc.versions[0]), id: secondId, number: 2 },
      ],
    };
    expect(roundStatus(required(rounds[0]), next, item, now.getTime())).toBe(
      "SUPERSEDED",
    );
    expect(() =>
      changeSignatures(
        rounds,
        next,
        item,
        creator,
        { ...cmd, type: "sign" },
        now,
      ),
    ).toThrow();
    const requestedNext = changeSignatures(
      rounds,
      next,
      item,
      creator,
      { ...cmd, versionId: secondId, revision: 2 },
      now,
    );
    expect(requestedNext[0]).toEqual(rounds[0]);
    expect(requestedNext[1]?.signatures).toHaveLength(0);
  });
  it("후보 둘 중 하나만 확정·미선정/종료 후보 차단·다른 의뢰와 이력 유지", () => {
    const rival = { ...item, id: secondId, creatorId: "other" };
    const unrelated = {
      ...rival,
      id: crypto.randomUUID(),
      campaignId: "other-campaign",
    };
    const state = {
      ...emptyProposals(),
      items: [item, rival, unrelated],
      messages: {
        [id]: [
          {
            id: vid,
            text: "기존 이력",
            senderId: client.id,
            at: now.toISOString(),
          },
        ],
      },
    };
    const selected = selectContract(state, id);
    expect(selected.items[0]?.contracted).toBe(true);
    expect(selected.items[1]?.status).toBe("NOT_SELECTED");
    expect(selected.items[2]).toEqual(unrelated);
    expect(selected.messages).toEqual(state.messages);
    expect(selectContract(selected, id)).toBe(selected);
    expect(() => selectContract(selected, secondId)).toThrow();
    expect(() =>
      changeSignatures(
        signed(),
        doc,
        required(selected.items[1]),
        { ...creator, id: "other" },
        { ...cmd, requestId: secondId, type: "sign" },
        now,
      ),
    ).toThrow();
    expect(() =>
      changeProposals(
        selected,
        { type: "end", campaignId: item.campaignId, reason: "종료" },
        client,
        [
          {
            ...emptyCampaign,
            id: "campaign",
            ownerId: client.id,
            status: "OPEN",
            publishedAt: now.toISOString(),
            recruitmentEndAt: null,
          },
        ],
        emptyStudio(),
        now,
      ),
    ).toThrow();
  });
});
