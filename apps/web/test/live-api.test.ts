import { describe, expect, it } from "vitest";
import { signupFormSchema } from "../src/features/auth/contracts";
import { query } from "../src/shared/api/kemi";
import { isAllowedMime } from "../src/shared/api/upload";

const signup = {
  email: "a@example.com",
  name: "테스트",
  role: "CLIENT",
};

describe("실제 API 연결 도우미", () => {
  it("검색어는 빈 값을 빼고 만든다", () => {
    expect(query({ q: "돌잔치", purpose: "", page: 2, sort: undefined })).toBe(
      "?q=%EB%8F%8C%EC%9E%94%EC%B9%98&page=2",
    );
    expect(query({ q: "" })).toBe("");
  });

  it("업로드는 서버가 받는 형식만 허용한다", () => {
    expect(isAllowedMime("video/mp4")).toBe(true);
    expect(isAllowedMime("image/png")).toBe(true);
    expect(isAllowedMime("video/webm")).toBe(false);
    expect(isAllowedMime("application/pdf")).toBe(false);
  });

  it("가입 폼 비밀번호는 API의 72바이트 상한을 넘지 않는다", () => {
    const ok = signupFormSchema.safeParse({
      ...signup,
      password: "abc12345",
      passwordConfirm: "abc12345",
    });
    expect(ok.success).toBe(true);
    // 한글은 한 글자에 3바이트: 64자 안이어도 72바이트를 넘으면 거부한다.
    const long = `a1${"가".repeat(30)}`;
    const tooLong = signupFormSchema.safeParse({
      ...signup,
      password: long,
      passwordConfirm: long,
    });
    expect(tooLong.success).toBe(false);
  });
});
