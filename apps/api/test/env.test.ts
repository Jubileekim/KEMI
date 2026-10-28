import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "../src/config/env.js";

const DATABASE_URL = "postgresql://user:secret-password@localhost:5432/kemi";
const JWT_ACCESS_SECRET = "test-access-secret-at-least-32-characters";
const APP_ORIGIN = "http://localhost:5173";
const REQUIRED = { DATABASE_URL, JWT_ACCESS_SECRET, APP_ORIGIN };

describe("parseEnv", () => {
  it("기본값을 채운다", () => {
    const env = parseEnv(REQUIRED);
    expect(env).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      DATABASE_URL,
      DATABASE_POOL_MAX: 5,
      JWT_ACCESS_SECRET,
      APP_ORIGIN,
      TRUST_PROXY_HOPS: 0,
      API_DOCS: false,
      AI_PRICING_MODEL: "gpt-4o-mini",
      STORAGE_BUCKET: "kemi-private",
    });
  });

  it("문자열 숫자를 변환한다", () => {
    const env = parseEnv({
      ...REQUIRED,
      NODE_ENV: "production",
      PORT: "10000",
      DATABASE_POOL_MAX: "8",
    });
    expect(env.PORT).toBe(10000);
    expect(env.DATABASE_POOL_MAX).toBe(8);
  });

  it("Toss 시크릿 키는 테스트 키만 받고, live 키는 값을 드러내지 않고 거부한다", () => {
    expect(
      parseEnv({ ...REQUIRED, TOSS_SECRET_KEY: "test_sk_abc" }).TOSS_SECRET_KEY,
    ).toBe("test_sk_abc");
    expect(
      parseEnv({ ...REQUIRED, TOSS_SECRET_KEY: "test_gsk_abc" })
        .TOSS_SECRET_KEY,
    ).toBe("test_gsk_abc");
    expect(
      parseEnv({ ...REQUIRED, TOSS_SECRET_KEY: "" }).TOSS_SECRET_KEY,
    ).toBeUndefined();
    const live = "live_sk_real-secret-value";
    expect(() => parseEnv({ ...REQUIRED, TOSS_SECRET_KEY: live })).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          /^(?![\s\S]*real-secret-value)[\s\S]*TOSS_SECRET_KEY/,
        ),
      }),
    );
  });

  it("API_DOCS는 기본으로 꺼져 있고 true·false만 받는다", () => {
    expect(parseEnv({ ...REQUIRED }).API_DOCS).toBe(false);
    expect(parseEnv({ ...REQUIRED, API_DOCS: "true" }).API_DOCS).toBe(true);
    expect(parseEnv({ ...REQUIRED, API_DOCS: "false" }).API_DOCS).toBe(false);
    expect(() => parseEnv({ ...REQUIRED, API_DOCS: "yes" })).toThrow(
      /API_DOCS/,
    );
  });

  it("DATABASE_URL이 없으면 실패한다", () => {
    expect(() => parseEnv({})).toThrow(EnvValidationError);
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("잘못된 값은 변수 이름과 함께 모두 보고한다", () => {
    try {
      parseEnv({ DATABASE_URL: "mysql://x", PORT: "abc", NODE_ENV: "staging" });
      expect.unreachable();
    } catch (err) {
      if (!(err instanceof EnvValidationError)) {
        throw err;
      }
      expect(err.issues.map((issue) => issue.split(":")[0])).toEqual(
        expect.arrayContaining(["DATABASE_URL", "PORT", "NODE_ENV"]),
      );
    }
  });

  it("오류 메시지에 비밀값을 노출하지 않는다", () => {
    const secretUrl = "mysql://user:secret-password@localhost/kemi";
    expect(() => parseEnv({ DATABASE_URL: secretUrl })).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining("secret-password"),
      }),
    );
  });

  it("소셜 로그인 키는 선택이며, 빈 값은 설정하지 않은 것으로 본다", () => {
    const env = parseEnv({
      ...REQUIRED,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: " ",
      KAKAO_REST_API_KEY: "kakao-key",
    });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.KAKAO_REST_API_KEY).toBe("kakao-key");
    expect(env.KAKAO_CLIENT_SECRET).toBeUndefined();
  });

  it("Google 키는 ID와 Secret을 함께 넣어야 하고, 오류에 값은 나오지 않는다", () => {
    expect(() =>
      parseEnv({ ...REQUIRED, GOOGLE_CLIENT_ID: "google-client-id-value" }),
    ).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() =>
      parseEnv({ ...REQUIRED, GOOGLE_CLIENT_SECRET: "google-secret-value" }),
    ).not.toThrow(/google-secret-value/);
    expect(() =>
      parseEnv({ ...REQUIRED, GOOGLE_CLIENT_SECRET: "google-secret-value" }),
    ).toThrow(EnvValidationError);
  });
});
