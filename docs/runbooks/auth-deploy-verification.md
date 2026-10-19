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

### 1-3. 적용

```bash
cd apps/api
npx prisma migrate status
npm run db:deploy
npx prisma migrate status
```

- 첫 `migrate status`에서 `20261019051147_auth_tables`가 적용 대기(not yet applied)로 나와야 한다. 다른 결과가 나오면 멈추고 팀원과 확인한다.
- 적용 뒤 `migrate status`는 "Database schema is up to date"여야 한다.

### 1-4. 확인

```bash
npm run dev:api
```

- `GET http://localhost:4000/health/ready` → `200 {"status":"ok","checks":{"database":"ok"}}`
- Supabase Table Editor에 테이블 4개와 `_prisma_migrations`의 기록 1건이 보인다.
- 결과(성공 여부, 시각)를 1-1의 공유 글에 답글로 남긴다.

### 되돌리기 (필요할 때만, 팀원 합의 후)

```sql
DROP TABLE auth_refresh_tokens, auth_sessions, auth_identities, users;
DELETE FROM _prisma_migrations WHERE migration_name = '20261019051147_auth_tables';
```

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
