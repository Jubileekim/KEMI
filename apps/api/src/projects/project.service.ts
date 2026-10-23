import {
  type AuthUser,
  type ProjectListQuery,
  type ProjectListResponse,
  projectCloseReasonSchema,
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
import notify from "../notifications/notify.js";
import lockProject from "./project-lock.js";
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
  closeReason: string | null;
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
    closeReason:
      row.closeReason === null
        ? null
        : projectCloseReasonSchema.parse(row.closeReason),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// DATE와 TIMESTAMPTZ의 비교는 KST 달력 날짜를 기준으로 한다.
const seoulDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
  if (
    deliveryDueDate.toISOString().slice(0, 10) <=
    seoulDateFormatter.format(recruitmentEndAt)
  ) {
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
  getPublic(projectId: bigint, viewer?: AuthUser): Promise<ProjectSummary>;
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
        ? {
            status: "OPEN",
            recruitmentEndAt: { gt: current },
            // 이용 제한·탈퇴 회원의 프로젝트는 공개하지 않는다(기존 지원·거래 이력은 그대로 둔다).
            client: { status: "ACTIVE" },
          }
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

    // 일반 사용자에게는 모집 중인 프로젝트만 보여준다.
    // 작성자와 이 프로젝트에 지원한 크리에이터는 마감·선정 뒤에도 상세를 볼 수 있다(삭제한 프로젝트는 제외, #19 리뷰 4번).
    async getPublic(projectId, viewer) {
      if (viewer) {
        const viewerId = BigInt(viewer.id);
        const related = await prisma.project.findFirst({
          where: {
            id: projectId,
            deletedAt: null,
            OR: [
              { clientId: viewerId },
              { workRequests: { some: { creatorId: viewerId } } },
            ],
          },
          include: includeClient,
        });
        if (related) return toProject(related);
      }
      const row = await prisma.project.findFirst({
        where: {
          id: projectId,
          status: "OPEN",
          recruitmentEndAt: { gt: now() },
          deletedAt: null,
          client: { status: "ACTIVE" },
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

    // 선정·마감과 겹치지 않도록 같은 프로젝트 행 잠금 안에서 상태를 다시 읽고 수정한다.
    async update(user, projectId, input) {
      await getOwned(user, projectId);
      const parsed = projectUpdateSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        const existing = await lockProject(tx, projectId);
        if (!existing) {
          throw new AppError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
        }
        if (projectStatusSchema.parse(existing.status) !== "OPEN") {
          throw new AppError(
            409,
            "CONFLICT",
            "모집 중인 프로젝트만 수정할 수 있습니다.",
          );
        }
        // 마감 시각이 지나면 제목만 고치거나 마감을 연장하는 요청도 받지 않는다.
        if (existing.recruitmentEndAt <= now()) {
          throw new AppError(
            409,
            "CONFLICT",
            "모집 마감 시각이 지나 수정할 수 없습니다.",
          );
        }
        const recruitmentEndAt =
          parsed.recruitmentEndAt === undefined
            ? existing.recruitmentEndAt
            : new Date(parsed.recruitmentEndAt);
        const deliveryDueDate =
          parsed.deliveryDueDate === undefined
            ? existing.deliveryDueDate
            : dateOnly(parsed.deliveryDueDate);
        validateSchedule(recruitmentEndAt, deliveryDueDate, now());

        const row = await tx.project.update({
          where: { id: projectId },
          data: {
            ...(parsed.title !== undefined ? { title: parsed.title } : {}),
            ...(parsed.description !== undefined
              ? { description: parsed.description }
              : {}),
            ...(parsed.purpose !== undefined
              ? { purpose: parsed.purpose }
              : {}),
            ...(parsed.styles !== undefined ? { styles: parsed.styles } : {}),
            ...(parsed.budget !== undefined
              ? { budget: BigInt(parsed.budget) }
              : {}),
            ...(parsed.expectedDurationSeconds !== undefined
              ? {
                  expectedDurationSeconds:
                    parsed.expectedDurationSeconds ?? null,
                }
              : {}),
            ...(parsed.recruitmentEndAt !== undefined
              ? { recruitmentEndAt }
              : {}),
            ...(parsed.deliveryDueDate !== undefined
              ? { deliveryDueDate }
              : {}),
          },
          include: includeClient,
        });
        return toProject(row);
      });
    },

    // 직접 마감: 신규 지원만 막는다. 대기 중인 지원은 그대로 두어 선정·거절할 수 있고, 지원자에게 마감을 알린다.
    // 지원·선정과 같은 프로젝트 행 잠금 안에서 처리한다.
    async close(user, projectId) {
      await getOwned(user, projectId);
      return prisma.$transaction(async (tx) => {
        const locked = await lockProject(tx, projectId);
        if (!locked) {
          throw new AppError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
        }
        const status: ProjectStatus = projectStatusSchema.parse(locked.status);
        if (status !== "OPEN") {
          throw new AppError(409, "CONFLICT", "이미 모집이 종료되었습니다.");
        }
        const row = await tx.project.update({
          where: { id: projectId },
          data: { status: "CLOSED", closeReason: "MANUAL" },
          include: includeClient,
        });
        const pending = await tx.workRequest.findMany({
          where: { projectId, status: "PENDING" },
          select: { creatorId: true },
        });
        await notify(
          tx,
          pending.map(({ creatorId }) => ({
            recipientUserId: creatorId,
            type: "PROJECT_CLOSED" as const,
            eventKey: `project:${projectId}:closed`,
            title: "지원한 프로젝트의 모집이 마감되었습니다",
            body: `'${row.title}' 프로젝트의 모집이 마감되었습니다. 선정 결과를 기다려주세요.`,
            projectId,
          })),
        );
        return toProject(row);
      });
    },

    // 삭제: 선정 후(거래 단계)에는 삭제할 수 없다. 대기 중인 지원은 자동 거절하고 알린다.
    async remove(user, projectId) {
      await getOwned(user, projectId);
      await prisma.$transaction(async (tx) => {
        const locked = await lockProject(tx, projectId);
        if (!locked) {
          throw new AppError(404, "NOT_FOUND", "프로젝트를 찾을 수 없습니다.");
        }
        const status = projectStatusSchema.parse(locked.status);
        if (status !== "OPEN" && status !== "CLOSED") {
          throw new AppError(
            409,
            "CONFLICT",
            "거래가 시작된 프로젝트는 삭제할 수 없습니다.",
          );
        }
        const pending = await tx.workRequest.findMany({
          where: { projectId, status: "PENDING" },
          select: { id: true, creatorId: true },
        });
        await tx.workRequest.updateMany({
          where: { id: { in: pending.map(({ id }) => id) } },
          data: {
            status: "NOT_SELECTED",
            closedReason: "PROJECT_DELETED",
            respondedAt: now(),
          },
        });
        await tx.project.update({
          where: { id: projectId },
          data: { status: "CLOSED", deletedAt: now() },
        });
        await notify(
          tx,
          pending.map(({ id, creatorId }) => ({
            recipientUserId: creatorId,
            type: "APPLICATION_AUTO_REJECTED" as const,
            eventKey: `application:${id}:auto-rejected`,
            title: "지원한 프로젝트가 삭제되었습니다",
            body: `'${locked.title}' 프로젝트가 삭제되어 지원이 종료되었습니다.`,
            projectId,
            workRequestId: id,
          })),
        );
      });
    },
  };
}
