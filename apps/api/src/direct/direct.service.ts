import {
  type AuthUser,
  DIRECT_REQUEST_RESPONSE_HOURS,
  type DirectRequest,
  directRequestCreateSchema,
  workRequestStatusSchema,
} from "@kemi/shared";
import { z } from "zod";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { ensureChatRoom } from "../chat/chat.service.js";
import notify from "../notifications/notify.js";
import { voidOpenTerms } from "../terms/terms.service.js";
import { requireNotRestricted } from "../safety/safety.service.js";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };
const HOUR_MS = 60 * 60 * 1000;

const snapshotSchema = z.object({
  packageId: z.string(),
  title: z.string(),
  priceKrw: z.number(),
  deliveryDays: z.number(),
  revisionCount: z.number(),
  includes: z.array(z.string()),
});

const includeParties = {
  client: { select: { name: true } },
  creator: { select: { name: true } },
} satisfies Prisma.WorkRequestInclude;
type DirectRow = Prisma.WorkRequestGetPayload<{
  include: typeof includeParties;
}>;

function toDirect(row: DirectRow): DirectRequest {
  if (!row.respondDueAt) {
    // DB CHECK(work_requests_direct_fields_check)로 직접 의뢰에는 항상 있다.
    throw new Error("직접 의뢰에 응답 기한이 없습니다.");
  }
  return {
    id: row.id.toString(),
    clientId: row.clientId.toString(),
    clientName: row.client.name,
    creatorId: row.creatorId.toString(),
    creatorName: row.creator.name,
    package: snapshotSchema.parse(row.packageSnapshot),
    message: row.message,
    purpose: row.purpose,
    eventDate: row.eventDate?.toISOString().slice(0, 10) ?? null,
    status: workRequestStatusSchema.parse(row.status),
    respondDueAt: row.respondDueAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const notFound = () =>
  new AppError(404, "NOT_FOUND", "직접 의뢰를 찾을 수 없습니다.");
const conflict = (message: string) => new AppError(409, "CONFLICT", message);

export interface DirectRequestService {
  create(
    user: AuthUser,
    packageId: bigint,
    input: unknown,
  ): Promise<DirectRequest>;
  list(user: AuthUser): Promise<{ items: DirectRequest[] }>;
  get(user: AuthUser, requestId: bigint): Promise<DirectRequest>;
  accept(user: AuthUser, requestId: bigint): Promise<DirectRequest>;
  decline(user: AuthUser, requestId: bigint): Promise<DirectRequest>;
  withdraw(user: AuthUser, requestId: bigint): Promise<DirectRequest>;
}

// DIRECT-01~03: 패키지 기반 직접 의뢰. 공고(project_id) 없이 WORK_REQUEST를 만든다.
export function createDirectRequestService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): DirectRequestService {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  // 응답 기한이 지난 대기 의뢰를 만료로 바꾸고 양쪽에 알린다(조회·동작 때 처리).
  async function expireOverdue(tx: Tx, where: Prisma.WorkRequestWhereInput) {
    const overdue = await tx.workRequest.findMany({
      where: {
        ...where,
        requestType: "DIRECT_REQUEST",
        status: "PENDING",
        respondDueAt: { lte: now() },
      },
      select: { id: true, clientId: true, creatorId: true },
    });
    if (overdue.length === 0) return;
    await tx.workRequest.updateMany({
      where: { id: { in: overdue.map((r) => r.id) }, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    await notify(
      tx,
      overdue.flatMap((r) =>
        [r.clientId, r.creatorId].map((recipientUserId) => ({
          recipientUserId,
          type: "DIRECT_REQUEST_EXPIRED" as const,
          eventKey: `direct:${r.id}:expired`,
          title: "직접 의뢰 응답 기한이 지났습니다",
          body: `크리에이터가 ${DIRECT_REQUEST_RESPONSE_HOURS}시간 안에 답하지 않아 의뢰가 만료되었습니다.`,
          workRequestId: r.id,
        })),
      ),
    );
  }

  // 요청 행을 잠그고 당사자인지 확인한다. 당사자가 아니면 404.
  async function lockOwn(tx: Tx, user: AuthUser, requestId: bigint) {
    const userId = BigInt(user.id);
    await tx.$queryRaw`SELECT id FROM work_requests WHERE id = ${requestId} FOR UPDATE`;
    await expireOverdue(tx, { id: requestId });
    const row = await tx.workRequest.findUnique({
      where: { id: requestId },
      include: includeParties,
    });
    if (
      !row ||
      row.requestType !== "DIRECT_REQUEST" ||
      (row.clientId !== userId && row.creatorId !== userId)
    ) {
      throw notFound();
    }
    return { row, role: row.clientId === userId ? "CLIENT" : "CREATOR" };
  }

  function requireRole(role: string, expected: "CLIENT" | "CREATOR") {
    if (role !== expected) {
      throw new AppError(
        403,
        "FORBIDDEN",
        expected === "CLIENT"
          ? "의뢰를 보낸 의뢰인만 할 수 있습니다."
          : "의뢰를 받은 크리에이터만 할 수 있습니다.",
      );
    }
  }

  return {
    // ORDER-01~03: 공개 패키지를 골라 요청사항과 함께 보낸다. 금액·기간은 패키지 조건으로 시작한다.
    async create(user, packageId, input) {
      if (user.role !== "CLIENT" || user.status !== "ACTIVE") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "활성 의뢰인 계정만 직접 의뢰를 보낼 수 있습니다.",
        );
      }
      const clientId = BigInt(user.id);
      const data = directRequestCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        // 이용 제한 중이면 새 직접 의뢰를 보낼 수 없다(OPS-02).
        await requireNotRestricted(tx, clientId);
        const pkg = await tx.servicePackage.findFirst({
          where: {
            id: packageId,
            status: "PUBLIC",
            creator: {
              status: "ACTIVE",
              creatorProfile: { serviceStatus: "PUBLIC" },
            },
          },
        });
        if (
          !pkg ||
          pkg.priceKrw === null ||
          pkg.deliveryDays === null ||
          pkg.revisionCount === null
        ) {
          throw new AppError(404, "NOT_FOUND", "패키지를 찾을 수 없습니다.");
        }
        const snapshot = {
          packageId: pkg.id.toString(),
          title: pkg.title,
          priceKrw: Number(pkg.priceKrw),
          deliveryDays: pkg.deliveryDays,
          revisionCount: pkg.revisionCount,
          includes: pkg.includes,
        };
        await expireOverdue(tx, { clientId, packageId });
        let created: DirectRow;
        try {
          created = await tx.workRequest.create({
            data: {
              requestType: "DIRECT_REQUEST",
              clientId,
              creatorId: pkg.creatorId,
              message: data.message,
              initialAmount: pkg.priceKrw,
              expectedDays: pkg.deliveryDays,
              packageId: pkg.id,
              packageSnapshot: snapshot,
              purpose: data.purpose ?? pkg.purpose,
              eventDate: data.eventDate
                ? new Date(`${data.eventDate}T00:00:00.000Z`)
                : null,
              respondDueAt: new Date(
                now().getTime() + DIRECT_REQUEST_RESPONSE_HOURS * HOUR_MS,
              ),
            },
            include: includeParties,
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw conflict("이 패키지로 진행 중인 직접 의뢰가 이미 있습니다.");
          }
          throw err;
        }
        await notify(tx, [
          {
            recipientUserId: pkg.creatorId,
            type: "DIRECT_REQUEST_RECEIVED",
            eventKey: `direct:${created.id}:received`,
            title: "직접 의뢰가 도착했습니다",
            body: `'${pkg.title}' 패키지로 의뢰가 왔습니다. ${DIRECT_REQUEST_RESPONSE_HOURS}시간 안에 답해주세요.`,
            workRequestId: created.id,
          },
        ]);
        return toDirect(created);
      });
    },

    // 의뢰인은 보낸 의뢰, 크리에이터는 받은 의뢰
    async list(user) {
      const userId = BigInt(user.id);
      const where =
        user.role === "CREATOR" ? { creatorId: userId } : { clientId: userId };
      return inTransaction(async (tx) => {
        await expireOverdue(tx, where);
        const rows = await tx.workRequest.findMany({
          where: { ...where, requestType: "DIRECT_REQUEST" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: includeParties,
        });
        return { items: rows.map(toDirect) };
      });
    },

    async get(user, requestId) {
      return inTransaction(async (tx) =>
        toDirect((await lockOwn(tx, user, requestId)).row),
      );
    },

    // DIRECT-02: 협의 수락. 계약 확정이 아니다. 대화방이 열리고 조건서 협의를 시작한다.
    async accept(user, requestId) {
      return inTransaction(async (tx) => {
        const { row, role } = await lockOwn(tx, user, requestId);
        requireRole(role, "CREATOR");
        if (row.status !== "PENDING") {
          throw conflict("답을 기다리는 의뢰만 수락할 수 있습니다.");
        }
        const updated = await tx.workRequest.update({
          where: { id: requestId },
          data: { status: "DISCUSSING", respondedAt: now() },
          include: includeParties,
        });
        await ensureChatRoom(tx, requestId);
        await notify(tx, [
          {
            recipientUserId: row.clientId,
            type: "DIRECT_REQUEST_ACCEPTED",
            eventKey: `direct:${requestId}:accepted`,
            title: "크리에이터가 협의를 수락했습니다",
            body: "대화방에서 최종 조건을 정하고 양측이 서명하면 계약이 확정됩니다.",
            workRequestId: requestId,
          },
        ]);
        return toDirect(updated);
      });
    },

    // DIRECT-03: 거절(대기·협의 중). 미확정 조건서는 무효가 된다.
    async decline(user, requestId) {
      return inTransaction(async (tx) => {
        const { row, role } = await lockOwn(tx, user, requestId);
        requireRole(role, "CREATOR");
        if (row.status !== "PENDING" && row.status !== "DISCUSSING") {
          throw conflict("대기·협의 중인 의뢰만 거절할 수 있습니다.");
        }
        await voidOpenTerms(tx, [requestId]);
        const updated = await tx.workRequest.update({
          where: { id: requestId },
          data: { status: "DECLINED", respondedAt: now() },
          include: includeParties,
        });
        await notify(tx, [
          {
            recipientUserId: row.clientId,
            type: "DIRECT_REQUEST_DECLINED",
            eventKey: `direct:${requestId}:declined`,
            title: "직접 의뢰 결과를 알려드립니다",
            body: "크리에이터가 이번 의뢰를 진행하기 어렵다고 답했습니다.",
            workRequestId: requestId,
          },
        ]);
        return toDirect(updated);
      });
    },

    // 의뢰인이 계약 전에 의뢰를 거둔다.
    async withdraw(user, requestId) {
      return inTransaction(async (tx) => {
        const { row, role } = await lockOwn(tx, user, requestId);
        requireRole(role, "CLIENT");
        if (row.status !== "PENDING" && row.status !== "DISCUSSING") {
          throw conflict("계약 전인 의뢰만 거둘 수 있습니다.");
        }
        await voidOpenTerms(tx, [requestId]);
        return toDirect(
          await tx.workRequest.update({
            where: { id: requestId },
            data: { status: "WITHDRAWN" },
            include: includeParties,
          }),
        );
      });
    },
  };
}
