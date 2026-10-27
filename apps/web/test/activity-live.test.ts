import { describe, expect, it } from "vitest";
import { reviewCreateSchema } from "@kemi/shared";
import readPage from "../src/features/activity/navigation";

describe("실제 활동·리뷰 입력 경계", () => {
  it.each([
    null,
    "",
    "-1",
    "0",
    "1.5",
    "Infinity",
    "100001",
    "9007199254740993",
  ])("잘못된 페이지 %s는 첫 페이지로 연다", (value) => {
    expect(readPage(value)).toBe(1);
  });
  it("유효한 페이지와 리뷰 태그를 보존하고 기존 태그 없는 요청도 허용한다", () => {
    expect(readPage("23")).toBe(23);
    expect(reviewCreateSchema.parse({ rating: 5 }).tags).toEqual([]);
    expect(
      reviewCreateSchema.parse({ rating: 5, tags: [" 소통 원활 "] }).tags,
    ).toEqual(["소통 원활"]);
    expect(
      reviewCreateSchema.safeParse({ rating: 5, tags: Array(6).fill("태그") })
        .success,
    ).toBe(false);
    expect(
      reviewCreateSchema.safeParse({ rating: 5, tags: ["가".repeat(31)] })
        .success,
    ).toBe(false);
    expect(
      reviewCreateSchema.safeParse({ rating: 5, comment: "가".repeat(2000) })
        .success,
    ).toBe(true);
    expect(
      reviewCreateSchema.safeParse({ rating: 5, comment: "가".repeat(2001) })
        .success,
    ).toBe(false);
  });
});
