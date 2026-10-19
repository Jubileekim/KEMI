-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT,
    "password_hash" TEXT,
    "name" VARCHAR(20) NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "provider_email" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" TEXT,
    "last_used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_refresh_tokens" (
    "id" BIGSERIAL NOT NULL,
    "session_id" BIGINT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "replaced_by_id" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "auth_identities_user_id_idx" ON "auth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_tokens_token_hash_key" ON "auth_refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_tokens_replaced_by_id_key" ON "auth_refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "auth_refresh_tokens_session_id_idx" ON "auth_refresh_tokens"("session_id");

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "auth_refresh_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── CHECK 제약 (Prisma 스키마로 표현할 수 없어 직접 작성) ───
-- 허용 값 목록은 @kemi/shared의 status.ts 배열과 같아야 한다(status-check DB 테스트로 비교).

-- users
ALTER TABLE "users" ADD CONSTRAINT "users_email_normalized_check" CHECK ("email" IS NULL OR "email" = lower(btrim("email")));
ALTER TABLE "users" ADD CONSTRAINT "users_name_length_check" CHECK (char_length("name") >= 2);
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('CLIENT', 'CREATOR', 'ADMIN'));
ALTER TABLE "users" ADD CONSTRAINT "users_status_check" CHECK ("status" IN ('ACTIVE', 'RESTRICTED', 'WITHDRAWN'));

-- auth_identities
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_provider_check" CHECK ("provider" IN ('GOOGLE', 'KAKAO'));

-- auth_sessions: 폐기 시각과 사유는 항상 함께 기록한다
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_revoke_reason_check" CHECK ("revoke_reason" IS NULL OR "revoke_reason" IN ('LOGOUT', 'REUSE_DETECTED', 'ADMIN'));
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_revoked_pair_check" CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL));

-- auth_refresh_tokens: 사용 처리와 다음 토큰 연결은 항상 함께 기록한다
ALTER TABLE "auth_refresh_tokens" ADD CONSTRAINT "auth_refresh_tokens_used_pair_check" CHECK (("used_at" IS NULL) = ("replaced_by_id" IS NULL));
