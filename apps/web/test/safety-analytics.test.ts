import { describe, it, expect } from "vitest";
import type { AuthUser } from "@kemi/shared";
import { changeSafety } from "../src/mocks/safety-model";
import {
  createAnalyticsRecorder,
  analyticsEventSchema,
  type AnalyticsEvent,
} from "../src/shared/analytics/events";

const client: AuthUser = {
  id: "c",
  email: null,
  name: "의뢰인",
  role: "CLIENT",
  status: "ACTIVE",
};
const ops: AuthUser = { ...client, id: "o", role: "ADMIN" };
const creator: AuthUser = { ...client, id: "r", role: "CREATOR" };
const report = {
  type: "report",
  id: "00000000-0000-4000-8000-000000000001",
  targetType: "request",
  targetId: "00000000-0000-4000-8000-000000000002",
  reason: "검토 부탁해요",
  evidence: "텍스트 근거",
};
const operation = {
  type: "operate",
  id: "00000000-0000-4000-8000-000000000003",
  reportId: report.id,
  action: "LIMIT",
  note: "DEV 제한 근거",
};
describe("7-C 신고·운영 경계", () => {
  it("신고 반복·3건 접수로 자동 제재하지 않으며 입력·자기신고 차단", () => {
    const records = changeSafety([], report, client, creator.id);
    expect(changeSafety(records, report, client, creator.id)).toEqual(records);
    expect(records[0]?.limited).toBe(false);
    const three = [
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ].reduce(
      (state, id) => changeSafety(state, { ...report, id }, client, creator.id),
      records,
    );
    expect(three.every((r) => !r.limited)).toBe(true);
    expect(() =>
      changeSafety(
        records,
        { ...report, reason: "changed" },
        client,
        creator.id,
      ),
    ).toThrow();
    expect(() => changeSafety([], report, client, client.id)).toThrow();
    expect(() =>
      changeSafety([], { ...report, subjectId: "x" }, client, creator.id),
    ).toThrow();
  });
  it("운영자만 근거 조치·명시 해제, 대상자만 이의·동일 처리 멱등", () => {
    const initial = changeSafety([], report, client, creator.id);
    expect(() => changeSafety(initial, operation, client)).toThrow();
    expect(() =>
      changeSafety(initial, { ...operation, note: " " }, ops),
    ).toThrow();
    const limited = changeSafety(initial, operation, ops);
    expect(changeSafety(limited, operation, ops)).toEqual(limited);
    expect(limited[0]?.limited).toBe(true);
    const appeal = {
      type: "appeal",
      id: "00000000-0000-4000-8000-000000000006",
      reportId: report.id,
      note: "이의 설명",
    };
    expect(() => changeSafety(limited, appeal, client)).toThrow();
    const appealed = changeSafety(limited, appeal, creator);
    expect(appealed[0]?.limited).toBe(true);
    expect(
      changeSafety(
        appealed,
        { ...operation, id: crypto.randomUUID(), action: "WARN" },
        ops,
      )[0]?.limited,
    ).toBe(true);
    expect(
      changeSafety(
        appealed,
        { ...operation, id: crypto.randomUUID(), action: "RELEASE" },
        ops,
      )[0]?.limited,
    ).toBe(false);
  });
});
describe("7-C 개인정보 없는 테스트 분석", () => {
  const event = {
    name: "contract_confirmed",
    objectId: report.id,
    at: new Date().toISOString(),
    test: true,
  };
  it("추가 개인정보·URL·실데이터 표식을 거부한다", () => {
    [
      { ...event, email: "private@example.test" },
      { ...event, brief: "private" },
      { ...event, test: false },
      { ...event, objectId: "https://example.test/private" },
    ].forEach((raw) =>
      expect(analyticsEventSchema.safeParse(raw).success).toBe(false),
    );
  });
  it("계약·완료·의뢰 확정만 중복 제거하고 노출은 계약으로 집계하지 않는다", () => {
    const records: AnalyticsEvent[] = [];
    const record = createAnalyticsRecorder((value) => records.push(value));
    expect(record(event)).toBe(true);
    expect(record(event)).toBe(false);
    record({ ...event, name: "feed_view" });
    record({ ...event, name: "feed_view" });
    record({ ...event, name: "transaction_completed" });
    record({ ...event, name: "transaction_completed" });
    expect(records.map((r) => r.name)).toEqual([
      "contract_confirmed",
      "feed_view",
      "feed_view",
      "transaction_completed",
    ]);
  });
  it("분석 sink 실패를 반환하고 거래 호출자에게 전파하지 않는다", () => {
    let fail = true;
    const record = createAnalyticsRecorder(() => {
      if (fail) throw new Error("sink failed");
    });
    expect(record(event)).toBe(false);
    fail = false;
    expect(record(event)).toBe(true);
    expect(record(event)).toBe(false);
  });
});
