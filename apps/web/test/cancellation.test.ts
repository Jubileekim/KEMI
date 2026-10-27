import { describe, it, expect } from "vitest";
import {
  emptyResolution,
  changeCancellation,
  cancellationCommandSchema,
} from "../src/mocks/resolution-model";

const now = "2026-10-27T00:00:00.000Z";
const values = {
  reason: "일정 변경",
  progress: "편집 일부 완료",
  compensation: 80000,
  files: "편집본 ZIP",
  unfinished: "잔여 작업 중단",
  originals: "촬영 원본 포함",
  rights: "광고 1회 사용",
};
const propose = {
  type: "propose",
  id: crypto.randomUUID(),
  revision: 0,
  values,
} as const;
const requested = () =>
  changeCancellation(emptyResolution(), propose, "client", 200000, 200000, now);
describe("취소 요청과 동일 버전 양측 합의", () => {
  it("요청은 확인 없는 버전과 보류 기록만 생성하며 금액과 파일/권리를 보존한다", () => {
    const state = requested();
    expect(state.versions[0]).toMatchObject({
      values,
      refund: 120000,
      confirmations: [],
    });
    expect(state).not.toHaveProperty("settlement");
    expect(state).not.toHaveProperty("refundResult");
  });
  it("같은 명령은 중복 생성하지 않고 다른 사용자/내용의 같은 ID를 거부한다", () => {
    const state = requested();
    expect(
      changeCancellation(state, propose, "client", 200000, 200000, now),
    ).toBe(state);
    expect(() =>
      changeCancellation(state, propose, "creator", 200000, 200000, now),
    ).toThrow();
    expect(() =>
      changeCancellation(
        state,
        { ...propose, values: { ...values, rights: "변조" } },
        "client",
        200000,
        200000,
        now,
      ),
    ).toThrow();
  });
  it("양측은 같은 최신 버전만 확인하며 새 제안은 기존 확인을 승계하지 않는다", () => {
    const state = requested();
    const first = changeCancellation(
      state,
      {
        type: "confirm",
        id: crypto.randomUUID(),
        revision: 1,
        versionId: propose.id,
        consent: true,
      },
      "client",
      200000,
      200000,
      now,
    );
    const next = changeCancellation(
      first,
      { ...propose, id: crypto.randomUUID(), revision: 2 },
      "creator",
      200000,
      200000,
      now,
    );
    expect(next.versions[0]?.confirmations).toEqual(["client"]);
    expect(next.versions[1]?.confirmations).toEqual([]);
    expect(() =>
      changeCancellation(
        next,
        {
          type: "confirm",
          id: crypto.randomUUID(),
          revision: 3,
          versionId: propose.id,
          consent: true,
        },
        "creator",
        200000,
        200000,
        now,
      ),
    ).toThrow();
  });
  it("음수/계약 초과/미동의/미결제/구 revision을 차단한다", () => {
    expect(
      cancellationCommandSchema.safeParse({
        ...propose,
        values: { ...values, compensation: -1 },
      }).success,
    ).toBe(false);
    expect(() =>
      changeCancellation(
        emptyResolution(),
        propose,
        "client",
        50000,
        50000,
        now,
      ),
    ).toThrow();
    const cmd = {
      type: "confirm",
      id: crypto.randomUUID(),
      revision: 1,
      versionId: propose.id,
      consent: true,
    } as const;
    expect(() =>
      changeCancellation(requested(), cmd, "creator", 200000, null, now),
    ).toThrow();
    expect(() =>
      changeCancellation(
        requested(),
        { ...cmd, revision: 0 },
        "creator",
        200000,
        200000,
        now,
      ),
    ).toThrow();
    expect(
      cancellationCommandSchema.safeParse({ ...cmd, consent: false }).success,
    ).toBe(false);
  });
  it("양측 확인 뒤 임의 재작성과 일방 중복 확인을 차단한다", () => {
    const cmd = {
      type: "confirm",
      id: crypto.randomUUID(),
      revision: 1,
      versionId: propose.id,
      consent: true,
    } as const;
    const first = changeCancellation(
      requested(),
      cmd,
      "client",
      200000,
      200000,
      now,
    );
    expect(() =>
      changeCancellation(
        first,
        { ...cmd, id: crypto.randomUUID(), revision: 2 },
        "client",
        200000,
        200000,
        now,
      ),
    ).toThrow();
    const both = changeCancellation(
      first,
      { ...cmd, id: crypto.randomUUID(), revision: 2 },
      "creator",
      200000,
      200000,
      now,
    );
    expect(both.versions[0]?.confirmations).toEqual(["client", "creator"]);
    expect(() =>
      changeCancellation(
        both,
        { ...propose, id: crypto.randomUUID(), revision: 3 },
        "client",
        200000,
        200000,
        now,
      ),
    ).toThrow();
  });
});
