# #92 작품 저장함·일괄 문의 운영 반영 절차

대상 마이그레이션: `20261028130000_work_bookmarks_inquiry` (추가형)

- 새 테이블 `portfolio_bookmarks` (RLS 켬)
- `work_requests`에 nullable 컬럼 4개: `material_type`, `desired_delivery_date`, `reference_portfolio_id`, `inquiry_group_id`
- CHECK 2개, 외래 키 3개, 인덱스 4개. 기존 행·제약은 바꾸지 않는다.

**순서가 중요하다.** API가 새 컬럼을 읽으므로, 운영 DB에 먼저 적용하고 성공을 확인한 뒤에만 #92를 병합(= Render 자동 배포)한다. 반대 순서면 기존 직접 의뢰 조회도 실패한다.

## 1. 적용 전 (PM)

1. 백업 확인 — 둘 중 하나를 남긴다.
   - **Supabase 대시보드:** Database → Backups에서 오늘 날짜 백업(또는 PITR 복구 가능 시점)이 보이면 그 시각을 기록
   - **직접 백업(대시보드 백업이 없거나 확인이 안 될 때, 무료 플랜 등):** `public` 스키마만 사용자 정의 형식으로 받아 둔다. 로컬에 PostgreSQL 17 클라이언트가 없으면 Docker로 실행한다.

     ```bash
     docker run --rm -v "$PWD:/backup" postgres:17 pg_dump "<운영 DB 직접 연결 주소>" --schema=public --format=custom --no-owner --file=/backup/kemi-before-inquiry.dump
     docker run --rm -v "$PWD:/backup" postgres:17 pg_restore --list /backup/kemi-before-inquiry.dump
     ```

     - 연결 주소는 Supabase의 Direct connection(5432) 또는 Session pooler를 쓴다. Transaction pooler(6543)는 `pg_dump`를 지원하지 않는다.
     - 두 번째 명령은 파일이 정상인지 목록만 확인한다(아무것도 복원하지 않음). 덤프 파일에는 회원 정보가 들어 있으니 저장소·메신저에 올리지 않는다.
     - 복원이 필요하면 새 빈 DB에 `pg_restore --no-owner --dbname <새 DB 주소> kemi-before-inquiry.dump`로 먼저 확인한다(운영 DB에 바로 복원하지 않는다).
2. 읽기 전용 점검: `psql "$DATABASE_URL" -f qa/inquiry-release/precheck.sql`
   - `target_already_applied = 0`, `unfinished_or_rolled_back = 0`
   - `portfolio_bookmarks_table`이 비어 있고, 새 컬럼 조회 결과 0행
   - 3번(의뢰 종류·상태별 건수)을 기록해 둔다

## 2. 적용 (PM)

`backend-stack-release.md` 4장과 같은 방법으로 운영 DB에 `npm run db:deploy -w @kemi/api`
(이번에 적용되는 마이그레이션은 위 1개뿐이어야 한다)

## 3. 적용 직후 점검 (PM)

`psql "$DATABASE_URL" -f qa/inquiry-release/postcheck.sql`

- 마이그레이션 `finished_at` 있음, `rolled_back_at` 비어 있음
- `portfolio_bookmarks.relrowsecurity = t`
- 새 컬럼 4개 모두 `is_nullable = YES`
- 제약 5개, 인덱스 4개가 모두 보임
- 의뢰 종류·상태별 건수가 1-2의 기록과 같고, `existing_rows_with_new_values = 0`

## 4. 병합·배포 후 스모크 (선우 또는 PM)

#92 병합 → Render 배포 완료(`/health/ready`가 `database: ok`) 뒤:

```bash
KEMI_API_URL=https://kemi-api.onrender.com KEMI_SMOKE_EMAIL=<시연 의뢰인 @kemi.test> KEMI_SMOKE_PASSWORD=<비밀번호> node qa/inquiry-release/smoke.mjs
```

- 기본은 조회·저장함만 확인한다(의뢰를 보내지 않음).
- `KEMI_SMOKE_SEND=1`을 함께 주면 시연 크리에이터 2명에게 일괄 문의를 보내 중복 전송 방지까지 확인하고, 보낸 의뢰는 바로 철회한다.
- 이번에 저장한 작품은 끝에 저장 해제한다. 비밀번호·토큰은 출력하지 않는다.

## 되돌리기

추가형이라 이전 버전 API는 새 테이블·컬럼을 무시하고 그대로 동작한다. 앱만 되돌리면 되고 DB는 그대로 둔다. 테이블·컬럼 삭제는 데이터가 사라지므로 PM 승인 없이 하지 않는다.

## 리허설 기록 (2026-10-28, 개발 환경)

- **빈 DB 리허설**: 마이그레이션 22개 상태 → precheck(대상 미적용·테이블·컬럼 없음) → 적용 → postcheck(RLS·nullable 4개·제약 5개·인덱스 4개, 기존 행 영향 0) 모두 기대값
- **운영 복제 DB + 로컬 API 스모크**: 상태 점검, 로그인, 기존 직접 의뢰 조회(3건), 작품 저장·목록, 일괄 문의 2건 발송, 같은 commandId 재전송 시 같은 의뢰 ID(중복 없음), 공통 조건 저장, 철회·저장 해제 정리까지 모두 통과
- **직접 백업·복원 리허설**: 운영 복제 DB를 위 `pg_dump` 명령으로 백업(270KB, 테이블 데이터 60개) → 새 빈 DB에 `pg_restore` → 회원 24·의뢰 18·작업물 18·마이그레이션 23건으로 원본과 같음
- 운영 precheck는 PM이 실행해 기대값 확인(2026-10-28 05:18, #92 리뷰). 적용·postcheck·스모크는 아직(1~4는 PM 적용 시 실행).
