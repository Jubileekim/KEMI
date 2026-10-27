-- 기능명세서 CHAT-01~05, WORK-04: 요청별 대화방·메시지·읽음 (단계 3)
-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" BIGSERIAL NOT NULL,
    "work_request_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" BIGSERIAL NOT NULL,
    "room_id" BIGINT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'USER',
    "sender_id" BIGINT,
    "body" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_reads" (
    "room_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "last_read_message_id" BIGINT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_reads_pkey" PRIMARY KEY ("room_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_rooms_work_request_id_key" ON "chat_rooms"("work_request_id");

-- CreateIndex
CREATE INDEX "chat_messages_room_id_id_idx" ON "chat_messages"("room_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_room_id_dedupe_key_key" ON "chat_messages"("room_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_work_request_id_fkey" FOREIGN KEY ("work_request_id") REFERENCES "work_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_reads" ADD CONSTRAINT "chat_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 ───
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_kind_check" CHECK ("kind" IN ('USER', 'SYSTEM'));
-- USER 메시지는 보낸 사람이 있고, SYSTEM 메시지는 없다.
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_check" CHECK (("kind" = 'USER') = ("sender_id" IS NOT NULL));
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_body_check" CHECK (char_length("body") BETWEEN 1 AND 4000);

-- ─── Supabase Data API 차단 ───
ALTER TABLE "chat_rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_reads" ENABLE ROW LEVEL SECURITY;
