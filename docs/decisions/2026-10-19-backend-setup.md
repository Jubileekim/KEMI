# 백엔드 초기 구성 결정 기록 (2026-10-19)

- 기준 문서: PRD v1.4 · 기능명세 v0.5 · 통합 ERD v0.6 (2026-10-16)
- 범위: ERD v0.6 검토에서 나온 충돌 항목의 결정, 인프라 기준, 이후 스키마 PR이 따라야 할 규칙
- 상태: 팀 검토용. 이 PR은 서버·환경 변수·헬스 체크·Prisma 초기 구성까지만 구현하며, 아래 테이블 변경은 각 기능 PR에서 적용한다.

## 0. 인프라 기준

| 영역 | 결정 |
|---|---|
| DB | Supabase PostgreSQL (별도 PostgreSQL 서버 없음) |
| 파일 | Supabase Storage |
| 프론트엔드 배포 | Vercel |
| 백엔드 배포 | Render 무료 플랜 |
| 채팅 | 메시지 저장·조회는 Express API. Supabase Realtime은 "새 메시지" 변경 신호로만 사용 |
| 기한 처리 | 서버 시각과 DB 마감 시각으로 판정. node-cron은 보조 정리 작업 |
| 공통 패키지 | `packages/shared`: 요청 검증 스키마·공통 타입·오류 코드만. Prisma 모델은 공유하지 않음 |

### 헬스 체크 경로

- `GET /health`(생존 확인), `GET /health/ready`(DB 연결 확인)로 통일한다. 서비스 API는 `/api/*`에 둔다.
- 처음 논의한 `/api/health`와 다른 이유는 두 가지다.
  - Render 헬스 체크는 Vercel rewrite를 거치지 않고 Render 주소로 직접 호출된다.
  - `/api/*`에 붙일 인증·요청 제한 미들웨어와 분리하기 위해서다.
- 프론트엔드의 배포 연결 확인(Plan1 1주차)은 Render 주소의 `/health`를 직접 호출한다.

### 채팅 Realtime 권한 (선행 검증 필요)

- 비공개 채널에는 대화방 참여자 권한 검사가 필요하다.
- KEMI는 Supabase Auth가 아닌 자체 JWT를 쓰므로, Realtime 비공개 채널 인증에 자체 토큰을 연결하는 방법을 작은 검증으로 먼저 확인한다.
- 검증 전에는 일정 주기로 새 메시지를 조회하는 단순 방식으로 동작하게 하고, Realtime 신호를 받지 못해도 채팅이 동작해야 한다.

### 기한 처리

- 만료 여부의 기준은 항상 `서버 현재 시각 ≥ DB 마감 시각`이다. 조회와 처리 API가 직접 판정한다.
- cron은 만료된 요청 일괄 종료·알림 생성 같은 정리 작업만 맡는다.
- Render 무료 플랜은 잠들 수 있으므로, 서버 시작 시 놓친 정리 작업을 한 번 실행한다.
- 정리 작업은 조건부 UPDATE로 작성해 여러 번 실행돼도 결과가 같게 한다.

### DB 연결

- 실제 배포 환경에 맞춰 Supabase 대시보드의 주소를 고른다. 포트(6543/5432)를 미리 가정하지 않는다.
- Render(상시 실행 서버)는 Session pooler를 기본으로 하고, 같은 주소로 마이그레이션한다. 상세 설명은 `apps/api/README.md`에 있다.

## 1. 이메일과 소셜 계정

- `users.email`은 이메일 로그인용 주소다. 소셜 전용 가입자는 `NULL`을 허용한다.
  - 정규화(소문자·공백 제거) 후 UNIQUE. PostgreSQL UNIQUE는 `NULL`을 서로 다른 값으로 보므로 소셜 전용 회원이 여러 명이어도 충돌하지 않는다.
- 소셜 제공 이메일은 `auth_identities.provider_email`(선택)에 따로 저장한다.
- 소셜 계정 식별 기준은 `(provider, provider_user_id)` UNIQUE다.
  - ERD v0.6의 `provider_subject` 컬럼은 `provider_user_id`로 이름을 바꾼다.
- 같은 이메일이라는 이유로 자동 병합하지 않는다.
- 소셜 전용 계정(`password_hash`가 `NULL`)은 이메일·비밀번호 로그인을 할 수 없다.
- 계정 연결 기능은 MVP 범위에서 제외한다.

## 2. 공고당 계약 최대 한 개

**정책**
- MVP에서는 취소된 계약의 공고를 다시 열거나, 같은 공고에서 다른 크리에이터와 재계약하지 않는다.
- 재모집하려면 새 공고를 작성한다.
- 직접 의뢰는 `project_id = NULL`이므로 별개의 거래다.

