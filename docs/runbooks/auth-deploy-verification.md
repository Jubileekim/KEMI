# 인증 배포·검증 절차 (PR #4 병합 후)

PR #4(이메일 회원가입·로그인·토큰 회전)가 `main`에 병합된 뒤 진행한다. 순서대로 진행하고, 각 단계의 결과를 마지막 "결과 기록" 표에 남긴다.

| 단계                                            | 담당                | 선행 조건                 |
| ----------------------------------------------- | ------------------- | ------------------------- |
| 1. 팀 개발용 Supabase에 마이그레이션 적용       | 백엔드              | PR #4 병합, 팀원 공유     |
| 2. Render 백엔드 배포 설정                      | 백엔드              | 1                         |
| 3. Vercel 프론트엔드 rewrite 설정               | 프론트엔드          | 2                         |
| 4. 클라이언트 IP 확인 → `TRUST_PROXY_HOPS` 결정 | 백엔드              | 2, 3                      |
| 5. 브라우저 인증 검증                           | 프론트엔드 + 백엔드 | 1–4, 프론트엔드 인증 화면 |

비밀값(DB 비밀번호, `JWT_ACCESS_SECRET`)은 로컬 `.env`와 Render 대시보드에만 넣는다. 저장소·이슈·PR·채팅에 붙여 넣지 않는다.

## 1. 팀 개발용 Supabase에 마이그레이션 적용

### 1-1. 적용 전에 팀원에게 공유

이슈나 팀 채널에 아래 내용을 남기고, 팀원 확인을 받은 뒤 적용한다.

```text
[DB 마이그레이션 적용 예정]
- 대상: 팀 개발용 Supabase 프로젝트 (<프로젝트 이름>), PostgreSQL 17.11
- 마이그레이션: 20261019051147_auth_tables, 20261019070424_auth_data_api_lockdown (함께 적용)
- 변경: users, auth_identities, auth_sessions, auth_refresh_tokens 테이블과 CHECK 제약을 새로 만든다. 기존 테이블·데이터는 바꾸지 않는다.
- 적용 방법: prisma migrate deploy (migrate dev·reset은 쓰지 않음)
- 되돌리는 방법: 아래 "되돌리기" SQL (이 테이블에 쌓인 회원 데이터도 함께 지워진다)
- 예정 시각: <시각>
```

### 1-2. 준비

1. Supabase 대시보드 → **Connect**에서 Session pooler 주소를 복사한다(`apps/api/README.md` "DB 연결 주소 고르기").
2. `apps/api/.env`를 만든다(커밋하지 않는다).

   ```text
   NODE_ENV=development
   DATABASE_URL=<Session pooler 주소>
   JWT_ACCESS_SECRET=<아래 명령으로 만든 값>
   APP_ORIGIN=http://localhost:5173
   ```

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

3. 대상이 맞는지 확인한다. Supabase SQL Editor에서 `SELECT version();`을 실행해 17.11인지 본다.

### 1-3. 적용 전 읽기 전용 점검

적용 전에 대상 DB의 현재 상태를 **읽기 전용**으로 확인한다. Supabase SQL Editor에서 실행하거나, 같은 접속 정보로 읽기 전용 트랜잭션(`BEGIN READ ONLY`)에서 실행한다. 아래 SQL은 아무것도 바꾸지 않는다.

```sql
BEGIN READ ONLY;

-- (1) 대상 확인: 버전·DB·접속 역할
SELECT version(), current_database(), current_user;

-- (2) public 스키마의 기존 테이블 목록
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

-- (3) 만들 테이블과 같은 이름이 이미 있는지 (모든 스키마)
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_name IN ('users', 'auth_identities', 'auth_sessions', 'auth_refresh_tokens', '_prisma_migrations');

-- (4) Prisma 마이그레이션 이력 테이블이 있는지 (NULL이면 없음)
SELECT to_regclass('public._prisma_migrations') AS prisma_history;

-- (5) 새 테이블에 RLS 등을 자동으로 거는 이벤트 트리거
SELECT evtname, evtevent, evtenabled FROM pg_event_trigger ORDER BY evtname;

-- (6) 접속 역할의 권한 속성
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;

ROLLBACK;
```

