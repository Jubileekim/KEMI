# ERD v0.6 변경 명세 (회원·인증·프로필 영역)

- 기준: 통합 ERD v0.6 (2026-10-16, `KEMI_ERD_v0.6.html`)
- 근거: [결정 기록](../decisions/2026-10-19-backend-setup.md) 1장(이메일·소셜 계정), 5장(인증 토큰)
- 상태: [확정 · 구현] 팀 결정을 반영한 설계다. `apps/api/prisma/schema.prisma`와 마이그레이션 `20261019051147_auth_tables`에 반영했다(CHECK 제약 포함).
- 프로필 영역은 [결정 기록](../decisions/2026-10-19-backend-setup.md) 10장 기준이며, 마이그레이션 `20261021005250_role_profiles`에 반영했다. 선택지 값은 [제안 · D21 미확정]이다.
- 원본 ERD HTML은 고치지 않았다. 다음 ERD 버전(v0.7)을 만들 때 이 명세를 반영한다.

## 공통 규칙

- PK·FK는 `bigint`다. API와 JWT에서는 문자열(`"42"`)로 전달한다.
- 상태값은 `text` + `CHECK` 제약으로 저장하고, 허용 값은 `@kemi/shared`의 배열과 같게 유지한다.
- 회원은 삭제하지 않고 상태로 관리한다(ERD v0.6 규칙). 그래서 회원을 참조하는 FK는 `ON DELETE RESTRICT`를 쓴다.

## users — 회원

| 컬럼                       | 타입        | 필수      | v0.6과 비교 | 설명                                        |
| -------------------------- | ----------- | --------- | ----------- | ------------------------------------------- |
| `id`                       | bigint PK   | 필수      | 같음        |                                             |
| `email`                    | text        | NULL 허용 | 의미 변경   | 이메일 로그인 주소. 소셜 전용 가입자는 NULL |
| `password_hash`            | text        | NULL 허용 | 같음        | bcrypt(cost 12). 소셜 전용 계정은 NULL      |
| `name`                     | varchar(20) | 필수      | 같음        | 표시 이름 2~20자, 중복 허용                 |
| `role`                     | text        | 필수      | 같음        | `CLIENT` / `CREATOR` / `ADMIN`              |
| `status`                   | text        | 필수      | 같음        | `ACTIVE` / `RESTRICTED` / `WITHDRAWN`       |
| `created_at`, `updated_at` | timestamptz | 필수      | 같음        |                                             |

제약

- `UNIQUE (email)`: NULL은 서로 다른 값으로 취급되므로 소셜 전용 회원끼리 충돌하지 않는다.
- `CHECK (email IS NULL OR email = lower(btrim(email)))`: 정규화한 값만 저장한다.
- `CHECK (role IN (...))`, `CHECK (status IN (...))`
- 가입 API는 `role`로 `CLIENT`, `CREATOR`만 받는다. `ADMIN`은 DB에는 허용하되 API로는 만들 수 없다.

## auth_identities — 외부 인증 계정

| 컬럼               | 타입                 | 필수      | v0.6과 비교                        | 설명                                                         |
| ------------------ | -------------------- | --------- | ---------------------------------- | ------------------------------------------------------------ |
| `id`               | bigint PK            | 필수      | 같음                               |                                                              |
| `user_id`          | bigint FK → users.id | 필수      | 같음                               |                                                              |
| `provider`         | text                 | 필수      | 같음                               | `GOOGLE` / `KAKAO`                                           |
| `provider_user_id` | text                 | 필수      | **이름 변경** (`provider_subject`) | 제공자가 발급한 사용자 식별자                                |
| `provider_email`   | text                 | NULL 허용 | **추가**                           | 제공자가 알려준 이메일. `users.email`과 자동 병합하지 않는다 |
| `created_at`       | timestamptz          | 필수      | 같음                               |                                                              |

제약

- `UNIQUE (provider, provider_user_id)`
- `CHECK (provider IN ('GOOGLE', 'KAKAO'))`

## auth_sessions — 로그인 세션 (변경)

v0.6에서는 한 테이블이 로그인 세션과 개별 Refresh 토큰을 함께 맡았다. 이번 변경으로 로그인 세션만 담당한다.

| 컬럼                     | 타입                 | 필수      | v0.6과 비교 | 설명                                        |
| ------------------------ | -------------------- | --------- | ----------- | ------------------------------------------- |
| `id`                     | bigint PK            | 필수      | 같음        | Access 토큰의 `sid`. 회전해도 바뀌지 않는다 |
| `user_id`                | bigint FK → users.id | 필수      | 같음        |                                             |
| `expires_at`             | timestamptz          | 필수      | 의미 변경   | 로그인 시각 + 7일. 회전해도 연장하지 않는다 |
| `revoked_at`             | timestamptz          | NULL 허용 | 같음        | 세션 전체 폐기 시각                         |
| `revoke_reason`          | text                 | NULL 허용 | **추가**    | `LOGOUT` / `REUSE_DETECTED` / `ADMIN`       |
| `last_used_at`           | timestamptz          | NULL 허용 | **추가**    | 마지막 갱신 시각                            |
| `created_at`             | timestamptz          | 필수      | 같음        | 로그인 시각                                 |
| ~~`refresh_token_hash`~~ |                      |           | **삭제**    | `auth_refresh_tokens.token_hash`로 이동     |

제약

