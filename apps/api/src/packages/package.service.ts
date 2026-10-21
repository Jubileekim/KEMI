import {
  type AuthUser,
  type CreatorPackagesResponse,
  creatorServiceStatusSchema,
  type CreatorServiceStatus,
  type MyPackagesResponse,
  PACKAGE_LIMITS,
  packageCreateSchema,
  packageSourceDeliverySchema,
  packageSpecificationSchema,
  packageUpdateSchema,
  packageUsageTermsSchema,
  type ServicePackage,
  type ServiceRequirement,
  serviceStatusUpdateSchema,
} from "@kemi/shared";
import { z } from "zod";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

interface PackageRow {
  id: bigint;
  title: string;
  description: string;
  basePrice: bigint;
  specification: Prisma.JsonValue;
  includedScope: string;
  excludedScope: string;
  requiredMaterials: Prisma.JsonValue;
  deliveryDays: number;
  revisionLimit: number;
  revisionScope: string;
  sourceDelivery: Prisma.JsonValue;
  usageTerms: Prisma.JsonValue;
  isPublic: boolean;
  isRepresentative: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const requiredMaterialsSchema = z.array(z.string());
const ID_PATTERN = /^\d+$/;

// 동시 요청이 줄을 서서 기다릴 수 있도록 기본값(연결 2초·실행 5초)보다 넉넉히 둔다.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

function toServicePackage(row: PackageRow): ServicePackage {
  return {
    id: row.id.toString(),
    title: row.title,
    description: row.description,
    basePrice: Number(row.basePrice),
    currency: "KRW",
    specification: packageSpecificationSchema.parse(row.specification),
    includedScope: row.includedScope,
    excludedScope: row.excludedScope,
    requiredMaterials: requiredMaterialsSchema.parse(row.requiredMaterials),
    deliveryDays: row.deliveryDays,
    revisionLimit: row.revisionLimit,
    revisionScope: row.revisionScope,
    sourceDelivery: packageSourceDeliverySchema.parse(row.sourceDelivery),
    usageTerms: packageUsageTermsSchema.parse(row.usageTerms),
    isPublic: row.isPublic,
    isRepresentative: row.isRepresentative,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requireCreator(user: AuthUser): bigint {
  if (user.role !== "CREATOR") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "크리에이터만 패키지와 제작 서비스를 관리할 수 있습니다.",
    );
  }
  return BigInt(user.id);
}

function packageNotFound(): AppError {
  return new AppError(404, "NOT_FOUND", "패키지를 찾을 수 없습니다.");
}

function parsePackageId(value: string): bigint {
  if (!ID_PATTERN.test(value)) throw packageNotFound();
  return BigInt(value);
}

// 크리에이터의 패키지·서비스 상태를 바꾸는 모든 작업은 먼저 creator_profiles 행을 잠근다.
// 같은 크리에이터의 변경이 한 번에 하나씩 실행되므로, 대표 하나·최대 개수·공개 조건을 읽은 값 그대로 지킬 수 있다.
async function lockCreator(
  tx: Tx,
  userId: bigint,
): Promise<CreatorServiceStatus> {
  // 프로필을 저장한 적이 없는 크리에이터도 패키지를 만들 수 있도록 빈 프로필을 먼저 만든다.
  await tx.$executeRaw`
    INSERT INTO creator_profiles (user_id, updated_at) VALUES (${userId}, now())
    ON CONFLICT (user_id) DO NOTHING`;
  const rows = await tx.$queryRaw<{ service_status: string }[]>`
    SELECT service_status FROM creator_profiles WHERE user_id = ${userId} FOR UPDATE`;
  return creatorServiceStatusSchema.parse(rows[0]?.service_status);
}

async function findOwnPackage(tx: Tx, userId: bigint, packageId: bigint) {
  const row = await tx.servicePackage.findFirst({
    where: { id: packageId, creatorId: userId, deletedAt: null },
  });
  if (!row) throw packageNotFound();
  return row;
}

async function otherPublicCount(tx: Tx, userId: bigint, packageId: bigint) {
  return tx.servicePackage.count({
    where: {
      creatorId: userId,
      deletedAt: null,
      isPublic: true,
      id: { not: packageId },
    },
  });
}

function representativeRequired(): AppError {
  return new AppError(
    409,
    "REPRESENTATIVE_REQUIRED",
    "다른 공개 패키지가 있어 대표 패키지를 비공개로 바꾸거나 삭제할 수 없습니다. 먼저 다른 패키지를 대표로 지정해주세요.",
  );
}

// 마지막 공개 패키지가 사라지면 공개 중인 서비스를 비공개로 바꾼다(D03 제안). 초안(DRAFT)은 그대로 둔다.
async function closeServiceIfPublic(
  tx: Tx,
  userId: bigint,
  status: CreatorServiceStatus,
) {
  if (status === "PUBLIC") {
    await tx.creatorProfile.update({
      where: { userId },
      data: { serviceStatus: "PRIVATE" },
    });
  }
}

async function listMine(tx: Tx, userId: bigint): Promise<MyPackagesResponse> {
  const profile = await tx.creatorProfile.findUnique({ where: { userId } });
  const rows = await tx.servicePackage.findMany({
    where: { creatorId: userId, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return {
    serviceStatus: creatorServiceStatusSchema.parse(
      profile?.serviceStatus ?? "DRAFT",
    ),
    packages: rows.map(toServicePackage),
  };
}

export function createPackageService({ prisma }: { prisma: PrismaClient }) {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  async function getMine(user: AuthUser): Promise<MyPackagesResponse> {
    const userId = requireCreator(user);
    return inTransaction((tx) => listMine(tx, userId));
  }

  // PACK-01: 패키지 만들기. 첫 공개 패키지는 대표가 된다(D03 제안).
  async function create(
    user: AuthUser,
    input: unknown,
  ): Promise<MyPackagesResponse> {
    const userId = requireCreator(user);
    const data = packageCreateSchema.parse(input);
    return inTransaction(async (tx) => {
      await lockCreator(tx, userId);
      const count = await tx.servicePackage.count({
        where: { creatorId: userId, deletedAt: null },
      });
      if (count >= PACKAGE_LIMITS.maxPackages) {
        throw new AppError(
          409,
          "PACKAGE_LIMIT_EXCEEDED",
          `패키지는 최대 ${PACKAGE_LIMITS.maxPackages}개까지 만들 수 있습니다.`,
        );
      }
      const hasRepresentative =
        (await tx.servicePackage.count({
          where: { creatorId: userId, deletedAt: null, isRepresentative: true },
        })) > 0;
      await tx.servicePackage.create({
        data: {
          ...data,
          creatorId: userId,
          basePrice: BigInt(data.basePrice),
          isRepresentative: data.isPublic && !hasRepresentative,
        },
      });
      return listMine(tx, userId);
    });
  }

  // PACK-02: 패키지 수정·공개 전환. 이미 요청·계약에 쓰인 금액·조건은 요청 쪽 스냅샷이라 바뀌지 않는다.
  async function update(
    user: AuthUser,
    packageIdParam: string,
    input: unknown,
  ): Promise<MyPackagesResponse> {
    const userId = requireCreator(user);
    const packageId = parsePackageId(packageIdParam);
    const { basePrice, ...data } = packageUpdateSchema.parse(input);
    return inTransaction(async (tx) => {
      const status = await lockCreator(tx, userId);
      const current = await findOwnPackage(tx, userId, packageId);
      let { isRepresentative } = current;

      if (data.isPublic === false && current.isRepresentative) {
        if ((await otherPublicCount(tx, userId, packageId)) > 0) {
          throw representativeRequired();
        }
        // 마지막 공개 패키지를 비공개로 바꾼다.
        isRepresentative = false;
        await closeServiceIfPublic(tx, userId, status);
      }
      if (data.isPublic === true && !current.isPublic) {
        const hasRepresentative =
          (await tx.servicePackage.count({
            where: {
              creatorId: userId,
              deletedAt: null,
              isRepresentative: true,
            },
          })) > 0;
        isRepresentative = !hasRepresentative;
      }

      await tx.servicePackage.update({
        where: { id: packageId },
        data: {
          ...data,
          ...(basePrice === undefined ? {} : { basePrice: BigInt(basePrice) }),
          isRepresentative,
        },
      });
      return listMine(tx, userId);
    });
  }

  // PACK-03: 대표 패키지 바꾸기. 공개 패키지만 대표가 될 수 있다.
  async function setRepresentative(
    user: AuthUser,
    packageIdParam: string,
  ): Promise<MyPackagesResponse> {
    const userId = requireCreator(user);
    const packageId = parsePackageId(packageIdParam);
    return inTransaction(async (tx) => {
      await lockCreator(tx, userId);
      const target = await findOwnPackage(tx, userId, packageId);
      if (!target.isPublic) {
        throw new AppError(
          409,
          "CONFLICT",
          "비공개 패키지는 대표로 지정할 수 없습니다. 먼저 공개해주세요.",
        );
      }
      // 부분 UNIQUE 인덱스 때문에 기존 대표를 먼저 내린 뒤 새 대표를 지정한다.
      await tx.servicePackage.updateMany({
        where: {
          creatorId: userId,
          deletedAt: null,
          isRepresentative: true,
          id: { not: packageId },
        },
        data: { isRepresentative: false },
      });
      await tx.servicePackage.update({
        where: { id: packageId },
        data: { isRepresentative: true },
      });
      return listMine(tx, userId);
    });
  }

  // 패키지 삭제: 행은 남기고 deleted_at만 기록한다(요청·계약 참조와 당시 조건 보존).
  async function remove(
    user: AuthUser,
    packageIdParam: string,
  ): Promise<MyPackagesResponse> {
    const userId = requireCreator(user);
    const packageId = parsePackageId(packageIdParam);
    return inTransaction(async (tx) => {
      const status = await lockCreator(tx, userId);
      const current = await findOwnPackage(tx, userId, packageId);
      if (current.isRepresentative) {
        if ((await otherPublicCount(tx, userId, packageId)) > 0) {
          throw representativeRequired();
        }
        await closeServiceIfPublic(tx, userId, status);
      }
      await tx.servicePackage.update({
        where: { id: packageId },
        data: {
          deletedAt: new Date(),
          isPublic: false,
          isRepresentative: false,
        },
      });
      return listMine(tx, userId);
    });
  }

  // PROFILE-03·04: 제작 서비스 공개·비공개
  async function updateServiceStatus(
    user: AuthUser,
    input: unknown,
  ): Promise<MyPackagesResponse> {
    const userId = requireCreator(user);
    const { status } = serviceStatusUpdateSchema.parse(input);
    return inTransaction(async (tx) => {
      const current = await lockCreator(tx, userId);
      if (status === "PRIVATE") {
        if (current === "DRAFT") {
          throw new AppError(
            409,
            "CONFLICT",
            "아직 공개한 적 없는 서비스입니다.",
          );
        }
      } else {
        const profile = await tx.creatorProfile.findUniqueOrThrow({
          where: { userId },
        });
        const hasRepresentative =
          (await tx.servicePackage.count({
            where: {
              creatorId: userId,
              deletedAt: null,
              isRepresentative: true,
            },
          })) > 0;
        const missing: ServiceRequirement[] = [];
        if (!profile.introduction) missing.push("INTRODUCTION");
        if (!profile.niche) missing.push("NICHE");
        if (profile.contentStyles.length === 0) missing.push("CONTENT_STYLES");
        if (profile.productionRoles.length === 0) {
          missing.push("PRODUCTION_ROLES");
        }
        if (!hasRepresentative) missing.push("PUBLIC_REPRESENTATIVE_PACKAGE");
        if (missing.length > 0) {
          throw new AppError(
            409,
            "SERVICE_REQUIREMENTS_MISSING",
            "서비스를 공개하려면 빠진 항목을 채워주세요.",
            { missing },
          );
        }
      }
      if (current !== status) {
        await tx.creatorProfile.update({
          where: { userId },
          data: { serviceStatus: status },
        });
      }
      return listMine(tx, userId);
    });
  }

  // 공개 서비스의 공개 패키지 조회 (탐색·직접 의뢰 화면용). 비공개·초안 서비스는 없는 것과 같게 404다.
  async function listPublic(
    creatorIdParam: string,
  ): Promise<CreatorPackagesResponse> {
    const notFound = new AppError(
      404,
      "NOT_FOUND",
      "공개된 제작 서비스를 찾을 수 없습니다.",
    );
    if (!ID_PATTERN.test(creatorIdParam)) throw notFound;
    const creatorId = BigInt(creatorIdParam);
    const profile = await prisma.creatorProfile.findUnique({
      where: { userId: creatorId },
      include: { user: true },
    });
    if (
      profile?.serviceStatus !== "PUBLIC" ||
      profile.user.status !== "ACTIVE"
    ) {
      throw notFound;
    }
    const rows = await prisma.servicePackage.findMany({
      where: { creatorId, deletedAt: null, isPublic: true },
      orderBy: [
        { isRepresentative: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
    return {
      creatorId: creatorIdParam,
      packages: rows.map(toServicePackage),
    };
  }

  return {
    getMine,
    create,
    update,
    setRepresentative,
    remove,
    updateServiceStatus,
    listPublic,
  };
}

export type PackageService = ReturnType<typeof createPackageService>;
