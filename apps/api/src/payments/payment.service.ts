import {
  ACTIVE_PAYMENT_STATUSES,
  type AuthUser,
  type PaymentListResponse,
  type PaymentOrder,
  type PaymentStatus,
  paymentConfirmSchema,
  paymentCreateSchema,
  paymentFailSchema,
  paymentStatusSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import notify from "../notifications/notify.js";
import type { TossClient, TossOutcome, TossPayment } from "./toss.js";

type Tx = Prisma.TransactionClient;
type PaymentRow = Prisma.PaymentGetPayload<object>;

// 승인 API 호출(최대 10초)과 이미 처리된 결제의 조회(최대 10초)를 잠금 안에서 기다릴 수 있게 둔다.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const ORDER_NAME_MAX = 100;

// Toss가 승인 키 문제로 거절하면 서버 설정 오류다. 주문 상태를 바꾸지 않는다.
const CONFIG_ERROR_CODES = new Set([
  "UNAUTHORIZED_KEY",
  "INVALID_API_KEY",
  "INCORRECT_BASIC_AUTH_FORMAT",
]);

function toOrder(row: PaymentRow): PaymentOrder {
  return {
    orderId: row.orderId,
    contractId: row.contractId.toString(),
    amountKrw: Number(row.amountKrw),
    orderName: row.orderName,
    status: paymentStatusSchema.parse(row.status),
    method: row.method,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    failureCode: row.failureCode,
    failureMessage: row.failureMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound(what: "계약" | "결제 주문"): AppError {
  return new AppError(404, "NOT_FOUND", `${what}을 찾을 수 없습니다.`);
}

function unavailable(): AppError {
  return new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "테스트 결제가 아직 설정되지 않았습니다.",
  );
}

const isActive = (status: string) =>
  ACTIVE_PAYMENT_STATUSES.some((active) => active === status);

// 주문에 저장할 결과. null이면 상태를 바꾸지 않는다.
interface Resolution {
  status: PaymentStatus;
  paymentKey?: string;
  method?: string | null;
  approvedAt?: Date | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

// Toss 결제 객체를 주문 상태로 줄인다. 어떤 상태든 주문 번호·금액이 저장한 값과 같을 때만 반영한다.
// 다르면 다른 결제의 결과일 수 있어 UNKNOWN으로 묶어 두고(새 주문 불가) 운영 확인을 기다린다.
function fromTossPayment(
  order: PaymentRow,
  payment: TossPayment,
): Resolution | null {
  const matches =
    payment.orderId === order.orderId &&
    payment.totalAmount === Number(order.amountKrw);
  const mismatch = (): Resolution => {
    console.warn("[payments] Toss payment did not match the order", {
      orderId: order.orderId,
      status: payment.status,
    });
    return {
      status: "UNKNOWN",
      failureCode: "PG_ORDER_MISMATCH",
      failureMessage:
        "결제사 조회 결과가 주문과 맞지 않습니다. 운영 확인이 필요합니다.",
    };
  };
  if (!matches) return mismatch();
  switch (payment.status) {
    case "DONE":
      if (!payment.approvedAt) return mismatch();
      return {
        status: "SUCCEEDED",
        paymentKey: payment.paymentKey,
        method: payment.method ?? null,
        approvedAt: new Date(payment.approvedAt),
        failureCode: null,
        failureMessage: null,
      };
    case "ABORTED":
    case "EXPIRED":
      return {
        status: "FAILED",
        failureCode: payment.status,
        failureMessage: "결제 승인이 완료되지 않았습니다.",
      };
    case "CANCELED":
      return { status: "CANCELED", failureCode: payment.status };
    case "PARTIAL_CANCELED":
      // 일부 금액이 결제된 채로 남아 있다. 새 결제를 열지 않고 운영 확인까지 보류한다.
      return {
        status: "UNKNOWN",
        failureCode: payment.status,
        failureMessage: "부분 취소된 결제입니다. 운영 확인이 필요합니다.",
      };
    default:
      // READY·IN_PROGRESS·WAITING_FOR_DEPOSIT: 아직 끝나지 않았다.
      return order.status === "UNKNOWN" ? null : { status: "UNKNOWN" };
  }
}

export interface PaymentService {
  list(user: AuthUser, contractId: bigint): Promise<PaymentListResponse>;
  create(
    user: AuthUser,
    contractId: bigint,
    input: unknown,
  ): Promise<{ created: boolean; order: PaymentOrder }>;
  confirm(user: AuthUser, input: unknown): Promise<PaymentOrder>;
  sync(user: AuthUser, orderId: string): Promise<PaymentOrder>;
  fail(user: AuthUser, orderId: string, input: unknown): Promise<PaymentOrder>;
}

export function createPaymentService({
  prisma,
  toss,
}: {
  prisma: PrismaClient;
  // 없으면(키 미설정) 주문·승인·조회는 503이고 내역 조회만 된다.
  toss?: TossClient;
}): PaymentService {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  function requireToss(): TossClient {
    if (!toss) throw unavailable();
    return toss;
  }

  // 계약 당사자만 접근한다. 다른 사람에게는 존재를 드러내지 않는다(404).
  function requireParty(
    user: AuthUser,
    contract: { clientId: bigint; creatorId: bigint } | null,
  ): bigint {
    const userId = BigInt(user.id);
    if (
      !contract ||
      (contract.clientId !== userId && contract.creatorId !== userId)
    ) {
      throw notFound("계약");
    }
    return userId;
  }

  // 결제는 의뢰인만 한다(PAY-01). 크리에이터는 내역만 본다.
  function requireClient(user: AuthUser, contract: { clientId: bigint }) {
    if (BigInt(user.id) !== contract.clientId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "계약의 의뢰인만 결제할 수 있습니다.",
      );
    }
  }

  // 주문을 계약 행 잠금 뒤에 읽는다. 같은 주문의 승인·조회·실패 처리가 하나씩 진행된다.
  async function lockOrder(tx: Tx, user: AuthUser, orderId: string) {
    const found = await tx.payment.findUnique({
      where: { orderId },
      select: {
        contractId: true,
        contract: { select: { clientId: true, creatorId: true } },
      },
    });
    if (!found) throw notFound("결제 주문");
    try {
      requireParty(user, found.contract);
    } catch {
      throw notFound("결제 주문");
    }
    await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${found.contractId} FOR UPDATE`;
    const order = await tx.payment.findUniqueOrThrow({ where: { orderId } });
    return { order, contract: found.contract };
  }

  async function apply(
    tx: Tx,
    order: PaymentRow,
    resolution: Resolution | null,
    creatorId: bigint,
  ): Promise<PaymentRow> {
    if (
      !resolution ||
      (resolution.status === order.status &&
        (resolution.failureCode ?? order.failureCode) === order.failureCode)
    ) {
      return order;
    }
    const updated = await tx.payment.update({
      where: { id: order.id },
      data: resolution,
    });
    if (updated.status === "SUCCEEDED") {
      await notify(tx, [
        {
          recipientUserId: creatorId,
          type: "PAYMENT_SUCCEEDED",
          eventKey: `payment:${updated.orderId}:succeeded`,
          title: "의뢰인이 결제를 완료했습니다",
          body: `${updated.orderName} 계약의 테스트 결제(${Number(updated.amountKrw).toLocaleString("ko-KR")}원)가 완료되었습니다.`,
        },
      ]);
    }
    return updated;
  }

  // 조회 결과를 반영한다. 결제가 없다는 응답(NOT_FOUND_PAYMENT)이면 승인되지 않은 것이다.
  function fromQuery(
    order: PaymentRow,
    outcome: TossOutcome,
  ): Resolution | null {
    if (outcome.kind === "payment") {
      return fromTossPayment(order, outcome.payment);
    }
    if (outcome.kind === "rejected" && outcome.code === "NOT_FOUND_PAYMENT") {
      return order.status === "UNKNOWN"
        ? {
            status: "FAILED",
            failureCode: outcome.code,
            failureMessage: "결제 승인 기록이 없습니다.",
          }
        : null;
    }
    if (outcome.kind === "rejected" && CONFIG_ERROR_CODES.has(outcome.code)) {
      throw unavailable();
    }
    return null;
  }

  return {
    // PAY-02: 계약의 결제 내역. 양 당사자가 볼 수 있다.
    async list(user, contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          payments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] },
        },
      });
      requireParty(user, contract);
      if (!contract) throw notFound("계약");
      return {
        contract: {
          id: contract.id.toString(),
          amountKrw: Number(contract.amountKrw),
          clientId: contract.clientId.toString(),
          creatorId: contract.creatorId.toString(),
        },
        items: contract.payments.map(toOrder),
      };
    },

    // PAY-01: 계약 전액으로 주문을 만든다. 금액은 서명된 계약에서만 가져온다(브라우저 값을 받지 않는다).
    async create(user, contractId, input) {
      const data = paymentCreateSchema.parse(input);
      requireToss();
      return inTransaction(async (tx) => {
        const found = await tx.contract.findUnique({
          where: { id: contractId },
          select: { clientId: true, creatorId: true },
        });
        requireParty(user, found);
        if (!found) throw notFound("계약");
        requireClient(user, found);
        await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId} FOR UPDATE`;
        const contract = await tx.contract.findUniqueOrThrow({
          where: { id: contractId },
          include: {
            project: { select: { title: true } },
            payments: true,
          },
        });

        // 같은 주문 요청의 재전송이면 이전 주문을 준다.
        const repeated = contract.payments.find(
          (p) => p.orderId === data.commandId,
        );
        if (repeated) return { created: false, order: toOrder(repeated) };
        if (
          await tx.payment.findUnique({ where: { orderId: data.commandId } })
        ) {
          throw new AppError(409, "CONFLICT", "이미 사용한 주문 식별자입니다.");
        }
        if (contract.status !== "SIGNED") {
          throw new AppError(
            409,
            "CONFLICT",
            "결제할 수 있는 계약이 아닙니다.",
          );
        }
        if (contract.payments.some((p) => isActive(p.status))) {
          throw new AppError(
            409,
            "CONFLICT",
            "진행 중이거나 완료된 결제가 있습니다. 기존 결제 결과를 먼저 확인해주세요.",
          );
        }
        const created = await tx.payment.create({
          data: {
            contractId,
            orderId: data.commandId,
            amountKrw: contract.amountKrw,
            orderName: (contract.project?.title ?? "KEMI 영상 제작").slice(
              0,
              ORDER_NAME_MAX,
            ),
            createdBy: contract.clientId,
          },
        });
        return { created: true, order: toOrder(created) };
      });
    },

    // PAY-01: Toss successUrl로 돌아온 값으로 승인한다. 금액이 저장한 주문 금액과 다르면 승인하지 않는다.
    async confirm(user, input) {
      const data = paymentConfirmSchema.parse(input);
      const client = requireToss();
      return inTransaction(async (tx) => {
        const { order, contract } = await lockOrder(tx, user, data.orderId);
        requireClient(user, contract);

        // 응답 유실 뒤 같은 승인을 다시 보내면 이전 결과를 준다.
        if (
          order.status === "SUCCEEDED" &&
          order.paymentKey === data.paymentKey
        ) {
          return toOrder(order);
        }
        if (order.status !== "READY" && order.status !== "UNKNOWN") {
          throw new AppError(409, "CONFLICT", "이미 처리된 결제 주문입니다.");
        }
        if (data.amount !== Number(order.amountKrw)) {
          throw new AppError(
            400,
            "VALIDATION_FAILED",
            "결제 금액이 주문 금액과 다릅니다.",
            [{ path: ["amount"] }],
          );
        }

        const outcome = await client.confirm({
          paymentKey: data.paymentKey,
          orderId: order.orderId,
          amount: Number(order.amountKrw),
          idempotencyKey: `confirm-${order.orderId}`,
        });
        let resolution: Resolution | null;
        if (outcome.kind === "payment") {
          resolution = fromTossPayment(order, outcome.payment);
        } else if (outcome.kind === "unavailable") {
          // 결과를 모른다. 실패로 처리하지 않고 조회(sync)로 맞춘다.
          resolution = { status: "UNKNOWN" };
        } else if (CONFIG_ERROR_CODES.has(outcome.code)) {
          throw unavailable();
        } else if (outcome.code === "ALREADY_PROCESSED_PAYMENT") {
          // 이미 처리된 결제: Toss에 저장된 결과를 조회해서 맞춘다.
          resolution = fromQuery(
            order,
            await client.getByOrderId(order.orderId),
          ) ?? { status: "UNKNOWN" };
        } else {
          resolution = {
            status: "FAILED",
            failureCode: outcome.code,
            failureMessage: outcome.message.slice(0, 500),
          };
        }
        return toOrder(await apply(tx, order, resolution, contract.creatorId));
      });
    },

    // PAY-02: 결과가 불명확한(UNKNOWN) 주문은 Toss 조회로 결과를 맞춘다. 브라우저 복귀 값은 증거로 쓰지 않는다.
    async sync(user, orderId) {
      const client = requireToss();
      return inTransaction(async (tx) => {
        const { order, contract } = await lockOrder(tx, user, orderId);
        if (order.status !== "READY" && order.status !== "UNKNOWN") {
          return toOrder(order);
        }
        const resolution = fromQuery(order, await client.getByOrderId(orderId));
        return toOrder(await apply(tx, order, resolution, contract.creatorId));
      });
    },

    // Toss failUrl로 돌아온 경우(사용자 취소·인증 실패). 브라우저 값은 사용자 의사 기록·조회 계기로만 쓴다.
    // Toss 조회로 결제 기록이 없거나(NOT_FOUND_PAYMENT) 미승인으로 끝났음을 확인해야 주문을 닫는다.
    // 그 전에는 UNKNOWN으로 묶어 새 주문(이중 결제)을 막는다.
    async fail(user, orderId, input) {
      const data = paymentFailSchema.parse(input);
      return inTransaction(async (tx) => {
        const { order, contract } = await lockOrder(tx, user, orderId);
        requireClient(user, contract);
        // 이미 결과가 정해진 주문(늦게 온 fail 콜백)은 그대로 준다.
        if (order.status !== "READY" && order.status !== "UNKNOWN") {
          return toOrder(order);
        }
        const reported = {
          failureCode: data.code,
          failureMessage: data.message ?? null,
        };
        let resolution: Resolution = { status: "UNKNOWN", ...reported };
        const outcome: TossOutcome = toss
          ? await toss.getByOrderId(order.orderId)
          : { kind: "unavailable" };
        if (
          outcome.kind === "rejected" &&
          outcome.code === "NOT_FOUND_PAYMENT"
        ) {
          resolution = {
            status:
              data.code === "PAY_PROCESS_CANCELED" ? "CANCELED" : "FAILED",
            ...reported,
          };
        } else if (outcome.kind === "payment") {
          const fromPg = fromTossPayment(order, outcome.payment);
          // 아직 진행 중(READY·IN_PROGRESS)이면 브라우저가 알린 코드를 남기고 UNKNOWN으로 둔다.
          if (fromPg && (fromPg.status !== "UNKNOWN" || fromPg.failureCode)) {
            resolution = fromPg;
          }
        }
        // 조회 실패·키 오류·그 밖의 거절은 결과를 모르는 것이다(UNKNOWN). 나중에 sync로 맞춘다.
        return toOrder(await apply(tx, order, resolution, contract.creatorId));
      });
    },
  };
}