**제약**
- `contracts.project_id`에 UNIQUE를 건다.
  - 취소된 계약도 행이 남아 있으므로 같은 공고의 두 번째 계약은 계속 막힌다. 이것이 위 정책과 일치한다.
  - 직접 의뢰는 `NULL`이라 서로 충돌하지 않는다.
- `contracts.work_request_id`, `contracts.terms_version_id`도 UNIQUE를 유지한다.

**계약 초안과 충돌하지 않는지 확인한 결과**
- ERD v0.6에서 계약 전 초안과 수정은 모두 `terms_versions`에서 이뤄진다. `contracts` 행은 같은 버전의 두 번째 유효 서명 시점에 처음 생성된다.
- 그래서 후보마다 초안을 여러 개 만들고 고쳐도 `contracts.project_id` 제약과 충돌하지 않는다.
- 두 후보의 두 번째 서명이 동시에 들어오면 한쪽은 UNIQUE 위반으로 실패한다. 서버는 이를 `409 CONFLICT`("이미 다른 후보와 계약이 확정됨")로 응답한다.
- 같은 트랜잭션에서 다른 후보의 미확정 `terms_versions`는 `VOID`로, 해당 `work_requests`는 `NOT_SELECTED`로 바꾼다.

**취소와 환불은 따로 관리**
- 계약 취소: `contracts.status = CANCELLED`
- 환불 완료: `refunds.status = SUCCEEDED`
- 계약 취소만으로 환불 완료로 표시하지 않는다.

## 3. 공개 모집 지원 중복

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

- 활성 상태는 `PENDING`, `DISCUSSING` 두 가지로 확정한다. 화면 표시와 "진행 중 지원" 집계에 사용한다.
- 하지만 MVP는 철회 후 재지원을 금지하므로, 중복 제약은 활성 상태만이 아니라 **모든 상태**에 걸어야 한다.
  - 활성 상태에만 부분 UNIQUE를 걸면 철회 후 재지원이 허용돼 정책과 어긋난다.

**제약**
- `work_requests (project_id, creator_id)` UNIQUE.
  - 공개 지원은 `project_id`가 있으므로 공고당 크리에이터 1건만 존재할 수 있다.
  - 직접 의뢰는 `project_id = NULL`이므로 이 제약을 받지 않는다.
- CHECK: `request_type = 'PROJECT_APPLICATION'`이면 `project_id IS NOT NULL`, `DIRECT_REQUEST`이면 `project_id IS NULL`.

**API 검사** (DB 제약만으로 부족한 부분)
- 공고가 `OPEN`이고, 서버 현재 시각이 `recruitment_end_at` 이전인지
- 지원자 역할이 `CREATOR`이고, 공고 작성자 본인이 아닌지
- 첨부한 패키지·포트폴리오가 지원자 소유인지
- UNIQUE 위반은 `409 CONFLICT`("이미 지원한 공고")로 응답

**직접 의뢰 중복 생성 방지**
- 공개 지원 제약과 별도로, 네트워크 재시도로 같은 요청이 두 번 생성되는 것을 막는다.
- `work_requests.client_request_key` 컬럼을 추가하고 `(client_id, client_request_key)` UNIQUE를 건다. (ERD v0.6에 없는 컬럼 추가)
- 클라이언트는 의뢰 작성 화면을 열 때 UUID를 만들고 재시도 때 같은 값을 보낸다.
- 서버는 같은 키가 이미 있으면 새로 만들지 않고 기존 요청을 반환한다.

## 4. 파일 제한

| 종류 | 파일당 한도 | 허용 형식 (초안) |
|---|---|---|
| 영상 | 50MB | mp4, mov |
| ZIP | 50MB | zip |
| 이미지 | 10MB | jpg, png, webp |

- Supabase 무료 플랜의 파일당 업로드 한도(50MB)에 맞춘 무료 MVP 기준이다. 유료 플랜으로 전환할 때 다시 정한다.

**검사 위치** (두 단계 모두)
1. 업로드 권한(서명 URL) 발급 시: 요청한 파일 크기·MIME 형식, 업로드 목적, 대상 리소스의 소유권·거래 당사자 여부
2. 업로드 완료 확인 시: Storage에 실제로 올라간 객체의 크기·형식을 다시 확인하고, 업로더와 `files.owner_id`가 같은지 확인. 실패하면 `files.status = REJECTED`
- 추가 방어: Supabase 버킷 설정에도 같은 크기·형식 제한을 건다.

**기존 300MB 표기 수정 대상**

