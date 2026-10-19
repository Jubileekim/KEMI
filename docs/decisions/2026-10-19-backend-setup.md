# 백엔드 설계 결정 기록 (2026-10-19)

- 기준 문서: PRD v1.4 · 기능명세 v0.5 · 통합 ERD v0.6 (2026-10-16) · 개발계획(Plan1)
- 범위: ERD v0.6 검토에서 나온 충돌 항목의 결정, 인프라 기준, 이후 스키마·기능 PR이 따라야 할 규칙
- 구현 상태: PR #1은 서버·환경 변수·헬스 체크·Prisma 초기 구성까지만 구현한다. 아래 테이블·API 규칙은 각 기능 PR에서 적용한다.

## 표기 규칙

| 표기 | 뜻 |
|---|---|
| **[확정]** | 팀이 결정한 정책. 바꾸려면 팀 합의가 필요하다 |
| **[제안]** | 백엔드 담당이 제안한 값·방식. 해당 기능 PR 리뷰에서 확정한다 |
| **[검증 필요]** | 실제 환경에서 작은 검증을 마친 뒤 적용한다 |

## 0. 인프라 기준

| 영역 | 내용 | 상태 |
|---|---|---|
| DB | Supabase PostgreSQL (별도 PostgreSQL 서버 없음), 마이그레이션은 Prisma로 통일 | [확정] |
| 파일 | Supabase Storage. 브라우저가 직접 업로드하고 서버가 권한 발급·완료 확인 | [확정] |
| 프론트엔드 배포 | Vercel. `/api/*`를 Render로 rewrite | [확정] |
| 백엔드 배포 | Render 무료 플랜 | [확정] |
| 공통 패키지 | `packages/shared`: 요청 검증 스키마·공통 타입·상태값·오류 코드만. Prisma 모델은 공유하지 않음 | [확정] |

### 헬스 체크 경로 [확정 · PR #1 구현]

- `GET /health`(생존 확인), `GET /health/ready`(DB 연결 확인). 서비스 API는 `/api/*`에 둔다.
- 처음 논의한 `/api/health`와 다른 이유는 두 가지다.
  - Render 헬스 체크는 Vercel rewrite를 거치지 않고 Render 주소로 직접 호출된다.
  - `/api/*`에 붙일 인증·요청 제한 미들웨어와 분리하기 위해서다.
- 프론트엔드의 배포 연결 확인(Plan1 1주차)은 Render 주소의 `/health`를 직접 호출한다.
- Render Health Check Path는 `/health`로 설정한다.

### DB 연결

- [확정] 실제 배포 환경과 Supabase 공식 문서에 맞춰 주소를 고른다. "실행용 6543, 마이그레이션용 직접 연결"을 전제하지 않는다.
- [제안] Render(상시 실행 서버)는 Session pooler 하나로 실행과 마이그레이션을 함께 한다. 마이그레이션 주소를 따로 둬야 하면 `MIGRATION_DATABASE_URL`을 쓴다.
- [검증 필요] Render에서 Session pooler 연결, Direct connection(IPv6) 사용 가능 여부
- [확정] 개발 DB와 테스트 DB를 분리하고, 테스트가 팀 공용 DB를 초기화하지 않게 한다. 테스트 DB 종류(로컬 Docker / 테스트 전용 Supabase)는 결정이 필요하다.

### 채팅 Realtime

- [확정] 메시지 저장·조회는 Express API가 참여자 권한을 확인하며 처리한다. Supabase Realtime은 "새 메시지" 신호에만 쓴다.
- [확정] 신호만 보내더라도 비공개 채널 구독 권한을 검사한다.
- [확정] Realtime 연결이 끊겨도, 마지막으로 받은 메시지 이후를 API로 다시 조회해 누락을 복구할 수 있어야 한다.
- [검증 필요] KEMI는 Supabase Auth가 아닌 자체 JWT를 쓴다. Realtime 비공개 채널 인증에 자체 토큰을 연결하는 방법을 작은 검증으로 먼저 확인한다.
- [제안] 검증 전에는 일정 주기로 조회하는 방식으로 동작하게 하고, Realtime은 검증 후에 붙인다.

### 기한 처리

