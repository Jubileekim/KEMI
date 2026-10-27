import {
  type AuthUser,
  type MySafetyView,
  type NotificationType,
  reportActionSchema,
  reportAppealSchema,
  reportCreateSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
  safetyActionSchema,
  type SafetyReport,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import notify from "../notifications/notify.js";

// 신고·이용 제한·이의 제기 (OPS-01·02) [제안, D18·D21]
// 신고만으로 제재하지 않는다. 운영자만 검토·경고·제한·해제하고, 근거가 운영 기록(operation_records)에 남는다.
// 제한 중인 회원은 새 공고·지원·직접 의뢰를 할 수 없다(requireNotRestricted). 진행 중인 거래는 막지 않는다.

type Tx = Prisma.TransactionClient;
type Db = PrismaClient | Tx;

const includeEvents = {
  events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.ReportInclude;
type ReportRow = Prisma.ReportGetPayload<{ include: typeof includeEvents }>;

const conflict = (message: string) => new AppError(409, "CONFLICT", message);
const forbidden = (message: string) => new AppError(403, "FORBIDDEN", message);
const notFound = () =>
  new AppError(404, "NOT_FOUND", "신고를 찾을 수 없습니다.");

function toReport(row: ReportRow): SafetyReport {
  return {
    id: row.id.toString(),
    reporterId: row.reporterId.toString(),
    subjectId: row.subjectId.toString(),
    targetType: reportTargetTypeSchema.parse(row.targetType),
    targetId: row.targetId.toString(),
    reason: row.reason,
    evidence: row.evidence,
    status: reportStatusSchema.parse(row.status),
    limited: row.limited,
    history: row.events.map((e) => ({
      id: e.id.toString(),
      actorId: e.actorId.toString(),
      action: safetyActionSchema.parse(e.action),
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

// 제한 중이면 403 RESTRICTED. 새 공고·지원·직접 의뢰 직전에 부른다.
export async function requireNotRestricted(
  db: Db,
  userId: bigint,
): Promise<void> {
  const limited = await db.report.count({
    where: { subjectId: userId, limited: true },
  });
  if (limited > 0) {
    throw new AppError(
      403,
      "RESTRICTED",
      "이용 제한 중이라 새 공고·지원·직접 의뢰를 할 수 없습니다. 진행 중인 거래는 계속할 수 있습니다.",
    );
  }
}

export interface SafetyService {
  report(
    user: AuthUser,
    input: unknown,
  ): Promise<{ created: boolean; report: SafetyReport }>;
  mine(user: AuthUser): Promise<MySafetyView>;
  appeal(
    user: AuthUser,
    reportId: bigint,
    input: unknown,
  ): Promise<MySafetyView>;
  list(user: AuthUser): Promise<{ items: SafetyReport[] }>;
  act(user: AuthUser, reportId: bigint, input: unknown): Promise<SafetyReport>;
}

const NOTICE: Partial<
  Record<string, { type: NotificationType; title: string; body: string }>
> = {
  WARN: {
    type: "SAFETY_WARNED",
    title: "운영 경고가 있습니다",
    body: "신고 검토 결과 경고가 기록되었습니다. 이용 제한은 없습니다.",
  },
  LIMIT: {
    type: "SAFETY_LIMITED",
    title: "이용이 제한되었습니다",
    body: "새 공고·지원·직접 의뢰가 제한됩니다. 진행 중인 거래는 계속할 수 있고, 이의를 남길 수 있습니다.",
  },
  RELEASE: {
    type: "SAFETY_RELEASED",
    title: "이용 제한이 해제되었습니다",
    body: "새 공고·지원·직접 의뢰를 다시 할 수 있습니다.",
  },
};

export function createSafetyService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): SafetyService {
  const requireMember = (user: AuthUser) => {
    if (
      user.status !== "ACTIVE" ||
      (user.role !== "CLIENT" && user.role !== "CREATOR")
    ) {
      throw forbidden("회원만 신고할 수 있습니다.");
    }
    return BigInt(user.id);
  };
  const requireAdmin = (user: AuthUser) => {
    if (user.role !== "ADMIN") throw forbidden("운영자만 처리할 수 있습니다.");
    return BigInt(user.id);
  };

  // 신고 대상의 당사자(제재 대상)를 정한다. 공개 모집은 작성자, 의뢰는 신고자가 아닌 쪽.
  async function subjectOf(
    reporterId: bigint,
    targetType: string,
    targetId: bigint,
  ): Promise<bigint> {
    if (targetType === "PROJECT") {
      const project = await prisma.project.findUnique({
        where: { id: targetId },
        select: { clientId: true },
      });
      if (!project) throw new AppError(404, "NOT_FOUND", "공고가 없습니다.");
      return project.clientId;
    }
    const request = await prisma.workRequest.findUnique({
      where: { id: targetId },
      select: { clientId: true, creatorId: true },
    });
    if (
      !request ||
      (request.clientId !== reporterId && request.creatorId !== reporterId)
    ) {
      throw new AppError(404, "NOT_FOUND", "의뢰를 찾을 수 없습니다.");
    }
    return request.clientId === reporterId
      ? request.creatorId
      : request.clientId;
  }

  async function view(userId: bigint): Promise<MySafetyView> {
    const [filed, received] = await Promise.all([
      prisma.report.findMany({
        where: { reporterId: userId },
        include: includeEvents,
        orderBy: { id: "desc" },
        take: 50,
      }),
      prisma.report.findMany({
        where: {
          subjectId: userId,
          events: { some: { action: { in: ["WARN", "LIMIT", "RELEASE"] } } },
        },
        include: includeEvents,
        orderBy: { id: "desc" },
        take: 50,
      }),
    ]);
    return {
      limited: received.some((r) => r.limited),
      reports: filed.map(toReport),
      // 신고자·신고 사유는 대상자에게 보여주지 않는다(운영자 조치와 본인 이의만).
      notices: received.map((r) => ({
        reportId: r.id.toString(),
        limited: r.limited,
        history: toReport(r).history.filter(
          (e) => e.action !== "RECEIVED" && e.action !== "REVIEW",
        ),
      })),
    };
  }

  return {
    // OPS-01: 회원 신고. 같은 commandId·같은 내용 재전송은 처음 접수를 준다.
    async report(user, input) {
      const reporterId = requireMember(user);
      const data = reportCreateSchema.parse(input);
      const targetId = BigInt(data.targetId);
      const existing = await prisma.report.findUnique({
        where: { commandId: data.commandId },
        include: includeEvents,
      });
      if (existing) {
        const same =
          existing.reporterId === reporterId &&
          existing.targetType === data.targetType &&
          existing.targetId === targetId &&
          existing.reason === data.reason &&
          existing.evidence === data.evidence;
        if (!same)
          throw conflict("같은 요청 식별자로 다른 신고를 보낼 수 없습니다.");
        return { created: false, report: toReport(existing) };
      }
      const subjectId = await subjectOf(reporterId, data.targetType, targetId);
      if (subjectId === reporterId) {
        throw forbidden("본인을 신고할 수 없습니다.");
      }
      try {
        const created = await prisma.report.create({
          data: {
            reporterId,
            subjectId,
            targetType: data.targetType,
            targetId,
            reason: data.reason,
            evidence: data.evidence,
            commandId: data.commandId,
            events: {
              create: {
                actorId: reporterId,
                action: "RECEIVED",
                note: "신고 접수 · 자동 제재 없음",
                commandId: data.commandId,
              },
            },
          },
          include: includeEvents,
        });
        return { created: true, report: toReport(created) };
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw conflict("같은 요청 식별자로 이미 처리된 요청이 있습니다.");
        }
        throw err;
      }
    },

    async mine(user) {
      return view(BigInt(user.id));
    },

    // OPS-02: 제한된 본인의 이의 제기. 같은 commandId 재전송은 한 번만 남는다.
    async appeal(user, reportId, input) {
      const userId = BigInt(user.id);
      const data = reportAppealSchema.parse(input);
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM reports WHERE id = ${reportId} FOR UPDATE`;
        const report = await tx.report.findUnique({ where: { id: reportId } });
        if (!report || report.subjectId !== userId) throw notFound();
        const previous = await tx.reportEvent.findUnique({
          where: { commandId: data.commandId },
        });
        if (previous) {
          if (
            previous.reportId !== reportId ||
            previous.actorId !== userId ||
            previous.action !== "APPEAL" ||
            previous.note !== data.note
          ) {
            throw conflict("같은 요청 식별자로 다른 내용을 보낼 수 없습니다.");
          }
          return;
        }
        if (!report.limited) {
          throw conflict("제한 중인 안내에만 이의를 남길 수 있습니다.");
        }
        await tx.reportEvent.create({
          data: {
            reportId,
            actorId: userId,
            action: "APPEAL",
            note: data.note,
            commandId: data.commandId,
          },
        });
      });
      return view(userId);
    },

    async list(user) {
      requireAdmin(user);
      const rows = await prisma.report.findMany({
        include: includeEvents,
        orderBy: [{ status: "asc" }, { id: "desc" }],
        take: 100,
      });
      return { items: rows.map(toReport) };
    },

    // OPS-01: 운영자 조치. REVIEW는 검토 중, 나머지는 처리 완료. LIMIT은 제한, RELEASE는 해제.
    async act(user, reportId, input) {
      const adminId = requireAdmin(user);
      const data = reportActionSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM reports WHERE id = ${reportId} FOR UPDATE`;
        const report = await tx.report.findUnique({ where: { id: reportId } });
        if (!report) throw notFound();
        const previous = await tx.reportEvent.findUnique({
          where: { commandId: data.commandId },
        });
        if (previous) {
          if (
            previous.reportId !== reportId ||
            previous.actorId !== adminId ||
            previous.action !== data.action ||
            previous.note !== data.note
          ) {
            throw conflict("같은 요청 식별자로 다른 조치를 보낼 수 없습니다.");
          }
        } else {
          if (data.action === "RELEASE" && !report.limited) {
            throw conflict("제한 중인 신고만 해제할 수 있습니다.");
          }
          await tx.reportEvent.create({
            data: {
              reportId,
              actorId: adminId,
              action: data.action,
              note: data.note,
              commandId: data.commandId,
            },
          });
          await tx.report.update({
            where: { id: reportId },
            data: {
              status: data.action === "REVIEW" ? "REVIEWING" : "RESOLVED",
              ...(data.action === "LIMIT" ? { limited: true } : {}),
              ...(data.action === "RELEASE" ? { limited: false } : {}),
              updatedAt: now(),
            },
          });
          await tx.operationRecord.create({
            data: {
              adminId,
              targetType: "REPORT",
              targetId: reportId,
              action: data.action,
              reason: data.note,
            },
          });
          const notice = NOTICE[data.action];
          await notify(tx, [
            ...(notice
              ? [
                  {
                    recipientUserId: report.subjectId,
                    type: notice.type,
                    eventKey: `report:${reportId}:${data.commandId}`,
                    title: notice.title,
                    body: notice.body,
                  },
                ]
              : []),
            ...(data.action === "REVIEW"
              ? []
              : [
                  {
                    recipientUserId: report.reporterId,
                    type: "REPORT_RESOLVED" as const,
                    eventKey: `report:${reportId}:resolved:${data.commandId}`,
                    title: "신고 처리가 끝났습니다",
                    body: "운영자가 신고를 검토하고 처리했습니다.",
                  },
                ]),
          ]);
        }
        return toReport(
          await tx.report.findUniqueOrThrow({
            where: { id: reportId },
            include: includeEvents,
          }),
        );
      });
    },
  };
}
