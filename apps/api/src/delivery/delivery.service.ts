import {
  type AuthUser,
  type Delivery,
  type Deliverable,
  type DeliverableKind,
  type Review,
  type RevisionItem,
  type RevisionRequest,
  type Settlement,
  type SettlementListItem,
  deliverableCreateSchema,
  deliverableKindSchema,
  deliverableStatusSchema,
  revisionItemSchema,
  revisionRequestCreateSchema,
  revisionStatusSchema,
  revisionTypeSchema,
  reviewCreateSchema,
  settlementStatusSchema,
} from "@kemi/shared";
import { z } from "zod";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { postSystemMessage } from "../chat/chat.service.js";
import { requireReadyFiles } from "../files/file.service.js";
import notify from "../notifications/notify.js";
import { settleIfReady } from "./settlement.js";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };

const byCreated = [{ createdAt: "asc" }, { id: "asc" }] as const;
const includeAll = {
  deliverables: {
    orderBy: { versionNo: "asc" },
    include: { files: { select: { fileId: true } } },
  },
  revisionRequests: {
    orderBy: [...byCreated],
    include: { files: { select: { fileId: true } } },
  },
  contract: {
    select: {
      id: true,
      workRequestId: true,
      clientId: true,
      creatorId: true,
      amountKrw: true,
      feeRateBps: true,
      payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
      settlement: true,
      reviews: { orderBy: [...byCreated] },
    },
  },
} satisfies Prisma.ProductionInclude;

type ProductionRow = Prisma.ProductionGetPayload<{
  include: typeof includeAll;
}>;
type DeliverableRow = ProductionRow["deliverables"][number];
type RevisionRow = ProductionRow["revisionRequests"][number];
type SettlementRow = NonNullable<ProductionRow["contract"]["settlement"]>;
type ReviewRow = ProductionRow["contract"]["reviews"][number];

const revisionItemsSchema = z.array(revisionItemSchema);

const conflict = (message: string) => new AppError(409, "CONFLICT", message);
const notFound = (what: string) =>
  new AppError(404, "NOT_FOUND", `${what}을 찾을 수 없습니다.`);

// 일반 수정만 계약 회차에서 차감한다. 초안 의견·계약 오류 시정은 차감하지 않는다.
const countsTowardLimit = (type: string) => type === "GENERAL";

function revisionUsage(row: ProductionRow) {
  const general = row.revisionRequests.filter((r) => countsTowardLimit(r.type));
  const used = general.filter((r) => r.status === "RESOLVED").length;
  const open = general.filter((r) => r.status === "OPEN").length;
  return {
    used,
    // 수정본을 기다리는 일반 요청은 회차를 미리 잡아 둔다(완료 처리는 수정본 제출 때).
    remaining: Math.max(row.revisionLimit - used - open, 0),
  };
}

function toDeliverable(row: DeliverableRow): Deliverable {
  return {
    id: row.id.toString(),
    versionNo: row.versionNo,
    kind: deliverableKindSchema.parse(row.kind),
    status: deliverableStatusSchema.parse(row.status),
    fileIds: row.files.map((f) => f.fileId.toString()),
    note: row.note,
    resolvesRevisionRequestId:
      row.resolvesRevisionRequestId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
  };
}