- [확정] 마감 시각은 DB에 저장하고, `서버 현재 시각 ≥ DB 마감 시각`으로 판정한다. cron 실행 여부와 관계없이 조회·처리 API가 만료된 요청을 직접 차단한다.
- [확정] cron(node-cron)은 상태 정리·알림 생성의 보조 수단이다.
- [확정] 서버를 재시작하면 놓친 정리 작업을 한 번 실행한다. Render 무료 플랜은 잠들 수 있기 때문이다.
- [확정] 정리 작업은 조건부 UPDATE로 작성해, 여러 번 실행돼도 결과가 같게 한다.

## 1. 이메일과 소셜 계정 [확정]

- `users.email`은 이메일 로그인용 주소다. 소셜 전용 가입자는 `NULL`을 허용한다.
  - [제안] 정규화 기준: 앞뒤 공백 제거 + 전체 소문자. 정규화한 값에 UNIQUE를 건다. PostgreSQL UNIQUE는 `NULL`을 서로 다른 값으로 보므로, 소셜 전용 회원이 여러 명이어도 충돌하지 않는다.
- 소셜 제공 이메일은 `auth_identities.provider_email`(선택)에 따로 저장한다.
- 소셜 계정 식별 기준은 `(provider, provider_user_id)` UNIQUE다.
  - ERD v0.6의 `provider_subject` 컬럼은 `provider_user_id`로 이름을 바꾼다.
- 같은 이메일이라는 이유로 자동 병합하지 않는다.
- 소셜 전용 계정(`password_hash`가 `NULL`)은 이메일·비밀번호 로그인을 할 수 없다.
- 계정 연결 기능은 MVP 범위에서 제외한다.

## 2. 공고당 계약 최대 한 개

**정책 [확정]**
- 공개 모집에서는 공고당 최종 체결 계약이 최대 한 개다.
- 같은 조건서 버전에 양측이 서명해야 계약이 체결된다.
- MVP에서는 계약 취소 후 같은 공고를 다시 열거나 다른 후보와 재계약하지 않는다. 재모집은 새 공고로 한다.
- 직접 의뢰는 `project_id = NULL`이므로 공고 제약과 별개의 거래다.
- 계약 취소와 결제 환불 완료는 별도 상태로 관리한다.

**제약 설계 [제안]**

계약 초안과 무효 조건서가 어디에 저장되는지 먼저 확인한 뒤 제약을 정했다.
- ERD v0.6에서 계약 전 초안·수정·무효 처리는 모두 `terms_versions`에서 이뤄진다. 상태는 `DRAFT / SIGNING / SIGNED / SUPERSEDED / EXPIRED / VOID`이고, 무효 조건서도 삭제하지 않고 보존한다.
- `contracts` 행은 같은 버전의 두 번째 유효 서명 시점에 처음 생성된다. 초안 단계의 계약 행은 없다.
- 따라서 `contracts.project_id`의 제약은 초안이나 무효 조건서와 부딪히지 않는다.
- 취소된 계약을 제외하는 부분 인덱스(`WHERE status <> 'CANCELLED'`)를 쓰면 취소 후 재계약이 허용된다. 이는 위 정책과 맞지 않는다.
- 결론: 검토 결과 `contracts.project_id` UNIQUE(NULL 제외)가 정책과 정확히 맞는다. 취소된 계약 행도 남아 있어서 같은 공고의 두 번째 계약을 계속 막는다.
- `contracts.work_request_id`, `contracts.terms_version_id`도 UNIQUE를 유지한다.
- `terms_versions`
  - `(work_request_id, version_no)` UNIQUE
  - 요청당 `SIGNING` 버전은 최대 1개: `(work_request_id) WHERE status = 'SIGNING'` 부분 UNIQUE
- `signatures (terms_version_id, user_id)` UNIQUE

**두 번째 서명 트랜잭션 [제안]**

다음을 하나의 트랜잭션으로 처리한다.
1. 공고 행을 `SELECT … FOR UPDATE`로 잠근다 (공개 모집일 때).
2. 서명 대상 버전이 `SIGNING`이고 만료 전이며 해시가 일치하는지 확인한다.
3. 서명을 INSERT하고, 버전을 `SIGNED`로 바꾼다.
4. `contracts`를 INSERT한다. UNIQUE 위반이면 롤백하고 `409 CONFLICT`("이미 다른 후보와 계약이 확정됨")로 응답한다.
5. 요청을 `CONTRACTED`로, 공고를 `CONTRACTED`로 바꾼다(모집 마감).
6. 같은 공고의 다른 활성 요청은 `NOT_SELECTED`로, 그 요청들의 미확정 조건서는 `VOID`로 바꾼다.
7. 관련 알림(`notifications`)을 INSERT한다. `(recipient_user_id, event_key)` UNIQUE로 중복 생성을 막는다.

