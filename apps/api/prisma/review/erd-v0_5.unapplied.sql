-- REVIEW ONLY: ERD v0.5 baseline, NOT PRD v1.4 complete.
-- NOT APPLIED. Generated from empty schema without connecting to the database.
-- Missing PRD models, CHECK/partial uniqueness constraints and RLS policies.
-- Read README.md before preparing any migration.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CLIENT', 'CREATOR');

-- CreateEnum
CREATE TYPE "niche_category" AS ENUM ('BEAUTY', 'FOOD', 'LIFESTYLE', 'TECH', 'OTHER');

-- CreateEnum
CREATE TYPE "content_style" AS ENUM ('MODERN', 'BRIGHT', 'EMOTIONAL', 'PROFESSIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "recruitment_status" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "request_type" AS ENUM ('PROJECT_APPLICATION', 'DIRECT_REQUEST');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('PENDING', 'SELECTED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "offer_status" AS ENUM ('NONE', 'PENDING', 'AGREED', 'DECLINED');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('DRAFT', 'SIGNED', 'IN_PROGRESS', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "deliverable_status" AS ENUM ('SUBMITTED', 'CHANGES_REQUESTED', 'SUPERSEDED', 'APPROVED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'FAILED', 'PAID_HELD', 'SETTLED');

-- CreateEnum
CREATE TYPE "payment_event_type" AS ENUM ('PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'SETTLEMENT_RECORDED');

-- CreateEnum
CREATE TYPE "ledger_account_type" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE');

-- CreateEnum
CREATE TYPE "ledger_transaction_type" AS ENUM ('PAYMENT_CAPTURED', 'SETTLEMENT_RELEASED');

-- CreateEnum
CREATE TYPE "ledger_entry_side" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "user_role",
    "password_hash" VARCHAR(255),
    "avatar_url" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_subject" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profiles" (
    "user_id" BIGINT NOT NULL,
    "company_name" VARCHAR(150) NOT NULL,
    "industry" VARCHAR(100) NOT NULL,
    "website_url" TEXT,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "user_id" BIGINT NOT NULL,
    "main_niche" "niche_category" NOT NULL,
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "hourly_rate" BIGINT NOT NULL,
    "external_portfolio_url" TEXT,
    "is_available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalized_name" VARCHAR(100) NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_skills" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "skill_id" BIGINT NOT NULL,

    CONSTRAINT "creator_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "video_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "content_style" "content_style",
    "duration_seconds" INTEGER,
    "aspect_ratio" VARCHAR(10),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_packages" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "base_price" BIGINT NOT NULL,
    "delivery_days" INTEGER NOT NULL,
    "terms_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "niche_category" NOT NULL,
    "budget" BIGINT NOT NULL,
    "recruitment_start_at" TIMESTAMPTZ(6) NOT NULL,
    "recruitment_end_at" TIMESTAMPTZ(6) NOT NULL,
    "recruitment_status" "recruitment_status" NOT NULL DEFAULT 'OPEN',
    "brief_json" JSONB,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_skills" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "skill_id" BIGINT NOT NULL,

    CONSTRAINT "project_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_requests" (
    "id" BIGSERIAL NOT NULL,
    "request_type" "request_type" NOT NULL,
    "client_id" BIGINT NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "project_id" BIGINT,
    "service_package_id" BIGINT,
    "title" VARCHAR(200) NOT NULL,
    "scope_text" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "brief_json" JSONB,
    "initial_amount" BIGINT NOT NULL,
    "offer_amount" BIGINT,
    "expected_days" INTEGER NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'PENDING',
    "offer_status" "offer_status" NOT NULL DEFAULT 'NONE',
    "rejection_reason" VARCHAR(80),
    "offered_at" TIMESTAMPTZ(6),
    "offer_responded_at" TIMESTAMPTZ(6),
    "selected_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" BIGSERIAL NOT NULL,
    "work_request_id" BIGINT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "agreed_amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KRW',
    "work_start_at" TIMESTAMPTZ(6) NOT NULL,
    "delivery_due_at" TIMESTAMPTZ(6) NOT NULL,
    "terms_text" TEXT NOT NULL,
    "client_snapshot" JSONB NOT NULL,
    "creator_snapshot" JSONB NOT NULL,
    "terms_hash" VARCHAR(128) NOT NULL,
    "status" "contract_status" NOT NULL DEFAULT 'DRAFT',
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "signed_terms_hash" VARCHAR(128) NOT NULL,
    "signed_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "submitted_by" BIGINT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "video_url" TEXT NOT NULL,
    "message" TEXT,
    "status" "deliverable_status" NOT NULL DEFAULT 'SUBMITTED',
    "feedback_text" TEXT,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_payment_id" VARCHAR(200),
    "amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KRW',
    "fee_rate_bps" INTEGER NOT NULL DEFAULT 1000,
    "fee_amount" BIGINT NOT NULL,
    "payout_amount" BIGINT NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMPTZ(6),
    "settled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" BIGSERIAL NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "event_type" "payment_event_type" NOT NULL,
    "event_key" VARCHAR(200) NOT NULL,
    "gross_amount" BIGINT NOT NULL,
    "fee_amount" BIGINT NOT NULL DEFAULT 0,
    "payout_amount" BIGINT NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KRW',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "author_user_id" BIGINT NOT NULL,
    "target_user_id" BIGINT NOT NULL,
    "rating" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "recipient_user_id" BIGINT NOT NULL,
    "project_id" BIGINT,
    "work_request_id" BIGINT,
    "event_type" VARCHAR(60) NOT NULL,
    "event_key" VARCHAR(200) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_bookmarks" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "account_type" "ledger_account_type" NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'KRW',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" BIGSERIAL NOT NULL,
    "payment_event_id" BIGINT NOT NULL,
    "transaction_type" "ledger_transaction_type" NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "memo" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" BIGSERIAL NOT NULL,
    "ledger_transaction_id" BIGINT NOT NULL,
    "ledger_account_id" BIGINT NOT NULL,
    "entry_side" "ledger_entry_side" NOT NULL,
    "amount" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_subject_key" ON "auth_identities"("provider", "provider_subject");

-- CreateIndex
CREATE UNIQUE INDEX "skills_normalized_name_key" ON "skills"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "creator_skills_creator_id_skill_id_key" ON "creator_skills"("creator_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_skills_project_id_skill_id_key" ON "project_skills"("project_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_work_request_id_key" ON "contracts"("work_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_contract_id_user_id_key" ON "signatures"("contract_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "deliverables_contract_id_version_no_key" ON "deliverables"("contract_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key" ON "payments"("provider", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_event_key_key" ON "payment_events"("event_key");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_contract_id_author_user_id_key" ON "reviews"("contract_id", "author_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_user_id_event_key_key" ON "notifications"("recipient_user_id", "event_key");

-- CreateIndex
CREATE UNIQUE INDEX "project_bookmarks_creator_id_project_id_key" ON "project_bookmarks"("creator_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_currency_key" ON "ledger_accounts"("code", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_payment_event_id_key" ON "ledger_transactions"("payment_event_id");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_skills" ADD CONSTRAINT "creator_skills_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_skills" ADD CONSTRAINT "creator_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "brand_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "brand_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_service_package_id_fkey" FOREIGN KEY ("service_package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_bookmarks" ADD CONSTRAINT "project_bookmarks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_bookmarks" ADD CONSTRAINT "project_bookmarks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_payment_event_id_fkey" FOREIGN KEY ("payment_event_id") REFERENCES "payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_transaction_id_fkey" FOREIGN KEY ("ledger_transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
