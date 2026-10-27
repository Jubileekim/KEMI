import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyProfileResponse } from "@kemi/shared";
import {
  profileValues,
  profilePatch,
  profileFormSchema,
} from "../src/features/profiles/contracts";
import {
  getProfile,
  saveProfile,
  readProfile,
} from "../src/features/profiles/api";
import { api } from "../src/shared/api/client";

const client: MyProfileResponse = {
  name: "개인 의뢰인",
  profile: {
    type: "CLIENT",
    brandName: null,
    introduction: null,
    industry: null,
    websiteUrl: null,
    socialUrl: null,
  },
};
const creator: MyProfileResponse = {
  name: "크리에이터",
  profile: {
    type: "CREATOR",
    introduction: null,
    niche: null,
    contentStyles: [],
    productionRoles: [],
    workMethod: null,
    serviceStatus: "PUBLIC",
    isAvailable: false,
    availableFrom: null,
  },
};
afterEach(() => vi.restoreAllMocks());
describe("PROFILE-01·02 계약 경계", () => {
  it("이미지·경력·크리에이터 링크를 변경한 값만 저장하고 삭제할 수 있다", () => {
    const before = profileValues(creator);
    const values = {
      ...before,
      imageFileId: "17",
      career: "영상 제작 3년",
      websiteUrl: "https://portfolio.example.com",
      socialUrl: "https://social.example.com",
    };
    expect(profileFormSchema("CREATOR").safeParse(values).success).toBe(true);
    expect(profilePatch("CREATOR", values, before)).toEqual({
      imageFileId: "17",
      career: "영상 제작 3년",
      websiteUrl: values.websiteUrl,
      socialUrl: values.socialUrl,
    });
    expect(profilePatch("CREATOR", before, values)).toEqual({
      imageFileId: null,
      career: null,
      websiteUrl: null,
      socialUrl: null,
    });
    expect(
      profilePatch(
        "CLIENT",
        { ...profileValues(client), imageFileId: "17" },
        profileValues(client),
      ),
    ).toEqual({ imageFileId: "17" });
  });
  it("추가 필드의 URL·이미지 ID·경력 길이를 검증한다", () => {
    [
      { websiteUrl: "ftp://example.com" },
      { socialUrl: ["javascript", "alert(1)"].join(":") },
      { imageFileId: "-1" },
      { career: "가".repeat(2001) },
    ].forEach((change) => {
      expect(
        profileFormSchema("CREATOR").safeParse({
          ...profileValues(creator),
          ...change,
        }).success,
      ).toBe(false);
    });
  });
  it("브랜드 정보가 없는 개인과 미완성 크리에이터를 허용한다", () => {
    expect(
      profileFormSchema("CLIENT").safeParse(profileValues(client)).success,
    ).toBe(true);
    expect(
      profileFormSchema("CREATOR").safeParse(profileValues(creator)).success,
    ).toBe(true);
  });
  it("변경하지 않은 값은 보내지 않는다", () => {
    const before = profileValues(client);
    expect(
      profilePatch("CLIENT", { ...before, name: "새 이름" }, before),
    ).toEqual({ name: "새 이름" });
    expect(profilePatch("CLIENT", before, before)).toEqual({});
  });
  it("선택 텍스트 삭제는 null, 선택지 삭제는 null, 복수 선택 삭제는 []", () => {
    const before = {
      ...profileValues(creator),
      introduction: "소개",
      niche: "BEAUTY",
      contentStyles: ["MODERN"] as const,
    };
    const original = { ...before, contentStyles: [...before.contentStyles] };
    expect(
      profilePatch(
        "CREATOR",
        { ...original, introduction: "  ", niche: "", contentStyles: [] },
        original,
      ),
    ).toEqual({ introduction: null, niche: null, contentStyles: [] });
  });
  it.each([
    ["javascript", "alert(1)"].join(":"),
    "ftp://example.test",
    "https://",
  ])("잘못된 URL을 거절한다: %s", (url) => {
    expect(
      profileFormSchema("CLIENT").safeParse({
        ...profileValues(client),
        websiteUrl: url,
      }).success,
    ).toBe(false);
  });
  it("이름·길이·날짜·중복 선택을 shared 규칙으로 검사한다", () => {
    expect(
      profileFormSchema("CLIENT").safeParse({
        ...profileValues(client),
        name: " ",
      }).success,
    ).toBe(false);
    expect(
      profileFormSchema("CLIENT").safeParse({
        ...profileValues(client),
        introduction: "a".repeat(1001),
      }).success,
    ).toBe(false);
    expect(
      profileFormSchema("CREATOR").safeParse({
        ...profileValues(creator),
        availableFrom: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      profileFormSchema("CREATOR").safeParse({
        ...profileValues(creator),
        contentStyles: ["MODERN", "MODERN"],
      }).success,
    ).toBe(false);
  });
  it("역할 반대 필드·공개 상태·계약 없는 정보는 보내지 않는다", () => {
    const before = profileValues(creator);
    expect(
      profilePatch(
        "CREATOR",
        { ...before, brandName: "브랜드", name: "수정 이름" },
        before,
      ),
    ).toEqual({ name: "수정 이름" });
    expect(
      profilePatch(
        "CLIENT",
        { ...profileValues(client), workMethod: "편집" },
        profileValues(client),
      ),
    ).toEqual({});
  });
  it("잘못된 응답·반대 역할 응답은 거절하고 공개 상태는 보존한다", () => {
    expect(() => readProfile(client, "CREATOR")).toThrow();
    expect(() => readProfile({ name: "이름" }, "CLIENT")).toThrow();
    expect(readProfile(creator, "CREATOR").profile).toMatchObject({
      serviceStatus: "PUBLIC",
    });
  });
  it("조회는 취소 signal을 전달하며 타인 ID를 URL에 받지 않는다", async () => {
    const { signal } = new AbortController();
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: client });
    await expect(getProfile("CLIENT", signal)).resolves.toEqual(client);
    expect(get).toHaveBeenCalledWith("/api/profiles/me", { signal });
  });
  it("저장 실패를 자동 재전송하지 않는다", async () => {
    const patch = vi
      .spyOn(api, "patch")
      .mockRejectedValue(new Error("network"));
    await expect(saveProfile("CLIENT", { name: "새 이름" })).rejects.toThrow(
      "network",
    );
    expect(patch).toHaveBeenCalledTimes(1);
  });
});