(4)에서 이력 테이블이 있으면 이어서 확인한다.

```sql
BEGIN READ ONLY;
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM public._prisma_migrations ORDER BY started_at;
ROLLBACK;
```

```bash
cd apps/api
npx prisma migrate status
```

**예상 결과와 중단 조건**

먼저 (4)의 결과로 어느 경우인지 정한다. 이력 테이블이 없으면 "최초 적용", 있으면 "추가 적용"이다.

_최초 적용 (Prisma 이력이 없는 DB)_

| 항목              | 예상                                                                                                                                 | 다르면                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| (1) 버전          | PostgreSQL 17.11                                                                                                                     | 중단하고 보고                               |
| (2)·(3) 테이블    | `public`에 우리가 만들 테이블이 없다. Supabase Auth의 `auth.users`가 보이는 것은 정상이다(다른 스키마이고, Prisma는 `public`만 쓴다) | `public`에 같은 이름의 테이블이 있으면 중단 |
| (4) 이력          | 이력 테이블(`_prisma_migrations`) 없음                                                                                               | — (있으면 아래 "추가 적용"으로 판정)        |
| (5) 이벤트 트리거 | 목록을 기록한다. RLS를 자동으로 켜는 트리거가 있으면 1-5에서 영향을 확인한다                                                         | —                                           |
| `migrate status`  | `prisma/migrations`의 마이그레이션 전체가 적용 대기                                                                                  | 중단                                        |

_추가 적용 (일부 마이그레이션이 이미 적용된 DB)_

| 항목              | 예상                                                                                                                                                           | 다르면                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| (1) 버전          | PostgreSQL 17.11                                                                                                                                               | 중단하고 보고                                                           |
| (2)·(3) 테이블    | 이미 적용된 마이그레이션이 만든 테이블과 `_prisma_migrations`가 **있어야 정상**이다. 이번에 적용할 마이그레이션이 새로 만드는 테이블과 같은 이름은 없어야 한다 | 이미 적용된 테이블이 없거나, 새로 만들 테이블과 같은 이름이 있으면 중단 |
| (4) 이력          | 모든 기록이 완료(`finished_at` 있음, `rolled_back_at` 없음) 상태이고, 이름이 저장소 `prisma/migrations`에 있는 것과 일치한다                                   | 실패·롤백 기록, 저장소에 없는 기록이 있으면 중단                        |
| (5) 이벤트 트리거 | 이전 점검과 같은지 본다                                                                                                                                        | 바뀌었으면 보고                                                         |
| `migrate status`  | 이력에 없는 마이그레이션만 적용 대기로 나온다. 경고(수정된 마이그레이션 등)가 없다                                                                             | 중단                                                                    |

예: 개발용 Supabase(2026-10-19 기준)는 "추가 적용"이다. 아래가 정상이다.

- 테이블: `users`, `auth_identities`, `auth_sessions`, `auth_refresh_tokens`, `_prisma_migrations`가 있다.
- 이력: `20261019051147_auth_tables`, `20261019070424_auth_data_api_lockdown` 2건이 완료 상태다.
- `migrate status`: `20261019074729_prisma_history_lockdown` 1개만 적용 대기다.

예상과 다르면 **적용하지 않고**, 차이를 이슈에 보고한 뒤 팀원과 정한다.

### 1-4. 적용

대상과 변경 사항을 확인하고 팀원 확인을 받은 뒤 실행한다.

```bash
cd apps/api
npm run db:deploy
npx prisma migrate status
```

- 적용 뒤 `migrate status`는 "Database schema is up to date"여야 한다.

### 1-5. 적용 후 확인

