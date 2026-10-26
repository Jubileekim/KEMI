import { describe, it, expect } from "vitest";
import { assetSchema, demoFileLimit } from "../src/shared/files/local-preview";
import {
  workSchema,
  emptyWork,
  changeWorks,
  safeExternalUrl,
  workProblems,
  type WorkValues,
} from "../src/mocks/portfolio-model";
import {
  applyStudio,
  emptyStudio,
  visibleWorks,
} from "../src/mocks/studio-model";

const sample: WorkValues = {
  ...emptyWork,
  title: "샘플",
  description: "소개",
  source: "직접 제작",
  roles: ["FILMING", "EDITING"],
  style: "밝은",
  workType: "숏폼",
  rights: true,
  asset: { name: "sample.webm", mime: "video/webm", size: 100, ready: true },
};
const initial = { works: [], workReference: null };
describe("1-D portfolio candidate model", () => {
  it("allows incomplete drafts without auto publicity", () => {
    const state = applyStudio(emptyStudio(), {
      type: "save-work",
      id: "draft",
      values: emptyWork,
      visibility: "DRAFT",
    });
    expect(state.works[0]?.visibility).toBe("DRAFT");
    expect(visibleWorks(state)).toEqual([]);
  });
  it("permits original samples without trade history and never auto publishes the service", () => {
    expect(workProblems(sample)).toEqual([]);
    const state = applyStudio(emptyStudio(), {
      type: "save-work",
      id: "sample",
      values: sample,
      visibility: "PUBLIC",
    });
    expect(state.service).toBe("DRAFT");
    expect(visibleWorks(state)).toEqual([]);
    expect(visibleWorks({ ...state, service: "PUBLIC" })).toHaveLength(1);
  });
  it.each(["EXTERNAL", "PLATFORM"] as const)(
    "requires customer consent for %s and never infers it",
    (origin) => {
      expect(workProblems({ ...sample, origin })).toContain(
        "고객 작업물의 공개 동의를 확인해 주세요. 거래물은 자동 공개하지 않아요.",
      );
      expect(workProblems({ ...sample, origin, consent: true })).toEqual([]);
    },
  );
  it("blocks missing role/source/rights/staged file before public", () => {
    expect(() =>
      changeWorks(initial, {
        type: "save-work",
        id: "bad",
        values: emptyWork,
        visibility: "PUBLIC",
      }),
    ).toThrow();
    expect(
      workProblems({
        ...sample,
        asset: {
          ...sample.asset,
          name: "sample.webm",
          mime: "video/webm",
          size: 100,
          ready: false,
        },
      }),
    ).not.toEqual([]);
    expect(workSchema.safeParse({ ...sample, roles: ["ADMIN"] }).success).toBe(
      false,
    );
  });
  it.each([
    ["javascript", "alert(1)"].join(":"),
    "data:video/mp4;base64,eA==",
    "http://example.test",
    "https://user:pass@example.test",
  ])("rejects unsafe external draft %s", (externalUrl) => {
    expect(safeExternalUrl(externalUrl)).toBe(false);
    expect(() =>
      changeWorks(initial, {
        type: "save-work",
        id: "url",
        values: { ...sample, mediaKind: "URL", externalUrl },
        visibility: "DRAFT",
      }),
    ).toThrow("https");
  });
  it("keeps syntactically safe external URLs draft-only pending provider policy", () => {
    const values: WorkValues = {
      ...sample,
      mediaKind: "URL",
      externalUrl: "https://example.test/video",
    };
    const state = changeWorks(initial, {
      type: "save-work",
      id: "url",
      values,
      visibility: "DRAFT",
    });
    expect(state.works[0]?.asset).toBeNull();
    expect(() =>
      changeWorks(initial, {
        type: "save-work",
        id: "url",
        values,
        visibility: "PUBLIC",
      }),
    ).toThrow("D02");
  });
  it("retains synthetic submitted metadata through edits/private/delete", () => {
    const saved = changeWorks(initial, {
      type: "save-work",
      id: "own",
      values: sample,
      visibility: "PUBLIC",
    });
    const captured = changeWorks(saved, {
      type: "capture-work-reference",
      id: "own",
    });
    const changed = changeWorks(captured, {
      type: "save-work",
      id: "own",
      values: { ...sample, title: "변경" },
      visibility: "PRIVATE",
    });
    expect(changed.workReference?.title).toBe("샘플");
    const deleted = changeWorks(changed, { type: "delete-work", id: "own" });
    expect(deleted.works).toEqual([]);
    expect(deleted.workReference).toEqual(captured.workReference);
    expect(saved.works).toHaveLength(1);
    expect(() =>
      changeWorks(deleted, { type: "delete-work", id: "foreign" }),
    ).toThrow();
  });
  it("checks the explicit local preview guard, not an upload contract", () => {
    expect(
      assetSchema.safeParse({
        name: "x.webm",
        mime: "video/webm",
        size: demoFileLimit,
        ready: false,
      }).success,
    ).toBe(true);
    [0, demoFileLimit + 1].forEach((size) =>
      expect(
        assetSchema.safeParse({
          name: "x.webm",
          mime: "video/webm",
          size,
          ready: false,
        }).success,
      ).toBe(false),
    );
    expect(
      assetSchema.safeParse({
        name: "x.webm",
        mime: "text/html",
        size: 1,
        ready: false,
      }).success,
    ).toBe(false);
  });
});
