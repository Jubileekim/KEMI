-- PRD v2.0 APPLY-01·02, STATE-01, NOTI-01: 공개 프로젝트 지원·선정·자동 거절과 인앱 알림
-- CreateTable
CREATE TABLE "work_requests" (
    "id" BIGSERIAL NOT NULL,
    "request_type" TEXT NOT NULL,
    "client_id" BIGINT NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "project_id" BIGINT,
    "message" TEXT NOT NULL,
    "initial_amount" BIGINT NOT NULL,
    "expected_days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "closed_reason" TEXT,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "recipient_user_id" BIGINT NOT NULL,
    "work_request_id" BIGINT,
    "project_id" BIGINT,
    "event_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_requests_creator_id_created_at_idx" ON "work_requests"("creator_id", "created_at");

-- CreateIndex
CREATE INDEX "work_requests_project_id_status_idx" ON "work_requests"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_requests_project_id_creator_id_key" ON "work_requests"("project_id", "creator_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_user_id_event_key_key" ON "notifications"("recipient_user_id", "event_key");

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── 프로젝트 상태 추가 ───
-- MATCHED: 지원자 선정(거래 단계). NO_SELECTION: 무선정 종료(계약 기능에서 사용).
ALTER TABLE "projects" DROP CONSTRAINT "projects_status_check";
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_check" CHECK ("status" IN ('OPEN', 'CLOSED', 'MATCHED', 'CONTRACTED', 'NO_SELECTION'));

-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_request_type_check" CHECK ("request_type" IN ('PROJECT_APPLICATION', 'DIRECT_REQUEST'));
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_status_check" CHECK ("status" IN ('PENDING', 'DISCUSSING', 'CONTRACTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED', 'NOT_SELECTED'));
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_closed_reason_check" CHECK ("closed_reason" IS NULL OR "closed_reason" IN ('OTHER_SELECTED', 'PROJECT_DELETED'));
-- 공개 지원은 프로젝트가 있어야 하고, 직접 의뢰는 프로젝트가 없다(결정 기록 3장).
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_type_project_check" CHECK (("request_type" = 'PROJECT_APPLICATION') = ("project_id" IS NOT NULL));
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_amount_check" CHECK ("initial_amount" > 0 AND "expected_days" >= 1);
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_parties_check" CHECK ("client_id" <> "creator_id");
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'APPLICATION_ACCEPTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED'));

-- 미확인 알림 개수·목록 조회용
CREATE INDEX "notifications_unread_idx" ON "notifications" ("recipient_user_id") WHERE "read_at" IS NULL;

-- ─── Supabase Data API 차단 ───
ALTER TABLE "work_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
