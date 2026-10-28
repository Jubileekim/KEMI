-- 작품 저장함(SAVE-01)과 직접 의뢰 공통 조건·일괄 문의(INQ-01). 추가형 변경만 한다(기존 행·제약 유지).

-- 1) 작품 저장함
CREATE TABLE "portfolio_bookmarks" (
    "user_id" BIGINT NOT NULL,
    "portfolio_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "portfolio_bookmarks_pkey" PRIMARY KEY ("user_id", "portfolio_id")
);
-- 앱 서버만 접근한다. Supabase Data API(anon·authenticated)로는 읽고 쓸 수 없게 RLS를 켜 둔다.
ALTER TABLE "portfolio_bookmarks" ENABLE ROW LEVEL SECURITY;
CREATE INDEX "portfolio_bookmarks_portfolio_id_idx" ON "portfolio_bookmarks"("portfolio_id");
CREATE INDEX "portfolio_bookmarks_user_id_created_at_idx" ON "portfolio_bookmarks"("user_id", "created_at" DESC);
ALTER TABLE "portfolio_bookmarks" ADD CONSTRAINT "portfolio_bookmarks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "portfolio_bookmarks" ADD CONSTRAINT "portfolio_bookmarks_portfolio_id_fkey"
  FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) 직접 의뢰 공통 조건: 보유 자료, 희망 납품일, 참고 작품, 일괄 문의 묶음
ALTER TABLE "work_requests"
  ADD COLUMN "material_type" TEXT,
  ADD COLUMN "desired_delivery_date" DATE,
  ADD COLUMN "reference_portfolio_id" BIGINT,
  ADD COLUMN "inquiry_group_id" UUID;

ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_material_type_check"
  CHECK ("material_type" IS NULL OR "material_type" IN ('PHOTOS_ONLY', 'PHOTOS_AND_VIDEOS', 'NEEDS_SHOOTING'));
-- 새 항목은 직접 의뢰에만 쓴다(공개 모집 지원에는 없다).
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_inquiry_fields_direct_check"
  CHECK ("request_type" = 'DIRECT_REQUEST' OR ("material_type" IS NULL AND "desired_delivery_date" IS NULL AND "reference_portfolio_id" IS NULL AND "inquiry_group_id" IS NULL));
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_reference_portfolio_id_fkey"
  FOREIGN KEY ("reference_portfolio_id") REFERENCES "portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "work_requests_inquiry_group_id_idx" ON "work_requests"("inquiry_group_id");
-- 같은 일괄 문의 안에서 같은 크리에이터에게 두 번 보내지 않는다.
CREATE UNIQUE INDEX "work_requests_inquiry_group_creator_idx" ON "work_requests" ("inquiry_group_id", "creator_id") WHERE "inquiry_group_id" IS NOT NULL;