공고 행 잠금이 1차 방어이고, UNIQUE는 마지막 방어선이다.

**취소와 환불 [확정]**
- 계약 취소: `contracts.status = CANCELLED`
- 환불 완료: `refunds.status = SUCCEEDED`
- 계약 취소만으로 환불 완료로 표시하지 않는다.

## 3. 공개 모집 지원 중복

**정책 [확정]**
- 같은 크리에이터는 같은 공고에 중복 지원할 수 없다.
- MVP에서는 철회한 뒤에도 같은 공고에 재지원할 수 없다.
- 직접 의뢰의 반복 거래는 이 제약으로 막지 않는다.
- 네트워크 재시도로 같은 요청이 중복 생성되는 것은 별도로 막는다.
- 지원 가능 여부는 권한·모집 상태·마감 시각까지 서버에서 확인한다.

**상태 정의 대조** (`work_requests.status`, ERD v0.6)

| 상태 | 의미 | 활성 여부 |
|---|---|---|
| `PENDING` | 제출됨, 의뢰인의 협의 요청 전 | 활성 |
| `DISCUSSING` | 협의 중 (조건서 작성·서명 대기 포함) | 활성 |
| `CONTRACTED` | 계약 확정 | 종료 (성공) |
| `DECLINED` | 거절됨 | 종료 |
| `WITHDRAWN` | 크리에이터가 철회 | 종료 |
| `EXPIRED` | 응답 기한 만료 (주로 직접 의뢰) | 종료 |
| `NOT_SELECTED` | 다른 후보 계약 또는 무선정 종료 | 종료 |

- [제안] 활성 상태는 `PENDING`, `DISCUSSING` 두 가지다. 화면 표시와 "진행 중 지원" 집계에 쓴다.
- 재지원을 금지하므로, 중복 제약은 활성 상태만이 아니라 **모든 상태**에 걸어야 한다. 활성 상태에만 부분 UNIQUE를 걸면 철회 후 재지원이 허용돼 정책과 어긋난다.

**제약 [제안]**
- `work_requests (project_id, creator_id)` UNIQUE.
  - 공개 지원은 `project_id`가 있으므로 공고당 크리에이터 1건만 존재할 수 있다.
  - 직접 의뢰는 `project_id = NULL`이라 이 제약을 받지 않는다.
- CHECK: `request_type = 'PROJECT_APPLICATION'`이면 `project_id IS NOT NULL`, `DIRECT_REQUEST`이면 `project_id IS NULL`.

**API 검사** (DB 제약만으로 부족한 부분)
- 공고가 `OPEN`이고, 서버 현재 시각이 `recruitment_end_at` 이전인지
- 지원자 역할이 `CREATOR`이고, 공고 작성자 본인이 아닌지
- 첨부한 패키지·포트폴리오가 지원자 소유인지
- UNIQUE 위반은 `409 CONFLICT`("이미 지원한 공고")로 응답

**직접 의뢰 중복 생성 방지 [제안]**
- `work_requests.client_request_key` 컬럼을 추가하고 `(client_id, client_request_key)` UNIQUE를 건다. ERD v0.6에 없는 컬럼이다.
- 클라이언트는 의뢰 작성 화면을 열 때 UUID를 만들고, 재시도할 때 같은 값을 보낸다.
- 서버는 같은 키가 이미 있으면 새로 만들지 않고 기존 요청을 반환한다.

## 4. 파일 업로드

**한도와 형식 [확정]** (무료 MVP 기준)

| 종류 | 파일당 한도 | 허용 형식 |
|---|---|---|
| 영상 | 50MB | MP4, MOV |
| 이미지 | 10MB | JPG·JPEG, PNG, WebP |
| ZIP | 50MB | ZIP |

- Supabase 무료 플랜의 파일당 업로드 한도(50MB)에 맞췄다. 유료로 전환할 때 다시 정한다.

**흐름 [확정]**
1. Express가 권한을 확인하고 업로드 권한(서명 URL)을 발급한다.
2. 브라우저가 Supabase Storage로 직접 업로드한다.
3. 업로드가 끝나면 서버가 실제 파일의 소유권·크기·형식을 확인한 뒤 업무 데이터에 연결한다.
- 계약 자료와 납품물은 비공개 버킷에 둔다. 다운로드·미리보기 URL을 발급할 때도 참여자 권한을 확인한다.

