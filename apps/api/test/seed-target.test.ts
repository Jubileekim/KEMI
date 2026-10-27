import { describe, expect, it } from "vitest";
import {
  checkSeedTarget,
  databaseIdentity,
  SeedTargetError,
} from "../src/seed/target.js";

// 접속 주소는 예시 값이다(실제 프로젝트·비밀번호 아님).
const POOLER =
  "postgresql://postgres.devref123:pw@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const DIRECT =
  "postgresql://postgres:pw@db.devref123.supabase.co:5432/postgres";
const OTHER =
  "postgresql://postgres.prodref999:pw@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
const LOCAL = "postgresql://kemi:pw@localhost:54329/kemi_test";

describe("시드 대상 확인 (#64 리뷰)", () => {
  it("접속 주소에서 DB 신원을 뽑는다(비밀번호는 쓰지 않는다)", () => {
    expect(databaseIdentity(POOLER)).toBe("supabase:devref123");
    expect(databaseIdentity(DIRECT)).toBe("supabase:devref123");
    expect(databaseIdentity(LOCAL)).toBe("localhost:54329/kemi_test");
    expect(databaseIdentity(POOLER)).not.toContain("pw");
  });

  it("허용 목록에 있고 확인값이 같을 때만 통과한다", () => {
    const base = {
      DATABASE_URL: POOLER,
      SEED_ALLOWED_TARGETS: "supabase:devref123, localhost:54329/kemi_test",
      SEED_CONFIRM_TARGET: "supabase:devref123",
    };
    expect(checkSeedTarget(base)).toBe("supabase:devref123");

    const refused = [
      // NODE_ENV를 비워도 다른 조건으로 막힌다.
      {
        ...base,
        DATABASE_URL: OTHER,
        SEED_CONFIRM_TARGET: "supabase:prodref999",
      },
      { ...base, SEED_ALLOWED_TARGETS: undefined },
      { ...base, SEED_ALLOWED_TARGETS: " , " },
      { ...base, SEED_CONFIRM_TARGET: undefined },
      { ...base, SEED_CONFIRM_TARGET: "supabase:other" },
      { ...base, NODE_ENV: "production" },
      { ...base, DATABASE_URL: "not a url" },
    ];
    refused.forEach((env) => {
      expect(() => checkSeedTarget(env)).toThrow(SeedTargetError);
    });
  });
});