```sql
BEGIN READ ONLY;

-- 테이블 4개
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('users', 'auth_identities', 'auth_sessions', 'auth_refresh_tokens');

-- CHECK 제약 8개 (users 4, auth_identities 1, auth_sessions 2, auth_refresh_tokens 1)
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c' AND conrelid::regclass::text IN ('users', 'auth_identities', 'auth_sessions', 'auth_refresh_tokens')
ORDER BY 1, 2;

-- 마이그레이션 이력
SELECT migration_name, finished_at FROM public._prisma_migrations;

-- RLS 상태
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
WHERE relnamespace = 'public'::regnamespace AND relname IN ('users', 'auth_identities', 'auth_sessions', 'auth_refresh_tokens');

-- Supabase Data API 역할(anon·authenticated)에 남은 권한 (인증 테이블·시퀀스 + Prisma 이력 테이블)
-- information_schema는 PostgreSQL 17의 MAINTAIN 권한을 보여주지 않으므로 ACL을 직접 읽는다.
SELECT c.relname, c.relkind, a.grantee::regrole AS grantee, a.privilege_type
FROM pg_class c
CROSS JOIN LATERAL aclexplode(c.relacl) a
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('users', 'auth_identities', 'auth_sessions', 'auth_refresh_tokens', '_prisma_migrations',
                    'users_id_seq', 'auth_identities_id_seq', 'auth_sessions_id_seq', 'auth_refresh_tokens_id_seq')
  AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole);

ROLLBACK;
```

```bash
npm run dev:api
```

- `GET http://localhost:4000/health/ready` → `200 {"status":"ok","checks":{"database":"ok"}}`

**RLS와 Express·Prisma 확인**

- Prisma는 테이블을 만든 역할(보통 `postgres`)로 접속한다. PostgreSQL에서 RLS는 테이블 소유자에게는 적용되지 않는다(`FORCE ROW LEVEL SECURITY`를 켠 경우는 예외). 그래서 RLS가 자동으로 켜져 있어도, 정책 없이 Express·Prisma가 동작해야 한다.
- 이를 실제로 확인한다. **Express가 쓰는 것과 같은 접속 정보(`DATABASE_URL`)**로 아래 SQL을 실행한다. 회원·세션·토큰 행을 INSERT·SELECT·UPDATE한 뒤 마지막에 **ROLLBACK**하므로, 공용 DB에 데이터는 남지 않는다. 중간에 권한 오류가 나면 RLS·권한 설정을 보고한다.

```sql
BEGIN;
INSERT INTO users (email, name, role, updated_at)
VALUES ('rls-check@example.com', '점검', 'CLIENT', now());
WITH new_session AS (
  INSERT INTO auth_sessions (user_id, expires_at)
  SELECT id, now() + interval '1 day' FROM users WHERE email = 'rls-check@example.com'
  RETURNING id
)
INSERT INTO auth_refresh_tokens (session_id, token_hash)
SELECT id, 'rls-check' FROM new_session;
SELECT count(*) AS rows_visible FROM auth_refresh_tokens WHERE token_hash = 'rls-check';
UPDATE auth_sessions SET last_used_at = now()
WHERE user_id = (SELECT id FROM users WHERE email = 'rls-check@example.com');
ROLLBACK;
```

- `rows_visible`가 1이고 오류 없이 ROLLBACK까지 끝나면 정상이다.
- **기대 결과 (`20261019074729_prisma_history_lockdown`까지 적용 후):** 인증 테이블 4개 모두 `relrowsecurity = true`이고, `anon`·`authenticated` 권한 조회 결과(`_prisma_migrations`·시퀀스 포함, MAINTAIN 포함)는 0행이어야 한다. 다르면 보고한다.
- **Data API 노출 확인 (중요):** Supabase는 `public` 스키마 테이블을 Data API(anon 키)로 노출할 수 있다.
  - RLS가 꺼져 있고 `anon`·`authenticated`에 권한이 있으면, `users.password_hash` 같은 값을 Data API로 읽을 수 있게 된다.
  - 이 경우 공개 전에 막아야 한다. 테이블마다 RLS를 켜거나, `anon`·`authenticated` 권한을 회수한다. 이 변경은 **새 마이그레이션으로 PR을 거쳐** 적용한다. 공용 DB에서 직접 바꾸지 않는다.
