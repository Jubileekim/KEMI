import type {
  ActivityRequest,
  ActivityResponse,
  ActivityStage,
  AuthUser,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { createProjectDraftService } from "../projects/project-draft.service.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";

// 내 활동 묶음 조회 (ACT-01). 내 모집·내 요청(공개 모집 지원·직접 의뢰)의 진행 단계를 한 번에 준다.

const requestInclude = {
  project: { select: { title: true } },
  client: { select: { name: true } },
  creator: { select: { name: true } },
  contract: {
    select: {
      id: true,
      status: true,
      payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
      production: { select: { status: true } },
      settlement: { select: { contractId: true, status: true } },
      disputes: { where: { status: "OPEN" }, select: { id: true } },
    },
  },
} satisfies Prisma.WorkRequestInclude;
type RequestRow = Prisma.WorkRequestGetPayload<{
  include: typeof requestInclude;
}>;

const PACKAGE_TITLE = (snapshot: unknown) =>
  typeof snapshot === "object" &&
  snapshot !== null &&
  typeof Reflect.get(snapshot, "title") === "string"
    ? String(Reflect.get(snapshot, "title"))
    : "직접 의뢰";

function stageOf(row: RequestRow): ActivityStage {
  const { contract } = row;
  if (!contract) {
    if (row.status === "PENDING") return "PENDING";
    if (row.status === "DISCUSSING") return "DISCUSSING";
    return "CLOSED";
  }
  if (contract.disputes.length > 0) return "DISPUTED";
  if (contract.status === "CANCELED") return "CANCELED";
  if (contract.settlement?.status === "SIMULATED") return "COMPLETED";
  if (contract.payments.length === 0) return "PAYMENT_PENDING";
  switch (contract.production?.status) {
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "DELIVERED":
      return "DELIVERED";
    case "COMPLETED":
      return "DELIVERED";
    case "CANCELED":
      return "CANCELED";
    default:
      return "PREPARING";
  }
}

// 대략적인 "내 차례" 안내: 의뢰인은 지원 검토·결제, 크리에이터는 직접 의뢰 응답·제작 준비
function needsAction(row: RequestRow, stage: ActivityStage, isClient: boolean) {
  if (isClient)
    return (
      (stage === "PENDING" && row.requestType === "PROJECT_APPLICATION") ||
      stage === "PAYMENT_PENDING"
    );
  return (
    (stage === "PENDING" && row.requestType === "DIRECT_REQUEST") ||
    stage === "PREPARING"
  );
}

export interface ActivityService {
  get(user: AuthUser): Promise<ActivityResponse>;
}

export function createActivityService({
  prisma,
}: {
  prisma: PrismaClient;
}): ActivityService {
  return {
    async get(user) {
      if (user.role !== "CLIENT" && user.role !== "CREATOR") {
        throw new AppError(403, "FORBIDDEN", "회원만 볼 수 있습니다.");
      }
      const userId = BigInt(user.id);
      const isClient = user.role === "CLIENT";
      const [rows, projects, bookmarkCount, unreadNotifications, drafts] =
        await Promise.all([
          prisma.workRequest.findMany({
            where: isClient ? { clientId: userId } : { creatorId: userId },
            include: requestInclude,
            orderBy: { updatedAt: "desc" },
            take: 100,
          }),
          isClient
            ? prisma.project.findMany({
                where: { clientId: userId, deletedAt: null },
                select: {
                  id: true,
                  title: true,
                  status: true,
                  workRequests: { select: { status: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
              })
            : Promise.resolve([]),
          isClient
            ? Promise.resolve(0)
            : prisma.projectBookmark.count({ where: { userId } }),
          prisma.notification.count({
            where: { recipientUserId: userId, readAt: null },
          }),
          isClient
            ? createProjectDraftService({ prisma }).list(user)
            : Promise.resolve({ items: [] }),
        ]);
      const requests: ActivityRequest[] = rows.map((row) => {
        const stage = stageOf(row);
        return {
          id: row.id.toString(),
          type:
            row.requestType === "DIRECT_REQUEST"
              ? "DIRECT_REQUEST"
              : "PROJECT_APPLICATION",
          title: row.project?.title ?? PACKAGE_TITLE(row.packageSnapshot),
          counterpartName: isClient ? row.creator.name : row.client.name,
          status: row.status,
          stage,
          contractId: row.contract?.id.toString() ?? null,
          needsAction: needsAction(row, stage, isClient),
          updatedAt: row.updatedAt.toISOString(),
        };
      });
      return {
        role: isClient ? "CLIENT" : "CREATOR",
        drafts: drafts.items,
        projects: projects.map((p) => ({
          id: p.id.toString(),
          title: p.title,
          status: p.status,
          applicationCount: p.workRequests.length,
          pendingCount: p.workRequests.filter((r) => r.status === "PENDING")
            .length,
        })),
        requests,
        bookmarkCount,
        unreadNotifications,
      };
    },
  };
}
