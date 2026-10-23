-- PRD v2.0 PROJ-01·02: 공개 맞춤 영상 제작 의뢰
CREATE TABLE "projects" (
  "id" BIGSERIAL NOT NULL,
  "client_id" BIGINT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "styles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "budget" BIGINT NOT NULL,
  "expected_duration_seconds" INTEGER,
  "recruitment_end_at" TIMESTAMPTZ(3) NOT NULL,
  "delivery_due_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "close_reason" TEXT,
  "deleted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "projects_purpose_check" CHECK ("purpose" IN (
    'WEDDING_COUPLE', 'CHILD_FAMILY', 'THANKS_CELEBRATION',
    'TRAVEL_DAILY', 'SNS_SHORTFORM', 'OTHER'
  )),
  CONSTRAINT "projects_styles_check" CHECK (
    "styles" <@ ARRAY[
      'EMOTIONAL', 'FUN', 'CINEMATIC', 'CLEAN', 'TRENDY', 'RETRO', 'OTHER'
    ]::TEXT[]
    AND cardinality("styles") BETWEEN 1 AND 5
  ),
  CONSTRAINT "projects_budget_check" CHECK ("budget" BETWEEN 1 AND 1000000000),
  CONSTRAINT "projects_duration_check" CHECK (
    "expected_duration_seconds" IS NULL
    OR "expected_duration_seconds" BETWEEN 1 AND 21600
  ),
  CONSTRAINT "projects_status_check" CHECK (
    "status" IN ('OPEN', 'MATCHED', 'CLOSED', 'CONTRACTED')
  ),
  CONSTRAINT "projects_close_reason_check" CHECK (
    "close_reason" IS NULL
    OR "close_reason" IN ('MANUAL', 'EXPIRED', 'NO_SELECTION')
  ),
  CONSTRAINT "projects_close_state_check" CHECK (
    ("status" = 'CLOSED' AND ("close_reason" IS NOT NULL OR "deleted_at" IS NOT NULL))
    OR ("status" <> 'CLOSED' AND "close_reason" IS NULL)
  ),
  CONSTRAINT "projects_deleted_check" CHECK ("deleted_at" IS NULL OR "status" = 'CLOSED'),
  CONSTRAINT "projects_schedule_check" CHECK (
    "recruitment_end_at" > "created_at"
    AND "delivery_due_date" > "recruitment_end_at"::DATE
  )
);

CREATE INDEX "projects_status_recruitment_end_at_idx"
  ON "projects"("status", "recruitment_end_at");
CREATE INDEX "projects_purpose_idx" ON "projects"("purpose");
CREATE INDEX "projects_budget_idx" ON "projects"("budget");
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at");

-- Supabase Data API에서는 anon/authenticated가 직접 읽거나 쓰지 못한다.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "projects" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE "projects_id_seq" FROM anon, authenticated;
