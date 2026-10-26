-- 단계 1·2 보강: 제작 패키지·작업물·서비스 공개(PACK-01~03, PORT-01~02), 공고 임시 저장(CAMP-01·02)
-- CreateTable
CREATE TABLE "service_packages" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "purpose" TEXT,
    "price_krw" BIGINT,
    "delivery_days" INTEGER,
    "revision_count" INTEGER,
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_representative" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "purpose" TEXT,
    "styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'OWN_WORK',
    "client_consent" BOOLEAN NOT NULL DEFAULT false,
    "video_file_id" BIGINT,
    "thumbnail_file_id" BIGINT,
    "package_id" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_drafts" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "values" JSONB NOT NULL,
    "recruitment_days" INTEGER NOT NULL DEFAULT 7,
    "published_project_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_packages_creator_id_created_at_idx" ON "service_packages"("creator_id", "created_at");

-- CreateIndex
CREATE INDEX "portfolios_creator_id_created_at_idx" ON "portfolios"("creator_id", "created_at");

-- CreateIndex
CREATE INDEX "portfolios_status_published_at_idx" ON "portfolios"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_drafts_published_project_id_key" ON "project_drafts"("published_project_id");

-- CreateIndex
CREATE INDEX "project_drafts_client_id_updated_at_idx" ON "project_drafts"("client_id", "updated_at");

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_video_file_id_fkey" FOREIGN KEY ("video_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_thumbnail_file_id_fkey" FOREIGN KEY ("thumbnail_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_drafts" ADD CONSTRAINT "project_drafts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_drafts" ADD CONSTRAINT "project_drafts_published_project_id_fkey" FOREIGN KEY ("published_project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_status_check" CHECK ("status" IN ('DRAFT', 'PUBLIC', 'PRIVATE'));
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_purpose_check" CHECK ("purpose" IS NULL OR "purpose" IN ('WEDDING_COUPLE', 'CHILD_FAMILY', 'THANKS_CELEBRATION', 'TRAVEL_DAILY', 'SNS_SHORTFORM', 'OTHER'));
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_ranges_check" CHECK (("price_krw" IS NULL OR "price_krw" BETWEEN 1 AND 1000000000) AND ("delivery_days" IS NULL OR "delivery_days" BETWEEN 1 AND 365) AND ("revision_count" IS NULL OR "revision_count" BETWEEN 0 AND 10));
-- 공개(한 번이라도 공개했다가 내린 것 포함)하려면 필수 항목이 모두 있어야 한다.
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_complete_check" CHECK ("status" = 'DRAFT' OR ("description" IS NOT NULL AND "purpose" IS NOT NULL AND "price_krw" IS NOT NULL AND "delivery_days" IS NOT NULL AND "revision_count" IS NOT NULL AND cardinality("includes") >= 1));
-- 대표 패키지는 공개 상태여야 하고, 크리에이터당 하나뿐이다.
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_representative_check" CHECK (NOT "is_representative" OR "status" = 'PUBLIC');
CREATE UNIQUE INDEX "service_packages_one_representative_idx" ON "service_packages" ("creator_id") WHERE "is_representative";

ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_status_check" CHECK ("status" IN ('DRAFT', 'PUBLIC', 'PRIVATE'));
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_source_check" CHECK ("source" IN ('OWN_WORK', 'CLIENT_WORK'));
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_purpose_check" CHECK ("purpose" IS NULL OR "purpose" IN ('WEDDING_COUPLE', 'CHILD_FAMILY', 'THANKS_CELEBRATION', 'TRAVEL_DAILY', 'SNS_SHORTFORM', 'OTHER'));
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_styles_check" CHECK ("styles" <@ ARRAY['EMOTIONAL', 'FUN', 'CINEMATIC', 'CLEAN', 'TRENDY', 'RETRO', 'OTHER']::text[]);
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_roles_check" CHECK ("roles" <@ ARRAY['PLANNING', 'ON_CAMERA', 'FILMING', 'EDITING']::text[]);
-- 공개하려면 영상·목적·본인 역할이 있어야 하고, 고객 의뢰 작업은 고객 공개 동의가 있어야 한다.
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_public_check" CHECK ("status" <> 'PUBLIC' OR ("video_file_id" IS NOT NULL AND "purpose" IS NOT NULL AND cardinality("roles") >= 1 AND ("source" = 'OWN_WORK' OR "client_consent") AND "published_at" IS NOT NULL));

ALTER TABLE "project_drafts" ADD CONSTRAINT "project_drafts_recruitment_days_check" CHECK ("recruitment_days" IN (3, 7, 14));
ALTER TABLE "project_drafts" ADD CONSTRAINT "project_drafts_values_check" CHECK (jsonb_typeof("values") = 'object');

-- ─── Supabase Data API 차단 ───
ALTER TABLE "service_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portfolios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_drafts" ENABLE ROW LEVEL SECURITY;
