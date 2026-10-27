import {
  type AuthUser,
  type Cancellation,
  type CancellationOverview,
  type Dispute,
  type OperationRecord,
  type Refund,
  cancellationCreateSchema,
  cancellationStatusSchema,
  disputeCreateSchema,
  disputeEvidenceSchema,
  disputeResolveSchema,
  disputeStatusSchema,
  refundStatusSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { postSystemMessage } from "../chat/chat.service.js";
import { requireReadyFiles } from "../files/file.service.js";
import notify, { type NotificationInput } from "../notifications/notify.js";
import { loadSettlementHold, settleIfReady } from "../delivery/settlement.js";
import {
  TOSS_TIMEOUT_MS,
  type TossClient,
  type TossOutcome,
} from "../payments/toss.js";

type Tx = Prisma.TransactionClient;

// 환불 API 호출(최대 10초)을 잠금 안에서 기다린다.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
// 보낸 지 이 시간이 지나지 않은 REQUESTED 환불은 조회로 판정하지 않는다(Toss 응답 대기 시간의 세 배).
export const REFUND_SYNC_GRACE_MS = TOSS_TIMEOUT_MS * 3;
const CONFIG_ERROR_CODES = new Set([
  "UNAUTHORIZED_KEY",
  "INVALID_API_KEY",
  "INCORRECT_BASIC_AUTH_FORMAT",
]);

const conflict = (message: string) => new AppError(409, "CONFLICT", message);
const notFound = (what: string) =>
  new AppError(404, "NOT_FOUND", `${what}을 찾을 수 없습니다.`);
const tossUnavailable = () =>
  new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "테스트 결제(환불)가 아직 설정되지 않았습니다.",
  );

const includeCancellation = {
  refund: true,
  deliveredFiles: { select: { fileId: true } },
} satisfies Prisma.CancellationInclude;
type CancellationRow = Prisma.CancellationGetPayload<{
  include: typeof includeCancellation;
}>;
type RefundRow = NonNullable<CancellationRow["refund"]>;

const includeDispute = {
  evidence: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { files: { select: { fileId: true } } },
  },
} satisfies Prisma.DisputeInclude;
type DisputeRow = Prisma.DisputeGetPayload<{ include: typeof includeDispute }>;

