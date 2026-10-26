-- 단계 5: 검토·수정·최종 수령·모의 정산·리뷰 (DEL-01~05, REV-01~02, SETTLE-01, REVIEW-01)
-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "fee_rate_bps" INTEGER NOT NULL DEFAULT 1000;

-- AlterTable
ALTER TABLE "productions" ADD COLUMN     "revision_limit" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "deliverables" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "note" TEXT,
    "resolves_revision_request_id" BIGINT,
    "command_id" UUID NOT NULL,
    "submitted_by" BIGINT NOT NULL,
    "approved_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverable_files" (
    "deliverable_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,

    CONSTRAINT "deliverable_files_pkey" PRIMARY KEY ("deliverable_id","file_id")
);

-- CreateTable
CREATE TABLE "revision_requests" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "deliverable_id" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "items" JSONB NOT NULL,
    "note" TEXT,
    "command_id" UUID NOT NULL,
    "requested_by" BIGINT NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_files" (
    "revision_request_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,

    CONSTRAINT "revision_files_pkey" PRIMARY KEY ("revision_request_id","file_id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "contract_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIMULATED',
    "gross_krw" BIGINT NOT NULL,
    "fee_rate_bps" INTEGER NOT NULL,
    "fee_krw" BIGINT NOT NULL,
    "payout_krw" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("contract_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "reviewer_id" BIGINT NOT NULL,
    "reviewee_id" BIGINT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_resolves_revision_request_id_key" ON "deliverables"("resolves_revision_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_command_id_key" ON "deliverables"("command_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_contract_id_version_no_key" ON "deliverables"("contract_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "revision_requests_command_id_key" ON "revision_requests"("command_id");

-- CreateIndex
CREATE INDEX "revision_requests_contract_id_created_at_idx" ON "revision_requests"("contract_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_created_at_idx" ON "reviews"("reviewee_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_contract_id_reviewer_id_key" ON "reviews"("contract_id", "reviewer_id");

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "productions"("contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_resolves_revision_request_id_fkey" FOREIGN KEY ("resolves_revision_request_id") REFERENCES "revision_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_files" ADD CONSTRAINT "deliverable_files_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverable_files" ADD CONSTRAINT "deliverable_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "productions"("contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "deliverables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_files" ADD CONSTRAINT "revision_files_revision_request_id_fkey" FOREIGN KEY ("revision_request_id") REFERENCES "revision_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_files" ADD CONSTRAINT "revision_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_fee_rate_bps_check" CHECK ("fee_rate_bps" BETWEEN 0 AND 10000);
ALTER TABLE "productions" ADD CONSTRAINT "productions_revision_limit_check" CHECK ("revision_limit" BETWEEN 0 AND 10);
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_kind_check" CHECK ("kind" IN ('DRAFT', 'REVIEW', 'FINAL'));
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_status_check" CHECK ("status" IN ('SUBMITTED', 'APPROVED', 'REVISION_REQUESTED', 'SUPERSEDED', 'RECEIVED'));
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_version_no_check" CHECK ("version_no" >= 1);
-- 승인은 검토본만, 수령 확인은 최종본만
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_approved_check" CHECK ("approved_at" IS NULL OR "kind" = 'REVIEW');
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_received_check" CHECK (("status" = 'RECEIVED') = ("received_at" IS NOT NULL) AND ("received_at" IS NULL OR "kind" = 'FINAL'));
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_type_check" CHECK ("type" IN ('GENERAL', 'DRAFT_FEEDBACK', 'CONTRACT_FIX'));
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED'));
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_resolved_check" CHECK (("status" = 'RESOLVED') = ("resolved_at" IS NOT NULL));
ALTER TABLE "revision_requests" ADD CONSTRAINT "revision_requests_items_check" CHECK (jsonb_typeof("items") = 'array' AND jsonb_array_length("items") BETWEEN 1 AND 30);
-- 계약당 수정본을 기다리는 요청은 하나뿐이다.
CREATE UNIQUE INDEX "revision_requests_one_open_idx" ON "revision_requests" ("contract_id") WHERE "status" = 'OPEN';
-- 계약당 최종본 수령 확인은 한 번뿐이다.
CREATE UNIQUE INDEX "deliverables_one_received_idx" ON "deliverables" ("contract_id") WHERE "status" = 'RECEIVED';
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_status_check" CHECK ("status" IN ('SIMULATED'));
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_amounts_check" CHECK ("gross_krw" > 0 AND "fee_krw" >= 0 AND "payout_krw" >= 0 AND "fee_krw" + "payout_krw" = "gross_krw");
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_not_self_check" CHECK ("reviewer_id" <> "reviewee_id");

-- 알림 종류 추가 (납품 제출·수정 요청·검토본 승인·최종 수령·리뷰)
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'DISCUSSION_REQUESTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'APPLICATION_WITHDRAWN', 'PROJECT_ENDED_NO_SELECTION', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED', 'PAYMENT_SUCCEEDED', 'DELIVERABLE_SUBMITTED', 'REVISION_REQUESTED', 'DELIVERABLE_APPROVED', 'DELIVERY_RECEIVED', 'REVIEW_RECEIVED'));

-- ─── Supabase Data API 차단 ───
ALTER TABLE "deliverables" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deliverable_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revision_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revision_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;
