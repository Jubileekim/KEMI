-- PRD v2.0 TERMS-01~03, CONTRACT-01: 최종 조건서 버전·양측 서명·계약 (결정 기록 2·13장)
-- CreateTable
CREATE TABLE "terms_versions" (
    "id" BIGSERIAL NOT NULL,
    "work_request_id" BIGINT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount_krw" BIGINT,
    "specification" TEXT,
    "scope" TEXT,
    "materials" TEXT,
    "deadline" TEXT,
    "revisions" TEXT,
    "usage_rights" TEXT,
    "cancellation" TEXT,
    "reference_snapshot" JSONB NOT NULL,
    "terms_hash" TEXT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "command_id" UUID NOT NULL,
    "signing_requested_by" BIGINT,
    "signing_requested_at" TIMESTAMPTZ(3),
    "signing_expires_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signatures" (
    "id" BIGSERIAL NOT NULL,
    "terms_version_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "terms_hash" TEXT NOT NULL,
    "signed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" BIGSERIAL NOT NULL,
    "work_request_id" BIGINT NOT NULL,
    "project_id" BIGINT,
    "terms_version_id" BIGINT NOT NULL,
    "client_id" BIGINT NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "amount_krw" BIGINT NOT NULL,
    "terms_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIGNED',
    "signed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_work_request_id_version_no_key" ON "terms_versions"("work_request_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "terms_versions_work_request_id_command_id_key" ON "terms_versions"("work_request_id", "command_id");

-- CreateIndex
CREATE UNIQUE INDEX "signatures_terms_version_id_user_id_key" ON "signatures"("terms_version_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_work_request_id_key" ON "contracts"("work_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_project_id_key" ON "contracts"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_terms_version_id_key" ON "contracts"("terms_version_id");

-- AddForeignKey
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_signing_requested_by_fkey" FOREIGN KEY ("signing_requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_terms_version_id_fkey" FOREIGN KEY ("terms_version_id") REFERENCES "terms_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_status_check" CHECK ("status" IN ('DRAFT', 'SIGNING', 'SIGNED', 'SUPERSEDED', 'EXPIRED', 'VOID'));
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_version_no_check" CHECK ("version_no" >= 1);
-- 금액은 프로젝트 budget과 같은 범위다.
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_amount_check" CHECK ("amount_krw" IS NULL OR "amount_krw" BETWEEN 1 AND 1000000000);
-- 서명 요청을 거친 상태는 요청 정보가 모두 있고, 기한은 요청 + 48시간이다. DRAFT에는 요청 정보가 없다.
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_signing_check" CHECK (
  CASE
    WHEN "status" IN ('SIGNING', 'SIGNED', 'EXPIRED') THEN
      "signing_requested_by" IS NOT NULL
      AND "signing_requested_at" IS NOT NULL
      AND "signing_expires_at" = "signing_requested_at" + INTERVAL '48 hours'
    WHEN "status" = 'DRAFT' THEN
      "signing_requested_by" IS NULL
      AND "signing_requested_at" IS NULL
      AND "signing_expires_at" IS NULL
    ELSE TRUE
  END
);
-- 서명 요청한 버전은 금액이 있어야 한다(필수 항목 검사는 서버에서 한다).
ALTER TABLE "terms_versions" ADD CONSTRAINT "terms_versions_signing_amount_check" CHECK ("status" NOT IN ('SIGNING', 'SIGNED') OR "amount_krw" IS NOT NULL);
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_signer_name_check" CHECK (char_length("signer_name") BETWEEN 1 AND 100);
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_status_check" CHECK ("status" IN ('SIGNED'));
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_amount_check" CHECK ("amount_krw" BETWEEN 1 AND 1000000000);
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_parties_check" CHECK ("client_id" <> "creator_id");

-- 요청당 서명 진행 중(SIGNING) 버전은 최대 1개 (결정 기록 2장)
CREATE UNIQUE INDEX "terms_versions_one_signing_idx" ON "terms_versions" ("work_request_id") WHERE "status" = 'SIGNING';

-- 새 알림 종류 2개 (결정 기록 13-3). 기존 값은 그대로 둔다.
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'APPLICATION_ACCEPTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED'));

-- ─── Supabase Data API 차단 ───
ALTER TABLE "terms_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
