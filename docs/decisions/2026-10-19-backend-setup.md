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

**확정 사항 [확정]**
- Access/Refresh 토큰을 쓴다.
- 수명
  - Access 토큰: 15분
  - 로그인 세션(Refresh 토큰 계열): 로그인 시점부터 최대 7일. 회전해도 이 기한은 늘어나지 않는다.
- Refresh 토큰은 해시로만 저장하고, 회전 이력을 보존한다.
- 기존 토큰을 사용 처리하는 일과 새 토큰을 발급하는 일은 한 트랜잭션에서 처리한다.
- 두 종류의 폐기를 구분한다.
  - 회전으로 "사용 처리된" 개별 토큰
  - 로그아웃·탈취 감지로 "폐기된" 로그인 세션 전체
- Access 토큰에 담긴 세션 ID는 회전 때문에 무효화되지 않는다.
- 동시 갱신 유예는 초기값 10초다. 유예 시간은 이미 사용한 토큰으로 새 토큰을 다시 발급해 주는 시간이 **아니다**.
- 프론트엔드는 갱신 요청을 하나로 모은다. 서버는 정상적인 동시 요청과 재사용(탈취 의심)을 구분한다.

**식별자 [확정]**
- PK·FK는 ERD v0.6대로 `bigint`다.
- API 응답과 JWT의 `sub`(사용자 ID)·`sid`(세션 ID)는 문자열로 보낸다(예: `"42"`).
- `JSON.stringify`는 `BigInt`를 직렬화하지 못한다. 그래서 응답을 만들 때 서버가 `bigint`를 문자열로 바꾸고, 요청으로 받은 ID는 숫자 형식인지 검증한 뒤 `BigInt`로 바꾼다.

**테이블 구조 [제안]**

ERD v0.6의 `auth_sessions` 한 테이블을 둘로 나눈다. 개별 토큰의 "사용됨"과 세션 전체의 "폐기됨"이 서로 다른 행에 기록되므로, 위의 두 가지 폐기가 자연스럽게 구분된다.

`auth_sessions` — 로그인 세션 1건 = 토큰 계열 1개

| 컬럼 | 설명 |
|---|---|
| `id` bigint PK | Access 토큰의 `sid`. 회전해도 바뀌지 않는다 |
| `user_id` | 회원 |
| `expires_at` | 로그인 시각 + 7일. 회전해도 바꾸지 않는다 |
| `revoked_at`, `revoke_reason` | 세션 전체 폐기 시각과 사유(`LOGOUT` / `REUSE_DETECTED` / `ADMIN`) |
| `last_used_at` | 마지막 갱신 시각 |
| `created_at` | 로그인 시각 |

`auth_refresh_tokens` — 개별 Refresh 토큰

| 컬럼 | 설명 |
|---|---|
| `id` bigint PK | |
| `session_id` FK | 소속 세션 (앞서 말한 `family_id`의 역할) |
| `token_hash` UNIQUE | 토큰 원문의 SHA-256 해시 |
| `used_at` | 회전에 사용된 시각. NULL이면 아직 유효 |
| `replaced_by_id` UNIQUE | 이 토큰 대신 발급된 다음 토큰 |
| `created_at` | 발급 시각 |

- 앞서 합의한 `family_id`·`replaced_by_id`·`last_used_at`의 역할은 모두 유지된다. 다만 `family_id`는 `session_id` FK가 된다.
- Refresh 쿠키의 `Max-Age`는 세션 `expires_at`까지 남은 시간으로 정한다.

**회전 절차 [제안]**

`POST /api/auth/refresh` 하나를 처리하는 트랜잭션:
1. 쿠키의 토큰을 해시해서 `auth_refresh_tokens` 행을 `SELECT … FOR UPDATE`로 잠그고, 소속 세션과 함께 읽는다.
2. 토큰이 없거나, 세션이 폐기됐거나, 세션이 만료(`expires_at ≤ now`)됐으면 `401 SESSION_REVOKED`로 응답하고 쿠키를 삭제한다.
3. `used_at`이 NULL이면 정상 회전이다.
   - 새 토큰 행을 INSERT한다.
   - 이전 행에 `used_at = now`, `replaced_by_id = 새 행`을 기록한다.
   - 세션 `last_used_at`을 갱신한다.
   - `200`과 새 Access 토큰, 새 쿠키를 응답한다.
4. `used_at`이 이미 있으면:
   - `now − used_at ≤ 10초`: 정상적인 동시 요청으로 본다. **새 토큰을 발급하지 않고**, 세션도 폐기하지 않는다. `409 REFRESH_RACE`로 응답하고 쿠키는 건드리지 않는다.
   - 10초 초과: 재사용(탈취 의심)으로 본다. 세션에 `revoked_at = now`, `revoke_reason = REUSE_DETECTED`를 기록하고, `401 SESSION_REVOKED`로 응답하며 쿠키를 삭제한다.
