import {
  type AuthUser,
  type CreatorPublicProfile,
  type Portfolio,
  type PortfolioMedia,
  type ServicePackage,
  catalogStatusSchema,
  packageCreateSchema,
  packageUpdateSchema,
  portfolioCreateSchema,
  portfolioSourceSchema,
  portfolioUpdateSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { type FileStorage, StorageUnavailableError } from "../files/storage.js";
import withObjectParticle from "../http/korean.js";

type Tx = Prisma.TransactionClient;
type PackageRow = Prisma.ServicePackageGetPayload<object>;
type PortfolioRow = Prisma.PortfolioGetPayload<object>;

// 공개 작업물 재생 주소의 유효 시간. 긴 영상도 끝까지 재생되고, 보는 도중 주소가 바뀌어 처음으로 돌아가지 않게 길게 둔다.
// 비공개 파일(납품·자료)은 files 서비스의 10분 주소를 그대로 쓴다.
const MEDIA_URL_SECONDS = 24 * 60 * 60;

const conflict = (message: string) => new AppError(409, "CONFLICT", message);
const notFound = (what: string) =>
  new AppError(
    404,
    "NOT_FOUND",
    `${withObjectParticle(what)} 찾을 수 없습니다.`,
  );

export function toPackage(row: PackageRow): ServicePackage {
  return {
    id: row.id.toString(),
    creatorId: row.creatorId.toString(),
    title: row.title,
    description: row.description,
    purpose: row.purpose,
    priceKrw: row.priceKrw === null ? null : Number(row.priceKrw),
    deliveryDays: row.deliveryDays,
    revisionCount: row.revisionCount,
    includes: row.includes,
    status: catalogStatusSchema.parse(row.status),
    isRepresentative: row.isRepresentative,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPortfolio(row: PortfolioRow): Portfolio {
  return {
    id: row.id.toString(),
    creatorId: row.creatorId.toString(),
    title: row.title,
    description: row.description,
    purpose: row.purpose,
    styles: row.styles,
    roles: row.roles,
    source: portfolioSourceSchema.parse(row.source),
    clientConsent: row.clientConsent,
    videoFileId: row.videoFileId?.toString() ?? null,
    thumbnailFileId: row.thumbnailFileId?.toString() ?? null,
    packageId: row.packageId?.toString() ?? null,
    status: catalogStatusSchema.parse(row.status),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// 공개에 필요한 항목이 빠졌으면 이름을 돌려준다.
function missingPackageFields(row: PackageRow): string[] {
  return [
    row.description === null && "description",
    row.purpose === null && "purpose",
    row.priceKrw === null && "priceKrw",
    row.deliveryDays === null && "deliveryDays",
    row.revisionCount === null && "revisionCount",
    row.includes.length === 0 && "includes",
  ].filter((name): name is string => typeof name === "string");
}

function missingPortfolioFields(row: PortfolioRow): string[] {
  return [
    row.videoFileId === null && "videoFileId",
    row.purpose === null && "purpose",
    row.roles.length === 0 && "roles",
  ].filter((name): name is string => typeof name === "string");
}

// 보내지 않은 항목(undefined)은 저장된 값을 쓴다.
const keep = <T>(value: T | undefined, saved: T): T =>
  value === undefined ? saved : value;

// 고객 의뢰 작업물은 고객의 검증 가능한 동의·범위·철회 기록이 준비될 때까지 공개하지 않는다(#60 리뷰, D16).
// 크리에이터가 스스로 표시하는 clientConsent만으로는 고객 동의를 증명할 수 없다. DB CHECK로도 막는다.
function clientWorkNotPublishable(): AppError {
  return conflict(
    "고객 의뢰 작업물은 아직 공개할 수 없습니다. 고객 동의 확인 기능이 준비되면 공개할 수 있습니다.",
  );
}

function incomplete(fields: string[]): AppError {
  return new AppError(
    400,
    "VALIDATION_FAILED",
    "공개하려면 필수 항목을 모두 채워야 합니다.",
    fields.map((field) => ({ path: [field] })),
  );
}

export interface CatalogService {
  listMyPackages(user: AuthUser): Promise<{ items: ServicePackage[] }>;
  createPackage(user: AuthUser, input: unknown): Promise<ServicePackage>;
  updatePackage(
    user: AuthUser,
    packageId: bigint,
    input: unknown,
  ): Promise<ServicePackage>;
  setPackageStatus(
    user: AuthUser,
    packageId: bigint,
    visible: boolean,
  ): Promise<ServicePackage>;
  makeRepresentative(
    user: AuthUser,
    packageId: bigint,
  ): Promise<ServicePackage>;
  listMyPortfolios(user: AuthUser): Promise<{ items: Portfolio[] }>;
  createPortfolio(user: AuthUser, input: unknown): Promise<Portfolio>;
  updatePortfolio(
    user: AuthUser,
    portfolioId: bigint,
    input: unknown,
  ): Promise<Portfolio>;
  setPortfolioStatus(
    user: AuthUser,
    portfolioId: bigint,
    visible: boolean,
  ): Promise<Portfolio>;
  setServiceStatus(
    user: AuthUser,
    visible: boolean,
  ): Promise<{ serviceStatus: string }>;
  getCreator(userId: bigint): Promise<CreatorPublicProfile>;
  getPackage(packageId: bigint): Promise<ServicePackage>;
  getPortfolio(portfolioId: bigint): Promise<Portfolio>;
  getPortfolioMedia(portfolioId: bigint): Promise<PortfolioMedia>;
}

// 공개 조건: 크리에이터가 활동 중이고 제작 서비스가 공개 상태
const publicCreator = {
  status: "ACTIVE",
  creatorProfile: { serviceStatus: "PUBLIC" },
} satisfies Prisma.UserWhereInput;

export function createCatalogService({
  prisma,
  storage,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  storage?: FileStorage;
  now?: () => Date;
}): CatalogService {
  function requireCreator(user: AuthUser): bigint {
    if (user.role !== "CREATOR") {
      throw new AppError(403, "FORBIDDEN", "크리에이터만 할 수 있습니다.");
    }
    return BigInt(user.id);
  }

  // 같은 크리에이터의 목록 변경(대표 지정·공개 전환)이 하나씩 진행되게 회원 행을 잠근다.
  async function lockCreator(tx: Tx, creatorId: bigint) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${creatorId} FOR UPDATE`;
  }

  async function ownPackage(tx: Tx, creatorId: bigint, packageId: bigint) {
    const row = await tx.servicePackage.findUnique({
      where: { id: packageId },
    });
    if (!row || row.creatorId !== creatorId) throw notFound("패키지");
    return row;
  }

  async function ownPortfolio(tx: Tx, creatorId: bigint, portfolioId: bigint) {
    const row = await tx.portfolio.findUnique({ where: { id: portfolioId } });
    if (!row || row.creatorId !== creatorId) throw notFound("작업물");
    return row;
  }

  async function serviceIsPublic(tx: Tx, creatorId: bigint) {
    const profile = await tx.creatorProfile.findUnique({
      where: { userId: creatorId },
      select: { serviceStatus: true },
    });
    return profile?.serviceStatus === "PUBLIC";
  }

  // 작업물 파일: 본인이 올려 확인이 끝난 PORTFOLIO 파일. 영상은 video/*, 대표 이미지는 image/*
  async function requirePortfolioFile(
    tx: Tx,
    creatorId: bigint,
    fileId: string | null | undefined,
    kind: "video" | "image",
  ) {
    if (fileId === undefined || fileId === null) return;
    const file = await tx.file.findUnique({ where: { id: BigInt(fileId) } });
    if (
      !file ||
      file.ownerId !== creatorId ||
      file.purpose !== "PORTFOLIO" ||
      file.status !== "READY" ||
      !file.mimeType.startsWith(`${kind}/`)
    ) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        kind === "video"
          ? "작업물 영상은 본인이 올려 확인이 끝난 영상 파일이어야 합니다."
          : "대표 이미지는 본인이 올려 확인이 끝난 이미지 파일이어야 합니다.",
        [{ path: [kind === "video" ? "videoFileId" : "thumbnailFileId"] }],
      );
    }
  }

  async function requireLinkablePackage(
    tx: Tx,
    creatorId: bigint,
    packageId: string | null | undefined,
  ) {
    if (packageId === undefined || packageId === null) return;
    const row = await tx.servicePackage.findUnique({
      where: { id: BigInt(packageId) },
    });
    if (!row || row.creatorId !== creatorId) {
      throw new AppError(
        400,
        "VALIDATION_FAILED",
        "본인 패키지만 연결할 수 있습니다.",
        [{ path: ["packageId"] }],
      );
    }
  }

  // undefined(보내지 않음)는 그대로 두고, null은 지운다.
  function optionalBigInt(value: string | null | undefined) {
    if (value === undefined || value === null) return value;
    return BigInt(value);
  }

  function portfolioData(data: ReturnType<typeof portfolioUpdateSchema.parse>) {
    return {
      title: data.title,
      description: data.description,
      purpose: data.purpose,
      styles: data.styles,
      roles: data.roles,
      source: data.source,
      clientConsent: data.clientConsent,
      videoFileId: optionalBigInt(data.videoFileId),
      thumbnailFileId: optionalBigInt(data.thumbnailFileId),
      packageId: optionalBigInt(data.packageId),
    };
  }

  function packageData(data: ReturnType<typeof packageUpdateSchema.parse>) {
    return {
      title: data.title,
      description: data.description,
      purpose: data.purpose,
      priceKrw:
        data.priceKrw === undefined || data.priceKrw === null
          ? data.priceKrw
          : BigInt(data.priceKrw),
      deliveryDays: data.deliveryDays,
      revisionCount: data.revisionCount,
      includes: data.includes,
    };
  }

  async function signedUrl(path: string) {
    if (!storage) {
      throw new AppError(
        503,
        "SERVICE_UNAVAILABLE",
        "파일 저장소가 아직 설정되지 않았습니다.",
        { reason: "STORAGE_NOT_CONFIGURED" },
      );
    }
    try {
      return {
        url: await storage.createDownloadUrl(path, MEDIA_URL_SECONDS),
        expiresAt: new Date(
          now().getTime() + MEDIA_URL_SECONDS * 1000,
        ).toISOString(),
      };
    } catch (err) {
      if (err instanceof StorageUnavailableError) {
        throw new AppError(
          503,
          "SERVICE_UNAVAILABLE",
          "파일 저장소에 연결할 수 없습니다.",
          {
            reason: "STORAGE_REQUEST_FAILED",
            failure: err.reason,
            storageStatus: err.storageStatus ?? null,
          },
        );
      }
      throw err;
    }
  }

  return {
    async listMyPackages(user) {
      const creatorId = requireCreator(user);
      const rows = await prisma.servicePackage.findMany({
        where: { creatorId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return { items: rows.map(toPackage) };
    },

    // PACK-01: 초안 저장. 공개는 따로 한다.
    async createPackage(user, input) {
      const creatorId = requireCreator(user);
      const data = packageCreateSchema.parse(input);
      const row = await prisma.servicePackage.create({
        data: { ...packageData(data), title: data.title, creatorId },
      });
      return toPackage(row);
    },

    // 공개 중인 패키지도 고칠 수 있지만, 필수 항목은 비울 수 없다.
    async updatePackage(user, packageId, input) {
      const creatorId = requireCreator(user);
      const data = packageUpdateSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        await lockCreator(tx, creatorId);
        const row = await ownPackage(tx, creatorId, packageId);
        const next = packageData(data);
        if (row.status !== "DRAFT") {
          const missing = missingPackageFields({
            ...row,
            description: keep(next.description, row.description),
            purpose: keep(next.purpose, row.purpose),
            priceKrw: keep(next.priceKrw, row.priceKrw),
            deliveryDays: keep(next.deliveryDays, row.deliveryDays),
            revisionCount: keep(next.revisionCount, row.revisionCount),
            includes: keep(next.includes, row.includes),
          });
          if (missing.length > 0) throw incomplete(missing);
        }
        return toPackage(
          await tx.servicePackage.update({
            where: { id: packageId },
            data: next,
          }),
        );
      });
    },

    // PACK-02: 공개·비공개 전환. 공개 서비스의 대표 패키지는 다른 대표를 정하기 전에는 내릴 수 없다.
    async setPackageStatus(user, packageId, visible) {
      const creatorId = requireCreator(user);
      return prisma.$transaction(async (tx) => {
        await lockCreator(tx, creatorId);
        const row = await ownPackage(tx, creatorId, packageId);
        if (visible) {
          const missing = missingPackageFields(row);
          if (missing.length > 0) throw incomplete(missing);
        } else if (
          row.isRepresentative &&
          (await serviceIsPublic(tx, creatorId))
        ) {
          throw conflict(
            "공개 중인 서비스의 대표 패키지입니다. 다른 대표 패키지를 먼저 정하거나 서비스를 내려주세요.",
          );
        }
        return toPackage(
          await tx.servicePackage.update({
            where: { id: packageId },
            data: visible
              ? { status: "PUBLIC" }
              : { status: "PRIVATE", isRepresentative: false },
          }),
        );
      });
    },

    // PACK-03: 대표 패키지 지정. 공개된 패키지만, 크리에이터당 하나(이전 대표는 해제).
    async makeRepresentative(user, packageId) {
      const creatorId = requireCreator(user);
      return prisma.$transaction(async (tx) => {
        await lockCreator(tx, creatorId);
        const row = await ownPackage(tx, creatorId, packageId);
        if (row.status !== "PUBLIC") {
          throw conflict("공개된 패키지만 대표로 정할 수 있습니다.");
        }
        await tx.servicePackage.updateMany({
          where: { creatorId, isRepresentative: true, id: { not: packageId } },
          data: { isRepresentative: false },
        });
        return toPackage(
          await tx.servicePackage.update({
            where: { id: packageId },
            data: { isRepresentative: true },
          }),
        );
      });
    },

    async listMyPortfolios(user) {
      const creatorId = requireCreator(user);
      const rows = await prisma.portfolio.findMany({
        where: { creatorId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return { items: rows.map(toPortfolio) };
    },

    // PORT-01: 작업물 초안 저장
    async createPortfolio(user, input) {
      const creatorId = requireCreator(user);
      const data = portfolioCreateSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        await requirePortfolioFile(tx, creatorId, data.videoFileId, "video");
        await requirePortfolioFile(
          tx,
          creatorId,
          data.thumbnailFileId,
          "image",
        );
        await requireLinkablePackage(tx, creatorId, data.packageId);
        return toPortfolio(
          await tx.portfolio.create({
            data: { ...portfolioData(data), title: data.title, creatorId },
          }),
        );
      });
    },

    async updatePortfolio(user, portfolioId, input) {
      const creatorId = requireCreator(user);
      const data = portfolioUpdateSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        const row = await ownPortfolio(tx, creatorId, portfolioId);
        await requirePortfolioFile(tx, creatorId, data.videoFileId, "video");
        await requirePortfolioFile(
          tx,
          creatorId,
          data.thumbnailFileId,
          "image",
        );
        await requireLinkablePackage(tx, creatorId, data.packageId);
        const next = portfolioData(data);
        if (
          row.status === "PUBLIC" &&
          keep(next.source, row.source) === "CLIENT_WORK"
        ) {
          throw clientWorkNotPublishable();
        }
        if (row.status === "PUBLIC") {
          const missing = missingPortfolioFields({
            ...row,
            videoFileId: keep(next.videoFileId, row.videoFileId),
            purpose: keep(next.purpose, row.purpose),
            roles: keep(next.roles, row.roles),
          });
          if (missing.length > 0) throw incomplete(missing);
        }
        return toPortfolio(
          await tx.portfolio.update({ where: { id: portfolioId }, data: next }),
        );
      });
    },

    // PORT-02: 작업물 공개·비공개. 고객 의뢰 작업은 지금은 공개하지 않는다(clientWorkNotPublishable).
    // 고객 납품물은 자동으로 공개되지 않는다(작업물은 크리에이터가 따로 올리고 공개해야 한다).
    async setPortfolioStatus(user, portfolioId, visible) {
      const creatorId = requireCreator(user);
      return prisma.$transaction(async (tx) => {
        const row = await ownPortfolio(tx, creatorId, portfolioId);
        if (visible) {
          const missing = missingPortfolioFields(row);
          if (missing.length > 0) throw incomplete(missing);
          if (row.source === "CLIENT_WORK") throw clientWorkNotPublishable();
        }
        return toPortfolio(
          await tx.portfolio.update({
            where: { id: portfolioId },
            data: visible
              ? { status: "PUBLIC", publishedAt: row.publishedAt ?? now() }
              : { status: "PRIVATE" },
          }),
        );
      });
    },

    // 제작 서비스 공개: 공개된 대표 패키지가 있어야 한다(P04).
    async setServiceStatus(user, visible) {
      const creatorId = requireCreator(user);
      return prisma.$transaction(async (tx) => {
        await lockCreator(tx, creatorId);
        if (visible) {
          const representative = await tx.servicePackage.findFirst({
            where: { creatorId, isRepresentative: true, status: "PUBLIC" },
            select: { id: true },
          });
          if (!representative) {
            throw conflict(
              "공개된 대표 패키지가 있어야 제작 서비스를 공개할 수 있습니다.",
            );
          }
        }
        const profile = await tx.creatorProfile.upsert({
          where: { userId: creatorId },
          create: {
            userId: creatorId,
            serviceStatus: visible ? "PUBLIC" : "PRIVATE",
          },
          update: { serviceStatus: visible ? "PUBLIC" : "PRIVATE" },
          select: { serviceStatus: true },
        });
        return profile;
      });
    },

    // 공개 제작자 페이지: 서비스가 공개된 크리에이터만
    async getCreator(userId) {
      const user = await prisma.user.findFirst({
        where: { id: userId, role: "CREATOR", ...publicCreator },
        include: {
          creatorProfile: { include: { image: true } },
          servicePackages: {
            where: { status: "PUBLIC" },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          portfolios: {
            where: { status: "PUBLIC" },
            orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
          },
          reviewsReceived: { select: { rating: true } },
        },
      });
      const representative = user?.servicePackages.find(
        (p) => p.isRepresentative,
      );
      if (!user?.creatorProfile || !representative) {
        throw notFound("제작자");
      }
      const ratings = user.reviewsReceived.map((r) => r.rating);
      const total = ratings.reduce((sum, value) => sum + value, 0);
      return {
        userId: user.id.toString(),
        career: user.creatorProfile.career,
        websiteUrl: user.creatorProfile.websiteUrl,
        socialUrl: user.creatorProfile.socialUrl,
        image:
          user.creatorProfile.image?.status === "READY" && storage
            ? await signedUrl(user.creatorProfile.image.storagePath)
            : null,
        name: user.name,
        introduction: user.creatorProfile.introduction,
        niche: user.creatorProfile.niche,
        contentStyles: user.creatorProfile.contentStyles,
        productionRoles: user.creatorProfile.productionRoles,
        isAvailable: user.creatorProfile.isAvailable,
        representativePackage: toPackage(representative),
        packages: user.servicePackages
          .filter((p) => !p.isRepresentative)
          .map(toPackage),
        portfolios: user.portfolios.map(toPortfolio),
        review: {
          averageRating:
            ratings.length === 0
              ? null
              : Math.round((total / ratings.length) * 10) / 10,
          count: ratings.length,
        },
      };
    },

    async getPackage(packageId) {
      const row = await prisma.servicePackage.findFirst({
        where: { id: packageId, status: "PUBLIC", creator: publicCreator },
      });
      if (!row) throw notFound("패키지");
      return toPackage(row);
    },

    async getPortfolio(portfolioId) {
      const row = await prisma.portfolio.findFirst({
        where: { id: portfolioId, status: "PUBLIC", creator: publicCreator },
      });
      if (!row) throw notFound("작업물");
      return toPortfolio(row);
    },

    // 공개 작업물의 영상·대표 이미지 재생 주소(24시간)
    async getPortfolioMedia(portfolioId) {
      const row = await prisma.portfolio.findFirst({
        where: { id: portfolioId, status: "PUBLIC", creator: publicCreator },
        include: {
          video: { select: { storagePath: true, status: true } },
          thumbnail: { select: { storagePath: true, status: true } },
        },
      });
      if (!row) throw notFound("작업물");
      const urlOf = async (file: typeof row.video) =>
        file?.status === "READY" ? signedUrl(file.storagePath) : null;
      const [video, thumbnail] = await Promise.all([
        urlOf(row.video),
        urlOf(row.thumbnail),
      ]);
      return { video, thumbnail };
    },
  };
}
