-- 기능명세서 FILE-01 (결정 기록 4장): 파일 메타데이터와 채팅 첨부
-- CreateTable
CREATE TABLE "files" (
    "id" BIGSERIAL NOT NULL,
    "owner_id" BIGINT NOT NULL,
    "purpose" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "work_request_id" BIGINT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_attachments" (
    "message_id" BIGINT NOT NULL,
    "file_id" BIGINT NOT NULL,

    CONSTRAINT "chat_attachments_pkey" PRIMARY KEY ("message_id","file_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_path_key" ON "files"("storage_path");

-- CreateIndex
CREATE INDEX "files_owner_id_created_at_idx" ON "files"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "files_work_request_id_idx" ON "files"("work_request_id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (허용 값은 @kemi/shared 배열과 같아야 한다) ───
ALTER TABLE "files" ADD CONSTRAINT "files_purpose_check" CHECK ("purpose" IN ('PROFILE_IMAGE', 'PORTFOLIO', 'CHAT_ATTACHMENT', 'MATERIAL', 'DELIVERABLE', 'REVISION'));
ALTER TABLE "files" ADD CONSTRAINT "files_mime_type_check" CHECK ("mime_type" IN ('video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp', 'application/zip'));
ALTER TABLE "files" ADD CONSTRAINT "files_status_check" CHECK ("status" IN ('PENDING', 'READY', 'REJECTED'));
-- 파일당 한도: 영상·ZIP 50MB, 이미지 10MB (결정 기록 4장)
ALTER TABLE "files" ADD CONSTRAINT "files_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= CASE WHEN "mime_type" LIKE 'image/%' THEN 10485760 ELSE 52428800 END);
-- 거래 파일은 요청이 있고, 프로필·작업물 파일은 요청이 없다.
ALTER TABLE "files" ADD CONSTRAINT "files_scope_check" CHECK (("purpose" IN ('CHAT_ATTACHMENT', 'MATERIAL', 'DELIVERABLE', 'REVISION')) = ("work_request_id" IS NOT NULL));

-- 채팅은 첨부만 보낼 수 있으므로 본문 0자를 허용한다(첨부 없는 빈 메시지는 서버에서 막는다).
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_body_check";
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_body_check" CHECK (char_length("body") <= 4000);

-- ─── Supabase Data API 차단 ───
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_attachments" ENABLE ROW LEVEL SECURITY;
