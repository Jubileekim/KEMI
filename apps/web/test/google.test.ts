import { afterEach, describe, expect, it, vi } from "vitest";
import { socialSignupRequestSchema } from "@kemi/shared";
import { api } from "../src/shared/api/client";
import createSessionController from "../src/features/auth/session-controller";
import {
  googleReturn,
  readGoogleCallback,
  rememberGoogleReturn,
} from "../src/features/auth/google";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Google 콜백은 인증 증거가 아닌 분기 값", () => {
  it.each(["login", "signup"])("%s 분기를 해석한다", (result) =>
    expect(readGoogleCallback(`?result=${result}`)).toBe(result),
  );
  it.each([
    "SOCIAL_CANCELLED",
    "SOCIAL_FAILED",
    "SOCIAL_UNAVAILABLE",
    "SOCIAL_RATE_LIMITED",
    "FORBIDDEN",
  ])("%s 오류를 해석한다", (error) =>
    expect(readGoogleCallback(`?error=${error}`)).toBe(error),
  );
  it.each([
    "",
    "?result=unknown",
    "?result=login&error=SOCIAL_FAILED",
    "?result=login&result=signup",
    "?result=login&accessToken=bad",
    "?code=provider-code",
    "?error=unknown",
  ])("모호하거나 민감한 콜백 거절: %s", (search) =>
    expect(readGoogleCallback(search)).toBe("INVALID"),
  );
});
describe("Google 복귀는 경로만 탭 저장소에 보존", () => {
  function storage() {
    const values = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      setItem: (k: string, v: string) => values.set(k, v),
      getItem: (k: string) => values.get(k) ?? null,
      removeItem: (k: string) => values.delete(k),
    });
    return values;
  }
  it("크리에이터 전용 경로를 역할 확인 후 1회 사용한다", () => {
    storage();
    rememberGoogleReturn("/studio/packages");
    expect(googleReturn("creator")).toBe("/studio/packages");
    expect(googleReturn("creator")).toBe("/studio/portfolio");
  });
  it.each([
    "//evil.test",
    "/%2f%2fevil.test",
    "/auth/social/callback",
    "/__mock__/google",
    "/ops/reports",
  ])("위험하거나 허용되지 않은 복귀 %s 거절", (path) => {
    storage();
    rememberGoogleReturn(path);
    expect(googleReturn("client")).toBe("/me/activity");
  });
  it("만료 또는 저장소 실패 시 역할별 기본 경로", () => {
    const values = storage();
    rememberGoogleReturn("/requests");
    values.set(
      "kemi.google.return",
      JSON.stringify({ path: "/requests", time: Date.now() - 600_001 }),
    );
    expect(googleReturn("creator")).toBe("/studio/portfolio");
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("blocked");
      },
    });
    expect(() => rememberGoogleReturn("/requests")).not.toThrow();
    expect(googleReturn("client")).toBe("/me/activity");
  });
});
describe("Google 신규 가입 세션", () => {
  it("기존 Google 세션 확인 전 개인 캐시를 제거한다", async () => {
    vi.spyOn(api, "post").mockResolvedValue({
      data: {
        accessToken: "fixture",
        accessTokenExpiresIn: 900,
        user: {
          id: "1",
          email: null,
          name: "구글",
          role: "CLIENT",
          status: "ACTIVE",
        },
      },
    });
    vi.spyOn(api, "get").mockResolvedValue({
      data: {
        user: {
          id: "1",
          email: null,
          name: "구글",
          role: "CLIENT",
          status: "ACTIVE",
        },
      },
    });
    const clear = vi.fn();
    const session = createSessionController(true, clear);
    const login = session.completeGoogleLogin();
    expect(clear).toHaveBeenCalledTimes(1);
    await login;
    expect(session.snapshot().status).toBe("authenticated");
  });
  const input = { name: "새 이름", role: "CREATOR" } as const;
  const result = {
    accessToken: "fixture-only",
    accessTokenExpiresIn: 900,
    user: {
      id: "google-1",
      email: null,
      name: "새 이름",
      role: "CREATOR",
      status: "ACTIVE",
    },
  };
  it("이메일/비밀번호 없는 shared 계약과 쿠키 응답으로 세션을 받는다", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    const clear = vi.fn();
    const session = createSessionController(true, clear);
    await session.completeGoogleSignup(socialSignupRequestSchema.parse(input));
    expect(post).toHaveBeenCalledExactlyOnceWith(
      "/api/auth/social/signup",
      input,
      { withCredentials: true },
    );
    expect(session.snapshot().role).toBe("creator");
    expect(clear).toHaveBeenCalled();
    expect(session.snapshot().user?.email).toBeNull();
  });
  it("API 비활성화 시 호출하지 않는다", async () => {
    const post = vi.spyOn(api, "post");
    const session = createSessionController(false, vi.fn());
    await expect(session.completeGoogleSignup(input)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
  it.each(["SUSPENDED", "WITHDRAWN"])(
    "제한 계정 %s 수락하지 않는다",
    async (status) => {
      vi.spyOn(api, "post").mockResolvedValue({
        data: { ...result, user: { ...result.user, status } },
      });
      const session = createSessionController(true, vi.fn());
      await expect(session.completeGoogleSignup(input)).rejects.toThrow();
      expect(session.snapshot().role).toBe("guest");
    },
  );
  it("늦은 가입 응답은 로그아웃을 뒤집지 않는다", async () => {
    let resolve = (_: unknown) => {};
    vi.spyOn(api, "post")
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue({ data: null });
    const session = createSessionController(true, vi.fn());
    const pending = session.completeGoogleSignup(input);
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const rejected = expect(pending).rejects.toThrow();
    const logout = session.logout();
    resolve({ data: result });
    await rejected;
    await logout;
    expect(session.snapshot().role).toBe("guest");
  });
});