- 결과(성공 여부, 시각, RLS·권한 확인 결과)를 공유 글에 답글로 남긴다.

### 되돌리기 — 비상 절차 (자동 실행 금지)

- 데이터 삭제를 수반한다. 이 테이블에 쌓인 회원·세션 데이터가 모두 지워진다.
- 스크립트·CI·자동화로 실행하지 않는다. 팀원 합의 후 사람이 직접 실행한다.
- 가능하면 실행 전에 백업을 받는다.

```sql
-- 비상 시에만, 팀원 합의 후 수동으로 실행
DROP TABLE auth_refresh_tokens, auth_sessions, auth_identities, users;
DELETE FROM _prisma_migrations
WHERE migration_name IN ('20261019051147_auth_tables', '20261019070424_auth_data_api_lockdown', '20261019074729_prisma_history_lockdown');
```

**주의: 수동 삭제로 Prisma 마이그레이션 이력이 "복구"되는 것은 아니다.**

- 이력 행을 지우면, Prisma는 이 마이그레이션을 "적용한 적 없음"으로 본다. 다음 `migrate deploy`에서 다시 적용한다.
- 테이블만 지우고 이력 행을 남기면, Prisma는 "적용됨"으로 보는데 실제 테이블은 없다. 스키마와 이력이 어긋난 상태(drift)가 된다.
- Prisma는 이미 적용된 마이그레이션을 되돌리는 기능(down)을 제공하지 않는다. 정상적인 되돌리기는 **변경을 되돌리는 새 마이그레이션을 PR로 만들어 적용**하는 것이다. 그래야 모든 DB의 이력이 같게 유지된다.
- `20261019070424_auth_data_api_lockdown`이 바꾼 `public` 기본 권한(`anon`·`authenticated` 제외)은 테이블을 지워도 되돌아가지 않는다. 원래대로 돌려야 하면 그것도 새 마이그레이션 PR로 한다.
- 비상 절차를 실행했다면, 그 사실과 시각을 이슈에 남기고 다른 환경(로컬·테스트·CI)과 이력이 달라졌음을 공유한다.

## 2. Render 백엔드 배포 설정

**현재 서비스는 수동으로 만든 `kemi-api`이고 Blueprint와 연결돼 있지 않다**(2-1). 그래서 지금은 기존 서비스의 설정을 점검·변경한다(2-2). 저장소 루트의 [`render.yaml`](../../render.yaml)(Blueprint)은 **새 환경을 처음 만들 때만** 쓴다(2-3). 기존 서비스가 있는 상태에서 Blueprint를 적용하면 같은 이름의 서비스가 또 생기거나 설정이 섞일 수 있다.

### 2-0. 관리 방식 (2026-10-23 결정, [이슈 #27](https://github.com/Jubileekim/KEMI/issues/27))

- **Render 계정 관리자: 희년님.** 무료(Hobby) 워크스페이스에는 팀원을 초대할 수 없어서 한 명이 관리한다. 저장소 주인이 희년님이라 Render GitHub 연결도 그 계정으로 한다.
- 팀원은 Render 대시보드에 들어가지 않는다. 변경은 모두 GitHub에서 한다.
  - 서비스 설정(빌드·시작 명령, 헬스 체크, 리전, 고정 환경 변수): `render.yaml`을 고치는 PR
  - 코드: 기능 PR을 `main`에 병합하면, CI를 통과한 커밋이 자동으로 배포된다(`checksPass`)
- **관리자만 하는 일:** 기존 서비스 설정 변경(2-2)·새 환경 생성(2-3), 비밀 환경 변수 입력·변경(`DATABASE_URL`, `APP_ORIGIN`, 소셜 로그인·AI 키), 로그 확인, 수동 재배포·되돌리기, 4단계의 임시 브랜치 수동 배포
  - 비밀값은 관리자에게 GitHub이 아닌 비공개 채널로 전달한다.
