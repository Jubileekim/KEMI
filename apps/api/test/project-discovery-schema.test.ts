import { projectDiscoveryQuerySchema } from "@kemi/shared";
import { describe, expect, it } from "vitest";

describe("프로젝트 탐색 부가 기능 쿼리", () => {
  it("기본 페이지와 페이지 크기를 적용한다", () => {
    expect(projectDiscoveryQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(
      projectDiscoveryQuerySchema.parse({ page: "2", pageSize: "10" }),
    ).toEqual({ page: 2, pageSize: 10 });
  });

  it.each([
    { page: "0" },
    { pageSize: "51" },
    { page: "1.5" },
    { unknown: "value" },
  ])("잘못된 쿼리 $input을 거부한다", (input) => {
    expect(() => projectDiscoveryQuerySchema.parse(input)).toThrow();
  });
});
