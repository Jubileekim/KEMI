-- #92 마이그레이션 적용 직후 운영 DB 점검. 읽기 전용(SELECT만).
-- 사용: psql "$DATABASE_URL" -f qa/inquiry-release/postcheck.sql

-- 1) 마이그레이션이 끝까지 적용됐는지
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
WHERE migration_name = '20261028130000_work_bookmarks_inquiry';

-- 2) 새 테이블과 RLS (relrowsecurity = true 여야 한다)
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'portfolio_bookmarks';

-- 3) work_requests의 새 컬럼 4개 (모두 nullable)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'work_requests'
  AND column_name IN ('material_type', 'desired_delivery_date', 'reference_portfolio_id', 'inquiry_group_id')
ORDER BY column_name;

-- 4) 새 제약·인덱스
SELECT conname
FROM pg_constraint
WHERE conname IN (
  'work_requests_material_type_check',
  'work_requests_inquiry_fields_direct_check',
  'work_requests_reference_portfolio_id_fkey',
  'portfolio_bookmarks_user_id_fkey',
  'portfolio_bookmarks_portfolio_id_fkey'
)
ORDER BY conname;

SELECT indexname
FROM pg_indexes
WHERE tablename IN ('work_requests', 'portfolio_bookmarks')
  AND indexname IN (
    'work_requests_inquiry_group_id_idx',
    'work_requests_inquiry_group_creator_idx',
    'portfolio_bookmarks_portfolio_id_idx',
    'portfolio_bookmarks_user_id_created_at_idx'
  )
ORDER BY indexname;

-- 5) 기존 의뢰 건수가 적용 전(precheck 3번)과 같아야 한다. 기존 행의 새 컬럼은 모두 NULL
SELECT request_type, status, count(*) AS rows
FROM work_requests
GROUP BY request_type, status
ORDER BY request_type, status;

SELECT count(*) AS existing_rows_with_new_values
FROM work_requests
WHERE inquiry_group_id IS NOT NULL
   OR material_type IS NOT NULL
   OR desired_delivery_date IS NOT NULL
   OR reference_portfolio_id IS NOT NULL;