- **결과 공유:** 배포 URL, 배포된 커밋, `/health`·`/health/ready` 결과, 오류 로그 요약(비밀값·개인정보 제외)을 [이슈 #27](https://github.com/Jubileekim/KEMI/issues/27)에 남긴다. 배포 상태는 GitHub 커밋의 체크와 CI로도 볼 수 있다.

### 2-1. 현재 상태 (2026-10-26, 희년님 확인, #28 리뷰)

| 항목              | 현재 서비스(수동 생성, live)                                               | 목표                                                                                 |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 서비스            | `kemi-api` (서비스 ID `srv-dbdj8ha9lscs73bv4hc0`), **Blueprint 연결 없음** | 그대로 유지                                                                          |
| 자동 배포         | `commit` (main에 커밋되면 바로)                                            | `checksPass` (main 커밋 중 GitHub CI 통과한 것만)                                    |
| Health Check Path | 비어 있음                                                                  | `/health`                                                                            |
| `DATABASE_URL`    | 기존 공유 Supabase(**구형 스키마**) → `/api/projects`가 Prisma `P2021`     | `KEMI-dev` Session pooler ([이슈 #24](https://github.com/Jubileekim/KEMI/issues/24)) |
| 빌드·시작 명령    | 확인 필요                                                                  | `npm ci --include=dev && npm run build:api` / `npm start -w @kemi/api`               |

- **빌드가 통과해도 API·DB 기능 검증이 끝난 것이 아니다.** DB가 우리 스키마가 아니면 대부분의 API가 500이다.
- **Blueprint로 DB를 만들거나, 기존 공유 DB에 바로 마이그레이션하지 않는다.** DB는 #24 절차(새 `KEMI-dev` → 읽기 전용 점검 → `npm run db:deploy` → 확인)로만 준비한다.

### 2-2. 기존 서비스 설정 점검·변경 (관리자: 희년님)

실제 서비스 변경은 자동으로 하지 않는다. 아래 순서로 한 항목씩 바꾸고, 바꿀 때마다 기록한다.

**변경 전 체크리스트**

- [ ] `KEMI-dev`가 만들어졌고, `main`의 마이그레이션이 모두 적용·확인됐다(#24 기록)
- [ ] 현재 설정을 기록했다(위 표의 "현재" 열, 환경 변수 **이름** 목록. 값은 적지 않는다)
- [ ] 최근 배포 로그에서 시작 오류가 없는지 확인했다(`KEMI API listening on port …`)
- [ ] 현재 `/health` 응답 코드를 기록했다

**변경 순서** (서비스 → Settings·Environment)

1. Environment
   - `DATABASE_URL`: `KEMI-dev` Session pooler 주소
   - `APP_ORIGIN`: Vercel 운영 주소(끝에 `/` 없음)
   - `JWT_ACCESS_SECRET`: 32자 이상 임의 값(로컬과 다르게)
   - `NODE_ENV=production`, `DATABASE_POOL_MAX=5`, `TRUST_PROXY_HOPS=0`
   - 소셜 로그인·AI·결제·파일 키는 발급된 것만 넣는다(없어도 서버는 시작하고 해당 기능만 503).
2. Health Check Path → `/health`
3. Auto-Deploy → "After CI checks pass"(`checksPass`)
4. Build·Start 명령이 목표와 다르면 맞춘다.
5. **Manual Deploy → Deploy latest commit**

**변경 후 체크리스트** (2-4의 명령)

- [ ] 배포 로그: 빌드 성공, 시작 로그, 환경 변수 오류 없음
- [ ] `/health` → `200`, `/health/ready` → `200`
- [ ] `/api/projects` → `200`(빈 목록이어도 됨). `500`이면 `DATABASE_URL`과 마이그레이션 상태를 확인한다
- [ ] Vercel의 `/api/*` rewrite(`https://kemi-api.onrender.com`)로 같은 응답이 오는지
- [ ] 결과를 [이슈 #27](https://github.com/Jubileekim/KEMI/issues/27)에 기록(주소, 배포 커밋, 응답 코드, 바꾼 설정 이름)

문제가 생기면 Render의 **Rollback**으로 직전 배포로 되돌리고, 바꾼 환경 변수를 기록한 값으로 되돌린다.

### 2-3. 새 환경을 처음 만들 때만: Blueprint

기존 `kemi-api`가 있는 지금은 **하지 않는다.** 서비스를 지우고 새로 만들거나, 다른 환경(예: 시연용)을 따로 만들 때만 쓴다.

1. Render 대시보드 → **New → Blueprint** → 저장소 `Jubileekim/KEMI`, 브랜치 `main`
2. `render.yaml`이 `kemi-api` 웹 서비스 1개만 만든다고 나오는지 확인한다(DB는 만들지 않는다).
3. `sync: false` 항목(`DATABASE_URL`, `APP_ORIGIN`)을 입력하고 **Apply**
   - 나머지 값(플랜 `free`, 리전 `singapore`, 빌드·시작 명령, `/health`, `checksPass`, `NODE_ENV`, `DATABASE_POOL_MAX`, Render가 만드는 `JWT_ACCESS_SECRET`, `TRUST_PROXY_HOPS=0`)은 `render.yaml`에 있다.
   - 같은 이름의 서비스가 이미 있으면 주소가 달라질 수 있다. 만든 뒤 주소를 Vercel rewrite와 맞춘다.

**공통 주의**

- 마이그레이션은 배포 때 자동으로 돌리지 않는다(`preDeployCommand` 없음). 스키마 변경은 1단계 절차로 따로 적용하고, **적용한 뒤에** 그 스키마를 쓰는 코드를 배포한다.
- 4단계 전까지는 요청 제한이 모든 사용자를 같은 IP로 볼 수 있다. 실제 사용자에게 공개하기 전에 4단계를 끝낸다.

### 2-4. 배포 후 확인

```bash
curl -s -o /dev/null -w "%{http_code}
" https://<render 서비스>.onrender.com/health
```

```bash
curl -s https://<render 서비스>.onrender.com/health/ready
```

- `/health` → `200`, `/health/ready` → `200`이면 Render에서 DB까지 연결된 것이다. `503`이면 `DATABASE_URL`(Session pooler 주소인지, 비밀번호)을 확인한다.
- 운영 환경에서는 Swagger UI가 꺼진다. `/api/docs` → `404`가 정상이다.
- 무료 플랜은 15분 동안 요청이 없으면 잠들고, 다음 요청에서 약 1분 걸려 깨어난다. 첫 확인이 느려도 기다린다.
- 결과(서비스 주소, 배포 커밋, 응답 코드)를 [이슈 #27](https://github.com/Jubileekim/KEMI/issues/27)과 아래 "결과 기록"에 남긴다. 비밀값은 적지 않는다.

## 3. Vercel 프론트엔드 rewrite 설정 (프론트엔드 담당)

`/api/*`만 Render로 전달하고, 경로의 `/api`는 그대로 둔다.

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://<render 서비스>.onrender.com/api/:path*"
    }
  ]
}
```

- 프론트엔드는 API를 상대 경로(`/api/auth/login`)로 호출한다. 브라우저 입장에서 같은 출처라 쿠키가 자동으로 실린다.
- 로컬 개발은 Vite `server.proxy`로 `/api` → `http://localhost:4000`을 연결한다.

## 4. 클라이언트 IP 확인 → `TRUST_PROXY_HOPS` 결정

값을 추측해서 바꾸지 않는다. **Vercel 경유**와 **Render 직접 접근** 두 경로를 모두 실제로 확인한다.

### 4-1. 진단 규칙

- 진단 코드는 임시 브랜치(예: `diag/client-ip`)에만 두고, `main`에 병합하지 않는다. PR도 만들지 않는다.
- **기록·응답하는 값은 IP 관련 값으로 제한한다:** `req.ip`, `req.socket.remoteAddress`, `X-Forwarded-For`, `X-Real-IP`, `X-Vercel-Forwarded-For`
- `Cookie`, `Authorization`, 요청 본문, 쿼리 문자열, 그 밖의 헤더는 **기록하지도 응답하지도 않는다.** 헤더 전체를 출력하는 코드를 쓰지 않는다.
- 확인이 끝나면 Render 배포를 `main`으로 되돌리고, 임시 브랜치를 지운다.

진단 코드 예시 (임시 브랜치에서만 `app.ts`의 auth 라우터 앞에 추가):

```ts
app.get("/api/_diag/ip", (req, res) => {
  const ipInfo = {
    ip: req.ip,
    remoteAddress: req.socket.remoteAddress,
    xForwardedFor: req.get("x-forwarded-for"),
    xRealIp: req.get("x-real-ip"),
    xVercelForwardedFor: req.get("x-vercel-forwarded-for"),
  };
  console.info("[diag:ip]", JSON.stringify(ipInfo));
  res.json(ipInfo);
});
```

### 4-2. 확인 순서

1. Render에서 임시 브랜치를 수동 배포한다(`TRUST_PROXY_HOPS=0`).
2. 내 공인 IP를 확인한다(예: 공유기 관리 화면, 또는 IP 확인 사이트).
3. 두 경로로 요청한다.

   ```bash
   curl -s https://<프로젝트>.vercel.app/api/_diag/ip
   ```

   ```bash
   curl -s https://<render 서비스>.onrender.com/api/_diag/ip
   ```

4. 위조 시도도 확인한다. 이 값이 결과의 `ip`로 나오면 그 경로는 위조할 수 있다는 뜻이다.

   ```bash
   curl -s -H "X-Forwarded-For: 198.51.100.7" https://<프로젝트>.vercel.app/api/_diag/ip
   ```

   ```bash
   curl -s -H "X-Forwarded-For: 198.51.100.7" https://<render 서비스>.onrender.com/api/_diag/ip
   ```

5. 결과를 정리한다.

| 경로        | `X-Forwarded-For` 전체 | 내 IP의 위치(오른쪽에서 몇 번째) | 위조 값이 `ip`로 나오는가 |
| ----------- | ---------------------- | -------------------------------- | ------------------------- |
| Vercel 경유 |                        |                                  |                           |
| Render 직접 |                        |                                  |                           |

6. Vercel 경유 경로에서 내 IP가 오른쪽에서 N번째면 `TRUST_PROXY_HOPS=N`이다. 값을 넣고, 다시 4번까지 확인해 `ip`가 내 IP인지 본다.
7. Render 직접 경로에서 위조 값이 `ip`로 나오면, 그 위험을 결정 기록 8장에 적고 대응을 정한다. 예: 서비스 주소를 공개하지 않고 직접 접근 요청에 별도 제한을 두는 방안.
8. Render 배포를 `main`으로 되돌린다. 임시 브랜치를 삭제하고, `TRUST_PROXY_HOPS` 값과 위 표를 결정 기록 8장 "클라이언트 IP 판단"에 기록한다.
9. 요청 제한을 실제로 확인한다: 같은 네트워크에서 Vercel 경유로 잘못된 로그인을 11번 보내면 11번째가 `429`이고, 다른 네트워크(예: 휴대폰 데이터)에서는 바로 `429`가 나지 않아야 한다.

## 5. 브라우저 인증 검증

Chrome 시크릿 창에서 Vercel 주소로 확인한다. 개발자 도구의 **Network** 탭과 **Application → Cookies**를 함께 본다.

### 5-1. 프론트엔드가 먼저 구현해야 할 것

- 로그인 응답의 `accessToken`은 메모리에만 저장한다(localStorage·sessionStorage 금지).
- API 호출에 `Authorization: Bearer <accessToken>`을 붙인다.
- 앱이 시작될 때(새로고침 포함) `POST /api/auth/refresh`로 로그인을 복구하고, 성공하면 `GET /api/auth/me`로 사용자 정보를 받는다.
- `401 TOKEN_EXPIRED`를 받으면 갱신을 한 번만 실행한다(single-flight + Web Locks). 이후 원래 요청을 한 번 다시 보낸다.
- `409 REFRESH_RACE`는 최대 2번(500ms, 1,000ms 간격) 재시도하고, 실패하면 재로그인 화면으로 보낸다(결정 기록 5장 "갱신 실패와 재시도 정책").

### 5-2. 확인 항목

| #   | 동작                    | 확인할 것                                                                                                                                                                                                                                                                        |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 로그인                  | `POST /api/auth/login` → `200`, 응답에 `accessToken`. 응답 헤더 `Set-Cookie: kemi_refresh=…; Path=/api/auth; HttpOnly; Secure; SameSite=Lax`. Application → Cookies에 `kemi_refresh`가 HttpOnly·Secure로 보인다. 콘솔에서 `document.cookie`에 `kemi_refresh`가 **나오지 않는다** |
| 2   | 새로고침 후 로그인 복구 | 새로고침하면 `POST /api/auth/refresh`(요청에 `Cookie: kemi_refresh`, `Origin: <Vercel 주소>`) → `200`과 새 `Set-Cookie`. 이어서 `GET /api/auth/me` → `200`. 화면이 로그인 상태로 돌아온다                                                                                        |
| 3   | 토큰 갱신               | Access 토큰이 만료(15분)된 뒤 API를 호출하면 `401 TOKEN_EXPIRED` → `POST /api/auth/refresh` `200` → 원래 요청 재시도 `200`. 쿠키 값이 새 값으로 바뀐다                                                                                                                           |
| 4   | 로그아웃 후 접근 차단   | `POST /api/auth/logout` → `204`, `kemi_refresh` 쿠키가 지워진다. 새로고침하면 `POST /api/auth/refresh` → `401 SESSION_REVOKED`이고 로그인 화면으로 간다. 로그아웃 전에 복사해 둔 Access 토큰으로 `GET /api/auth/me`를 호출하면 `401`                                             |

4번의 마지막 확인은 터미널에서 한다(토큰은 결과 기록에 남기지 않는다).

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <로그아웃 전 Access 토큰>" https://<프로젝트>.vercel.app/api/auth/me
```

- 3번은 15분을 기다려야 한다. 기다리는 동안 다른 항목을 먼저 확인해도 된다.
- 선택 확인: 탭 두 개를 열고 동시에 새로고침했을 때 두 탭 모두 로그인 상태로 돌아오는지 본다(Web Locks 동작).
- Safari 등 다른 브라우저는 필요하면 같은 표로 따로 기록한다.

## 결과 기록

확인한 날짜와 함께 채우고, 이 문서를 수정하는 PR로 남긴다. 토큰·쿠키 값·비밀번호는 적지 않는다.

| 단계                                  | 결과                                                                                                       | 날짜       | 확인한 사람                   | 비고                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------- | ------------------------------------------------------ |
| 1. 개발용 Supabase 마이그레이션       | 완료 — 3개 적용, 권한 0(MAINTAIN 포함)·RLS·`/health/ready` 200·쓰기 ROLLBACK 점검 통과, Data API 꺼짐 확인 | 2026-10-19 | seonu2070-droid (Claude 실행) | [이슈 #5](https://github.com/Jubileekim/KEMI/issues/5) |
| 2. Render 배포                        | 미완료                                                                                                     |            |                               |                                                        |
| 3. Vercel rewrite                     | 미완료                                                                                                     |            |                               |                                                        |
| 4. 클라이언트 IP (`TRUST_PROXY_HOPS`) | 미완료                                                                                                     |            |                               |                                                        |
| 5-1 로그인                            | 미완료                                                                                                     |            |                               |                                                        |
| 5-2 새로고침 후 복구                  | 미완료                                                                                                     |            |                               |                                                        |
| 5-3 토큰 갱신                         | 미완료                                                                                                     |            |                               |                                                        |
| 5-4 로그아웃 후 차단                  | 미완료                                                                                                     |            |                               |                                                        |
