-- 단계 7: 취소 합의·부분 환불·분쟁·운영 기록 (CANCEL-01~02, REFUND-01, DISPUTE-01, OPS-01)
-- CreateTable
CREATE TABLE "cancellations" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "proposed_by" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "completed_work_krw" BIGINT NOT NULL,
    "refund_krw" BIGINT NOT NULL,
    "unfinished_state" TEXT,
    "usage_rights" TEXT,
    "responded_by" BIGINT,
    "responded_at" TIMESTAMPTZ(3),
    "handover_confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cancellation_files" (
    "cancellation_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,

    CONSTRAINT "cancellation_files_pkey" PRIMARY KEY ("cancellation_id","file_id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "cancellation_id" BIGINT NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "amount_krw" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "opened_by" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "resolution" TEXT,
    "resolved_by" BIGINT,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence" (
    "id" BIGSERIAL NOT NULL,
    "dispute_id" BIGINT NOT NULL,
    "submitted_by" BIGINT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispute_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispute_evidence_files" (
    "evidence_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,

    CONSTRAINT "dispute_evidence_files_pkey" PRIMARY KEY ("evidence_id","file_id")
);

-- CreateTable
CREATE TABLE "operation_records" (
    "id" BIGSERIAL NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cancellations_contract_id_version_no_key" ON "cancellations"("contract_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_cancellation_id_key" ON "refunds"("cancellation_id");

-- CreateIndex
CREATE INDEX "disputes_status_created_at_idx" ON "disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "dispute_evidence_dispute_id_created_at_idx" ON "dispute_evidence"("dispute_id", "created_at");

-- CreateIndex
CREATE INDEX "operation_records_target_type_target_id_idx" ON "operation_records"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_files" ADD CONSTRAINT "cancellation_files_cancellation_id_fkey" FOREIGN KEY ("cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cancellation_files" ADD CONSTRAINT "cancellation_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_cancellation_id_fkey" FOREIGN KEY ("cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_fkey" FOREIGN KEY ("dispute_id") REFERENCES "disputes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_files" ADD CONSTRAINT "dispute_evidence_files_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "dispute_evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispute_evidence_files" ADD CONSTRAINT "dispute_evidence_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_records" ADD CONSTRAINT "operation_records_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── 상태 값 확장 ───
ALTER TABLE "contracts" DROP CONSTRAINT "contracts_status_check";
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_status_check" CHECK ("status" IN ('SIGNED', 'CANCELED'));
ALTER TABLE "productions" DROP CONSTRAINT "productions_status_check";
ALTER TABLE "productions" ADD CONSTRAINT "productions_status_check" CHECK ("status" IN ('PREPARING', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELED'));
-- 시작 전에 취소될 수 있으므로 CANCELED는 시작 여부와 무관하다. 시작 시각과 마감일은 함께 있다.
ALTER TABLE "productions" DROP CONSTRAINT "productions_started_check";
ALTER TABLE "productions" ADD CONSTRAINT "productions_started_check" CHECK ((("status" = 'PREPARING' AND "started_at" IS NULL) OR ("status" IN ('IN_PROGRESS', 'DELIVERED', 'COMPLETED') AND "started_at" IS NOT NULL) OR "status" = 'CANCELED') AND ("started_at" IS NULL) = ("due_date" IS NULL));
ALTER TABLE "files" DROP CONSTRAINT "files_purpose_check";
ALTER TABLE "files" ADD CONSTRAINT "files_purpose_check" CHECK ("purpose" IN ('PROFILE_IMAGE', 'PORTFOLIO', 'CHAT_ATTACHMENT', 'MATERIAL', 'DELIVERABLE', 'REVISION', 'EVIDENCE'));

-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_status_check" CHECK ("status" IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN'));
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_amounts_check" CHECK ("completed_work_krw" >= 0 AND "refund_krw" >= 0);
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_responded_check" CHECK (("status" IN ('ACCEPTED', 'REJECTED')) = ("responded_at" IS NOT NULL) AND ("responded_at" IS NULL) = ("responded_by" IS NULL));
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_not_self_check" CHECK ("responded_by" IS NULL OR "responded_by" <> "proposed_by");
-- 계약당 대기 중인 제안·승인된 합의는 하나뿐이다.
CREATE UNIQUE INDEX "cancellations_one_proposed_idx" ON "cancellations" ("contract_id") WHERE "status" = 'PROPOSED';
CREATE UNIQUE INDEX "cancellations_one_accepted_idx" ON "cancellations" ("contract_id") WHERE "status" = 'ACCEPTED';

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_status_check" CHECK ("status" IN ('REQUESTED', 'UNKNOWN', 'SUCCEEDED', 'FAILED'));
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("amount_krw" > 0 AND "attempt" >= 1);

ALTER TABLE "disputes" ADD CONSTRAINT "disputes_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED'));
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_check" CHECK (("status" = 'RESOLVED') = ("resolved_at" IS NOT NULL) AND ("resolved_at" IS NULL) = ("resolved_by" IS NULL) AND ("resolved_at" IS NULL) = ("resolution" IS NULL));
-- 계약당 열린 분쟁은 하나뿐이다.
CREATE UNIQUE INDEX "disputes_one_open_idx" ON "disputes" ("contract_id") WHERE "status" = 'OPEN';

-- 알림 종류 추가 (취소 제안·승인·거절, 환불 완료, 분쟁 신고·처리)
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'DISCUSSION_REQUESTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'APPLICATION_WITHDRAWN', 'PROJECT_ENDED_NO_SELECTION', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED', 'PAYMENT_SUCCEEDED', 'DELIVERABLE_SUBMITTED', 'REVISION_REQUESTED', 'DELIVERABLE_APPROVED', 'DELIVERY_RECEIVED', 'REVIEW_RECEIVED', 'DIRECT_REQUEST_RECEIVED', 'DIRECT_REQUEST_ACCEPTED', 'DIRECT_REQUEST_DECLINED', 'DIRECT_REQUEST_EXPIRED', 'CANCELLATION_PROPOSED', 'CANCELLATION_ACCEPTED', 'CANCELLATION_REJECTED', 'REFUND_SUCCEEDED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED'));

-- ─── Supabase Data API 차단 ───
ALTER TABLE "cancellations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cancellation_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dispute_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dispute_evidence_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operation_records" ENABLE ROW LEVEL SECURITY;
