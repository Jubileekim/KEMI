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
- 마이그레이션: 20261019051147_auth_tables
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

| 항목              | 예상                                                                                                              | 다르면                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| (1) 버전          | PostgreSQL 17.11                                                                                                  | 중단하고 보고                                         |
| (3) 같은 이름     | `public`에는 없다. Supabase Auth의 `auth.users`가 보이는 것은 정상이다(다른 스키마이고, Prisma는 `public`만 쓴다) | `public`에 같은 이름이 있으면 중단                    |
| (4) 이력          | 없음(처음 적용) 또는 있어도 이 마이그레이션 기록이 없음                                                           | 다른 기록·실패 기록(`finished_at` NULL)이 있으면 중단 |
| (5) 이벤트 트리거 | 목록을 기록한다. RLS를 자동으로 켜는 트리거가 있으면 1-5에서 영향을 확인한다                                      | —                                                     |
| `migrate status`  | `20261019051147_auth_tables` 1개만 적용 대기                                                                      | 중단                                                  |

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

-- Supabase Data API 역할(anon·authenticated)에 준 권한
SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('users', 'auth_identities', 'auth_sessions', 'auth_refresh_tokens')
  AND grantee IN ('anon', 'authenticated');

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
DELETE FROM _prisma_migrations WHERE migration_name = '20261019051147_auth_tables';
```

**주의: 수동 삭제로 Prisma 마이그레이션 이력이 "복구"되는 것은 아니다.**

- 이력 행을 지우면, Prisma는 이 마이그레이션을 "적용한 적 없음"으로 본다. 다음 `migrate deploy`에서 다시 적용한다.
- 테이블만 지우고 이력 행을 남기면, Prisma는 "적용됨"으로 보는데 실제 테이블은 없다. 스키마와 이력이 어긋난 상태(drift)가 된다.
- Prisma는 이미 적용된 마이그레이션을 되돌리는 기능(down)을 제공하지 않는다. 정상적인 되돌리기는 **변경을 되돌리는 새 마이그레이션을 PR로 만들어 적용**하는 것이다. 그래야 모든 DB의 이력이 같게 유지된다.
- 비상 절차를 실행했다면, 그 사실과 시각을 이슈에 남기고 다른 환경(로컬·테스트·CI)과 이력이 달라졌음을 공유한다.

## 2. Render 백엔드 배포 설정

| 항목              | 값                                          |
| ----------------- | ------------------------------------------- |
| Build Command     | `npm ci --include=dev && npm run build:api` |
| Start Command     | `npm start -w @kemi/api`                    |
| Health Check Path | `/health`                                   |

| 환경 변수           | 값                                                           |
| ------------------- | ------------------------------------------------------------ |
| `NODE_ENV`          | `production`                                                 |
| `DATABASE_URL`      | 1-2와 같은 Session pooler 주소                               |
| `DATABASE_POOL_MAX` | `5`                                                          |
| `JWT_ACCESS_SECRET` | 로컬과 **다른** 새 값                                        |
| `APP_ORIGIN`        | Vercel 프론트엔드 주소 (예: `https://<프로젝트>.vercel.app`) |
| `TRUST_PROXY_HOPS`  | `0`으로 시작한다. 4단계에서 확인한 값으로 바꾼다             |

- 4단계 전까지는 요청 제한이 모든 사용자를 같은 IP로 볼 수 있다. 실제 사용자에게 공개하기 전에 4단계를 끝낸다.
- 배포 후 `https://<render 서비스>.onrender.com/health` → `200`

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

| 단계                                  | 결과   | 날짜 | 확인한 사람 | 비고 |
| ------------------------------------- | ------ | ---- | ----------- | ---- |
| 1. 개발용 Supabase 마이그레이션       | 미완료 |      |             |      |
| 2. Render 배포                        | 미완료 |      |             |      |
| 3. Vercel rewrite                     | 미완료 |      |             |      |
| 4. 클라이언트 IP (`TRUST_PROXY_HOPS`) | 미완료 |      |             |      |
| 5-1 로그인                            | 미완료 |      |             |      |
| 5-2 새로고침 후 복구                  | 미완료 |      |             |      |
| 5-3 토큰 갱신                         | 미완료 |      |             |      |
| 5-4 로그아웃 후 차단                  | 미완료 |      |             |      |
