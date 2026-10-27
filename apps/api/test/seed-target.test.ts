import { describe, expect, it } from "vitest";
import {
  allowSharedProductionDemoSeed,
  checkSeedTarget,
  databaseIdentity,
  SHARED_PRODUCTION_SEED_ACK,
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
  it("KEMI 운영 DB는 허용 목록에 넣고 직접 확인해도 시드 차단", () => {
    const productionIdentity = "supabase:nibqyycfknurkncdgqps";
    const productionUrls = [
      "postgresql://postgres:pw@db.nibqyycfknurkncdgqps.supabase.co:5432/postgres",
      "postgresql://postgres.nibqyycfknurkncdgqps:pw@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
    ];
    productionUrls.forEach((DATABASE_URL) => {
      expect(() =>
        checkSeedTarget({
          DATABASE_URL,
          NODE_ENV: "development",
          SEED_ALLOWED_TARGETS: productionIdentity,
          SEED_CONFIRM_TARGET: productionIdentity,
        }),
      ).toThrow(SeedTargetError);
    });
  });
  it("PM 1회 명시 승인 + 운영 DB 정확한 신원 + 두 개 대상 확인이 모두 일치하면 예외 허용", () => {
    const identity = "supabase:nibqyycfknurkncdgqps";
    const base = {
      DATABASE_URL:
        "postgresql://postgres.nibqyycfknurkncdgqps:pw@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
      NODE_ENV: "production",
      SEED_ALLOWED_TARGETS: identity,
      SEED_CONFIRM_TARGET: identity,
      SEED_PRODUCTION_ACK: SHARED_PRODUCTION_SEED_ACK,
    };
    expect(checkSeedTarget(base)).toBe(identity);
    expect(allowSharedProductionDemoSeed(base, identity)).toBe(true);
    expect(
      allowSharedProductionDemoSeed(
        { ...base, SEED_PRODUCTION_ACK: undefined },
        identity,
      ),
    ).toBe(false);

    const refused = [
      { ...base, SEED_PRODUCTION_ACK: undefined },
      { ...base, SEED_PRODUCTION_ACK: "yes" },
      { ...base, SEED_ALLOWED_TARGETS: "" },
      { ...base, SEED_CONFIRM_TARGET: "supabase:other" },
      { ...base, DATABASE_URL: OTHER },
      // 어느 운영 DB에나 일괄 적용되는 우회는 없어야 한다.
      {
        ...base,
        DATABASE_URL: OTHER,
        SEED_ALLOWED_TARGETS: "supabase:prodref999",
        SEED_CONFIRM_TARGET: "supabase:prodref999",
      },
    ];
    for (const env of refused) {
      expect(() => checkSeedTarget(env)).toThrow(SeedTargetError);
    }
  });
});