function toRevision(row: RevisionRow): RevisionRequest {
  return {
    id: row.id.toString(),
    deliverableId: row.deliverableId.toString(),
    type: revisionTypeSchema.parse(row.type),
    status: revisionStatusSchema.parse(row.status),
    items: revisionItemsSchema.parse(row.items),
    fileIds: row.files.map((f) => f.fileId.toString()),
    note: row.note,
    countsTowardLimit: countsTowardLimit(row.type),
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    contractId: row.contractId.toString(),
    status: settlementStatusSchema.parse(row.status),
    grossKrw: Number(row.grossKrw),
    feeRateBps: row.feeRateBps,
    feeKrw: Number(row.feeKrw),
    payoutKrw: Number(row.payoutKrw),
    createdAt: row.createdAt.toISOString(),
  };
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id.toString(),
    contractId: row.contractId.toString(),
    reviewerId: row.reviewerId.toString(),
    revieweeId: row.revieweeId.toString(),
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDelivery(row: ProductionRow, userId: bigint): Delivery {
  const usage = revisionUsage(row);
  return {
    contractId: row.contractId.toString(),
    workRequestId: row.contract.workRequestId.toString(),
    productionStatus: row.status,
    revisionLimit: row.revisionLimit,
    revisionsUsed: usage.used,
    revisionsRemaining: usage.remaining,
    deliverables: row.deliverables.map(toDeliverable),
    revisionRequests: row.revisionRequests.map(toRevision),
    settlement: row.contract.settlement
      ? toSettlement(row.contract.settlement)
      : null,
    reviews: row.contract.reviews.map(toReview),
    canReview:
      row.status === "COMPLETED" &&
      !row.contract.reviews.some((r) => r.reviewerId === userId),
  };
}

// 수정 요청 대상 버전 종류에 따라 수정본으로 낼 수 있는 종류
const RESOLUTION_KINDS: Record<DeliverableKind, readonly DeliverableKind[]> = {
  DRAFT: ["DRAFT", "REVIEW"],
  REVIEW: ["REVIEW"],
  FINAL: ["FINAL"],
};
// 버전 종류별로 받을 수 있는 수정 요청 유형
const REVISION_TYPES_FOR: Record<DeliverableKind, readonly string[]> = {
  DRAFT: ["DRAFT_FEEDBACK"],
  REVIEW: ["GENERAL", "CONTRACT_FIX"],
  FINAL: ["CONTRACT_FIX"],
};

const REVISION_TYPE_HINT: Record<DeliverableKind, string> = {
  DRAFT: "초안에는 초안 의견(DRAFT_FEEDBACK)만 남길 수 있습니다.",
  REVIEW: "검토본에는 일반 수정 또는 계약 오류 시정을 요청할 수 있습니다.",
  FINAL:
    "최종본은 계약 조건과 다른 부분의 시정(CONTRACT_FIX)만 요청할 수 있습니다.",
};

const KIND_LABEL: Record<DeliverableKind, string> = {
  DRAFT: "초안",
  REVIEW: "검토본",
  FINAL: "최종본",
};

export interface DeliveryService {
  get(user: AuthUser, contractId: bigint): Promise<Delivery>;
  submit(user: AuthUser, contractId: bigint, input: unknown): Promise<Delivery>;
  requestRevision(
    user: AuthUser,
    contractId: bigint,
    deliverableId: bigint,
    input: unknown,
  ): Promise<Delivery>;
  approve(
    user: AuthUser,
    contractId: bigint,
    deliverableId: bigint,
  ): Promise<Delivery>;
  receive(
    user: AuthUser,
    contractId: bigint,
    deliverableId: bigint,
  ): Promise<Delivery>;
  review(user: AuthUser, contractId: bigint, input: unknown): Promise<Delivery>;
  listSettlements(user: AuthUser): Promise<{ items: SettlementListItem[] }>;
  listReviews(userId: bigint): Promise<{
    averageRating: number | null;
    count: number;
    items: Review[];
  }>;
}

// 같은 commandId로 다른 내용을 보낸 경우
function reusedCommand(): AppError {
  return conflict("같은 요청 식별자로 다른 내용을 보낼 수 없습니다.");
}

// 파일 ID는 순서·중복과 관계없이 같은 집합인지 본다.
function sameIds(saved: bigint[], sent: string[]): boolean {
  const a = [...new Set(saved.map(String))].sort();
  const b = [...new Set(sent)].sort();
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// 저장된 체크리스트와 보낸 체크리스트를 같은 형태로 맞춰 비교한다(위치가 없으면 빈 값).
function sameItems(saved: unknown, sent: RevisionItem[]): boolean {
  const parsed = z.array(revisionItemSchema).safeParse(saved);
  if (!parsed.success) return false;
  const key = (items: RevisionItem[]) =>
    JSON.stringify(
      items.map((item) => [item.position ?? "", item.problem, item.desired]),
    );
  return key(parsed.data) === key(sent);
}

export function createDeliveryService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): DeliveryService {
  // 계약 행을 잠그고 당사자인지 확인한다. 당사자가 아니면 404.
  async function lock(tx: Tx, user: AuthUser, contractId: bigint) {
    const userId = BigInt(user.id);
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { clientId: true, creatorId: true },
    });
    if (
      !contract ||
      (contract.clientId !== userId && contract.creatorId !== userId)
    ) {
      throw notFound("계약");
    }
    await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId} FOR UPDATE`;
    const production = await tx.production.findUnique({
      where: { contractId },
      include: includeAll,
    });
    if (!production) throw notFound("제작 정보");
    return {
      userId,
      production,
      role: contract.clientId === userId ? "CLIENT" : "CREATOR",
    } as const;
  }

  function requireRole(role: "CLIENT" | "CREATOR", expected: string) {
    if (role !== expected) {
      throw new AppError(
        403,
        "FORBIDDEN",
        expected === "CLIENT"
          ? "의뢰인만 할 수 있습니다."
          : "크리에이터만 할 수 있습니다.",
      );
    }
  }

  function requireInProgress(production: ProductionRow) {
    if (production.status !== "IN_PROGRESS") {
      throw conflict("제작 중인 거래에서만 할 수 있습니다.");
    }
  }

  // 화면이 보고 있던 최신 버전에만 답할 수 있다.
  function latestDeliverable(production: ProductionRow, deliverableId: bigint) {
    const target = production.deliverables.find((d) => d.id === deliverableId);
    if (!target) throw notFound("납품 버전");
    if (production.deliverables.at(-1)?.id !== target.id) {
      throw conflict("최신 버전에만 답할 수 있습니다.");
    }
    return target;
  }

  async function reload(tx: Tx, contractId: bigint, userId: bigint) {
    return toDelivery(
      await tx.production.findUniqueOrThrow({
        where: { contractId },
        include: includeAll,
      }),
      userId,
    );
  }

  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  return {
    async get(user, contractId) {
      return inTransaction(async (tx) => {
        const { userId, production } = await lock(tx, user, contractId);
        return toDelivery(production, userId);
      });
    },

    // DEL-01·02: 크리에이터가 버전을 정식 제출한다. 수정 요청이 열려 있으면 이 버전이 수정본이 되고,
    // 일반 회차는 이때 한 번만 완료 처리한다. 같은 commandId의 재전송은 새 버전을 만들지 않는다.
    async submit(user, contractId, input) {
      const data = deliverableCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, role, production } = await lock(tx, user, contractId);
        requireRole(role, "CREATOR");
        const repeated = await tx.deliverable.findUnique({
          where: { commandId: data.commandId },
          select: {
            contractId: true,
            kind: true,
            note: true,
            files: { select: { fileId: true } },
          },
        });
        if (repeated) {
          // 같은 요청의 재전송만 성공으로 본다. 계약·종류·파일·메모 중 하나라도 다르면 409.
          const same =
            repeated.contractId === contractId &&
            repeated.kind === data.kind &&
            repeated.note === (data.note ?? null) &&
            sameIds(
              repeated.files.map((f) => f.fileId),
              data.fileIds,
            );
          if (!same) throw reusedCommand();
          return toDelivery(production, userId);
        }
        requireInProgress(production);

        const open = production.revisionRequests.find(
          (r) => r.status === "OPEN",
        );
        const openTarget = open
          ? production.deliverables.find((d) => d.id === open.deliverableId)
          : undefined;
        const approvedReview = production.deliverables.some(
          (d) => d.kind === "REVIEW" && d.status === "APPROVED",
        );
        if (openTarget) {
          const allowed =
            RESOLUTION_KINDS[deliverableKindSchema.parse(openTarget.kind)];
          if (!allowed.includes(data.kind)) {
            throw conflict(
              `열린 수정 요청에는 ${allowed.map((k) => KIND_LABEL[k]).join("·")}으로 답해야 합니다.`,
            );
          }
        } else if (data.kind === "FINAL" && !approvedReview) {
          throw conflict("검토본이 승인된 뒤에 최종본을 낼 수 있습니다.");
        } else if (data.kind !== "FINAL" && approvedReview) {
          throw conflict("검토본이 승인되어 최종본만 낼 수 있습니다.");
        }

        const fileIds = data.fileIds.map(BigInt);
        await requireReadyFiles(tx, fileIds, {
          ownerId: userId,
          purpose: "DELIVERABLE",
          workRequestId: production.contract.workRequestId,
        });

        // 검토를 기다리던 이전 버전은 새 버전으로 대체된다.
        await tx.deliverable.updateMany({
          where: { contractId, status: "SUBMITTED" },
          data: { status: "SUPERSEDED" },
        });
        const versionNo = (production.deliverables.at(-1)?.versionNo ?? 0) + 1;
        if (open) {
          await tx.revisionRequest.update({
            where: { id: open.id },
            data: { status: "RESOLVED", resolvedAt: now() },
          });
        }
        await tx.deliverable.create({
          data: {
            contractId,
            versionNo,
            kind: data.kind,
            note: data.note ?? null,
            commandId: data.commandId,
            submittedBy: userId,
            resolvesRevisionRequestId: open?.id ?? null,
            files: {
              create: [...new Set(data.fileIds)].map((id) => ({
                fileId: BigInt(id),
              })),
            },
          },
        });
        const label = KIND_LABEL[data.kind];
        await notify(tx, [
          {
            recipientUserId: production.contract.clientId,
            type: "DELIVERABLE_SUBMITTED",
            eventKey: `deliverable:${contractId}:${versionNo}:submitted`,
            title: `${label}이 도착했습니다`,
            body: `크리에이터가 ${versionNo}번째 버전(${label})을 제출했습니다. 확인해주세요.`,
            workRequestId: production.contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `deliverable:${contractId}:${versionNo}:submitted`,
          `크리에이터가 ${versionNo}번째 버전(${label})을 제출했습니다.`,
        );
        return reload(tx, contractId, userId);
      });
    },

    // REV-01·02: 의뢰인이 최신 버전에 수정을 요청한다. 일반 수정은 남은 회차가 있어야 한다.
    async requestRevision(user, contractId, deliverableId, input) {
      const data = revisionRequestCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, role, production } = await lock(tx, user, contractId);
        requireRole(role, "CLIENT");
        const repeated = await tx.revisionRequest.findUnique({
          where: { commandId: data.commandId },
          select: {
            contractId: true,
            deliverableId: true,
            type: true,
            items: true,
            note: true,
            files: { select: { fileId: true } },
          },
        });
        if (repeated) {
          // 같은 요청의 재전송만 성공으로 본다. 대상 버전·종류·항목·파일·메모 중 하나라도 다르면 409.
          const same =
            repeated.contractId === contractId &&
            repeated.deliverableId === deliverableId &&
            repeated.type === data.type &&
            repeated.note === (data.note ?? null) &&
            sameItems(repeated.items, data.items) &&
            sameIds(
              repeated.files.map((f) => f.fileId),
              data.fileIds,
            );
          if (!same) throw reusedCommand();
          return toDelivery(production, userId);
        }
        requireInProgress(production);
        const target = latestDeliverable(production, deliverableId);
        if (target.status !== "SUBMITTED") {
          throw conflict("검토를 기다리는 버전에만 수정을 요청할 수 있습니다.");
        }
        const kind = deliverableKindSchema.parse(target.kind);
        if (!REVISION_TYPES_FOR[kind].includes(data.type)) {
          throw conflict(REVISION_TYPE_HINT[kind]);
        }
        if (
          countsTowardLimit(data.type) &&
          revisionUsage(production).remaining === 0
        ) {
          throw conflict("남은 일반 수정 회차가 없습니다.");
        }
        const fileIds = data.fileIds.map(BigInt);
        await requireReadyFiles(tx, fileIds, {
          ownerId: userId,
          purpose: "REVISION",
          workRequestId: production.contract.workRequestId,
        });
        const created = await tx.revisionRequest.create({
          data: {
            contractId,
            deliverableId,
            type: data.type,
            items: data.items,
            note: data.note ?? null,
            commandId: data.commandId,
            requestedBy: userId,
            files: {
              create: [...new Set(data.fileIds)].map((id) => ({
                fileId: BigInt(id),
              })),
            },
          },
        });
        await tx.deliverable.update({
          where: { id: deliverableId },
          data: { status: "REVISION_REQUESTED" },
        });
        await notify(tx, [
          {
            recipientUserId: production.contract.creatorId,
            type: "REVISION_REQUESTED",
            eventKey: `revision:${created.id}:requested`,
            title: "수정 요청이 도착했습니다",
            body: `${target.versionNo}번째 버전에 수정 요청 ${data.items.length}건이 있습니다.`,
            workRequestId: production.contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `revision:${created.id}:requested`,
          `의뢰인이 ${target.versionNo}번째 버전에 수정을 요청했습니다.`,
        );
        return reload(tx, contractId, userId);
      });
    },

    // DEL-03: 최신 검토본 승인. 승인만으로 정산되지 않는다(최종본 수령 확인이 따로 있다).
    async approve(user, contractId, deliverableId) {
      return inTransaction(async (tx) => {
        const { userId, role, production } = await lock(tx, user, contractId);
        requireRole(role, "CLIENT");
        requireInProgress(production);
        const target = latestDeliverable(production, deliverableId);
        if (target.kind !== "REVIEW" || target.status !== "SUBMITTED") {
          throw conflict("검토를 기다리는 최신 검토본만 승인할 수 있습니다.");
        }
        await tx.deliverable.update({
          where: { id: deliverableId },
          data: { status: "APPROVED", approvedAt: now() },
        });
        await notify(tx, [
          {
            recipientUserId: production.contract.creatorId,
            type: "DELIVERABLE_APPROVED",
            eventKey: `deliverable:${deliverableId}:approved`,
            title: "검토본이 승인되었습니다",
            body: "깨끗한 최종 파일을 최종본으로 제출해주세요.",
            workRequestId: production.contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `deliverable:${deliverableId}:approved`,
          `의뢰인이 ${target.versionNo}번째 버전(검토본)을 승인했습니다. 최종본 제출을 기다립니다.`,
        );
        return reload(tx, contractId, userId);
      });
    },

    // DEL-04·05, SETTLE-01: 최종본 수령 확인. 결제 완료·보류 없음이면 계약 당시 요율로 모의 정산하고 거래를 완료한다.
    async receive(user, contractId, deliverableId) {
      return inTransaction(async (tx) => {
        const { userId, role, production } = await lock(tx, user, contractId);
        requireRole(role, "CLIENT");
        requireInProgress(production);
        const target = latestDeliverable(production, deliverableId);
        if (target.kind !== "FINAL" || target.status !== "SUBMITTED") {
          throw conflict(
            "검토를 기다리는 최신 최종본만 수령 확인할 수 있습니다.",
          );
        }
        await tx.deliverable.update({
          where: { id: deliverableId },
          data: { status: "RECEIVED", receivedAt: now() },
        });
        await tx.production.update({
          where: { contractId },
          data: { status: "DELIVERED" },
        });
        // 결제 완료·분쟁 없음이면 바로 정산하고 거래를 완료한다. 아니면 DELIVERED로 보류한다.
        const { hold: blocker, amounts } = await settleIfReady(tx, contractId);
        const won = (value: number) => `${value.toLocaleString("ko-KR")}원`;
        await notify(tx, [
          {
            recipientUserId: production.contract.creatorId,
            type: "DELIVERY_RECEIVED",
            eventKey: `delivery:${contractId}:received`,
            title: "의뢰인이 최종본 수령을 확인했습니다",
            body: amounts
              ? `모의 정산: 거래 금액 ${won(amounts.grossKrw)}, 수수료 ${won(amounts.feeKrw)}, 지급 예정 ${won(amounts.payoutKrw)}`
              : `정산이 보류되었습니다(${blocker}).`,
            workRequestId: production.contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `delivery:${contractId}:received`,
          blocker
            ? "의뢰인이 최종본 수령을 확인했습니다. 정산은 보류 중입니다."
            : "의뢰인이 최종본 수령을 확인했습니다. 거래가 완료되었고 서로 리뷰를 남길 수 있습니다.",
        );
        return reload(tx, contractId, userId);
      });
    },

    // REVIEW-01: 정상 완료된 거래의 당사자가 상대방을 한 번 평가한다.
    async review(user, contractId, input) {
      const data = reviewCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, role, production } = await lock(tx, user, contractId);
        if (production.status !== "COMPLETED") {
          throw conflict("완료된 거래에만 리뷰를 남길 수 있습니다.");
        }
        const revieweeId =
          role === "CLIENT"
            ? production.contract.creatorId
            : production.contract.clientId;
        try {
          await tx.review.create({
            data: {
              contractId,
              reviewerId: userId,
              revieweeId,
              rating: data.rating,
              comment: data.comment ?? null,
            },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw conflict("이 거래에는 이미 리뷰를 남겼습니다.");
          }
          throw err;
        }
        await notify(tx, [
          {
            recipientUserId: revieweeId,
            type: "REVIEW_RECEIVED",
            eventKey: `review:${contractId}:${userId}`,
            title: "새 리뷰가 등록되었습니다",
            body: `거래 상대방이 평점 ${data.rating}점을 남겼습니다.`,
            workRequestId: production.contract.workRequestId,
          },
        ]);
        return reload(tx, contractId, userId);
      });
    },

    // 내 모의 정산 내역(크리에이터: 지급 예정, 의뢰인: 결제한 거래). 실제 송금이 아니다.
    async listSettlements(user) {
      const userId = BigInt(user.id);
      const rows = await prisma.settlement.findMany({
        where: {
          contract: { OR: [{ clientId: userId }, { creatorId: userId }] },
        },
        orderBy: [{ createdAt: "desc" }, { contractId: "desc" }],
        include: {
          contract: {
            select: {
              workRequestId: true,
              project: { select: { title: true } },
            },
          },
        },
      });
      return {
        items: rows.map((row) => ({
          ...toSettlement(row),
          workRequestId: row.contract.workRequestId.toString(),
          title: row.contract.project?.title ?? "직접 의뢰",
        })),
      };
    },

    // 공개 리뷰 목록(프로필 화면). 받은 리뷰만, 최신순.
    async listReviews(userId) {
      const rows = await prisma.review.findMany({
        where: { revieweeId: userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const total = rows.reduce((sum, row) => sum + row.rating, 0);
      return {
        averageRating:
          rows.length === 0
            ? null
            : Math.round((total / rows.length) * 10) / 10,
        count: rows.length,
        // 목록은 최근 50개까지
        items: rows.slice(0, 50).map(toReview),
      };
    },
  };
}
