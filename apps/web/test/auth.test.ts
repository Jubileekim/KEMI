import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthTokenResponse } from "@kemi/shared";
import { api, ApiError } from "../src/shared/api/client";
import createSessionController from "../src/features/auth/session-controller";
import { signupFormSchema } from "../src/features/auth/contracts";
import safeReturnTo from "../src/features/auth/redirect";

const input = {
  email: " Client@Example.test ",
  password: "Kemi1234",
  passwordConfirm: "Kemi1234",
  name: "의뢰인",
  role: "CLIENT",
} as const;
const result: AuthTokenResponse = {
  accessToken: "fixture-token",
  accessTokenExpiresIn: 900,
  user: {
    id: "1",
    email: "client@example.test",
    name: "의뢰인",
    role: "CLIENT",
    status: "ACTIVE",
  },
};
afterEach(() => vi.restoreAllMocks());

describe("P01 가입 계약", () => {
  it("이메일을 정규화하고 64자 영문 숫자 비밀번호를 허용한다", () => {
    expect(signupFormSchema.parse(input).email).toBe("client@example.test");
    const password = `A${"1".repeat(63)}`;
    expect(
      signupFormSchema.safeParse({
        ...input,
        password,
        passwordConfirm: password,
      }).success,
    ).toBe(true);
  });
  it.each(["abcdefghi", "12345678", "Ab123", `A${"1".repeat(64)}`])(
    "비밀번호 경계 %s 거부",
    (password) => {
      expect(
        signupFormSchema.safeParse({
          ...input,
          password,
          passwordConfirm: password,
        }).success,
      ).toBe(false);
    },
  );
  it("확인값 불일치와 운영자 가입을 거부한다", () => {
    expect(
      signupFormSchema.safeParse({ ...input, passwordConfirm: "different" })
        .success,
    ).toBe(false);
    expect(
      signupFormSchema.safeParse({ ...input, role: "ADMIN" }).success,
    ).toBe(false);
  });
});
describe("안전한 역할별 복귀", () => {
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil",
    "/%2f%2fevil",
    "/login",
    "/auth/social/callback",
    "/missing",
    "/ops/reports",
    "/studio/packages",
    "/campaigns/../login",
  ])("의뢰인에게 위험하거나 불가능한 복귀 %s 차단", (path) => {
    expect(safeReturnTo(path, "client")).toBe("/me/activity");
  });
  it("유효한 검색 조건은 보존하고 크리에이터 기본 경로를 구분한다", () => {
    expect(safeReturnTo("/campaigns/42?from=list", "client")).toBe(
      "/campaigns/42?from=list",
    );
    expect(safeReturnTo(null, "creator")).toBe("/studio/portfolio");
    // 비로그인 패키지 의뢰 CTA: 로그인 뒤 같은 패키지 의뢰 화면으로 돌아온다.
    expect(safeReturnTo("/creators/7/request?packageId=4", "client")).toBe(
      "/creators/7/request?packageId=4",
    );
    expect(safeReturnTo("/creators/7/request?packageId=4", "creator")).toBe(
      "/studio/portfolio",
    );
    expect(safeReturnTo("/campaigns/new", "creator")).toBe("/studio/portfolio");
  });
});
describe("세션 수명과 실패", () => {
  it("다른 탭의 계정 변경을 갱신으로 발견하면 개인 캐시와 세션을 폐기한다", async () => {
    const clear = vi.fn();
    const controller = createSessionController(true, clear);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    await controller.authenticate(input);
    post.mockResolvedValue({
      data: { ...result, user: { ...result.user, id: "other-account" } },
    });
    await expect(controller.recover(result.accessToken)).rejects.toMatchObject({
      code: "ACCOUNT_CHANGED",
    });
    expect(clear).toHaveBeenCalledTimes(2);
    expect(controller.snapshot().user).toBeNull();
    await expect(controller.getToken()).rejects.toThrow();
  });
  it("비로그인 첫 방문의 갱신 401은 공개 조회 캐시를 지우지 않고, 로그인·만료에서는 지운다", async () => {
    const clear = vi.fn();
    const controller = createSessionController(true, clear);
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(401, "UNAUTHENTICATED", "로그인"));
    await controller.bootstrap();
    expect(controller.snapshot().status).toBe("guest");
    // 지울 개인 데이터가 없으면 진행 중인 공개 조회(작품 피드 등)를 취소하지 않는다.
    expect(clear).not.toHaveBeenCalled();
    post.mockResolvedValue({ data: result });
    await controller.authenticate(input);
    const cleared = clear.mock.calls.length;
    post.mockRejectedValueOnce(new ApiError(401, "UNAUTHENTICATED", "만료"));
    await expect(controller.recover(result.accessToken)).rejects.toThrow();
    expect(clear.mock.calls.length).toBeGreaterThan(cleared);
    expect(controller.snapshot().user).toBeNull();
  });
  it("초기 갱신을 하나로 모으고 me까지 확인 전 보호 화면을 열지 않는다", async () => {
    const controller = createSessionController(true, vi.fn());
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    vi.spyOn(api, "get").mockImplementation(async () => {
      expect(controller.snapshot().status).toBe("checking");
      return { data: { user: result.user } };
    });
    await Promise.all([controller.bootstrap(), controller.bootstrap()]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().status).toBe("authenticated");
  });
  it("동시 만료 갱신 하나와 409 후 제한된 재시도를 사용한다", async () => {
    const controller = createSessionController(true, vi.fn());
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    await controller.authenticate(input);
    post
      .mockRejectedValueOnce(new ApiError(409, "REFRESH_RACE", "race", 0))
      .mockResolvedValue({ data: result });
    await Promise.all([
      controller.recover(result.accessToken),
      controller.recover(result.accessToken),
    ]);
    expect(post).toHaveBeenCalledTimes(3);
    post.mockRejectedValue(new ApiError(409, "REFRESH_RACE", "race", 0));
    await expect(controller.recover(result.accessToken)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(6);
    expect(controller.snapshot().role).toBe("guest");
  });
  it("3초를 초과하는 서버 재시도 지시를 따르지 않는다", async () => {
    const controller = createSessionController(true, vi.fn());
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    await controller.authenticate(input);
    post.mockRejectedValue(new ApiError(409, "REFRESH_RACE", "race", 3000));
    await expect(controller.recover(result.accessToken)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(2);
  });
  it("서버 로그아웃 실패 시 캐시 제거와 실패 상태를 유지하고 재시도한다", async () => {
    const clear = vi.fn();
    const controller = createSessionController(true, clear);
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    await controller.authenticate(input);
    post.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "network"));
    await controller.logout();
    expect(clear).toHaveBeenCalledTimes(2);
    expect(controller.snapshot().status).toBe("logout-error");
    await expect(controller.getToken()).rejects.toThrow();
    post.mockResolvedValue({ data: undefined });
    await controller.logout();
    expect(controller.snapshot().status).toBe("guest");
  });
  it("로그아웃보다 늦은 갱신 응답으로 세션을 복원하지 않는다", async () => {
    const controller = createSessionController(true, vi.fn());
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    await controller.authenticate(input);
    let resolveRefresh = (_value: { data: AuthTokenResponse }) => {};
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const pending = controller.recover(result.accessToken);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    const pendingRejection = expect(pending).rejects.toThrow();
    const logout = controller.logout();
    resolveRefresh({ data: result });
    await pendingRejection;
    await logout;
    expect(controller.snapshot().role).toBe("guest");
  });
  it("갱신 네트워크 오류는 한 번만 재시도한다", async () => {
    const controller = createSessionController(true, vi.fn());
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: result });
    await controller.authenticate(input);
    post.mockRejectedValue(new ApiError(0, "NETWORK_ERROR", "network"));
    await expect(controller.recover(result.accessToken)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(3);
    expect(controller.snapshot().role).toBe("guest");
  });
  it("실제 가입 충돌, 제한 계정과 잘못된 응답을 인증 성공으로 처리하지 않는다", async () => {
    const controller = createSessionController(true, vi.fn());
    const post = vi.spyOn(api, "post");
    // 실제 가입: 서버가 중복 이메일 등으로 거절하면 인증되지 않는다.
    post.mockRejectedValueOnce(new Error("409 CONFLICT"));
    await expect(controller.authenticate(input, true)).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().role).toBe("guest");
    post.mockResolvedValue({
      data: { ...result, user: { ...result.user, status: "RESTRICTED" } },
    });
    await expect(controller.authenticate(input)).rejects.toThrow();
    post.mockResolvedValue({ data: "<html>" });
    await expect(controller.authenticate(input)).rejects.toThrow();
    expect(controller.snapshot().role).toBe("guest");
  });
});
