-- CreateTable
CREATE TABLE "service_packages" (
    "id" BIGSERIAL NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "base_price" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'KRW',
    "specification" JSONB NOT NULL,
    "included_scope" TEXT NOT NULL,
    "excluded_scope" TEXT NOT NULL,
    "required_materials" JSONB NOT NULL,
    "delivery_days" INTEGER NOT NULL,
    "revision_limit" INTEGER NOT NULL,
    "revision_scope" TEXT NOT NULL,
    "source_delivery" JSONB NOT NULL,
    "usage_terms" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_representative" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_packages_creator_id_idx" ON "service_packages"("creator_id");

-- AddForeignKey
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creator_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (Prisma 스키마로 표현할 수 없어 직접 작성) ───
-- 금액·기간 상한 같은 정책 값은 API(@kemi/shared PACKAGE_LIMITS)에서 검사한다. DB는 값의 형태와 패키지 상태 규칙만 강제한다.
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_base_price_check" CHECK ("base_price" > 0);
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_currency_check" CHECK ("currency" = 'KRW');
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_days_check" CHECK ("delivery_days" >= 1 AND "revision_limit" >= 0);
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_json_shape_check" CHECK (
  jsonb_typeof("specification") = 'object'
  AND jsonb_typeof("required_materials") = 'array'
  AND jsonb_typeof("source_delivery") = 'object'
  AND jsonb_typeof("usage_terms") = 'object'
);
-- 대표 패키지는 공개이고 삭제되지 않은 패키지여야 한다.
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_representative_check" CHECK (NOT "is_representative" OR ("is_public" AND "deleted_at" IS NULL));
-- 삭제한 패키지는 공개 상태로 남지 않는다.
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_deleted_check" CHECK ("deleted_at" IS NULL OR NOT "is_public");

-- ─── 대표 하나 (P04·D03) ───
-- 삭제되지 않은 패키지 중 대표는 크리에이터당 하나뿐이다. 삭제된 행은 대상에서 빼서, 지난 대표 기록이 새 대표 지정을 막지 않게 한다.
CREATE UNIQUE INDEX "service_packages_one_representative_idx" ON "service_packages" ("creator_id") WHERE "is_representative" AND "deleted_at" IS NULL;

-- ─── Supabase Data API 차단 ───
-- 정책 없는 RLS. anon·authenticated 권한은 20261019070424_auth_data_api_lockdown의 기본 권한 변경으로 처음부터 붙지 않는다.
ALTER TABLE "service_packages" ENABLE ROW LEVEL SECURITY;
