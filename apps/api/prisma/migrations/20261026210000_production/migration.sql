-- 기능명세서 READY-01·02, WORK-01·02 (단계 4): 제작 준비 자료·제작 시작·납기 변경
-- CreateTable
CREATE TABLE "productions" (
    "contract_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "working_days" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "due_date" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productions_pkey" PRIMARY KEY ("contract_id")
);

-- CreateTable
CREATE TABLE "production_materials" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "file_id" BIGINT,
    "carrier" TEXT,
    "tracking_number" TEXT,
    "note" TEXT,
    "issue_note" TEXT,
    "replaces_material_id" BIGINT,
    "submitted_by" BIGINT NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deadline_changes" (
    "id" BIGSERIAL NOT NULL,
    "contract_id" BIGINT NOT NULL,
    "requested_by" BIGINT NOT NULL,
    "previous_due_date" DATE NOT NULL,
    "new_due_date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "responded_by" BIGINT,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deadline_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "production_materials_replaces_material_id_key" ON "production_materials"("replaces_material_id");

-- CreateIndex
CREATE INDEX "production_materials_contract_id_created_at_idx" ON "production_materials"("contract_id", "created_at");

-- CreateIndex
CREATE INDEX "deadline_changes_contract_id_created_at_idx" ON "deadline_changes"("contract_id", "created_at");

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "productions"("contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_replaces_material_id_fkey" FOREIGN KEY ("replaces_material_id") REFERENCES "production_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_changes" ADD CONSTRAINT "deadline_changes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "productions"("contract_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_changes" ADD CONSTRAINT "deadline_changes_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deadline_changes" ADD CONSTRAINT "deadline_changes_responded_by_fkey" FOREIGN KEY ("responded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "productions" ADD CONSTRAINT "productions_status_check" CHECK ("status" IN ('PREPARING', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'));
ALTER TABLE "productions" ADD CONSTRAINT "productions_working_days_check" CHECK ("working_days" BETWEEN 1 AND 365);
-- 시작 전에는 시작 시각·마감일이 없고, 시작한 뒤에는 둘 다 있다.
ALTER TABLE "productions" ADD CONSTRAINT "productions_started_check" CHECK (("status" = 'PREPARING') = ("started_at" IS NULL) AND ("started_at" IS NULL) = ("due_date" IS NULL));
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_kind_check" CHECK ("kind" IN ('FILE', 'SHIPMENT', 'NOTE'));
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_status_check" CHECK ("status" IN ('SUBMITTED', 'CONFIRMED', 'ISSUE_REPORTED', 'REPLACED'));
-- 종류별 필수 값: 파일은 파일, 발송은 택배사·송장번호, 메모는 메모
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_fields_check" CHECK (CASE "kind" WHEN 'FILE' THEN "file_id" IS NOT NULL WHEN 'SHIPMENT' THEN "carrier" IS NOT NULL AND "tracking_number" IS NOT NULL ELSE "note" IS NOT NULL END);
ALTER TABLE "deadline_changes" ADD CONSTRAINT "deadline_changes_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED'));
ALTER TABLE "deadline_changes" ADD CONSTRAINT "deadline_changes_dates_check" CHECK ("new_due_date" <> "previous_due_date");
-- 계약당 대기 중인 납기 변경은 하나뿐이다.
CREATE UNIQUE INDEX "deadline_changes_one_pending_idx" ON "deadline_changes" ("contract_id") WHERE "status" = 'PENDING';

-- ─── Supabase Data API 차단 ───
ALTER TABLE "productions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "production_materials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deadline_changes" ENABLE ROW LEVEL SECURITY;
