-- 고객 의뢰 작업물 공개 금지 (#60 리뷰, D16).
-- 고객의 검증 가능한 동의·범위·철회 기록이 생기기 전까지 CLIENT_WORK는 공개(PUBLIC)할 수 없다.
-- portfolios는 이 PR 묶음에서 처음 만드는 테이블이라 기존 행이 없다.
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_client_work_private_check" CHECK (NOT ("source" = 'CLIENT_WORK' AND "status" = 'PUBLIC'));
