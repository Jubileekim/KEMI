import {
  contentStyleSchema,
  type AuthUser,
  type ContentStyle,
  type ProductCategory,
  type ProjectDiscoveryQuery,
  type ProjectListResponse,
  type ProjectSummary,
  type VideoPurpose,
  type VideoStyle,
  productCategorySchema,
  projectCloseReasonSchema,
  projectDiscoveryQuerySchema,
  projectStatusSchema,
  videoPurposeSchema,
  videoStyleSchema,
} from "@kemi/shared";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import AppError from "../http/app-error.js";

interface ProjectRow {
  id: bigint;
  clientId: bigint;
  title: string;
  description: string;
  purpose: string;
  styles: string[];
  budget: bigint;
  expectedDurationSeconds: number | null;
  recruitmentEndAt: Date;
  deliveryDueDate: Date;
  status: string;
  closeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { name: string };
}

const includeClient = { client: { select: { name: true } } } as const;

const NICHE_PURPOSES: Record<ProductCategory, readonly VideoPurpose[]> = {
  BEAUTY: ["SNS_SHORTFORM"],
  FOOD: ["SNS_SHORTFORM"],
  LIFESTYLE: [
    "WEDDING_COUPLE",
    "CHILD_FAMILY",
    "THANKS_CELEBRATION",
    "TRAVEL_DAILY",
  ],
  TECH: ["SNS_SHORTFORM"],
  OTHER: ["OTHER"],
};

const CONTENT_STYLE_VIDEO_STYLES: Record<ContentStyle, readonly VideoStyle[]> =
  {
    MODERN: ["CLEAN", "TRENDY"],
    BRIGHT: ["FUN", "CLEAN"],
    EMOTIONAL: ["EMOTIONAL", "CINEMATIC"],
    PROFESSIONAL: ["CLEAN", "CINEMATIC"],
    OTHER: ["OTHER"],
  };

function requireCreator(user: AuthUser): bigint {
  if (user.role !== "CREATOR") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "크리에이터만 프로젝트 북마크와 추천을 사용할 수 있습니다.",
    );
  }
  return BigInt(user.id);
}

function toProject(row: ProjectRow): ProjectSummary {
  return {
    id: row.id.toString(),
    clientId: row.clientId.toString(),
    clientName: row.client.name,
    title: row.title,
    description: row.description,
    purpose: videoPurposeSchema.parse(row.purpose),
    styles: videoStyleSchema.array().parse(row.styles),
    budget: Number(row.budget),
    expectedDurationSeconds: row.expectedDurationSeconds,
    recruitmentEndAt: row.recruitmentEndAt.toISOString(),
    deliveryDueDate: row.deliveryDueDate.toISOString().slice(0, 10),
    status: projectStatusSchema.parse(row.status),
    closeReason:
      row.closeReason === null
        ? null
        : projectCloseReasonSchema.parse(row.closeReason),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function responseOf(
  rows: ProjectRow[],
  total: number,
  query: ProjectDiscoveryQuery,
): ProjectListResponse {
  return {
    items: rows.map(toProject),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export interface ProjectDiscoveryService {
  listBookmarks(user: AuthUser, input: unknown): Promise<ProjectListResponse>;
  addBookmark(user: AuthUser, projectId: bigint): Promise<ProjectSummary>;
  removeBookmark(user: AuthUser, projectId: bigint): Promise<void>;
  listRecommendations(
    user: AuthUser,
    input: unknown,
  ): Promise<ProjectListResponse>;
}

export function createProjectDiscoveryService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): ProjectDiscoveryService {
  return {
    async listBookmarks(user, input) {
      const userId = requireCreator(user);
      const query = projectDiscoveryQuerySchema.parse(input);
      const where: Prisma.ProjectBookmarkWhereInput = {
        userId,
        project: { deletedAt: null },
      };
      const [bookmarks, total] = await prisma.$transaction([
        prisma.projectBookmark.findMany({
          where,
          include: { project: { include: includeClient } },
          orderBy: [{ createdAt: "desc" }, { projectId: "desc" }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        prisma.projectBookmark.count({ where }),
      ]);
      return responseOf(
        bookmarks.map(({ project }) => project),
        total,
        query,
      );
    },

    async addBookmark(user, projectId) {
      const userId = requireCreator(user);
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          status: "OPEN",
          recruitmentEndAt: { gt: now() },
          deletedAt: null,
        },
        include: includeClient,
      });
      if (!project) {
        throw new AppError(
          404,
          "NOT_FOUND",
          "북마크할 수 있는 모집 중 프로젝트가 없습니다.",
        );
      }
      await prisma.projectBookmark.upsert({
        where: { userId_projectId: { userId, projectId } },
        create: { userId, projectId },
        update: {},
      });
      return toProject(project);
    },

    async removeBookmark(user, projectId) {
      const userId = requireCreator(user);
      await prisma.projectBookmark.deleteMany({ where: { userId, projectId } });
    },

    async listRecommendations(user, input) {
      const userId = requireCreator(user);
      const query = projectDiscoveryQuerySchema.parse(input);
      const [profile, bookmarkedProjects] = await Promise.all([
        prisma.creatorProfile.findUnique({ where: { userId } }),
        prisma.projectBookmark.findMany({
          where: { userId, project: { deletedAt: null } },
          select: { project: { select: { purpose: true, styles: true } } },
        }),
      ]);

      const profileNiche = profile?.niche
        ? productCategorySchema.parse(profile.niche)
        : null;
      const purposes = new Set<VideoPurpose>([
        ...bookmarkedProjects.map(({ project }) =>
          videoPurposeSchema.parse(project.purpose),
        ),
        ...(profileNiche ? NICHE_PURPOSES[profileNiche] : []),
      ]);
      const styles = new Set<VideoStyle>([
        ...bookmarkedProjects.flatMap(({ project }) =>
          videoStyleSchema.array().parse(project.styles),
        ),
        ...(profile?.contentStyles ?? []).flatMap(
          (value) =>
            CONTENT_STYLE_VIDEO_STYLES[contentStyleSchema.parse(value)],
        ),
      ]);

      const baseWhere: Prisma.ProjectWhereInput = {
        status: "OPEN",
        recruitmentEndAt: { gt: now() },
        deletedAt: null,
        bookmarks: { none: { userId } },
      };
      const hasPreferences = purposes.size > 0 || styles.size > 0;
      const preferredWhere: Prisma.ProjectWhereInput = hasPreferences
        ? {
            ...baseWhere,
            OR: [
              ...(purposes.size > 0
                ? [{ purpose: { in: [...purposes] } }]
                : []),
              ...(styles.size > 0
                ? [{ styles: { hasSome: [...styles] } }]
                : []),
            ],
          }
        : baseWhere;
      const preferredTotal = await prisma.project.count({
        where: preferredWhere,
      });
      const where = preferredTotal > 0 ? preferredWhere : baseWhere;
      const total =
        preferredTotal > 0
          ? preferredTotal
          : await prisma.project.count({ where });
      const rows = await prisma.project.findMany({
        where,
        include: includeClient,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      return responseOf(rows, total, query);
    },
  };
}