**검사 방식 [제안]**
- 발급할 때: 선언한 크기·MIME 형식·업로드 목적, 대상 리소스의 소유권과 거래 당사자 여부
- 완료를 확인할 때:
  - Storage 객체의 실제 크기를 확인한다.
  - 확장자를 믿지 않고 파일 앞부분(매직 바이트)을 읽어 실제 형식을 판정한다. MP4·MOV는 `ftyp`, PNG·JPEG·WebP·ZIP은 각자의 시그니처로 판정한다.
  - 업로더와 `files.owner_id`가 같은지 확인한다.
  - 하나라도 실패하면 `files.status = REJECTED`로 표시한다.
- 추가 방어: Supabase 버킷 설정에도 같은 크기·MIME 제한을 건다.
- [검증 필요] 영상은 끊겨도 이어서 올릴 수 있는 업로드(Supabase의 TUS 재개 가능 업로드)를 검토한다. Supabase는 6MB가 넘는 파일에 이 방식을 권장한다. 서명 URL 방식과 함께 쓸 수 있는지, 권한 발급과 어떻게 연결할지 먼저 확인한다.

**기존 300MB 표기 수정 대상**

| 문서 | 위치 | 수정 내용 |
|---|---|---|
| PRD | 15.6 파일과 편집 원본 ("300MB는 파일당 한도 후보") | 위 표로 변경. 300MB는 유료 전환 시 재검토 |
| PRD | 24장 기능명세 확정 항목 "파일" 행 | 300MB 적용 단위 → 위 표로 확정 |
| 기능명세서 | FILE-01 (파일 업로드) | 한도·형식·검사 단계 반영 |
| ERD v0.6 | `files` 업무 규칙 ("300MB 적용 단위는 D17 미결정") | 위 표로 교체 |
| ERD v0.6 | 미결정 D17 | 크기·형식 확정. ZIP 내부 검사와 보관 기간만 미결로 남김 |

## 5. 인증 토큰

**방식 [확정]**
- Access/Refresh 토큰을 쓴다.
- Refresh 토큰은 해시로 저장하고, 회전 이력을 보존한다.
- `auth_sessions`에 `family_id`, `replaced_by_id`, `last_used_at`을 추가한다.
- 기존 토큰 폐기와 새 토큰 발급은 한 트랜잭션에서 처리한다.
- 재사용을 감지하면 해당 토큰 계열을 폐기하되, 정상적인 동시 갱신 요청도 처리할 수 있게 설계한다.

**수명 [제안 · 초기값]**
- Access 토큰: 15분
- Refresh 토큰: 7일

**`auth_sessions` 추가 컬럼의 역할**
- `family_id`: 최초 로그인 시 생성. 회전해도 유지된다
- `replaced_by_id`: 이 토큰을 대체한 새 세션 행
- `last_used_at`: 마지막 사용 시각

**회전 절차 [제안]**
- 이전 Refresh 토큰 행은 삭제하지 않고 보존한다. DB에는 토큰 원문이 아닌 해시만 저장한다.
- 회전은 한 트랜잭션에서 처리한다.
  1. 새 행 INSERT
  2. `UPDATE auth_sessions SET replaced_by_id = :new, last_used_at = now() WHERE id = :old AND replaced_by_id IS NULL AND revoked_at IS NULL AND expires_at > now()`
  3. 2번에서 바뀐 행이 0개이면 롤백하고, 아래 재사용 판정으로 넘어간다.
- 재사용 감지: 이미 대체된 토큰이 유예 시간이 지난 뒤 다시 들어오면, 해당 `family_id`의 모든 세션을 폐기(`revoked_at`)하고 401로 응답한다.
- 로그아웃: 현재 `family_id` 전체를 폐기하고 쿠키를 삭제한다.

**정상적인 동시 갱신 [제안]**
- 같은 브라우저의 두 탭이 동시에 갱신하면, 한쪽은 이미 대체된 토큰을 보내게 된다.
- 대체된 지 짧은 유예 시간(초안 10초) 안이면 탈취로 보지 않는다. 계열을 폐기하지 않고 `409 REFRESH_RACE`로 응답한다.
- 클라이언트는 이 응답을 받으면 한 번 재시도한다. 그 사이 첫 응답의 새 쿠키가 저장됐으므로 새 토큰으로 갱신된다.
- 프론트엔드는 갱신 요청을 한 번에 하나만 보낸다(single-flight).
- 테스트할 것: 정상 회전, 유예 안의 동시 갱신, 유예 이후 재사용 시 계열 폐기, 로그아웃 후 갱신 실패

