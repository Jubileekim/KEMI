import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@kemi/shared";
import { createPrismaClient } from "../src/lib/prisma.js";
import { createProfileService } from "../src/profiles/profile.service.js";

const user: AuthUser = {
  id: "1",
  email: "creator@example.com",
  name: "제작자",
  role: "CREATOR",
  status: "ACTIVE",
};

function fixture(fileChange: Record<string, unknown> = {}) {
  const file = {
    id: 7n,
    ownerId: 1n,
    purpose: "PROFILE_IMAGE",
    mimeType: "image/png",
    status: "READY",
    workRequestId: null,
    ...fileChange,
  };
  let profile = {
    brandName: null,
    industry: null,
    imageFileId: null,
    career: null,
    websiteUrl: null,
    socialUrl: null,
    introduction: null,
    niche: null,
    contentStyles: [],
    productionRoles: [],
    workMethod: null,
    serviceStatus: "DRAFT",
    isAvailable: false,
    availableFrom: null,
  };
  const upsert = vi.fn(
    async ({ update }: { update: Record<string, unknown> }) => {
      profile = {
        ...profile,
        ...Object.fromEntries(
          Object.entries(update).filter(([, value]) => value !== undefined),
        ),
      };
      return profile;
    },
  );
  const tx = {
    file: { findUnique: vi.fn().mockResolvedValue(file) },
    creatorProfile: { upsert, findUnique: vi.fn(async () => profile) },
    clientProfile: { upsert },
    user: { update: vi.fn().mockResolvedValue({ name: user.name }) },
  };
  const prisma = Object.assign(
    createPrismaClient({
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
      DATABASE_POOL_MAX: 1,
    }),
    {
      ...tx,
      $transaction: async (run: (value: typeof tx) => Promise<unknown>) =>
        run(tx),
    },
  );
  return { service: createProfileService({ prisma }), upsert, tx };
}

describe("프로필 추가 정보 저장 경계", () => {
  it("본인 READY 이미지와 경력·링크를 저장하고, 재조회·삭제한다", async () => {
    const { service, tx } = fixture();
    const result = await service.updateMine(user, {
      imageFileId: "7",
      career: "  제작 3년  ",
      websiteUrl: "https://example.com",
      socialUrl: "",
    });
    expect(result.profile).toMatchObject({
      imageFileId: "7",
      career: "제작 3년",
      websiteUrl: "https://example.com",
      socialUrl: null,
    });
    expect(await service.getMine(user)).toEqual(result);
    await service.updateMine(user, { introduction: "소개" });
    expect((await service.getMine(user)).profile).toMatchObject({
      imageFileId: "7",
      career: "제작 3년",
    });
    expect(tx.file.findUnique).toHaveBeenCalledTimes(1);
    await service.updateMine(user, {
      imageFileId: null,
      career: "",
      websiteUrl: "",
    });
    expect((await service.getMine(user)).profile).toMatchObject({
      imageFileId: null,
      career: null,
      websiteUrl: null,
      serviceStatus: "DRAFT",
    });
  });
  it("의뢰인도 본인 로고를 저장할 수 있다", async () => {
    const { service, tx } = fixture();
    await service.updateMine({ ...user, role: "CLIENT" }, { imageFileId: "7" });
    expect(tx.clientProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { imageFileId: 7n } }),
    );
  });
  it.each([
    { ownerId: 2n },
    { status: "PENDING" },
    { status: "REJECTED" },
    { purpose: "PORTFOLIO" },
    { mimeType: "video/mp4" },
    { workRequestId: 3n },
  ])(
    "연결할 수 없는 파일을 거절하고 프로필을 쓰지 않는다: %o",
    async (change) => {
      const { service, upsert } = fixture(change);
      await expect(
        service.updateMine(user, { imageFileId: "7" }),
      ).rejects.toMatchObject({ status: 400 });
      expect(upsert).not.toHaveBeenCalled();
    },
  );
  it("존재하지 않는 파일과 잘못된 URL을 거절한다", async () => {
    const { service, tx, upsert } = fixture();
    tx.file.findUnique.mockResolvedValue(null);
    await expect(
      service.updateMine(user, { imageFileId: "7" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.updateMine(user, {
        socialUrl: ["javascript", "alert(1)"].join(":"),
      }),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });
});
