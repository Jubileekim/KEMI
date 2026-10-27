import { describe, expect, it } from "vitest";
import withObjectParticle from "../src/http/korean.js";

describe("목적격 조사", () => {
  it("받침이 있으면 을, 없으면 를을 붙인다", () => {
    expect(withObjectParticle("계약")).toBe("계약을");
    expect(withObjectParticle("제작자")).toBe("제작자를");
    expect(withObjectParticle("패키지")).toBe("패키지를");
    expect(withObjectParticle("프로젝트")).toBe("프로젝트를");
    expect(withObjectParticle("작업물")).toBe("작업물을");
    expect(withObjectParticle("제작 정보")).toBe("제작 정보를");
  });
});
