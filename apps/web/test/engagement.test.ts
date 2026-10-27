import { it, expect, describe } from "vitest";
import { submitReview, readNotices } from "../src/mocks/engagement-model";

const context = {
  contractId: "00000000-0000-4000-8000-000000000001",
  authorId: "client",
  targetId: "creator",
  participant: true,
  complete: true,
  cancelled: false,
};
const input = { rating: 5, content: "함께 작업했어요.", tags: ["소통"] };
describe("7-B 리뷰·읽음", () => {
  it("정상 완료 양측 각각 1회·동일 재전송은 멱등", () => {
    const records = submitReview([], input, context);
    expect(submitReview(records, input, context)).toEqual(records);
    expect(() =>
      submitReview(records, { ...input, rating: 1 }, context),
    ).toThrow();
    expect(
      submitReview(records, input, {
        ...context,
        authorId: "creator",
        targetId: "client",
      }),
    ).toHaveLength(2);
  });
  it("미완료/취소/비당사자/자기평가·평점/내용/대상주입 거부", () => {
    [
      { complete: false },
      { cancelled: true },
      { participant: false },
      { targetId: "client" },
    ].forEach((override) =>
      expect(() =>
        submitReview([], input, { ...context, ...override }),
      ).toThrow(),
    );
    [
      { rating: 0 },
      { rating: 6 },
      { content: " " },
      { targetId: "other" },
      { tags: ["x".repeat(31)] },
    ].forEach((override) =>
      expect(() =>
        submitReview([], { ...input, ...override }, context),
      ).toThrow(),
    );
  });
  it("본인 수신 알림에만 읽음을 허용하며 중복/역순 읽음에도 정합", () => {
    const items = ["a", "b"].map((id) => ({
      id,
      label: "확인",
      path: "/requests",
      at: new Date().toISOString(),
      read: false,
    }));
    const once = readNotices(items, { ids: ["b"] });
    expect(
      readNotices(once, { ids: ["b", "b"] }).filter((n) => !n.read),
    ).toHaveLength(1);
    expect(
      readNotices(once, { ids: ["a"] }).filter((n) => !n.read),
    ).toHaveLength(0);
    expect(() => readNotices(items, { ids: ["other"] })).toThrow();
    expect(() => readNotices(items, { ids: ["a"], userId: "other" })).toThrow();
  });
});
