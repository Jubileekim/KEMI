-- PRD v2.0 BOOK-01: 크리에이터의 공개 프로젝트 북마크
CREATE TABLE "project_bookmarks" (
  "user_id" BIGINT NOT NULL,
  "project_id" BIGINT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_bookmarks_pkey" PRIMARY KEY ("user_id", "project_id"),
  CONSTRAINT "project_bookmarks_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "project_bookmarks_project_id_fkey" FOREIGN KEY ("project_id")
    REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "project_bookmarks_project_id_idx"
  ON "project_bookmarks"("project_id");
CREATE INDEX "project_bookmarks_user_id_created_at_idx"
  ON "project_bookmarks"("user_id", "created_at" DESC);

-- Supabase Data API에서는 anon/authenticated가 직접 읽거나 쓰지 못한다.
ALTER TABLE "project_bookmarks" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "project_bookmarks" FROM anon, authenticated;
