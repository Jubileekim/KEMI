-- Prisma 마이그레이션 이력 테이블(_prisma_migrations)에서 Supabase Data API 역할의 권한을 회수한다.
--
-- _prisma_migrations는 Prisma가 첫 마이그레이션을 적용하기 전에 만든다. 그래서
-- 20261019070424_auth_data_api_lockdown이 기본 권한을 바꾸기 전의 기본 권한(anon·authenticated 전체 권한)을 받는다.
-- 이미 적용된 마이그레이션과 이력 데이터는 바꾸지 않고, 권한만 회수한다.
-- Prisma는 이 테이블의 소유자 역할로 접속하므로 영향을 받지 않는다.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON TABLE public._prisma_migrations FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
