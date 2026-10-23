import {
  type Application,
  applicationCreateSchema,
  applicationListQuerySchema,
  type AuthUser,
  type MyApplicationListResponse,
  type ProjectApplicationListResponse,
  projectStatusSchema,
  workRequestClosedReasonSchema,
  workRequestStatusSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import notify from "../notifications/notify.js";
import lockProject from "../projects/project-lock.js";

type Tx = Prisma.TransactionClient;

interface ApplicationRow {
  id: bigint;
  projectId: bigint | null;
  creatorId: bigint;
  message: string;
  initialAmount: bigint;
  expectedDays: number;
  status: string;
  closedReason: string | null;
  respondedAt: Date | null;
  createdAt: Date;
  creator: { name: string };
}

const includeCreator = { creator: { select: { name: true } } } as const;

// 같은 프로젝트의 변경이 줄을 서서 기다릴 수 있도록 기본값보다 넉넉히 둔다.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

function toApplication(row: ApplicationRow): Application {
  // 공개 지원은 DB CHECK(work_requests_type_project_check)로 항상 프로젝트가 있다.
  if (row.projectId === null) {
    throw new Error("공개 지원에 프로젝트가 없습니다.");
  }
  return {
    id: row.id.toString(),
    projectId: row.projectId.toString(),
    creatorId: row.creatorId.toString(),
    creatorName: row.creator.name,
    message: row.message,
    proposedAmount: Number(row.initialAmount),
    expectedDays: row.expectedDays,
    status: workRequestStatusSchema.parse(row.status),
    closedReason:
      row.closedReason === null
        ? null
        : workRequestClosedReasonSchema.parse(row.closedReason),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function notFound(what: "프로젝트" | "지원"): AppError {
  return new AppError(404, "NOT_FOUND", `${what}을 찾을 수 없습니다.`);
}

function requireRole(user: AuthUser, role: "CLIENT" | "CREATOR"): bigint {
  if (user.role !== role) {
    throw new AppError(
      403,
      "FORBIDDEN",
      role === "CREATOR"
        ? "크리에이터만 프로젝트에 지원할 수 있습니다."
        : "프로젝트를 등록한 의뢰인만 지원자를 관리할 수 있습니다.",
    );
  }
  return BigInt(user.id);
}

export interface ApplicationService {
  apply(
    user: AuthUser,
    projectId: bigint,
    input: unknown,
  ): Promise<Application>;
  listForProject(
    user: AuthUser,
    projectId: bigint,
  ): Promise<ProjectApplicationListResponse>;
  listMine(user: AuthUser, input: unknown): Promise<MyApplicationListResponse>;
  accept(user: AuthUser, applicationId: bigint): Promise<Application>;
  decline(user: AuthUser, applicationId: bigint): Promise<Application>;
}

export function createApplicationService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): ApplicationService {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  // 의뢰인 본인 프로젝트의 지원을 잠근 프로젝트와 함께 읽는다. 남의 프로젝트면 404(존재를 드러내지 않음).
  async function lockOwnApplication(
    tx: Tx,
    clientId: bigint,
    applicationId: bigint,
  ) {
    const found = await tx.workRequest.findUnique({
      where: { id: applicationId },
      select: { projectId: true, clientId: true },
    });
    if (!found?.projectId || found.clientId !== clientId) {
      throw notFound("지원");
    }
    const project = await lockProject(tx, found.projectId);
    if (!project || project.deletedAt) throw notFound("지원");
    const application = await tx.workRequest.findUniqueOrThrow({
      where: { id: applicationId },
      include: includeCreator,
    });
    return { project, application };
  }

  function requirePending(status: string) {
    if (status !== "PENDING") {
      throw new AppError(409, "CONFLICT", "이미 처리된 지원입니다.");
    }
  }

  // 지원을 받는 단계인지: 모집 중(OPEN)이거나 직접 마감(CLOSED)이어야 한다. 선정 후(MATCHED)에는 처리할 수 없다.
  function requireSelectable(status: string) {
    const parsed = projectStatusSchema.parse(status);
    if (parsed !== "OPEN" && parsed !== "CLOSED") {
      throw new AppError(
        409,
        "CONFLICT",
        "이미 지원자를 선정했거나 종료된 프로젝트입니다.",
      );
    }
  }

  return {
    // APPLY-01: 모집 중이고 마감 시각 전인 프로젝트에만, 크리에이터당 한 번 지원한다.
    async apply(user, projectId, input) {
      const creatorId = requireRole(user, "CREATOR");
      const data = applicationCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const project = await lockProject(tx, projectId);
        if (!project || project.deletedAt) throw notFound("프로젝트");
        if (project.status !== "OPEN" || project.recruitmentEndAt <= now()) {
          throw new AppError(409, "CONFLICT", "모집이 마감된 프로젝트입니다.");
        }
        try {
          const created = await tx.workRequest.create({
            data: {
              requestType: "PROJECT_APPLICATION",
              clientId: project.clientId,
              creatorId,
              projectId,
              message: data.message,
              initialAmount: BigInt(data.proposedAmount),
              expectedDays: data.expectedDays,
            },
            include: includeCreator,
          });
          await notify(tx, [
            {
              recipientUserId: project.clientId,
              type: "APPLICATION_SUBMITTED",
              eventKey: `application:${created.id}:submitted`,
              title: "새 지원이 도착했습니다",
              body: `'${project.title}' 프로젝트에 새 지원이 들어왔습니다.`,
              projectId,
              workRequestId: created.id,
            },
          ]);
          return toApplication(created);
        } catch (err) {
          // 결정 기록 3장: 같은 공고에는 상태와 관계없이 한 번만 지원할 수 있다.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw new AppError(409, "CONFLICT", "이미 지원한 프로젝트입니다.");
          }
          throw err;
        }
      });
    },

    async listForProject(user, projectId) {
      const clientId = requireRole(user, "CLIENT");
      const project = await prisma.project.findFirst({
        where: { id: projectId, clientId, deletedAt: null },
      });
      if (!project) throw notFound("프로젝트");
      const rows = await prisma.workRequest.findMany({
        where: { projectId },
        include: includeCreator,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return { items: rows.map(toApplication) };
    },

    async listMine(user, input) {
      const creatorId = requireRole(user, "CREATOR");
      const { page, pageSize } = applicationListQuerySchema.parse(input);
      const where = { creatorId, requestType: "PROJECT_APPLICATION" };
      const [rows, total] = await prisma.$transaction([
        prisma.workRequest.findMany({
          where,
          include: {
            ...includeCreator,
            project: { select: { id: true, title: true, status: true } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.workRequest.count({ where }),
      ]);
      return {
        items: rows.flatMap((row) =>
          row.project
            ? [
                {
                  ...toApplication(row),
                  project: {
                    id: row.project.id.toString(),
                    title: row.project.title,
                    status: projectStatusSchema.parse(row.project.status),
                  },
                },
              ]
            : [],
        ),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    },

    // APPLY-02 수락: 선정 지원은 협의 단계(DISCUSSING)로, 프로젝트는 거래 단계(MATCHED)로,
    // 나머지 대기 지원은 자동 거절(NOT_SELECTED)로 한 트랜잭션에서 바꾼다.
    async accept(user, applicationId) {
      const clientId = requireRole(user, "CLIENT");
      return inTransaction(async (tx) => {
        const { project, application } = await lockOwnApplication(
          tx,
          clientId,
          applicationId,
        );
        requireSelectable(project.status);
        requirePending(application.status);
        const respondedAt = now();

        const others = await tx.workRequest.findMany({
          where: {
            projectId: project.id,
            status: "PENDING",
            id: { not: applicationId },
          },
          select: { id: true, creatorId: true },
        });
        await tx.workRequest.updateMany({
          where: { id: { in: others.map((other) => other.id) } },
          data: {
            status: "NOT_SELECTED",
            closedReason: "OTHER_SELECTED",
            respondedAt,
          },
        });
        const accepted = await tx.workRequest.update({
          where: { id: applicationId },
          data: { status: "DISCUSSING", respondedAt },
          include: includeCreator,
        });
        await tx.project.update({
          where: { id: project.id },
          data: { status: "MATCHED" },
        });
        await notify(tx, [
          {
            recipientUserId: accepted.creatorId,
            type: "APPLICATION_ACCEPTED",
            eventKey: `application:${accepted.id}:accepted`,
            title: "지원이 선정되었습니다",
            body: `'${project.title}' 프로젝트에 선정되었습니다. 조건 협의를 진행해주세요.`,
            projectId: project.id,
            workRequestId: accepted.id,
          },
          ...others.map((other) => ({
            recipientUserId: other.creatorId,
            type: "APPLICATION_AUTO_REJECTED" as const,
            eventKey: `application:${other.id}:auto-rejected`,
            title: "다른 지원자가 선정되었습니다",
            body: `'${project.title}' 프로젝트는 다른 지원자가 선정되어 모집이 종료되었습니다.`,
            projectId: project.id,
            workRequestId: other.id,
          })),
        ]);
        return toApplication(accepted);
      });
    },

    // APPLY-02 거절: 대기 중인 지원만 직접 거절한다. 프로젝트 상태는 바꾸지 않는다.
    async decline(user, applicationId) {
      const clientId = requireRole(user, "CLIENT");
      return inTransaction(async (tx) => {
        const { project, application } = await lockOwnApplication(
          tx,
          clientId,
          applicationId,
        );
        requireSelectable(project.status);
        requirePending(application.status);
        const declined = await tx.workRequest.update({
          where: { id: applicationId },
          data: { status: "DECLINED", respondedAt: now() },
          include: includeCreator,
        });
        await notify(tx, [
          {
            recipientUserId: declined.creatorId,
            type: "APPLICATION_DECLINED",
            eventKey: `application:${declined.id}:declined`,
            title: "지원 결과를 알려드립니다",
            body: `'${project.title}' 프로젝트 지원이 거절되었습니다.`,
            projectId: project.id,
            workRequestId: declined.id,
          },
        ]);
        return toApplication(declined);
      });
    },
  };
}
