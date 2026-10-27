import { z } from "zod";

// Toss Payments API (https://docs.tosspayments.com/reference). 테스트 키로 부르면 실제 돈은 움직이지 않는다.
const TOSS_API_BASE = "https://api.tosspayments.com";

// 요청 하나(연결·응답 본문 읽기 전체)의 제한 시간 [제안]. 승인 API가 늦어도 결과는 조회로 다시 맞춘다.
export const TOSS_TIMEOUT_MS = 10_000;

const tossPaymentSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  // READY, IN_PROGRESS, WAITING_FOR_DEPOSIT, DONE, CANCELED, PARTIAL_CANCELED, ABORTED, EXPIRED
  status: z.string(),
  totalAmount: z.number(),
  approvedAt: z.string().nullable().optional(),
  method: z.string().nullable().optional(),
  // 취소 뒤 남은 금액(부분 취소 확인용)
  balanceAmount: z.number().optional(),
});
export type TossPayment = z.infer<typeof tossPaymentSchema>;

const tossErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// Toss 응답을 세 가지로 나눈다.
// - payment: 결제 객체를 받음(승인 성공만이 아니라 조회 결과의 모든 상태)
// - rejected: Toss가 오류 코드로 거절함(4xx·5xx에 code가 있음)
// - unavailable: 응답을 받지 못했거나 형식을 알 수 없음(시간 초과·네트워크·잘못된 본문). 결과가 불명확하다.
export type TossOutcome =
  | { kind: "payment"; payment: TossPayment }
  | { kind: "rejected"; httpStatus: number; code: string; message: string }
  | { kind: "unavailable" };

export interface TossClient {
  confirm(input: {
    paymentKey: string;
    orderId: string;
    amount: number;
    // 같은 키의 재요청은 Toss가 처음 결과를 돌려준다(15일 유지).
    idempotencyKey: string;
  }): Promise<TossOutcome>;
  getByOrderId(orderId: string): Promise<TossOutcome>;
  // 결제 (부분) 취소. 같은 멱등 키의 재요청은 처음 결과를 돌려준다.
  cancel(input: {
    paymentKey: string;
    cancelAmount: number;
    cancelReason: string;
    idempotencyKey: string;
  }): Promise<TossOutcome>;
}

export function createTossClient({
  secretKey,
  fetchFn = fetch,
  timeoutMs = TOSS_TIMEOUT_MS,
}: {
  secretKey: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): TossClient {
  // 시크릿 키 뒤에 콜론을 붙여 base64로 인코딩한다(Basic 인증). 키는 로그·응답에 남기지 않는다.
  const authorization = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

  async function call(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string },
  ): Promise<TossOutcome> {
    let response: Response;
    let raw: unknown;
    try {
      response = await fetchFn(`${TOSS_API_BASE}${path}`, {
        method: init.method,
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          ...(init.idempotencyKey
            ? { "Idempotency-Key": init.idempotencyKey }
            : {}),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      raw = await response.json();
    } catch {
      console.warn("[payments] Toss request failed", { path: init.method });
      return { kind: "unavailable" };
    }
    if (response.ok) {
      const payment = tossPaymentSchema.safeParse(raw);
      return payment.success
        ? { kind: "payment", payment: payment.data }
        : { kind: "unavailable" };
    }
    const error = tossErrorSchema.safeParse(raw);
    console.warn("[payments] Toss returned an error", {
      status: response.status,
      code: error.success ? error.data.code : null,
    });
    // 5xx는 Toss 내부 문제라 결과를 알 수 없다고 본다(승인이 실제로 됐을 수 있다).
    if (!error.success || response.status >= 500)
      return { kind: "unavailable" };
    return {
      kind: "rejected",
      httpStatus: response.status,
      code: error.data.code,
      message: error.data.message,
    };
  }

  return {
    confirm: ({ paymentKey, orderId, amount, idempotencyKey }) =>
      call("/v1/payments/confirm", {
        method: "POST",
        body: { paymentKey, orderId, amount },
        idempotencyKey,
      }),
    getByOrderId: (orderId) =>
      call(`/v1/payments/orders/${encodeURIComponent(orderId)}`, {
        method: "GET",
      }),
    cancel: ({ paymentKey, cancelAmount, cancelReason, idempotencyKey }) =>
      call(`/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
        method: "POST",
        body: { cancelAmount, cancelReason },
        idempotencyKey,
      }),
  };
}
