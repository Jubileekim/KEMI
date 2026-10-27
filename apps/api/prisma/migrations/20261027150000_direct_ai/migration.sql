-- 단계 6: 직접 의뢰(DIRECT-01~03)·AI 분석 보고서(AI-01·02)
-- AlterTable
ALTER TABLE "work_requests" ADD COLUMN     "event_date" DATE,
ADD COLUMN     "package_id" BIGINT,
ADD COLUMN     "package_snapshot" JSONB,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "respond_due_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "ai_reports" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "model" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "estimated_budget_krw" BIGINT NOT NULL,
    "applied_at" TIMESTAMPTZ(3),
    "applied_budget_krw" BIGINT,
    "applied_draft_id" BIGINT,
    "applied_project_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_reports_user_id_created_at_idx" ON "ai_reports"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "service_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── CHECK 제약 ───
-- 직접 의뢰는 패키지·조건 사본·응답 기한이 있고, 공개 지원에는 없다(프로젝트 유무는 기존 work_requests_type_project_check).
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_direct_fields_check" CHECK (("request_type" = 'DIRECT_REQUEST') = ("package_id" IS NOT NULL) AND ("package_id" IS NULL) = ("package_snapshot" IS NULL) AND ("package_id" IS NULL) = ("respond_due_at" IS NULL));
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_purpose_check" CHECK ("purpose" IS NULL OR "purpose" IN ('WEDDING_COUPLE', 'CHILD_FAMILY', 'THANKS_CELEBRATION', 'TRAVEL_DAILY', 'SNS_SHORTFORM', 'OTHER'));
-- 같은 의뢰인이 같은 패키지에 진행 중인 직접 의뢰는 하나뿐이다.
CREATE UNIQUE INDEX "work_requests_one_active_direct_idx" ON "work_requests" ("client_id", "package_id") WHERE "request_type" = 'DIRECT_REQUEST' AND "status" IN ('PENDING', 'DISCUSSING');
CREATE INDEX "work_requests_client_id_created_at_idx" ON "work_requests" ("client_id", "created_at");

ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_budget_check" CHECK ("estimated_budget_krw" BETWEEN 1 AND 1000000000 AND ("applied_budget_krw" IS NULL OR "applied_budget_krw" BETWEEN 1 AND 1000000000));
-- 반영 기록은 한꺼번에 있고, 대상은 초안·공고 중 하나다.
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_applied_check" CHECK (("applied_at" IS NULL) = ("applied_budget_krw" IS NULL) AND (("applied_at" IS NULL AND "applied_draft_id" IS NULL AND "applied_project_id" IS NULL) OR ("applied_at" IS NOT NULL AND (("applied_draft_id" IS NULL) <> ("applied_project_id" IS NULL)))));

-- 알림 종류 추가 (직접 의뢰 도착·협의 수락·거절·응답 기한 만료)
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'APPLICATION_ACCEPTED', 'DISCUSSION_REQUESTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'APPLICATION_WITHDRAWN', 'PROJECT_ENDED_NO_SELECTION', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED', 'PAYMENT_SUCCEEDED', 'DELIVERABLE_SUBMITTED', 'REVISION_REQUESTED', 'DELIVERABLE_APPROVED', 'DELIVERY_RECEIVED', 'REVIEW_RECEIVED', 'DIRECT_REQUEST_RECEIVED', 'DIRECT_REQUEST_ACCEPTED', 'DIRECT_REQUEST_DECLINED', 'DIRECT_REQUEST_EXPIRED'));

-- ─── Supabase Data API 차단 ───
ALTER TABLE "ai_reports" ENABLE ROW LEVEL SECURITY;
