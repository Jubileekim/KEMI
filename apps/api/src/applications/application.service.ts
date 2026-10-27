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
import { voidOpenTerms } from "../terms/terms.service.js";
import { ensureChatRoom } from "../chat/chat.service.js";
import { requireNotRestricted } from "../safety/safety.service.js";
import withObjectParticle from "../http/korean.js";

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
  return new AppError(
    404,
    "NOT_FOUND",
    `${withObjectParticle(what)} 찾을 수 없습니다.`,
  );
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
  requestDiscussion(
    user: AuthUser,
    applicationId: bigint,
  ): Promise<Application>;
  decline(user: AuthUser, applicationId: bigint): Promise<Application>;
  withdraw(user: AuthUser, applicationId: bigint): Promise<Application>;
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

  function requireStatus(status: string, allowed: readonly string[]) {
    if (!allowed.includes(status)) {
      throw new AppError(409, "CONFLICT", "이미 처리된 지원입니다.");
    }
  }

  // 지원을 처리(협의 요청·거절)할 수 있는 프로젝트인지: 모집 중(OPEN)이거나 마감(CLOSED + MANUAL·EXPIRED)이어야 한다.
  // 마감은 신규 지원만 막고 이미 들어온 지원은 계속 처리할 수 있다(CAMP-05).
  // 계약(CONTRACTED)·무선정 종료(CLOSED + NO_SELECTION)·삭제된 프로젝트는 처리할 수 없다.
  function requireDecidable(project: {
    status: string;
    closeReason: string | null;
  }) {
    const status = projectStatusSchema.parse(project.status);
    const closedButOpenForDecision =
      status === "CLOSED" &&
      (project.closeReason === "MANUAL" || project.closeReason === "EXPIRED");
    if (status !== "OPEN" && !closedButOpenForDecision) {
      throw new AppError(
        409,
        "CONFLICT",
        "계약이 확정됐거나 종료된 프로젝트입니다.",
      );
    }
  }

  return {
    // APPLY-01: 모집 중이고 마감 시각 전인 프로젝트에만, 크리에이터당 한 번 지원한다.
    async apply(user, projectId, input) {
      const creatorId = requireRole(user, "CREATOR");
      const data = applicationCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        // 이용 제한 중이면 새 지원을 할 수 없다(OPS-02).
        await requireNotRestricted(tx, creatorId);
        const project = await lockProject(tx, projectId);
        if (!project || project.deletedAt) throw notFound("프로젝트");
        // 이용 제한·탈퇴 의뢰인의 프로젝트는 공개 목록·상세에 없으므로, ID로 직접 지원해도 없는 것처럼 404다(#22 리뷰).
        const client = await tx.user.findUnique({
          where: { id: project.clientId },
          select: { status: true },
        });
        if (client?.status !== "ACTIVE") throw notFound("프로젝트");
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

    // APPLY-02 협의 요청: 그 지원만 협의 중(DISCUSSING)으로 바꾼다. 선정이 아니다.
    // 프로젝트 상태와 다른 지원은 그대로이고, 여러 후보와 동시에 협의할 수 있다(기능명세서 P07).
    // 선정은 같은 조건서 버전에 양측이 서명할 때 일어난다(결정 기록 13장).
    async requestDiscussion(user, applicationId) {
      const clientId = requireRole(user, "CLIENT");
      return inTransaction(async (tx) => {
        const { project, application } = await lockOwnApplication(
          tx,
          clientId,
          applicationId,
        );
        requireDecidable(project);
        requireStatus(application.status, ["PENDING"]);
        const discussing = await tx.workRequest.update({
          where: { id: applicationId },
          data: { status: "DISCUSSING", respondedAt: now() },
          include: includeCreator,
        });
        // 요청별 대화방을 연다(CHAT-02). 계약 뒤에도 같은 방을 쓴다.
        await ensureChatRoom(tx, discussing.id);
        await notify(tx, [
          {
            recipientUserId: discussing.creatorId,
            type: "DISCUSSION_REQUESTED",
            eventKey: `application:${discussing.id}:discussion-requested`,
            title: "의뢰인이 협의를 요청했습니다",
            body: `'${project.title}' 프로젝트의 의뢰인이 조건 협의를 요청했습니다.`,
            projectId: project.id,
            workRequestId: discussing.id,
          },
        ]);
        return toApplication(discussing);
      });
    },

    // APPLY-03 거절: 대기·협의 중인 지원을 거절한다. 프로젝트 상태는 바꾸지 않는다. 미확정 조건서는 무효가 된다.
    async decline(user, applicationId) {
      const clientId = requireRole(user, "CLIENT");
      return inTransaction(async (tx) => {
        const { project, application } = await lockOwnApplication(
          tx,
          clientId,
          applicationId,
        );
        requireDecidable(project);
        requireStatus(application.status, ["PENDING", "DISCUSSING"]);
        await voidOpenTerms(tx, [applicationId]);
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

    // APPLY-03 철회: 크리에이터가 계약 전(대기·협의 중) 본인 지원을 거둔다. 의뢰인에게 알린다.
    async withdraw(user, applicationId) {
      const creatorId = requireRole(user, "CREATOR");
      return inTransaction(async (tx) => {
        const found = await tx.workRequest.findUnique({
          where: { id: applicationId },
          select: { projectId: true, creatorId: true },
        });
        if (!found?.projectId || found.creatorId !== creatorId) {
          throw notFound("지원");
        }
        const project = await lockProject(tx, found.projectId);
        if (!project) throw notFound("지원");
        const application = await tx.workRequest.findUniqueOrThrow({
          where: { id: applicationId },
        });
        requireStatus(application.status, ["PENDING", "DISCUSSING"]);
        await voidOpenTerms(tx, [applicationId]);
        const withdrawn = await tx.workRequest.update({
          where: { id: applicationId },
          data: { status: "WITHDRAWN", respondedAt: now() },
          include: includeCreator,
        });
        await notify(tx, [
          {
            recipientUserId: withdrawn.clientId,
            type: "APPLICATION_WITHDRAWN",
            eventKey: `application:${withdrawn.id}:withdrawn`,
            title: "지원이 철회되었습니다",
            body: `'${project.title}' 프로젝트의 지원 하나가 철회되었습니다.`,
            projectId: project.id,
            workRequestId: withdrawn.id,
          },
        ]);
        return toApplication(withdrawn);
      });
    },
  };
}
