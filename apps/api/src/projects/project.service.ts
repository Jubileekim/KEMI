import {
  type AuthUser,
  type ProjectListQuery,
  type ProjectListResponse,
  type ProjectStatus,
  type ProjectSummary,
  projectCreateSchema,
  projectListQuerySchema,
  projectStatusSchema,
  projectUpdateSchema,
  videoPurposeSchema,
  videoStyleSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

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
  createdAt: Date;
  updatedAt: Date;
  client: { name: string };
}

function requireClient(user: AuthUser): void {
  if (user.role !== "CLIENT") {
    throw new AppError(
      403,
      "FORBIDDEN",
      "의뢰인만 공개 프로젝트를 관리할 수 있습니다.",
    );
  }
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function validateSchedule(
  recruitmentEndAt: Date,
  deliveryDueDate: Date,
  now: Date,
): void {
  if (recruitmentEndAt <= now) {
    throw new AppError(
      400,
      "VALIDATION_FAILED",
      "모집 마감 시각은 현재보다 뒤여야 합니다.",
    );
  }
  if (deliveryDueDate <= recruitmentEndAt) {
    throw new AppError(
      400,
      "VALIDATION_FAILED",
      "희망 납품일은 모집 마감일보다 뒤여야 합니다.",
    );
  }
}

function orderByOf(
  sort: ProjectListQuery["sort"],
): Prisma.ProjectOrderByWithRelationInput[] {
  if (sort === "BUDGET_LOW") return [{ budget: "asc" }, { id: "desc" }];
  if (sort === "BUDGET_HIGH") return [{ budget: "desc" }, { id: "desc" }];
  if (sort === "DEADLINE") {
    return [{ recruitmentEndAt: "asc" }, { id: "desc" }];
  }
  return [{ createdAt: "desc" }, { id: "desc" }];
}

function filterOf(query: ProjectListQuery): Prisma.ProjectWhereInput {
  return {
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            {
              description: {
                contains: query.q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(query.purpose ? { purpose: query.purpose } : {}),
    ...(query.styles ? { styles: { hasSome: query.styles } } : {}),
    ...(query.budgetMin !== undefined || query.budgetMax !== undefined
      ? {
          budget: {
            ...(query.budgetMin !== undefined
              ? { gte: BigInt(query.budgetMin) }
              : {}),
            ...(query.budgetMax !== undefined
              ? { lte: BigInt(query.budgetMax) }
              : {}),
          },
        }
      : {}),
  };
}

const includeClient = { client: { select: { name: true } } } as const;

export interface ProjectService {
  listPublic(input: unknown): Promise<ProjectListResponse>;
  getPublic(projectId: bigint): Promise<ProjectSummary>;
  listMine(user: AuthUser, input: unknown): Promise<ProjectListResponse>;
  create(user: AuthUser, input: unknown): Promise<ProjectSummary>;
  update(
    user: AuthUser,
    projectId: bigint,
    input: unknown,
  ): Promise<ProjectSummary>;
  close(user: AuthUser, projectId: bigint): Promise<ProjectSummary>;
  remove(user: AuthUser, projectId: bigint): Promise<void>;
}

export function createProjectService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): ProjectService {
  async function list(
    input: unknown,
    ownerId?: bigint,
  ): Promise<ProjectListResponse> {
    const query = projectListQuerySchema.parse(input);
    const current = now();
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(ownerId === undefined
        ? { status: "OPEN", recruitmentEndAt: { gt: current } }
        : { clientId: ownerId }),
      ...filterOf(query),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.project.findMany({
        where,
        include: includeClient,
        orderBy: orderByOf(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.project.count({ where }),
    ]);
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

  async function getOwned(user: AuthUser, projectId: bigint) {
    requireClient(user);
    const row = await prisma.project.findFirst({
      where: { id: projectId, clientId: BigInt(user.id), deletedAt: null },
      include: includeClient,
    });
    if (!row) {
      throw new AppError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
    }
    return row;
  }

  return {
    listPublic: (input) => list(input),

    async getPublic(projectId) {
      const row = await prisma.project.findFirst({
        where: {
          id: projectId,
          status: "OPEN",
          recruitmentEndAt: { gt: now() },
          deletedAt: null,
        },
        include: includeClient,
      });
      if (!row) {
        throw new AppError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
      }
      return toProject(row);
    },

    async listMine(user, input) {
      requireClient(user);
      return list(input, BigInt(user.id));
    },

    async create(user, input) {
      requireClient(user);
      const parsed = projectCreateSchema.parse(input);
      const recruitmentEndAt = new Date(parsed.recruitmentEndAt);
      const deliveryDueDate = dateOnly(parsed.deliveryDueDate);
      validateSchedule(recruitmentEndAt, deliveryDueDate, now());
      const row = await prisma.project.create({
        data: {
          clientId: BigInt(user.id),
          title: parsed.title,
          description: parsed.description,
          purpose: parsed.purpose,
          styles: parsed.styles,
          budget: BigInt(parsed.budget),
          expectedDurationSeconds: parsed.expectedDurationSeconds ?? null,
          recruitmentEndAt,
          deliveryDueDate,
        },
        include: includeClient,
      });
      return toProject(row);
    },

    async update(user, projectId, input) {
      const existing = await getOwned(user, projectId);
      if (projectStatusSchema.parse(existing.status) !== "OPEN") {
        throw new AppError(
          409,
          "CONFLICT",
          "모집 중인 프로젝트만 수정할 수 있습니다.",
        );
      }
      const parsed = projectUpdateSchema.parse(input);
      const recruitmentEndAt =
        parsed.recruitmentEndAt === undefined
          ? existing.recruitmentEndAt
          : new Date(parsed.recruitmentEndAt);
      const deliveryDueDate =
        parsed.deliveryDueDate === undefined
          ? existing.deliveryDueDate
          : dateOnly(parsed.deliveryDueDate);
      validateSchedule(recruitmentEndAt, deliveryDueDate, now());

      const row = await prisma.project.update({
        where: { id: projectId },
        data: {
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
          ...(parsed.description !== undefined
            ? { description: parsed.description }
            : {}),
          ...(parsed.purpose !== undefined ? { purpose: parsed.purpose } : {}),
          ...(parsed.styles !== undefined ? { styles: parsed.styles } : {}),
          ...(parsed.budget !== undefined
            ? { budget: BigInt(parsed.budget) }
            : {}),
          ...(parsed.expectedDurationSeconds !== undefined
            ? {
                expectedDurationSeconds: parsed.expectedDurationSeconds ?? null,
              }
            : {}),
          ...(parsed.recruitmentEndAt !== undefined
            ? { recruitmentEndAt }
            : {}),
          ...(parsed.deliveryDueDate !== undefined ? { deliveryDueDate } : {}),
        },
        include: includeClient,
      });
      return toProject(row);
    },

    async close(user, projectId) {
      const existing = await getOwned(user, projectId);
      const status: ProjectStatus = projectStatusSchema.parse(existing.status);
      if (status !== "OPEN") {
        throw new AppError(409, "CONFLICT", "이미 모집이 종료되었습니다.");
      }
      const row = await prisma.project.update({
        where: { id: projectId },
        data: { status: "CLOSED" },
        include: includeClient,
      });
      return toProject(row);
    },

    async remove(user, projectId) {
      const existing = await getOwned(user, projectId);
      if (projectStatusSchema.parse(existing.status) === "CONTRACTED") {
        throw new AppError(
          409,
          "CONFLICT",
          "거래가 시작된 프로젝트는 삭제할 수 없습니다.",
        );
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "CLOSED", deletedAt: now() },
      });
    },
  };
}