- `CHECK (revoke_reason IS NULL OR revoke_reason IN ('LOGOUT', 'REUSE_DETECTED', 'ADMIN'))`
- `CHECK ((revoked_at IS NULL) = (revoke_reason IS NULL))`: 폐기 시각과 사유는 항상 함께 기록된다.
- `INDEX (user_id)`

## auth_refresh_tokens — 개별 Refresh 토큰 (신규)

| 컬럼             | 타입                               | 필수      | 설명                                                  |
| ---------------- | ---------------------------------- | --------- | ----------------------------------------------------- |
| `id`             | bigint PK                          | 필수      |                                                       |
| `session_id`     | bigint FK → auth_sessions.id       | 필수      | 소속 세션 (토큰 계열)                                 |
| `token_hash`     | text                               | 필수      | 토큰 원문의 SHA-256 해시(hex). 원문은 저장하지 않는다 |
| `used_at`        | timestamptz                        | NULL 허용 | 회전에 사용된 시각. NULL이면 아직 쓸 수 있다          |
| `replaced_by_id` | bigint FK → auth_refresh_tokens.id | NULL 허용 | 이 토큰 대신 발급된 다음 토큰                         |
| `created_at`     | timestamptz                        | 필수      | 발급 시각                                             |

제약

- `UNIQUE (token_hash)`
- `UNIQUE (replaced_by_id)`: 한 토큰을 대신하는 다음 토큰은 하나뿐이다.
- `CHECK ((used_at IS NULL) = (replaced_by_id IS NULL))`: 사용 처리와 다음 토큰 연결은 항상 함께 기록된다.
- `INDEX (session_id)`
- 행은 삭제하지 않는다. 회전 이력을 보존한다.

## client_profiles — 의뢰인 프로필 (PROFILE-01)

| 컬럼                        | 설명                                     |
| --------------------------- | ---------------------------------------- |
| `user_id` bigint PK·FK      | 회원 (회원당 1개, `ON DELETE RESTRICT`)  |
| `brand_name`                | 브랜드명 (선택, API에서 최대 50자 검사)  |
| `introduction`              | 소개 (선택, API에서 최대 1000자 검사)    |
| `industry`                  | 제품 분야 (선택). `CHECK`로 허용 값 검사 |
| `website_url`, `social_url` | 자사몰·공식 SNS 주소 (선택, http/https)  |
| `created_at`, `updated_at`  |                                          |

- 모든 항목이 선택이다. 행이 없어도 의뢰 기능을 막지 않는다(P02).
- 로고는 파일 기능과 함께 추가한다.

## creator_profiles — 크리에이터 프로필 (PROFILE-02)

| 컬럼                             | 설명                                                                  |
| -------------------------------- | --------------------------------------------------------------------- |
| `user_id` bigint PK·FK           | 회원 (회원당 1개, `ON DELETE RESTRICT`)                               |
| `introduction`, `work_method`    | 소개·작업 방식 (선택, API에서 최대 1000자 검사)                       |
| `niche`                          | 분야 (선택). `CHECK`로 허용 값 검사                                   |
| `content_styles` text[]          | 콘텐츠 스타일 (복수). 기본 빈 배열, `NULL` 불가, `CHECK (<@ 허용 값)` |
| `production_roles` text[]        | 제작 역할 (복수). 위와 같음                                           |
| `service_status`                 | `DRAFT`(기본)·`PUBLIC`·`PRIVATE`. 프로필 저장으로는 바뀌지 않는다     |
| `is_available`, `available_from` | 작업 가능 여부(기본 false)·시작일(date)                               |
| `created_at`, `updated_at`       |                                                                       |

- ERD v0.6의 `jsonb` 목록 대신 `text[]`를 쓴다. 두 방식 모두 CHECK로 허용 값을 검사할 수 있지만, `text[]`는 열 타입만으로 문자열 배열이 보장되고 Prisma에서 `string[]`로 바로 받는다. 이유는 결정 기록 10장에 있다.
- `skills`·`creator_skills`, 경력·링크·이미지는 다음 PR에서 추가한다.

## 접근 제어 (Supabase Data API)

마이그레이션 `20261019070424_auth_data_api_lockdown`에서 처리한다. 첫 마이그레이션은 수정하지 않았다.

- `users`, `auth_identities`, `auth_sessions`, `auth_refresh_tokens` 모두 RLS를 켠다. 정책은 두지 않는다.
- `client_profiles`, `creator_profiles`도 만드는 마이그레이션(`20261021005250_role_profiles`)에서 RLS를 켠다. 기본 권한 변경 덕분에 두 역할의 권한은 처음부터 없다.
- `anon`·`authenticated` 역할의 테이블·시퀀스 권한을 회수한다.
- 서버(Express·Prisma)만 테이블 소유자 역할로 접근한다.

## 관계 요약

```text
users 1 ─── 0..N auth_identities
users 1 ─── 0..N auth_sessions
auth_sessions 1 ─── 1..N auth_refresh_tokens
auth_refresh_tokens 0..1 ─── 0..1 auth_refresh_tokens (replaced_by_id)
users 1 ─── 0..1 client_profiles
users 1 ─── 0..1 creator_profiles
```

## 다른 영역의 변경

회원·인증 외의 변경(작업 요청 중복 제약, 조건서 부분 UNIQUE, 파일 한도, `ledger_*` 제외 등)은 [결정 기록](../decisions/2026-10-19-backend-setup.md) 9장의 변경 목록에 있다. 해당 기능 PR에서 이 문서에 영역별로 추가한다.
