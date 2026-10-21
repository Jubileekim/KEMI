-- CreateTable
CREATE TABLE "client_profiles" (
    "user_id" BIGINT NOT NULL,
    "brand_name" TEXT,
    "introduction" TEXT,
    "industry" TEXT,
    "website_url" TEXT,
    "social_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "creator_profiles" (
    "user_id" BIGINT NOT NULL,
    "introduction" TEXT,
    "niche" TEXT,
    "content_styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "production_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "work_method" TEXT,
    "service_status" TEXT NOT NULL DEFAULT 'DRAFT',
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "available_from" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "creator_profiles_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (Prisma 스키마로 표현할 수 없어 직접 작성) ───
-- 허용 값 목록은 @kemi/shared의 status.ts 배열과 같아야 한다(status-check DB 테스트로 비교).
-- 분야·콘텐츠 스타일 값은 임시 제안(D21)이다. 확정되면 이 목록과 shared를 함께 바꾸는 마이그레이션을 추가한다.

-- client_profiles
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_industry_check" CHECK ("industry" IS NULL OR "industry" IN ('BEAUTY', 'FOOD', 'LIFESTYLE', 'TECH', 'OTHER'));

-- creator_profiles (목록 열은 NULL 대신 빈 배열을 쓴다)
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_niche_check" CHECK ("niche" IS NULL OR "niche" IN ('BEAUTY', 'FOOD', 'LIFESTYLE', 'TECH', 'OTHER'));
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_content_styles_check" CHECK ("content_styles" IS NOT NULL AND "content_styles" <@ ARRAY['MODERN', 'BRIGHT', 'EMOTIONAL', 'PROFESSIONAL', 'OTHER']::text[]);
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_production_roles_check" CHECK ("production_roles" IS NOT NULL AND "production_roles" <@ ARRAY['PLANNING', 'ON_CAMERA', 'FILMING', 'EDITING']::text[]);
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_service_status_check" CHECK ("service_status" IN ('DRAFT', 'PUBLIC', 'PRIVATE'));

-- ─── Supabase Data API 차단 ───
-- 정책 없는 RLS: Data API 역할은 행에 접근할 수 없다. Express(Prisma)는 테이블 소유자라 영향이 없다.
-- anon·authenticated의 권한은 20261019070424_auth_data_api_lockdown의 기본 권한 변경으로 처음부터 붙지 않는다.
ALTER TABLE "client_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "creator_profiles" ENABLE ROW LEVEL SECURITY;
