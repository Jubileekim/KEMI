import { loginRequestSchema, signupRequestSchema } from "@kemi/shared";
import { describe, expect, it } from "vitest";

// OpenAPI 표시용 메타데이터를 추가해도 이메일 입력 처리(공백 제거·소문자 변환·형식·길이 검증)는 그대로여야 한다.
const VALID_SIGNUP = {
  password: "correct-horse-battery",
  name: "테스트",
  role: "CLIENT",
};

describe("이메일 입력 처리", () => {
  it.each([
    [
      "가입",
      (email: string) =>
        signupRequestSchema.parse({ ...VALID_SIGNUP, email }).email,
    ],
    [
      "로그인",
      (email: string) =>
        loginRequestSchema.parse({ email, password: "x" }).email,
    ],
  ])("%s: 앞뒤 공백을 지우고 소문자로 바꾼다", (_label, parseEmail) => {
    expect(parseEmail("  Client@EXAMPLE.com ")).toBe("client@example.com");
  });

  it("이메일 형식이 아니면 거부한다", () => {
    const result = signupRequestSchema.safeParse({
      ...VALID_SIGNUP,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("254자를 넘으면 거부한다", () => {
    const email = `${"a".repeat(64)}@${"b".repeat(186)}.com`;
    expect(email).toHaveLength(255);
    const result = loginRequestSchema.safeParse({ email, password: "x" });
    expect(result.success).toBe(false);
  });
});