| 문서 | 위치 | 수정 내용 |
|---|---|---|
| PRD | 15.6 파일과 편집 원본 ("300MB는 파일당 한도 후보") | 무료 MVP 기준 영상·ZIP 50MB, 이미지 10MB로 변경, 300MB는 유료 전환 시 재검토 |
| PRD | 24장 기능명세 확정 항목 "파일" 행 | 300MB 적용 단위 → 위 표로 확정 |
| 기능명세서 | FILE-01 (파일 업로드) | 한도·형식·검사 단계 반영 |
| ERD v0.6 | `files` 업무 규칙 ("300MB 적용 단위는 D17 미결정") | 위 표로 교체 |
| ERD v0.6 | 미결정 D17 | 크기·형식 확정, ZIP 내부 검사·보관 기간만 미결로 남김 |

## 5. Refresh 토큰

**기본값**
- Access 토큰: 15분
- Refresh 토큰: 7일

**`auth_sessions` 컬럼 추가**
- `family_id`: 최초 로그인 시 생성. 회전해도 유지
- `replaced_by_id`: 이 토큰을 대체한 새 세션 행
- `last_used_at`: 마지막 사용 시각

**규칙**
- 이전 Refresh 토큰 행은 삭제하지 않고 보존한다. DB에는 토큰 원문이 아닌 해시만 저장한다.
- 회전은 한 트랜잭션에서 처리한다.
  1. 새 행 INSERT
  2. `UPDATE auth_sessions SET replaced_by_id = :new, last_used_at = now() WHERE id = :old AND replaced_by_id IS NULL AND revoked_at IS NULL AND expires_at > now()`
  3. 2번에서 바뀐 행이 0개이면 롤백하고, 아래 재사용 판정으로 넘어간다.
- 재사용 감지: 이미 대체된 토큰이 유예 시간 이후에 다시 들어오면 해당 `family_id`의 모든 세션을 폐기(`revoked_at`)하고 401을 응답한다.
- 로그아웃: 현재 `family_id` 전체를 폐기하고 쿠키를 삭제한다.

**정상적인 동시 갱신 처리**
- 같은 브라우저의 두 탭이 동시에 갱신하면, 한쪽은 이미 대체된 토큰을 보내게 된다.
- 대체된 지 짧은 유예 시간(초안 10초) 안이면 탈취로 보지 않는다. 계열을 폐기하지 않고 `409 REFRESH_RACE`를 응답한다.
- 클라이언트는 이 응답을 받으면 한 번 재시도한다. 그 사이 첫 응답으로 새 쿠키가 저장됐으므로 새 토큰으로 갱신된다.
- 프론트엔드는 갱신 요청을 한 번에 하나만 보내도록 공유한다(single-flight).
- 테스트 대상: 정상 회전, 동시 갱신(유예 안), 유예 이후 재사용 시 계열 폐기, 로그아웃 후 갱신 실패. 회원가입·로그인 PR에서 구현과 함께 작성한다.

**저장과 Vercel rewrite**
- Vercel rewrite로 `/api/*`를 Render로 전달해, 브라우저 입장에서 프론트엔드와 API가 같은 도메인이 되게 한다.
- Refresh 토큰: `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` 쿠키
- Access 토큰: 응답 본문으로 받아 메모리에만 보관한다. localStorage에 저장하지 않는다.
- CSRF: 쿠키가 실리는 엔드포인트(refresh·logout)는 `SameSite=Lax`, `Origin` 헤더 검사, `Content-Type: application/json` 요구로 막는다.
- OAuth: 콜백 주소를 Vercel 도메인의 `/api/auth/{provider}/callback`으로 통일하고, `state` 값을 검증한다.
- 회원가입·로그인 PR에서 실제 배포 환경으로 확인한다.

## 6. 구현 범위

- `ledger_accounts`, `ledger_transactions`, `ledger_entries`는 초기 마이그레이션에서 제외한다(선택 확장 D23).
- `payments`, `payment_events`, `refunds`, `settlements`, `cancellation_agreements`, `disputes`의 상태와 거래 이력은 기본 범위에 포함한다.

**상태값 관리**
- 상태값은 `text` + DB `CHECK` 제약으로 저장하고, 공통 검증은 `@kemi/shared`의 Zod enum으로 한다.
- 양쪽 값이 어긋나지 않도록 `@kemi/shared`의 `as const` 배열을 유일한 원본으로 둔다.
- 마이그레이션의 CHECK 목록과 shared 배열이 같은지 비교하는 테스트를 첫 테이블 PR에 추가한다.
- Prisma 스키마로 표현할 수 없는 제약(CHECK, 부분 인덱스)은 마이그레이션 SQL에 직접 추가한다.

## 다음 작업 (별도 PR)

1. 회원 테이블(`users`, `auth_identities`, `auth_sessions`, `client_profiles`, `creator_profiles`) + 이메일 회원가입·로그인·토큰 회전
2. 공통 상태값 shared enum과 CHECK 일치 테스트
3. Supabase Realtime 자체 JWT 연동 검증
4. ESLint·Prettier·GitHub Actions CI (프론트엔드와 공동 설정, [이슈 #2](https://github.com/Jubileekim/KEMI/issues/2))
