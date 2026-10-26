import { z } from "zod";

// 테스트 결제 주문 상태 (PAY-01·02). Toss Sandbox 결과를 이 값으로 줄여 저장한다.
// READY(주문 생성, 승인 전) → SUCCEEDED(승인 완료) / FAILED(승인 거절·만료) / CANCELED(사용자 취소)
// UNKNOWN: 승인을 요청했지만 결과를 확인하지 못함(시간 초과 등). PG 조회로 결과를 맞춘다.
export const PAYMENT_STATUSES = [
  "READY",
  "UNKNOWN",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// 계약당 동시에 하나만 있을 수 있는 상태(결과가 아직 끝나지 않았거나 이미 성공한 주문)
export const ACTIVE_PAYMENT_STATUSES = [
  "READY",
  "UNKNOWN",
  "SUCCEEDED",
] as const satisfies readonly PaymentStatus[];

// 주문 생성. commandId가 그대로 Toss orderId가 된다(UUID 36자, Toss 규칙 6~64자·영문·숫자·-·_).
export const paymentCreateSchema = z.strictObject({
  commandId: z.uuid(),
});
export type PaymentCreateRequest = z.input<typeof paymentCreateSchema>;

// Toss successUrl로 돌아온 값. 서버가 저장한 주문 금액과 같은지 먼저 확인한 뒤 승인한다.
export const paymentConfirmSchema = z.strictObject({
  paymentKey: z.string().min(1).max(200),
  orderId: z.uuid(),
  amount: z.int().min(1).max(1_000_000_000),
});
export type PaymentConfirmRequest = z.input<typeof paymentConfirmSchema>;

// Toss failUrl로 돌아온 값(사용자 취소·인증 실패). 서버가 Toss 조회로 확인한 뒤에만 주문을 닫는다.
export const paymentFailSchema = z.strictObject({
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().max(500).optional(),
});
export type PaymentFailRequest = z.input<typeof paymentFailSchema>;

export interface PaymentOrder {
  orderId: string;
  contractId: string;
  amountKrw: number;
  // 결제창에 보이는 주문 이름
  orderName: string;
  status: PaymentStatus;
  method: string | null;
  approvedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListResponse {
  contract: {
    id: string;
    amountKrw: number;
    clientId: string;
    creatorId: string;
  };
  // 최근 주문부터
  items: PaymentOrder[];
}