**저장·쿠키·CSRF·OAuth [제안]**
- Vercel rewrite로 `/api/*`를 Render로 전달해, 브라우저 입장에서 프론트엔드와 API가 같은 도메인이 되게 한다.
- Refresh 토큰: `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` 쿠키
- Access 토큰: 응답 본문으로 받아 메모리에만 보관한다. localStorage에 저장하지 않는다.
- CSRF: 쿠키가 실리는 엔드포인트(refresh·logout)는 `SameSite=Lax`, `Origin` 헤더 검사, `Content-Type: application/json` 요구로 막는다.
- OAuth: 콜백 주소를 Vercel 도메인의 `/api/auth/{provider}/callback`으로 통일하고, `state` 값을 검증한다.
- [검증 필요] rewrite를 거친 쿠키 설정·OAuth 콜백 동작을 실제 Vercel·Render 배포에서 확인한다.

## 6. 구현 범위

- [확정] `ledger_accounts`, `ledger_transactions`, `ledger_entries`는 초기 마이그레이션에서 제외한다(선택 확장 D23).
- [확정] `payments`, `payment_events`, `refunds`, `settlements`, `cancellation_agreements`, `disputes`의 상태와 거래 이력은 기본 범위에 포함한다.

**상태값 관리**
- [확정] 상태값은 `text` + DB `CHECK` 제약으로 저장하고, 공통 검증은 `@kemi/shared`의 Zod enum으로 한다. 두 목록은 서로 같아야 한다.
- [제안] `@kemi/shared`의 `as const` 배열을 유일한 원본으로 둔다. 마이그레이션의 CHECK 목록과 shared 배열이 같은지 비교하는 테스트를 첫 테이블 PR에 추가한다.
- Prisma 스키마로 표현할 수 없는 제약(CHECK, 부분 인덱스)은 마이그레이션 SQL에 직접 추가한다.

## 7. 기존 문서와 충돌하는 내용 (변경 목록)

| 문서 | 현재 내용 | 변경 |
|---|---|---|
| 공통 작업 기준 10-3 | `GET /api/health` | `GET /health`, `GET /health/ready` 유지 (0장 사유) |
| ERD v0.6 `users` | 이메일 UNIQUE + 자동 병합 금지 | 이메일 로그인 전용 · NULL 허용 · 정규화 UNIQUE |
| ERD v0.6 `auth_identities` | `provider_subject` | `provider_user_id`로 이름 변경, `provider_email` 추가 |
| ERD v0.6 `auth_sessions` | 해시·만료·폐기만 있음 | `family_id`, `replaced_by_id`, `last_used_at` 추가 |
| ERD v0.6 `work_requests` | 중복 제약 없음 | `(project_id, creator_id)` UNIQUE, `client_request_key` 추가 |
| ERD v0.6 `terms_versions` | 요청+버전 UNIQUE | 요청당 `SIGNING` 1개 부분 UNIQUE 추가 |
| ERD v0.6 `files`, D17 · PRD 15.6·24장 · 기능명세 FILE-01 | 300MB | 4장 표 |
| ERD v0.6 `ledger_*` | 선택 확장 | 초기 마이그레이션에서 제외 |
| ERD v0.6 상태값 | text (CHECK 언급 없음) | text + CHECK + shared Zod enum |

## 다음 작업

| 작업 | 처리 |
|---|---|
| ESLint·Prettier·GitHub Actions CI | [이슈 #2](https://github.com/Jubileekim/KEMI/issues/2) (프론트엔드와 공동 설정) |
| 회원 테이블 + 이메일 회원가입·로그인·토큰 회전 | PR #1 병합 후 최신 `main`에서 새 브랜치 |
| shared 상태값 enum과 CHECK 일치 테스트 | 첫 테이블 PR에 포함 |
| Supabase Realtime 자체 JWT 연동 검증 | 채팅 작업 전 별도 검증 |
| Swagger/OpenAPI 문서 뼈대 | 결정 필요 (PR #1 보완 또는 별도 이슈) |
