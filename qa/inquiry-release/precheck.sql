-- #92 마이그레이션(20261028130000_work_bookmarks_inquiry) 적용 전 운영 DB 점검. 읽기 전용(SELECT만).
-- 사용: psql "$DATABASE_URL" -f qa/inquiry-release/precheck.sql  (결과를 PR에 붙인다. 연결 주소는 붙이지 않는다)

-- 1) 마지막 마이그레이션과 미완료·되돌린 기록이 없는지
SELECT migration_name, finished_at
FROM _prisma_migrations
ORDER BY finished_at DESC NULLS FIRST
LIMIT 3;

SELECT
  count(*) FILTER (WHERE migration_name = '20261028130000_work_bookmarks_inquiry') AS target_already_applied,
  count(*) FILTER (WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) AS unfinished_or_rolled_back
FROM _prisma_migrations;

-- 2) 새 테이블·컬럼이 아직 없어야 한다 (모두 NULL·0행이 정상)
SELECT to_regclass('public.portfolio_bookmarks') AS portfolio_bookmarks_table;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'work_requests'
  AND column_name IN ('material_type', 'desired_delivery_date', 'reference_portfolio_id', 'inquiry_group_id');

-- 3) 적용 뒤 비교할 기준값: 의뢰 종류·상태별 건수
SELECT request_type, status, count(*) AS rows
FROM work_requests
GROUP BY request_type, status
ORDER BY request_type, status;
