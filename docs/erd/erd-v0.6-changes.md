# ERD v0.6 변경 명세 (회원·인증 영역)

- 기준: 통합 ERD v0.6 (2026-10-16, `KEMI_ERD_v0.6.html`)
- 근거: [결정 기록](../decisions/2026-10-19-backend-setup.md) 1장(이메일·소셜 계정), 5장(인증 토큰)
- 상태: [확정] 팀 결정을 반영한 설계다. Prisma 스키마와 마이그레이션은 회원가입·로그인 PR에서 이 명세대로 만든다.
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

## 관계 요약

```text
users 1 ─── 0..N auth_identities
users 1 ─── 0..N auth_sessions
auth_sessions 1 ─── 1..N auth_refresh_tokens
auth_refresh_tokens 0..1 ─── 0..1 auth_refresh_tokens (replaced_by_id)
```

## 다른 영역의 변경

회원·인증 외의 변경(작업 요청 중복 제약, 조건서 부분 UNIQUE, 파일 한도, `ledger_*` 제외 등)은 [결정 기록](../decisions/2026-10-19-backend-setup.md) 9장의 변경 목록에 있다. 해당 기능 PR에서 이 문서에 영역별로 추가한다.
