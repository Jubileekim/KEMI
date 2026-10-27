-- PRD v2.0 PAY-01·02: 계약 전액 테스트 결제 주문 (Toss Sandbox, docs/decisions/2026-10-26-payments.md)
-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount_krw" BIGINT NOT NULL,
    "order_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "payment_key" TEXT,
    "method" TEXT,
    "approved_at" TIMESTAMPTZ(3),
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_key_key" ON "payments"("payment_key");

-- CreateIndex
CREATE INDEX "payments_contract_id_created_at_idx" ON "payments"("contract_id", "created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_check" CHECK ("status" IN ('READY', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELED'));
-- Toss orderId 규칙: 6~64자, 영문·숫자·-·_
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_check" CHECK ("order_id" ~ '^[A-Za-z0-9_-]{6,64}$');
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount_krw" BETWEEN 1 AND 1000000000);
-- 승인 완료 주문은 PG 결제 키와 승인 시각이 있다.
ALTER TABLE "payments" ADD CONSTRAINT "payments_succeeded_check" CHECK ("status" <> 'SUCCEEDED' OR ("payment_key" IS NOT NULL AND "approved_at" IS NOT NULL));

-- 계약당 진행 중이거나 성공한 주문은 하나뿐이다. 실패·취소 주문만 여러 개 남을 수 있다.
CREATE UNIQUE INDEX "payments_one_active_idx" ON "payments" ("contract_id") WHERE "status" IN ('READY', 'UNKNOWN', 'SUCCEEDED');

-- 새 알림 종류 (결제 완료 → 크리에이터). 기존 값은 그대로 둔다.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'APPLICATION_ACCEPTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED', 'PAYMENT_SUCCEEDED'));

-- ─── Supabase Data API 차단 ───
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