function toRefund(row: RefundRow): Refund {
  return {
    id: row.id.toString(),
    amountKrw: Number(row.amountKrw),
    status: refundStatusSchema.parse(row.status),
    attempt: row.attempt,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCancellation(row: CancellationRow): Cancellation {
  return {
    id: row.id.toString(),
    versionNo: row.versionNo,
    status: cancellationStatusSchema.parse(row.status),
    proposedBy: row.proposedBy.toString(),
    reason: row.reason,
    completedWorkKrw: Number(row.completedWorkKrw),
    refundKrw: Number(row.refundKrw),
    deliveredFileIds: row.deliveredFiles.map((f) => f.fileId.toString()),
    unfinishedState: row.unfinishedState,
    usageRights: row.usageRights,
    respondedBy: row.respondedBy?.toString() ?? null,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    handoverConfirmedAt: row.handoverConfirmedAt?.toISOString() ?? null,
    refund: row.refund ? toRefund(row.refund) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDispute(row: DisputeRow): Dispute {
  return {
    id: row.id.toString(),
    contractId: row.contractId.toString(),
    openedBy: row.openedBy.toString(),
    status: disputeStatusSchema.parse(row.status),
    reason: row.reason,
    evidence: row.evidence.map((e) => ({
      id: e.id.toString(),
      submittedBy: e.submittedBy.toString(),
      note: e.note,
      fileIds: e.files.map((f) => f.fileId.toString()),
      createdAt: e.createdAt.toISOString(),
    })),
    resolution: row.resolution,
    resolvedBy: row.resolvedBy?.toString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

const won = (value: bigint | number) =>
  `${Number(value).toLocaleString("ko-KR")}원`;

export interface CancelService {
  overview(user: AuthUser, contractId: bigint): Promise<CancellationOverview>;
  propose(
    user: AuthUser,
    contractId: bigint,
    input: unknown,
  ): Promise<CancellationOverview>;
  respond(
    user: AuthUser,
    contractId: bigint,
    cancellationId: bigint,
    action: "accept" | "reject" | "withdraw",
  ): Promise<CancellationOverview>;
  retryRefund(
    user: AuthUser,
    contractId: bigint,
  ): Promise<CancellationOverview>;
  syncRefund(user: AuthUser, contractId: bigint): Promise<CancellationOverview>;
  confirmHandover(
    user: AuthUser,
    contractId: bigint,
  ): Promise<CancellationOverview>;
  openDispute(
    user: AuthUser,
    contractId: bigint,
    input: unknown,
  ): Promise<CancellationOverview>;
  addEvidence(
    user: AuthUser,
    contractId: bigint,
    disputeId: bigint,
    input: unknown,
  ): Promise<CancellationOverview>;
  listDisputes(user: AuthUser): Promise<{ items: Dispute[] }>;
  getDispute(user: AuthUser, disputeId: bigint): Promise<Dispute>;
  resolveDispute(
    user: AuthUser,
    disputeId: bigint,
    input: unknown,
  ): Promise<Dispute>;
  listOperationRecords(user: AuthUser): Promise<{ items: OperationRecord[] }>;
}

export function createCancelService({
  prisma,
  toss,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  // 없으면(키 미설정) 환불이 필요한 취소 승인·재시도·조회는 503
  toss?: TossClient;
  now?: () => Date;
}): CancelService {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  // 잠금 순서는 언제나 계약 → (분쟁·환불 등) 계약에 딸린 행이다(데드락 방지).
  async function lockContract(tx: Tx, contractId: bigint) {
    await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId} FOR UPDATE`;
    return tx.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: {
        payments: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        production: { select: { status: true } },
        settlement: { select: { contractId: true } },
        cancellations: {
          orderBy: { versionNo: "asc" },
          include: includeCancellation,
        },
      },
    });
  }

  // 계약 행을 잠그고 당사자인지 확인한다. 당사자가 아니면 404.
  async function lock(tx: Tx, user: AuthUser, contractId: bigint) {
    const userId = BigInt(user.id);
    const found = await tx.contract.findUnique({
      where: { id: contractId },
      select: { clientId: true, creatorId: true },
    });
    if (!found || (found.clientId !== userId && found.creatorId !== userId)) {
      throw notFound("계약");
    }
    const contract = await lockContract(tx, contractId);
    const otherId =
      userId === contract.clientId ? contract.creatorId : contract.clientId;
    return { userId, otherId, contract };
  }
  type Locked = Awaited<ReturnType<typeof lock>>["contract"];

  const paidPayment = (contract: Locked) =>
    contract.payments.find((p) => p.status === "SUCCEEDED");

  async function overviewOf(
    tx: Tx,
    contractId: bigint,
  ): Promise<CancellationOverview> {
    const contract = await tx.contract.findUniqueOrThrow({
      where: { id: contractId },
      include: {
        payments: { where: { status: "SUCCEEDED" } },
        cancellations: {
          orderBy: { versionNo: "asc" },
          include: includeCancellation,
        },
        disputes: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: includeDispute,
        },
      },
    });
    const hold = await loadSettlementHold(tx, contractId);
    return {
      contractId: contractId.toString(),
      contractStatus: contract.status,
      paidKrw: contract.payments.reduce(
        (sum, p) => sum + Number(p.amountKrw),
        0,
      ),
      cancellations: contract.cancellations.map(toCancellation),
      disputes: contract.disputes.map(toDispute),
      settlementHold: hold === "이미 정산됨" ? null : hold,
    };
  }

  // Toss 취소 결과를 환불 상태로 줄인다. 주문 번호·원결제 금액·남은 금액이 모두 응답에 있고 맞아야 성공으로 본다.
  // 증거가 빠지거나 다르면 UNKNOWN으로 두고 조회(sync)로 다시 맞춘다.
  function refundResult(
    outcome: TossOutcome,
    payment: { orderId: string; amountKrw: bigint },
    refundKrw: bigint,
  ): { status: string; failureCode?: string; failureMessage?: string } {
    if (outcome.kind === "unavailable") return { status: "UNKNOWN" };
    if (outcome.kind === "rejected") {
      if (CONFIG_ERROR_CODES.has(outcome.code)) {
        // 키 설정 오류는 결제사가 요청을 처리하지 않은 것이다. 실패로 남기고 설정을 고친 뒤 재시도한다.
        console.warn("[refunds] Toss key configuration error", {
          code: outcome.code,
        });
      }
      return {
        status: "FAILED",
        failureCode: outcome.code,
        failureMessage: outcome.message.slice(0, 500),
      };
    }
    const expectedBalance = Number(payment.amountKrw - refundKrw);
    const canceled =
      outcome.payment.status === "PARTIAL_CANCELED" ||
      outcome.payment.status === "CANCELED";
    if (
      outcome.payment.orderId === payment.orderId &&
      canceled &&
      outcome.payment.totalAmount === Number(payment.amountKrw) &&
      outcome.payment.balanceAmount !== undefined &&
      outcome.payment.balanceAmount === expectedBalance
    ) {
      return { status: "SUCCEEDED" };
    }
    console.warn("[refunds] Toss result did not match the refund", {
      orderId: payment.orderId,
      status: outcome.payment.status,
    });
    return { status: "UNKNOWN" };
  }

  async function applyRefund(
    tx: Tx,
    contract: Locked,
    refund: RefundRow,
    result: { status: string; failureCode?: string; failureMessage?: string },
  ) {
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: result.status,
        failureCode: result.failureCode ?? null,
        failureMessage: result.failureMessage ?? null,
      },
    });
    if (result.status !== "SUCCEEDED") return;
    await notify(
      tx,
      [contract.clientId, contract.creatorId].map(
        (recipientUserId): NotificationInput => ({
          recipientUserId,
          type: "REFUND_SUCCEEDED",
          eventKey: `refund:${refund.id}:succeeded`,
          title: "테스트 환불이 완료되었습니다",
          body: `취소 합의에 따라 ${won(refund.amountKrw)}이 환불되었습니다.`,
          workRequestId: contract.workRequestId,
        }),
      ),
    );
    await postSystemMessage(
      tx,
      contract.workRequestId,
      `refund:${refund.id}:succeeded`,
      `취소 합의에 따른 테스트 환불 ${won(refund.amountKrw)}이 완료되었습니다.`,
    );
    await settleIfReady(tx, contract.id);
  }

  // 2단계 환불. 1단계(호출하는 쪽): 환불 시도(REQUESTED, attempt)를 트랜잭션으로 먼저 커밋한다. 멱등 키는
  // refund-{cancellationId}-{attempt}라 DB에 남은 값으로 언제든 다시 만들 수 있다.
  // 2단계(여기): 트랜잭션 밖에서 Toss를 부르고, 결과는 계약 잠금 아래 새 트랜잭션으로 기록한다.
  // Toss 성공 뒤 기록이 실패해도 시도는 REQUESTED로 남아 조회(sync)로 맞추며, 새 멱등 키를 만들지 않는다.
  async function dispatchRefund(contractId: bigint, refundId: bigint) {
    if (!toss) throw tossUnavailable();
    const refund = await prisma.refund.findUniqueOrThrow({
      where: { id: refundId },
      include: { payment: true },
    });
    if (refund.status !== "REQUESTED") return;
    const { payment } = refund;
    if (!payment.paymentKey) throw conflict("환불할 결제를 찾을 수 없습니다.");
    const outcome = await toss.cancel({
      paymentKey: payment.paymentKey,
      cancelAmount: Number(refund.amountKrw),
      cancelReason: "KEMI 취소 합의",
      idempotencyKey: `refund-${refund.cancellationId}-${refund.attempt}`,
    });
    const result = refundResult(outcome, payment, refund.amountKrw);
    try {
      await inTransaction(async (tx) => {
        const contract = await lockContract(tx, contractId);
        const current = await tx.refund.findUniqueOrThrow({
          where: { id: refundId },
        });
        // 그사이 조회로 이미 정리됐거나 다른 시도로 넘어갔으면 이 결과는 쓰지 않는다.
        if (
          current.status !== "REQUESTED" ||
          current.attempt !== refund.attempt
        ) {
          return;
        }
        await applyRefund(tx, contract, current, result);
      });
    } catch (err) {
      // 결제사 처리 결과는 Toss에 남아 있다. 시도는 REQUESTED로 두고 조회로 맞춘다.
      console.warn("[refunds] could not record the Toss result; sync later", {
        refundId: refundId.toString(),
        status: result.status,
      });
      throw err;
    }
  }

  // 환불 시도를 보낸 뒤 현재 상태를 돌려준다. 결과 기록 단계의 실패는 응답을 막지 않는다(REQUESTED로 보인다).
  async function dispatchThenOverview(contractId: bigint, refundId: bigint) {
    await dispatchRefund(contractId, refundId).catch((err: unknown) => {
      if (err instanceof AppError) throw err;
    });
    return inTransaction((tx) => overviewOf(tx, contractId));
  }

  function acceptedOf(contract: Locked) {
    const accepted = contract.cancellations.find(
      (c) => c.status === "ACCEPTED",
    );
    if (!accepted) throw conflict("승인된 취소 합의가 없습니다.");
    return accepted;
  }

  function requireAdmin(user: AuthUser): bigint {
    if (user.role !== "ADMIN") {
      throw new AppError(403, "FORBIDDEN", "운영자만 할 수 있습니다.");
    }
    return BigInt(user.id);
  }

  async function requireEvidenceFiles(
    tx: Tx,
    userId: bigint,
    workRequestId: bigint,
    fileIds: string[],
  ) {
    await requireReadyFiles(tx, fileIds.map(BigInt), {
      ownerId: userId,
      purpose: "EVIDENCE",
      workRequestId,
    });
  }

  return {
    async overview(user, contractId) {
      return inTransaction(async (tx) => {
        await lock(tx, user, contractId);
        return overviewOf(tx, contractId);
      });
    },

    // CANCEL-01·02: 취소 제안. 미결제 계약은 대가·환불 모두 0, 결제 완료 계약은 대가 + 환불 = 원결제.
    async propose(user, contractId, input) {
      const data = cancellationCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, otherId, contract } = await lock(tx, user, contractId);
        if (contract.status !== "SIGNED" || contract.settlement) {
          throw conflict("진행 중인 계약만 취소를 제안할 수 있습니다.");
        }
        if (
          contract.payments.some(
            (p) => p.status === "UNKNOWN" || p.status === "READY",
          )
        ) {
          throw conflict(
            "결제 결과를 확인 중인 주문이 있습니다. 결제 결과를 먼저 확인해주세요.",
          );
        }
        const paid = paidPayment(contract)?.amountKrw ?? 0n;
        if (BigInt(data.completedWorkKrw) + BigInt(data.refundKrw) !== paid) {
          throw new AppError(
            400,
            "VALIDATION_FAILED",
            paid === 0n
              ? "결제 전 계약은 완료 작업 대가와 환불액이 모두 0원이어야 합니다."
              : `완료 작업 대가와 환불액의 합이 결제 금액(${won(paid)})과 같아야 합니다.`,
            [{ path: ["refundKrw"] }],
          );
        }
        await requireReadyFiles(tx, data.deliveredFileIds.map(BigInt), {
          ownerId: contract.creatorId,
          purpose: "DELIVERABLE",
          workRequestId: contract.workRequestId,
        });
        await tx.cancellation.updateMany({
          where: { contractId, status: "PROPOSED" },
          data: { status: "SUPERSEDED" },
        });
        const versionNo = (contract.cancellations.at(-1)?.versionNo ?? 0) + 1;
        await tx.cancellation.create({
          data: {
            contractId,
            versionNo,
            proposedBy: userId,
            reason: data.reason,
            completedWorkKrw: BigInt(data.completedWorkKrw),
            refundKrw: BigInt(data.refundKrw),
            unfinishedState: data.unfinishedState ?? null,
            usageRights: data.usageRights ?? null,
            deliveredFiles: {
              create: [...new Set(data.deliveredFileIds)].map((id) => ({
                fileId: BigInt(id),
              })),
            },
          },
        });
        await notify(tx, [
          {
            recipientUserId: otherId,
            type: "CANCELLATION_PROPOSED",
            eventKey: `cancellation:${contractId}:${versionNo}:proposed`,
            title: "계약 취소 제안이 도착했습니다",
            body: `완료 작업 대가 ${won(data.completedWorkKrw)}, 환불 ${won(data.refundKrw)}으로 취소하자는 제안입니다.`,
            workRequestId: contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          contract.workRequestId,
          `cancellation:${contractId}:${versionNo}:proposed`,
          `계약 취소 제안(${versionNo}번째)이 있습니다. 사유: ${data.reason}`,
        );
        return overviewOf(tx, contractId);
      });
    },

    // 상대방의 승인·거절, 제안자의 철회. 승인하면 계약·제작을 취소하고 환불(있으면)을 요청한다.
    async respond(user, contractId, cancellationId, action) {
      const refundId = await inTransaction(async (tx) => {
        const { userId, contract } = await lock(tx, user, contractId);
        const target = contract.cancellations.find(
          (c) => c.id === cancellationId,
        );
        if (!target) throw notFound("취소 제안");
        if (target.status !== "PROPOSED") {
          throw conflict("답을 기다리는 취소 제안이 아닙니다.");
        }
        if (action === "withdraw") {
          if (target.proposedBy !== userId) {
            throw new AppError(
              403,
              "FORBIDDEN",
              "제안한 사람만 거둘 수 있습니다.",
            );
          }
          await tx.cancellation.update({
            where: { id: cancellationId },
            data: { status: "WITHDRAWN" },
          });
          return null;
        }
        if (target.proposedBy === userId) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "제안한 사람은 직접 승인·거절할 수 없습니다.",
          );
        }
        if (action === "reject") {
          await tx.cancellation.update({
            where: { id: cancellationId },
            data: {
              status: "REJECTED",
              respondedBy: userId,
              respondedAt: now(),
            },
          });
          await notify(tx, [
            {
              recipientUserId: target.proposedBy,
              type: "CANCELLATION_REJECTED",
              eventKey: `cancellation:${cancellationId}:rejected`,
              title: "취소 제안이 거절되었습니다",
              body: "계약은 그대로 진행됩니다.",
              workRequestId: contract.workRequestId,
            },
          ]);
          return null;
        }

        // 승인: 제안 뒤 결제가 끝났으면 금액이 맞지 않으므로 다시 제안해야 한다.
        const payment = paidPayment(contract);
        const paid = payment?.amountKrw ?? 0n;
        if (target.completedWorkKrw + target.refundKrw !== paid) {
          throw conflict("결제 금액이 바뀌었습니다. 취소를 다시 제안해주세요.");
        }
        if (target.refundKrw > 0n && !toss) throw tossUnavailable();
        await tx.cancellation.update({
          where: { id: cancellationId },
          data: { status: "ACCEPTED", respondedBy: userId, respondedAt: now() },
        });
        await tx.contract.update({
          where: { id: contractId },
          data: { status: "CANCELED" },
        });
        await tx.production.updateMany({
          where: { contractId },
          data: { status: "CANCELED" },
        });
        // 승인 전 주문(READY)은 닫는다(결제 중인 주문이 있으면 제안 단계에서 막았다).
        await tx.payment.updateMany({
          where: { contractId, status: "READY" },
          data: { status: "CANCELED", failureCode: "CONTRACT_CANCELED" },
        });
        await notify(tx, [
          {
            recipientUserId: target.proposedBy,
            type: "CANCELLATION_ACCEPTED",
            eventKey: `cancellation:${cancellationId}:accepted`,
            title: "취소 합의가 승인되었습니다",
            body:
              target.refundKrw > 0n
                ? `환불 ${won(target.refundKrw)}을 요청합니다.`
                : "계약이 취소되었습니다.",
            workRequestId: contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          contract.workRequestId,
          `cancellation:${cancellationId}:accepted`,
          `양측이 계약 취소에 합의했습니다. 완료 작업 대가 ${won(target.completedWorkKrw)}, 환불 ${won(target.refundKrw)}.`,
        );
        if (payment && target.refundKrw > 0n) {
          // 1단계: 승인과 환불 시도를 함께 커밋한다. Toss 호출은 커밋 뒤에 한다.
          const refund = await tx.refund.create({
            data: {
              contractId,
              cancellationId,
              paymentId: payment.id,
              amountKrw: target.refundKrw,
            },
          });
          return refund.id;
        }
        await settleIfReady(tx, contractId);
        return null;
      });
      if (refundId === null) {
        return inTransaction((tx) => overviewOf(tx, contractId));
      }
      return dispatchThenOverview(contractId, refundId);
    },

    // REFUND-01: 실패한 환불을 새 시도로 다시 요청한다(같은 시도는 Toss가 같은 결과를 준다).
    async retryRefund(user, contractId) {
      if (!toss) throw tossUnavailable();
      const refundId = await inTransaction(async (tx) => {
        const { contract } = await lock(tx, user, contractId);
        const { refund } = acceptedOf(contract);
        if (!refund || refund.status !== "FAILED") {
          throw conflict("실패한 환불만 다시 요청할 수 있습니다.");
        }
        // 1단계: 새 시도 번호(새 멱등 키)를 먼저 커밋한다.
        await tx.refund.update({
          where: { id: refund.id },
          data: { status: "REQUESTED", attempt: refund.attempt + 1 },
        });
        return refund.id;
      });
      return dispatchThenOverview(contractId, refundId);
    },

    // 결과가 불명확한 환불은 Toss 주문 조회로 맞춘다. 취소되지 않았으면 FAILED로 두어 재시도할 수 있게 한다.
    async syncRefund(user, contractId) {
      return inTransaction(async (tx) => {
        const { contract } = await lock(tx, user, contractId);
        const { refund } = acceptedOf(contract);
        if (
          !refund ||
          (refund.status !== "UNKNOWN" && refund.status !== "REQUESTED")
        ) {
          return overviewOf(tx, contractId);
        }
        // 방금 보낸 시도는 Toss 응답을 기다리는 중일 수 있다. 그때 "취소 기록 없음"으로 실패 처리하면
        // 재시도가 새 멱등 키로 한 번 더 환불할 수 있으므로, 응답 대기 시간이 지난 뒤에만 조회로 판정한다.
        if (
          refund.status === "REQUESTED" &&
          now().getTime() - refund.updatedAt.getTime() < REFUND_SYNC_GRACE_MS
        ) {
          return overviewOf(tx, contractId);
        }
        if (!toss) throw tossUnavailable();
        const payment = contract.payments.find(
          (p) => p.id === refund.paymentId,
        );
        if (!payment) throw conflict("환불할 결제를 찾을 수 없습니다.");
        const outcome = await toss.getByOrderId(payment.orderId);
        const notCanceled =
          outcome.kind === "payment" &&
          outcome.payment.orderId === payment.orderId &&
          outcome.payment.status === "DONE" &&
          outcome.payment.balanceAmount === Number(payment.amountKrw);
        const result = notCanceled
          ? {
              status: "FAILED",
              failureCode: "NOT_CANCELED",
              failureMessage:
                "결제사에 취소 기록이 없습니다. 다시 요청해주세요.",
            }
          : refundResult(outcome, payment, refund.amountKrw);
        if (result.status === "FAILED" && !notCanceled) {
          // 조회 응답의 거절은 환불 실패의 근거가 아니다.
          return overviewOf(tx, contractId);
        }
        await applyRefund(tx, contract, refund, result);
        return overviewOf(tx, contractId);
      });
    },

    // 합의한 인도 파일을 받았는지 의뢰인이 확인한다. 이후 잔여 대가를 정산한다.
    async confirmHandover(user, contractId) {
      return inTransaction(async (tx) => {
        const { userId, contract } = await lock(tx, user, contractId);
        if (userId !== contract.clientId) {
          throw new AppError(403, "FORBIDDEN", "의뢰인만 확인할 수 있습니다.");
        }
        const accepted = acceptedOf(contract);
        if (accepted.deliveredFiles.length === 0) {
          throw conflict("인도하기로 한 파일이 없습니다.");
        }
        if (accepted.handoverConfirmedAt) {
          throw conflict("이미 확인했습니다.");
        }
        await tx.cancellation.update({
          where: { id: accepted.id },
          data: { handoverConfirmedAt: now() },
        });
        await settleIfReady(tx, contractId);
        return overviewOf(tx, contractId);
      });
    },

    // DISPUTE-01: 분쟁 신고. 열려 있는 동안 정산하지 않는다(대화·증빙 제출은 계속).
    async openDispute(user, contractId, input) {
      const data = disputeCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, otherId, contract } = await lock(tx, user, contractId);
        if (contract.settlement) {
          throw conflict("정산이 끝난 거래입니다.");
        }
        await requireEvidenceFiles(
          tx,
          userId,
          contract.workRequestId,
          data.fileIds,
        );
        let dispute: { id: bigint };
        try {
          dispute = await tx.dispute.create({
            data: {
              contractId,
              openedBy: userId,
              reason: data.reason,
              evidence: {
                create: {
                  submittedBy: userId,
                  note: data.reason,
                  files: {
                    create: [...new Set(data.fileIds)].map((id) => ({
                      fileId: BigInt(id),
                    })),
                  },
                },
              },
            },
            select: { id: true },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw conflict("처리 중인 분쟁이 이미 있습니다.");
          }
          throw err;
        }
        await notify(tx, [
          {
            recipientUserId: otherId,
            type: "DISPUTE_OPENED",
            eventKey: `dispute:${dispute.id}:opened`,
            title: "거래에 분쟁이 접수되었습니다",
            body: "운영자가 확인할 때까지 정산이 보류됩니다. 대화와 증빙 제출은 계속할 수 있습니다.",
            workRequestId: contract.workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          contract.workRequestId,
          `dispute:${dispute.id}:opened`,
          "분쟁이 접수되었습니다. 운영자 확인 전까지 정산이 보류됩니다.",
        );
        return overviewOf(tx, contractId);
      });
    },

    async addEvidence(user, contractId, disputeId, input) {
      const data = disputeEvidenceSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, contract } = await lock(tx, user, contractId);
        const dispute = await tx.dispute.findUnique({
          where: { id: disputeId },
        });
        if (!dispute || dispute.contractId !== contractId) {
          throw notFound("분쟁");
        }
        if (dispute.status !== "OPEN")
          throw conflict("처리가 끝난 분쟁입니다.");
        await requireEvidenceFiles(
          tx,
          userId,
          contract.workRequestId,
          data.fileIds,
        );
        await tx.disputeEvidence.create({
          data: {
            disputeId,
            submittedBy: userId,
            note: data.note,
            files: {
              create: [...new Set(data.fileIds)].map((id) => ({
                fileId: BigInt(id),
              })),
            },
          },
        });
        return overviewOf(tx, contractId);
      });
    },

    // OPS-01: 운영자 분쟁 목록(열린 것 먼저)
    async listDisputes(user) {
      requireAdmin(user);
      const rows = await prisma.dispute.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        include: includeDispute,
        take: 100,
      });
      return { items: rows.map(toDispute) };
    },

    async getDispute(user, disputeId) {
      requireAdmin(user);
      const row = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: includeDispute,
      });
      if (!row) throw notFound("분쟁");
      return toDispute(row);
    },

    // OPS-01: 분쟁을 닫고 근거를 남긴다. 지급·환불을 대신 실행하지 않는다(당사자 합의·정상 흐름으로 진행).
    async resolveDispute(user, disputeId, input) {
      const adminId = requireAdmin(user);
      const { reason } = disputeResolveSchema.parse(input);
      return inTransaction(async (tx) => {
        // 잠금 순서: 계약 → 분쟁(신고·정산 등 다른 작업과 같은 순서).
        const target = await tx.dispute.findUnique({
          where: { id: disputeId },
          select: { contractId: true },
        });
        if (!target) throw notFound("분쟁");
        await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${target.contractId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM disputes WHERE id = ${disputeId} FOR UPDATE`;
        const dispute = await tx.dispute.findUnique({
          where: { id: disputeId },
          include: {
            contract: {
              select: { clientId: true, creatorId: true, workRequestId: true },
            },
          },
        });
        if (!dispute) throw notFound("분쟁");
        if (dispute.status !== "OPEN")
          throw conflict("처리가 끝난 분쟁입니다.");
        await tx.dispute.update({
          where: { id: disputeId },
          data: {
            status: "RESOLVED",
            resolution: reason,
            resolvedBy: adminId,
            resolvedAt: now(),
          },
        });
        await tx.operationRecord.create({
          data: {
            adminId,
            targetType: "DISPUTE",
            targetId: disputeId,
            action: "RESOLVE",
            reason,
          },
        });
        const { contract } = dispute;
        await notify(
          tx,
          [contract.clientId, contract.creatorId].map(
            (recipientUserId): NotificationInput => ({
              recipientUserId,
              type: "DISPUTE_RESOLVED",
              eventKey: `dispute:${disputeId}:resolved`,
              title: "분쟁 처리 결과를 알려드립니다",
              body: reason.slice(0, 200),
              workRequestId: contract.workRequestId,
            }),
          ),
        );
        await postSystemMessage(
          tx,
          contract.workRequestId,
          `dispute:${disputeId}:resolved`,
          `운영자가 분쟁을 처리했습니다: ${reason}`,
        );
        // 보류가 풀렸으면 정산을 이어서 한다.
        await settleIfReady(tx, dispute.contractId);
        return toDispute(
          await tx.dispute.findUniqueOrThrow({
            where: { id: disputeId },
            include: includeDispute,
          }),
        );
      });
    },

    async listOperationRecords(user) {
      requireAdmin(user);
      const rows = await prisma.operationRecord.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
      return {
        items: rows.map((row) => ({
          id: row.id.toString(),
          adminId: row.adminId.toString(),
          targetType: row.targetType,
          targetId: row.targetId.toString(),
          action: row.action,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
  };
}