- `FOR UPDATE` 잠금 때문에 같은 토큰으로 온 두 요청은 순서대로 처리된다. 두 요청이 모두 새 토큰을 받는 일은 없다.

**동시 갱신 응답·재시도 순서 [제안]**
1. 프론트엔드는 한 화면 안에서 갱신 요청을 하나로 모은다(single-flight). Access 토큰 만료(`401 TOKEN_EXPIRED`)를 받은 여러 요청이 하나의 갱신 결과를 함께 기다린다.
2. 그래도 같은 토큰으로 두 요청이 도착할 수 있다(여러 탭 등). 이때 먼저 잠금을 얻은 요청 A는 `200`과 새 쿠키를 받는다. 뒤의 요청 B는 A가 커밋된 뒤 `409 REFRESH_RACE`를 받는다.
3. B는 `409`를 받으면 잠시(예: 300ms) 기다린 뒤 **한 번만** 다시 갱신한다. 브라우저에는 A가 받은 새 쿠키가 저장돼 있으므로, 재시도는 새 토큰으로 `200`을 받는다.
4. 재시도도 `409`나 `401`이면 로그아웃 상태로 처리하고 로그인 화면으로 보낸다. 무한히 재시도하지 않는다.

**로그아웃 [제안]**
- 세션에 `revoked_at`, `revoke_reason = LOGOUT`을 기록하고 쿠키를 삭제한다.
- 이후 Refresh 요청은 `401`이다. 아직 만료되지 않은 Access 토큰도 다음 요청부터 `401`이다(8장 Access 토큰 검증).

**비밀번호 해시 [확정]**
- `bcrypt`, cost 12를 쓴다.
- 확인 결과 (2026-10-19, 이 PC의 Windows · Node 24.18, 저장소 밖 임시 폴더)
  - `bcrypt@6.0.0`의 설치, 해시, 비교가 성공했다. 맞는 비밀번호는 `true`, 틀린 비밀번호는 `false`로 나왔다.
  - cost 12 해시 1회는 약 200ms 걸렸다.
  - 패키지에 미리 빌드된 바이너리(`win32-x64`, `linux-x64` 등)가 들어 있어 네이티브 빌드 없이 로드됐다.
  - npm 11은 설치 스크립트(`node-gyp-build`)를 실행하지 않았다는 경고를 낸다. 미리 빌드된 바이너리로 정상 동작했다.
- [검증 필요] Render와 GitHub Actions(Linux x64)에서의 설치·실행은 인증 PR의 CI·배포에서 확인한다.
- bcrypt는 72바이트 이후를 무시하므로, 입력 검증에서 비밀번호 길이를 72바이트 이하로 제한한다.

**오류 응답 [확정]**
- 형식: `{ error: { code, message, details? } }`
- `details`에는 공개해도 되는 정보만 넣는다. 예: 검증 실패 필드의 경로와 메시지.
- 스택, SQL, 토큰, 해시, 내부 ID 같은 정보는 넣지 않는다.
- [제안] 인증 오류 코드

| 코드 | 상태 | 언제 |
|---|---|---|
| `VALIDATION_FAILED` | 400 | 입력 검증 실패 (`ADMIN` 가입 요청 포함) |
| `EMAIL_ALREADY_EXISTS` | 409 | 이미 가입된 이메일 |
| `INVALID_CREDENTIALS` | 401 | 이메일이 없거나, 비밀번호가 틀리거나, 소셜 전용 계정일 때 (모두 같은 메시지) |
| `TOKEN_EXPIRED` | 401 | Access 토큰 만료 (프론트엔드는 갱신 시도) |
| `UNAUTHENTICATED` | 401 | Access 토큰이 없거나 잘못됨 |
| `SESSION_REVOKED` | 401 | 세션 폐기·만료, 재사용 감지 |
| `REFRESH_RACE` | 409 | 유예 안의 동시 갱신 (위 재시도 순서) |
| `FORBIDDEN` | 403 | 회원 상태가 이용 불가(제한·탈퇴) |

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

## 7. 테스트 DB [확정]

- 로컬 Docker PostgreSQL(`apps/api/docker-compose.test.yml`)을 쓴다. 개발용 Supabase DB로 테스트를 대신 실행하지 않는다.
- 개발용은 `DATABASE_URL`, 테스트용은 `TEST_DATABASE_URL`로 구분한다.
- 안전장치: `TEST_DATABASE_URL`이 없거나, 로컬 호스트가 아니거나, DB 이름이 `_test`로 끝나지 않거나, `DATABASE_URL`과 같은 DB이면 테스트가 실패한다. 개발 DB로 자동 대체하지 않는다.
- Prisma 마이그레이션(`migrate deploy`)을 테스트 DB에 적용한 뒤 DB 테스트를 실행한다.
- GitHub Actions는 PostgreSQL 서비스 컨테이너로 같은 테스트를 실행한다(`.github/workflows/api-ci.yml`).

