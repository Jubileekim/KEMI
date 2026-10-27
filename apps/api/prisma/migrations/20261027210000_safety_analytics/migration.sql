-- 신고·이용 제한·이의 제기(OPS-01·02), 행동 기록(METRIC-01) [제안, D18·D21·D22]
-- 새 테이블만 추가한다. 기존 테이블은 알림 종류 CHECK만 넓힌다(기존 행 변경 없음).

-- CreateTable
CREATE TABLE "reports" (
    "id" BIGSERIAL NOT NULL,
    "reporter_id" BIGINT NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "limited" BOOLEAN NOT NULL DEFAULT false,
    "command_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_events" (
    "id" BIGSERIAL NOT NULL,
    "report_id" BIGINT NOT NULL,
    "actor_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "command_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "user_id" BIGINT,
    "is_test" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_command_id_key" ON "reports"("command_id");

-- CreateIndex
CREATE INDEX "reports_subject_id_limited_idx" ON "reports"("subject_id", "limited");

-- CreateIndex
CREATE INDEX "reports_reporter_id_created_at_idx" ON "reports"("reporter_id", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_events_command_id_key" ON "report_events"("command_id");

-- CreateIndex
CREATE INDEX "report_events_report_id_created_at_idx" ON "report_events"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_name_created_at_idx" ON "analytics_events"("name", "created_at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_type_check" CHECK ("target_type" IN ('PROJECT', 'WORK_REQUEST'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_check" CHECK ("status" IN ('RECEIVED', 'REVIEWING', 'RESOLVED'));
ALTER TABLE "reports" ADD CONSTRAINT "reports_not_self_check" CHECK ("reporter_id" <> "subject_id");
ALTER TABLE "reports" ADD CONSTRAINT "reports_text_check" CHECK (char_length("reason") BETWEEN 1 AND 2000 AND char_length("evidence") <= 4000);
ALTER TABLE "report_events" ADD CONSTRAINT "report_events_action_check" CHECK ("action" IN ('RECEIVED', 'REVIEW', 'WARN', 'LIMIT', 'RELEASE', 'APPEAL'));
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_name_check" CHECK ("name" IN ('feed_view', 'work_play', 'creator_view', 'request_sent', 'contract_confirmed', 'transaction_completed'));
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_object_id_check" CHECK ("object_id" ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$');
-- 같은 대상에 한 번만 세는 이벤트(로그인 사용자별)
CREATE UNIQUE INDEX "analytics_events_once_idx" ON "analytics_events" ("name", "object_id", "user_id") WHERE "user_id" IS NOT NULL AND "name" IN ('request_sent', 'contract_confirmed', 'transaction_completed');

-- 알림 종류 추가 (경고·제한·해제 안내, 신고 처리 완료)
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_event_type_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_type_check" CHECK ("event_type" IN ('APPLICATION_SUBMITTED', 'APPLICATION_ACCEPTED', 'DISCUSSION_REQUESTED', 'APPLICATION_AUTO_REJECTED', 'APPLICATION_DECLINED', 'PROJECT_CLOSED', 'APPLICATION_WITHDRAWN', 'PROJECT_ENDED_NO_SELECTION', 'TERMS_SIGNING_REQUESTED', 'CONTRACT_SIGNED', 'PAYMENT_SUCCEEDED', 'DELIVERABLE_SUBMITTED', 'REVISION_REQUESTED', 'DELIVERABLE_APPROVED', 'DELIVERY_RECEIVED', 'REVIEW_RECEIVED', 'DIRECT_REQUEST_RECEIVED', 'DIRECT_REQUEST_ACCEPTED', 'DIRECT_REQUEST_DECLINED', 'DIRECT_REQUEST_EXPIRED', 'CANCELLATION_PROPOSED', 'CANCELLATION_ACCEPTED', 'CANCELLATION_REJECTED', 'REFUND_SUCCEEDED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED', 'SAFETY_WARNED', 'SAFETY_LIMITED', 'SAFETY_RELEASED', 'REPORT_RESOLVED'));

-- ─── Supabase Data API 차단 ───
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
