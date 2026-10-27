import { describe, it, expect } from "vitest";
import { catalogFixture, publicWorks } from "../src/mocks/catalog-model";

describe("6-A 공개 작업물 경계", () => {
  it("후기·거래 없이 신규 샘플 노출, 비공개 서비스 차단", () => {
    const studio = catalogFixture();
    expect(publicWorks(studio, "mock-creator", "제작자")).toHaveLength(5);
    expect(publicWorks({ ...studio, service: "PRIVATE" }, "c", "n")).toEqual(
      [],
    );
  });
  it("비공개·삭제·동의 없는 고객물·권한 없는 작품을 제외한다", () => {
    const studio = catalogFixture();
    const work = studio.works[0];
    if (!work) throw new Error("fixture");
    studio.works = [
      { ...work, visibility: "PRIVATE" },
      { ...work, rights: false },
      { ...work, origin: "EXTERNAL", consent: false },
      { ...work, origin: "EXTERNAL", consent: true, id: "allowed" },
    ];
    expect(publicWorks(studio, "c", "n").map((w) => w.id)).toEqual(["allowed"]);
    studio.works = [];
    expect(publicWorks(studio, "c", "n")).toEqual([]);
  });
});