## 8. 회원가입·로그인 PR 설계

**진행 방식 [확정]**
- PR #1이 병합되기 전에는 인증 구현을 시작하지 않는다.
- 병합 후 기존 `feat/auth-email` 브랜치와 작업 상태를 확인하고, 최신 `main`을 반영해 한 세션에서 진행한다.
- 강제 초기화로 기존 작업을 지우지 않는다. `auth-draft` stash 원본도 유지한다.

**범위**
- 포함: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`
- 제외: 프로필 수정 API(다음 프로필 PR), 소셜 로그인, 비밀번호 재설정

**가입 역할 [확정]**
- 가입 요청으로 고를 수 있는 역할은 `CLIENT`, `CREATOR`뿐이다. `ADMIN`을 보내면 `400 VALIDATION_FAILED`로 응답한다.
- `ADMIN`은 운영용 시드·스크립트로만 만든다.

**Access 토큰 검증 [확정]**
- 서명과 만료만 보지 않는다. 요청마다 DB에서 다음을 확인한다.
  1. 토큰의 `sid`에 해당하는 `auth_sessions` 행이 폐기되지 않았는지(`revoked_at IS NULL`)
  2. 그 세션의 `expires_at`이 지나지 않았는지
  3. 회원 상태가 `ACTIVE`인지
- 회전은 `auth_refresh_tokens`에만 기록되고 세션 행은 그대로이므로, 회전한 뒤에도 기존 Access 토큰은 만료 전까지 계속 유효하다.
- 로그아웃이나 재사용 감지로 세션이 폐기되면, 만료되지 않은 Access 토큰도 바로 막힌다.
- [제안] 실패 응답: 세션 폐기·만료는 `401 SESSION_REVOKED`, 회원 제한·탈퇴는 `403 FORBIDDEN`
- [제안] 비용: 요청마다 조회가 1회(세션과 회원을 함께 조회) 늘어난다. MVP 규모에서는 감수한다.

**실제 DB로 검증할 테스트 [확정]**

| 시나리오 | 기대 결과 |
|---|---|
| 회원가입 | 201, 비밀번호는 bcrypt 해시로만 저장, 응답에 해시·토큰 해시 없음 |
| 이메일 중복 가입 | 대소문자·공백만 다른 이메일도 `409 EMAIL_ALREADY_EXISTS` |
| `ADMIN` 가입 요청 | `400 VALIDATION_FAILED` |
| 정상 로그인 | 200, Access 토큰과 Refresh 쿠키 발급, 사용자 ID는 문자열 |
| 잘못된 비밀번호 | `401 INVALID_CREDENTIALS`. 없는 이메일·소셜 전용 계정과 같은 응답 |
| 정상 회전 | 새 쿠키 발급, 이전 토큰 행은 `used_at`·`replaced_by_id`가 채워진 채 보존, 세션 `sid`는 그대로, 기존 Access 토큰도 계속 유효 |
| 최대 수명 | 회전해도 세션 `expires_at`이 바뀌지 않음, 만료된 세션의 갱신은 `401` |
| 동시 갱신 | 같은 토큰으로 동시에 두 번 요청하면 하나는 200(새 쿠키), 하나는 `409 REFRESH_RACE`(새 토큰 없음). 세션은 유지되고, 409 쪽이 새 쿠키로 재시도하면 200 |
| 재사용 감지 | 사용한 지 10초가 지난 토큰을 다시 쓰면 `401 SESSION_REVOKED`, 세션 `revoke_reason = REUSE_DETECTED`, 최신 토큰과 Access 토큰도 실패 |
| 로그아웃 후 차단 | Refresh는 `401`, 기존 Access 토큰으로 `GET /api/auth/me`도 `401` |
| 회원 상태 | 제한된 회원의 Access 토큰은 `403` |

- 10초가 지난 상황은 실제로 기다리지 않는다. 테스트에서 `used_at`을 11초 전으로 바꿔서 재현한다.
- DB 테스트 격리
  - `db` 프로젝트는 테스트 파일을 한 번에 하나씩 실행한다(`fileParallelism: false`).
  - 각 테스트 전에 테이블을 비운다.
  - 단위 테스트(`unit` 프로젝트)는 DB에 접속하지 않아서, 함께 실행해도 서로 영향이 없다.

**`auth-draft` 검토 결과**

인증 세션이 중단 전에 만든 초안이다. stash 원본(`auth-draft`)은 유지한다.

| 항목 | 판단 |
|---|---|
| `packages/shared/src/auth.ts`: 이메일 정규화, 가입 역할에서 `ADMIN` 제외, bcrypt 72바이트 상한, 요청 스키마 | 재사용 |
| `packages/shared/src/status.ts`: `as const` 배열 + Zod enum 구조 | 구조 재사용, 값은 수정 |
| `AuthIdentity` 모델 (`(provider, provider_user_id)` UNIQUE, `provider_email`) | 재사용 (PK는 `bigint`로 수정) |
| `AuthSession` 한 테이블 구조 | 수정: `auth_sessions` + `auth_refresh_tokens` 두 테이블 (5장) |
| PK를 `UUID`로 바꿈 | 수정: `bigint` 유지 (확정) |
| `users.status` 값 `SUSPENDED` | 수정: ERD v0.6은 `ACTIVE / RESTRICTED / WITHDRAWN` |
| 표시 이름을 프로필 테이블의 `display_name`에 둠 | 수정: ERD v0.6은 `users.name`(2~20자, 중복 허용) |
| 마이그레이션에 CHECK 제약 없음 (주석에는 있다고 적음) | 수정: role·status·provider·revoke_reason·이메일 정규화 CHECK 추가 |
| 마이그레이션 시각 `20261019120000` (손으로 쓴 값) | 새로 생성 |
| 오류 코드에 `TOKEN_EXPIRED`, `SESSION_REVOKED` 없음 | 추가 |
| `bcryptjs` | 수정: `bcrypt`로 교체 (확정) |
| `jose`(JWT), `cookie-parser` | 재사용 |

**PostgreSQL 버전 [검증 필요]**
- 테스트 DB(로컬 Docker, CI)는 현재 PostgreSQL 17(확인 버전 17.11)이다.
- 팀 개발용 Supabase DB의 주 버전은 아직 확인하지 못했다. Supabase 대시보드의 프로젝트 설정(Infrastructure)이나 `SELECT version();`으로 확인한다.
- 다르면(예: 15) `apps/api/docker-compose.test.yml`과 `.github/workflows/api-ci.yml`의 이미지를 같은 주 버전으로 바꾼다.

## 9. 기존 문서와 충돌하는 내용 (변경 목록)

| 문서 | 현재 내용 | 변경 |
|---|---|---|
| 공통 작업 기준 10-3 | `GET /api/health` | `GET /health`, `GET /health/ready` 유지 (0장 사유) |
| ERD v0.6 `users` | 이메일 UNIQUE + 자동 병합 금지 | 이메일 로그인 전용 · NULL 허용 · 정규화 UNIQUE |
| ERD v0.6 `auth_identities` | `provider_subject` | `provider_user_id`로 이름 변경, `provider_email` 추가 |
| ERD v0.6 `auth_sessions` | 한 테이블에 해시·만료·폐기 | `auth_sessions`(로그인 세션) + `auth_refresh_tokens`(개별 토큰)로 분리, 세션 최대 수명 고정 (5장) |
| ERD v0.6 `work_requests` | 중복 제약 없음 | `(project_id, creator_id)` UNIQUE, `client_request_key` 추가 |
| ERD v0.6 `terms_versions` | 요청+버전 UNIQUE | 요청당 `SIGNING` 1개 부분 UNIQUE 추가 |
| ERD v0.6 `files`, D17 · PRD 15.6·24장 · 기능명세 FILE-01 | 300MB | 4장 표 |
| ERD v0.6 `ledger_*` | 선택 확장 | 초기 마이그레이션에서 제외 |
| ERD v0.6 상태값 | text (CHECK 언급 없음) | text + CHECK + shared Zod enum |
| 공통 작업 기준 · Plan1 | 프로필 API를 회원가입과 같은 날 구현 | 프로필 수정 API는 다음 프로필 PR로 분리 |

## 다음 작업

| 작업 | 처리 |
|---|---|
| API CI (타입 검사·단위·DB 테스트·빌드) | PR #1에 추가 (`.github/workflows/api-ci.yml`) |
| ESLint·Prettier·프론트엔드 CI | [이슈 #2](https://github.com/Jubileekim/KEMI/issues/2) (프론트엔드와 공동 설정) |
| 회원 테이블 + 이메일 회원가입·로그인·토큰 회전 | PR #1 병합 후 기존 `feat/auth-email` 상태를 확인하고 최신 `main`을 반영해 진행 (8장) |
| 의뢰인·크리에이터 프로필 수정 API | 인증 PR 다음 프로필 PR |
| shared 상태값 enum과 CHECK 일치 테스트 | 첫 테이블 PR에 포함 |
| Supabase Realtime 자체 JWT 연동 검증 | 채팅 작업 전 별도 검증 |
| Swagger/OpenAPI 문서 뼈대 | 결정 필요 (PR #1 보완 또는 별도 이슈) |
| 팀 개발용 Supabase PostgreSQL 주 버전 확인 | 확인 후 테스트 DB·CI 이미지 맞춤 (8장) |
