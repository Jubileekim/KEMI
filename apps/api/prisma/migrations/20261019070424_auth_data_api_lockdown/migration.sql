-- Supabase Data API 역할(anon·authenticated)이 인증 테이블에 접근하지 못하게 한다.
-- 이미 병합된 20261019051147_auth_tables는 수정하지 않고, 이 마이그레이션을 추가로 적용한다.
--
-- Express(Prisma)는 테이블 소유자 역할(Supabase에서는 postgres, BYPASSRLS)로 접속하므로
-- 아래 RLS·권한 변경의 영향을 받지 않는다.

-- 1) RLS를 명시적으로 켠다. 정책이 없으므로 RLS를 적용받는 역할은 어떤 행도 읽거나 쓸 수 없다.
--    (Supabase의 자동 RLS 이벤트 트리거는 실패해도 로그만 남기므로 여기서 직접 켠다)
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_refresh_tokens" ENABLE ROW LEVEL SECURITY;

-- 2) anon·authenticated 역할이 있는 DB(Supabase)에서만 권한을 회수한다.
--    로컬 PostgreSQL처럼 역할이 없으면 건너뛴다.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      -- 인증 테이블·시퀀스에 이미 부여된 권한
      EXECUTE format(
        'REVOKE ALL ON TABLE public.users, public.auth_identities, public.auth_sessions, public.auth_refresh_tokens FROM %I',
        api_role
      );
      EXECUTE format(
        'REVOKE ALL ON SEQUENCE public.users_id_seq, public.auth_identities_id_seq, public.auth_sessions_id_seq, public.auth_refresh_tokens_id_seq FROM %I',
        api_role
      );
      -- 앞으로 이 마이그레이션을 실행하는 역할(Prisma 접속 역할)이 public에 만드는 테이블·시퀀스에
      -- 자동으로 권한이 부여되지 않게 한다. 다른 역할(supabase_admin 등)과 auth·storage·realtime 스키마의
      -- 기본 권한은 건드리지 않는다.
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
