import {
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
} from "@kemi/shared";
import { describe, expect, it } from "vitest";

const validProject = {
  title: "돌잔치 성장영상 제작",
  description: "아이의 첫 생일에 상영할 감성적인 성장영상을 만들고 싶습니다.",
  purpose: "FIRST_BIRTHDAY",
  styles: ["EMOTIONAL", "CINEMATIC"],
  budget: 50_000,
  expectedDurationSeconds: 90,
  recruitmentEndAt: "2026-11-01T12:00:00+09:00",
  deliveryDueDate: "2026-11-10",
};

describe("프로젝트 요청 스키마", () => {
  it("B2C 영상 목적·스타일과 거래 조건을 받는다", () => {
    expect(projectCreateSchema.parse(validProject)).toEqual(validProject);
  });

  it.each([
    ["모르는 목적", { ...validProject, purpose: "BEAUTY" }],
    ["중복 스타일", { ...validProject, styles: ["EMOTIONAL", "EMOTIONAL"] }],
    ["빈 스타일", { ...validProject, styles: [] }],
    ["0원 예산", { ...validProject, budget: 0 }],
    [
      "시간대 없는 마감",
      { ...validProject, recruitmentEndAt: "2026-11-01T12:00:00" },
    ],
    ["모르는 필드", { ...validProject, category: "FAMILY" }],
  ])("%s은 거부한다", (_label, input) => {
    expect(() => projectCreateSchema.parse(input)).toThrow();
  });

  it("부분 수정은 최소 한 항목이 필요하다", () => {
    expect(projectUpdateSchema.parse({ title: "수정된 제목" })).toEqual({
      title: "수정된 제목",
    });
    expect(() => projectUpdateSchema.parse({})).toThrow();
  });

  it("목록 쿼리는 쉼표 스타일·숫자·기본 페이지 값을 변환한다", () => {
    expect(
      projectListQuerySchema.parse({
        styles: "EMOTIONAL,CLEAN",
        budgetMin: "10000",
        budgetMax: "50000",
      }),
    ).toEqual({
      styles: ["EMOTIONAL", "CLEAN"],
      budgetMin: 10_000,
      budgetMax: 50_000,
      sort: "LATEST",
      page: 1,
      pageSize: 20,
    });
  });
});
