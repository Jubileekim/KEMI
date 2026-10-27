import {
  type AuthUser,
  type ClientProfile,
  clientProfileUpdateSchema,
  contentStyleSchema,
  type CreatorProfile,
  creatorProfileUpdateSchema,
  creatorServiceStatusSchema,
  type MyProfileResponse,
  productCategorySchema,
  productionRoleSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

interface ClientProfileRow {
  imageFileId: bigint | null;
  brandName: string | null;
  introduction: string | null;
  industry: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
}

interface CreatorProfileRow {
  imageFileId: bigint | null;
  career: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  introduction: string | null;
  niche: string | null;
  contentStyles: string[];
  productionRoles: string[];
  workMethod: string | null;
  serviceStatus: string;
  isAvailable: boolean;
  availableFrom: Date | null;
}

// 아직 저장한 적이 없는 프로필. DB 기본값과 같다.
const EMPTY_CLIENT_PROFILE: ClientProfileRow = {
  imageFileId: null,
  brandName: null,
  introduction: null,
  industry: null,
  websiteUrl: null,
  socialUrl: null,
};

const EMPTY_CREATOR_PROFILE: CreatorProfileRow = {
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

function toClientProfile(row: ClientProfileRow): ClientProfile {
  return {
    type: "CLIENT",
    imageFileId: row.imageFileId?.toString() ?? null,
    brandName: row.brandName,
    introduction: row.introduction,
    industry: productCategorySchema.nullable().parse(row.industry),
    websiteUrl: row.websiteUrl,
    socialUrl: row.socialUrl,
  };
}

function toCreatorProfile(row: CreatorProfileRow): CreatorProfile {
  return {
    type: "CREATOR",
    imageFileId: row.imageFileId?.toString() ?? null,
    career: row.career,
    websiteUrl: row.websiteUrl,
    socialUrl: row.socialUrl,
    introduction: row.introduction,
    niche: productCategorySchema.nullable().parse(row.niche),
    contentStyles: contentStyleSchema.array().parse(row.contentStyles),
    productionRoles: productionRoleSchema.array().parse(row.productionRoles),
    workMethod: row.workMethod,
    serviceStatus: creatorServiceStatusSchema.parse(row.serviceStatus),
    isAvailable: row.isAvailable,
    availableFrom: row.availableFrom?.toISOString().slice(0, 10) ?? null,
  };
}

// 프로필은 의뢰인·크리에이터만 가진다.
function profileRoleOf(user: AuthUser): "CLIENT" | "CREATOR" {
  if (user.role === "ADMIN") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "의뢰인·크리에이터만 프로필을 사용할 수 있습니다.",
    );
  }
  return user.role;
}

// 표시 이름은 users.name에 있다. 보낸 경우에만 바꾼다.
async function updateName(
  tx: Prisma.TransactionClient,
  user: AuthUser,
  name: string | undefined,
): Promise<string> {
  if (name === undefined) return user.name;
  const updated = await tx.user.update({
    where: { id: BigInt(user.id) },
    data: { name },
  });
  return updated.name;
}

export function createProfileService({ prisma }: { prisma: PrismaClient }) {
  async function imageField(
    tx: Prisma.TransactionClient,
    userId: bigint,
    id: string | null | undefined,
  ) {
    if (id === undefined || id === null) return id;
    const file = await tx.file.findUnique({ where: { id: BigInt(id) } });
    if (
      !file ||
      file.ownerId !== userId ||
      file.purpose !== "PROFILE_IMAGE" ||
      file.status !== "READY" ||
      file.workRequestId !== null ||
      !["image/png", "image/jpeg", "image/webp"].includes(file.mimeType)
    ) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "본인이 업로드하고 확인을 마친 프로필 이미지만 사용할 수 있습니다.",
      );
    }
    return file.id;
  }
  async function getMine(user: AuthUser): Promise<MyProfileResponse> {
    const userId = BigInt(user.id);
    if (profileRoleOf(user) === "CLIENT") {
      const row = await prisma.clientProfile.findUnique({ where: { userId } });
      return {
        name: user.name,
        profile: toClientProfile(row ?? EMPTY_CLIENT_PROFILE),
      };
    }
    const row = await prisma.creatorProfile.findUnique({ where: { userId } });
    return {
      name: user.name,
      profile: toCreatorProfile(row ?? EMPTY_CREATOR_PROFILE),
    };
  }

  // 보낸 항목만 바꾼다. 처음 저장할 때 프로필 행을 만든다.
  async function updateMine(
    user: AuthUser,
    input: unknown,
  ): Promise<MyProfileResponse> {
    const userId = BigInt(user.id);
    if (profileRoleOf(user) === "CLIENT") {
      const { name, imageFileId, ...data } =
        clientProfileUpdateSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        const image = await imageField(tx, userId, imageFileId);
        const displayName = await updateName(tx, user, name);
        const row = await tx.clientProfile.upsert({
          where: { userId },
          create: { userId, ...data, imageFileId: image },
          update: { ...data, imageFileId: image },
        });
        return { name: displayName, profile: toClientProfile(row) };
      });
    }
    const { name, availableFrom, imageFileId, ...data } =
      creatorProfileUpdateSchema.parse(input);
    const fields = {
      ...data,
      // "YYYY-MM-DD"를 그날 UTC 0시로 저장한다(date 열이라 날짜만 남는다).
      availableFrom:
        availableFrom === undefined || availableFrom === null
          ? availableFrom
          : new Date(availableFrom),
    };
    return prisma.$transaction(async (tx) => {
      const image = await imageField(tx, userId, imageFileId);
      const displayName = await updateName(tx, user, name);
      const row = await tx.creatorProfile.upsert({
        where: { userId },
        create: { userId, ...fields, imageFileId: image },
        update: { ...fields, imageFileId: image },
      });
      return { name: displayName, profile: toCreatorProfile(row) };
    });
  }

  return { getMine, updateMine };
}

export type ProfileService = ReturnType<typeof createProfileService>;
