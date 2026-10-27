import { describe, expect, it } from "vitest";
import {
  applyStudio,
  emptyStudio,
  emptyPackage,
  packageProblems,
  packageSchema,
  visiblePackages,
  type StudioState,
} from "../src/mocks/studio-model";

const values = {
  ...emptyPackage,
  title: "숏폼",
  description: "소개",
  price: "100000",
  specification: "9:16 30초",
  quantity: "1",
  included: "촬영·편집",
  excluded: "기획",
  materials: "제품",
  days: "7",
  revisions: "1",
  originals: "별도 합의",
  usage: "광고 활용",
  commercial: true,
};
function add(state: StudioState, id = "one") {
  return applyStudio(state, {
    type: "save-package",
    id,
    values,
    visibility: "PUBLIC",
  });
}
function publish() {
  let state = add(emptyStudio());
  state = applyStudio(state, { type: "primary", id: "one" });
  state = applyStudio(state, { type: "profile-gate", value: "READY" });
  return applyStudio(state, { type: "service", public: true });
}
describe("1-D candidate package model (not product policy)", () => {
  it("saves incomplete drafts and multiple independent products without auto primary or service", () => {
    const state = add(
      add(
        applyStudio(emptyStudio(), {
          type: "save-package",
          id: "draft",
          values: emptyPackage,
          visibility: "DRAFT",
        }),
      ),
      "two",
    );
    expect(state.packages).toHaveLength(3);
    expect(state.primaryId).toBeNull();
    expect(state.service).toBe("DRAFT");
    expect(visiblePackages(state)).toEqual([]);
  });
  it("blocks incomplete and noncommercial public packages", () => {
    expect(packageProblems(emptyPackage).length).toBeGreaterThan(0);
    expect(() =>
      applyStudio(emptyStudio(), {
        type: "save-package",
        id: "bad",
        values: { ...values, commercial: false },
        visibility: "PUBLIC",
      }),
    ).toThrow("비상업용");
  });
  it.each(["0", "-1", "1.1", "1e3", "9007199254740992"])(
    "rejects invalid price %s",
    (price) => expect(packageProblems({ ...values, price })).not.toEqual([]),
  );
  it("allows zero revisions, trims and enforces a labeled input protection cap", () => {
    expect(packageProblems({ ...values, revisions: "0" })).toEqual([]);
    expect(packageSchema.parse({ ...values, title: " 제목 " }).title).toBe(
      "제목",
    );
    expect(
      packageSchema.safeParse({ ...values, title: "a".repeat(4001) }).success,
    ).toBe(false);
  });
  it("requires explicit D01 fixture and public primary, but never requires works", () => {
    expect(() =>
      applyStudio(add(emptyStudio()), { type: "service", public: true }),
    ).toThrow("D01");
    expect(() =>
      applyStudio(
        { ...emptyStudio(), profileGate: "READY" },
        { type: "service", public: true },
      ),
    ).toThrow("대표");
    expect(visiblePackages(publish())).toHaveLength(1);
  });
  it("keeps one primary and rejects private/missing/foreign IDs", () => {
    const state = applyStudio(add(publish(), "two"), {
      type: "primary",
      id: "two",
    });
    expect(state.primaryId).toBe("two");
    expect(() =>
      applyStudio(state, { type: "primary", id: "foreign" }),
    ).toThrow();
    const draft = applyStudio(emptyStudio(), {
      type: "save-package",
      id: "draft",
      values: emptyPackage,
      visibility: "DRAFT",
    });
    expect(() =>
      applyStudio(draft, { type: "primary", id: "draft" }),
    ).toThrow();
  });
  it("refuses hiding primary during public service without implicit D03 transitions", () => {
    const state = publish();
    expect(() =>
      applyStudio(state, {
        type: "save-package",
        id: "one",
        values,
        visibility: "PRIVATE",
      }),
    ).toThrow("먼저");
    expect(state.service).toBe("PUBLIC");
    const hidden = applyStudio(
      applyStudio(state, { type: "service", public: false }),
      { type: "save-package", id: "one", values, visibility: "PRIVATE" },
    );
    expect(hidden.service).toBe("PRIVATE");
    expect(hidden.primaryId).toBeNull();
    expect(visiblePackages(hidden)).toEqual([]);
  });
  it("retains a separate reference and original state through edits/private transitions", () => {
    const original = publish();
    const captured = applyStudio(original, {
      type: "capture-reference",
      id: "one",
    });
    const edited = applyStudio(captured, {
      type: "save-package",
      id: "one",
      values: { ...values, price: "200000", included: "다른 범위" },
      visibility: "PUBLIC",
    });
    expect(edited.reference?.price).toBe("100000");
    expect(edited.reference?.included).toBe("촬영·편집");
    expect(original.packages[0]?.price).toBe("100000");
    expect(
      applyStudio(edited, { type: "service", public: false }).reference,
    ).toEqual(captured.reference);
  });
});
