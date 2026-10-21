# KEMI API (`@kemi/api`)

Express 5 · TypeScript · Prisma 7 · Supabase PostgreSQL 백엔드.

## 요구 사항

- Node.js 24 LTS (`.nvmrc`)
- npm 11 이상 (npm Workspaces)

## 처음 실행하기

저장소 루트에서 실행한다.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # 값 채우기 (아래 "DB 연결 주소" 참고)
npm run dev:api
```

- 서버 주소: `http://localhost:4000`
- `GET /health` → `200 {"status":"ok", ...}`
- `GET /health/ready` → DB 연결 시 `200`, 연결 실패 시 `503`

`.env`가 없거나 값이 잘못되면 서버는 시작하지 않고 어떤 변수가 문제인지 출력한 뒤 종료한다. 변수 값(비밀번호 등)은 출력하지 않는다.

## 명령어

| 위치       | 명령                      | 하는 일                                                                                                    |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 루트       | `npm run dev:api`         | 공통 패키지 빌드 후 개발 서버 실행 (파일 변경 시 재시작)                                                   |
| 루트       | `npm run test:api`        | 단위 테스트 (DB 불필요)                                                                                    |
| 루트       | `npm run test:api:db`     | DB 테스트 (테스트 전용 PostgreSQL 필요, 아래 "테스트" 참고)                                                |
| 루트       | `npm run lint`            | ESLint 검사 (`apps/api`, `packages/shared`)                                                                |
| 루트       | `npm run format`          | Prettier로 저장소 전체 형식 정리                                                                           |
| 루트       | `npm run format:check`    | Prettier 형식 검사만 (CI에서 실행)                                                                         |
| 루트       | `npm run build:api`       | 린트 → Prisma Client 생성 → `apps/api/dist` 빌드. **ESLint 오류나 경고가 하나라도 있으면 빌드가 실패한다** |
| 루트       | `npm run typecheck`       | 전체 워크스페이스 타입 검사                                                                                |
| `apps/api` | `npm start`               | 빌드 결과 실행 (`node dist/server.js`)                                                                     |
| `apps/api` | `npm run prisma:validate` | Prisma 스키마 검사                                                                                         |
| `apps/api` | `npm run db:migrate`      | 개발 DB에 마이그레이션 생성·적용                                                                           |
| `apps/api` | `npm run db:deploy`       | 배포 DB에 기존 마이그레이션만 적용                                                                         |

## 테스트

테스트는 두 종류로 나뉜다.

| 종류        | 명령 (루트)           | DB                     | 파일                   |
| ----------- | --------------------- | ---------------------- | ---------------------- |
| 단위 테스트 | `npm run test:api`    | 필요 없음              | `test/**/*.test.ts`    |
| DB 테스트   | `npm run test:api:db` | 테스트 전용 PostgreSQL | `test/**/*.db.test.ts` |

### DB 테스트 실행 (로컬 Docker)

```bash
cd apps/api
cp .env.test.example .env.test
npm run test:db:up
npm run test:db
npm run test:db:down
```

- `test:db:up`은 `docker-compose.test.yml`의 PostgreSQL 17.11 컨테이너(팀 개발용 Supabase와 같은 버전)를 포트 `54329`로 띄운다. 데이터는 메모리에만 있어서, 컨테이너를 내리면 사라진다.
- DB 테스트를 시작하기 전에 `prisma migrate deploy`로 마이그레이션을 테스트 DB에 적용한다.
- 각 테스트 전에 테이블을 비운다(`_prisma_migrations` 제외).

### 안전장치

DB 테스트는 `TEST_DATABASE_URL`만 사용한다. 개발용 `DATABASE_URL`과 `.env`는 읽지 않는다. 다음 중 하나라도 해당하면 테스트를 시작하지 않고 실패한다.

- `TEST_DATABASE_URL`이 없다. 이때 개발 DB로 대신 실행하지 않는다.
- 호스트가 `localhost`/`127.0.0.1`이 아니다(Supabase 등 원격 DB 차단).
- DB 이름이 `_test`로 끝나지 않는다.
- `DATABASE_URL`과 같은 DB를 가리킨다.

테이블을 비우는 함수(`resetDatabase`)도 실행할 때마다 현재 DB 이름이 `_test`로 끝나는지 다시 확인한다.

### CI

`.github/workflows/api-ci.yml`이 `main` 대상 PR마다 실행된다. 같은 DB 테스트를 GitHub Actions의 PostgreSQL 서비스 컨테이너로 돌린다. 순서는 타입 검사 → 단위 테스트 → DB 테스트 → 린트 + 빌드다.

## 코드 규칙 (ESLint · Prettier)

설정 파일은 저장소 루트의 `eslint.config.js`(ESLint), `.prettierrc.json`(Prettier)이다.

- **역할 분담:** 코드 형식(들여쓰기, 따옴표, 줄 길이, 세미콜론 등)은 Prettier 기본 설정이 정한다. ESLint는 형식을 제외한 규칙만 검사한다(`eslint-config-prettier`로 겹치는 규칙을 끈다).
- **Prettier:** 기본 설정(`{}`)을 그대로 쓴다. 저장 전에 `npm run format`으로 정리하고, CI는 `npm run format:check`로 검사한다. 빌드에서는 Prettier를 실행하지 않는다.
- **줄바꿈:** `.gitattributes`(`eol=lf`)로 모든 OS에서 작업 폴더를 LF로 꺼낸다. 그래서 Windows에서도 Prettier 기본값(LF)과 맞는다.

- **기반:** Airbnb 스타일 + TypeScript 규칙(`eslint-config-airbnb-extended`, ESLint 9)
  - 공식 `eslint-config-airbnb-base`는 ESLint 7–8만 지원하고 TypeScript 규칙이 없어서, flat config와 TypeScript를 지원하는 이 포트를 쓴다.
- **팀 규칙**
  - `any` 금지: `@typescript-eslint/no-explicit-any`
  - 타입 단언 금지: `as Type`, `<Type>value`, `value!` 모두 금지. 대신 `instanceof`, `typeof`, `'key' in obj` 같은 타입 가드로 타입을 좁힌다.
    - 예외: `as const`(const assertion)는 허용한다. 값을 다른 타입으로 바꾸지 않고 리터럴 타입 그대로 고정하기만 해서, `consistent-type-assertions` 규칙이 `assertionStyle: 'never'`에서도 허용한다. `satisfies`도 단언이 아니라 허용된다.
  - 운영 코드(`src`)에서는 라이브러리가 돌려준 `any` 값을 그대로 쓰는 것도 막는다(`no-unsafe-*`). 테스트는 vitest의 `expect.any()`와 supertest의 `res.body`가 `any` 타입이라 이 규칙에서 제외한다.
  - 로그는 `console.info`, `console.warn`, `console.error`만 쓴다.
- **빌드와 CI:** `npm run build`(apps/api)는 `npm run lint`를 먼저 실행하고, 경고까지 0개여야(`--max-warnings 0`) 다음 단계로 넘어간다. CI와 Render 빌드도 같은 명령을 쓰므로, 린트를 통과하지 못한 코드는 배포되지 않는다.
- **자동 수정:** 형식 문제는 `npx eslint . --fix`로 고칠 수 있다.

타입 가드 예시:

```ts
// ❌ 단언: 실제 값이 그 모양인지 확인하지 않는다
const code = (err as { code: string }).code;

// ✅ 타입 가드: 실제로 확인한 뒤에만 그 타입으로 쓴다
if (err instanceof Error && "code" in err && err.code === "ENOENT") {
  /* ... */
}
```

## API 문서 (OpenAPI)

- 개발 서버(`npm run dev:api`)에서 열 수 있다.
  - Swagger UI: `http://localhost:4000/api/docs`
  - 원본 JSON: `http://localhost:4000/api/openapi.json`
- 운영 환경(`NODE_ENV=production`)에서는 문서 경로를 열지 않는다.
- 문서 정의: `src/docs/openapi.ts`
  - 요청 본문 스키마는 서버가 검증에 쓰는 `@kemi/shared`의 Zod 스키마에서 자동으로 만든다.
  - 응답·오류 스키마는 직접 적는다.
- `test/openapi.test.ts`가 확인하는 것
  - 문서가 OpenAPI 3.1 규격에 맞는지
  - 문서의 모든 경로가 실제 라우터에 있는지
  - 가입·로그인 요청의 `email`이 `format: email`, `maxLength: 254`로 표시되는지
- API를 추가·변경하면 이 문서도 같은 PR에서 고친다.

### Swagger UI에서 `refresh`·`logout`이 403이 되는 이유

- `POST /api/auth/refresh`와 `POST /api/auth/logout`은 쿠키만으로 동작하는 요청이다. 그래서 CSRF 방어로 요청의 `Origin`이 `APP_ORIGIN`(예: `http://localhost:5173`)과 같은지 검사한다.
- Swagger UI는 `http://localhost:4000`에서 열리므로 요청의 `Origin`이 `http://localhost:4000`이 된다. 포트가 달라 다른 출처로 보고 `403 FORBIDDEN`이 난다. **정상 동작이다.**
- 문서 도구를 쓰려고 `APP_ORIGIN`을 API 주소로 바꾸거나 Origin 검사를 끄지 않는다.
- `signup`·`login`·`me`는 Origin 검사가 없어서 Swagger UI에서 바로 실행해 볼 수 있다.

`refresh`·`logout`은 다음 방법으로 확인한다.

1. **허용된 프론트엔드 출처에서 확인**
   - `npm run dev:api`와 `npm run dev:web`을 함께 실행한다.
   - `http://localhost:5173`을 열고 개발자 도구 콘솔에서 아래처럼 호출한다.
   - 아직 로그인 화면이 없으면, 첫 줄처럼 콘솔에서 먼저 로그인한다. 테스트용 계정만 쓴다.
   - Vite 개발 서버가 `/api`를 API 서버로 전달하면서 `Origin`(`http://localhost:5173`)을 유지하므로, 실제 사용자와 같은 조건이 된다.

   ```js
   await fetch("/api/auth/login", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       email: "<테스트 계정>",
       password: "<테스트 비밀번호>",
     }),
   }).then((res) => res.status);
   await fetch("/api/auth/refresh", {
     method: "POST",
     credentials: "include",
   }).then((res) => res.status);
   await fetch("/api/auth/logout", {
     method: "POST",
     credentials: "include",
   }).then((res) => res.status);
   ```

   - 응답의 토큰 값은 기록·공유하지 않는다.

2. **통합 테스트로 확인**: `npm run test:api:db`의 `test/db/auth.db.test.ts`가 실제 테스트 DB로 다음을 검증한다.
   - `Origin`을 붙인 갱신·동시 갱신·재사용 감지·로그아웃
   - `Origin`이 없거나 다른 출처일 때 403

## 인증 API

자세한 규칙은 [결정 기록](../../docs/decisions/2026-10-19-backend-setup.md) 5장·8장에 있다.

| 메서드·경로              | 하는 일                                                              | 성공 응답                                                            |
| ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/auth/signup`  | 이메일·비밀번호·이름·역할(`CLIENT`/`CREATOR`)로 가입하고 바로 로그인 | `201` + `{ accessToken, accessTokenExpiresIn, user }` + Refresh 쿠키 |
| `POST /api/auth/login`   | 이메일 로그인                                                        | `200` + 위와 같음                                                    |
| `POST /api/auth/refresh` | Refresh 쿠키로 토큰 회전 (`Origin` 검사)                             | `200` + 새 Access 토큰 + 새 쿠키                                     |
| `POST /api/auth/logout`  | 로그인 세션 폐기, 쿠키 삭제 (`Origin` 검사)                          | `204`                                                                |
| `GET /api/auth/me`       | `Authorization: Bearer <accessToken>`으로 현재 사용자 조회           | `200` + `{ user }`                                                   |

- 사용자 ID는 문자열이다(`"42"`). DB는 `bigint`다.
- Access 토큰은 15분이다. 응답 본문으로 받아 메모리에만 보관한다.
- Refresh 토큰은 `kemi_refresh` 쿠키(`HttpOnly; Secure; SameSite=Lax; Path=/api/auth`)로만 주고받는다. 로그인 세션은 로그인 시점부터 최대 7일이고, 회전해도 연장되지 않는다.
- 요청 제한: 가입 1시간 10회, 로그인 15분 10회, 갱신 15분 60회(IP 기준). 넘으면 `429 RATE_LIMITED`
- 오류 코드: `VALIDATION_FAILED`(400), `INVALID_CREDENTIALS`(401), `TOKEN_EXPIRED`(401), `UNAUTHENTICATED`(401), `SESSION_REVOKED`(401), `FORBIDDEN`(403), `EMAIL_ALREADY_EXISTS`(409), `REFRESH_RACE`(409, `details.retryAfterMs`), `RATE_LIMITED`(429)

## API 경로 규칙

| 경로                | 용도                               | 누가 호출하나                    |
| ------------------- | ---------------------------------- | -------------------------------- |
| `GET /health`       | 프로세스 생존 확인 (DB 확인 안 함) | Render 헬스 체크, 배포 직후 확인 |
| `GET /health/ready` | DB 연결까지 확인                   | 배포·연동 점검                   |
| `/api/*`            | 서비스 API (예: `/api/auth/login`) | 프론트엔드 (Vercel rewrite 경유) |

- 헬스 체크는 `/api/health`가 아니라 `/health`로 통일한다.
  - Render 헬스 체크는 Vercel을 거치지 않고 Render 서비스 주소로 직접 호출된다.
  - 앞으로 `/api/*`에 붙일 인증·요청 제한 같은 미들웨어의 영향을 받지 않게 서비스 API와 분리한다.
- 프론트엔드에서 배포 연결을 확인할 때는 Render 주소로 직접 호출한다: `https://<render-서비스>.onrender.com/health`
- Vercel rewrite는 `/api/*`만 Render로 전달하며, 경로의 `/api`는 그대로 유지한다. (`/api/auth/login` → Render의 `/api/auth/login`)

## 환경 변수

| 이름                     | 필수 | 기본값         | 설명                                                                                                                            |
| ------------------------ | ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`               |      | `development`  | `development` / `test` / `production`                                                                                           |
| `PORT`                   |      | `4000`         | Render는 자동으로 지정한다                                                                                                      |
| `DATABASE_URL`           | ✅   |                | 실행용 PostgreSQL 주소                                                                                                          |
| `DATABASE_POOL_MAX`      |      | `5`            | 서버 한 대의 최대 DB 연결 수                                                                                                    |
| `MIGRATION_DATABASE_URL` |      | `DATABASE_URL` | 마이그레이션 전용 주소가 따로 필요할 때만                                                                                       |
| `JWT_ACCESS_SECRET`      | ✅   |                | Access 토큰 서명 키 (32자 이상)                                                                                                 |
| `APP_ORIGIN`             | ✅   |                | 프론트엔드 주소. refresh·logout 요청의 `Origin`과 같아야 한다                                                                   |
| `TRUST_PROXY_HOPS`       |      | `0`            | 앞단 프록시 개수. 요청 제한의 클라이언트 IP 판단에 쓴다. 배포 값은 배포 후 확인해서 정한다 (결정 기록 8장 "클라이언트 IP 판단") |

실제 값은 `.env`(커밋 금지)나 Render 대시보드의 Environment에만 넣는다. 저장소에는 `.env.example`만 둔다.

## DB 연결 주소 고르기

Supabase 대시보드 **Connect** 화면에서 실제 배포 환경에 맞는 주소를 고른다. 포트 번호를 외워서 쓰지 않는다.

| 주소 종류                                         | 특징                             | KEMI에서                                                                     |
| ------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Direct connection (`db.<ref>.supabase.co:5432`)   | 기본은 IPv6 전용                 | Render에서 IPv6로 접속할 수 없으면 사용 불가. 로컬에서 IPv6가 되면 사용 가능 |
| Session pooler (`*.pooler.supabase.com:5432`)     | IPv4 지원, 연결을 세션 동안 유지 | **Render 같은 상시 실행 서버에 권장.** 마이그레이션도 이 주소로 가능         |
| Transaction pooler (`*.pooler.supabase.com:6543`) | 요청마다 연결을 나눠 씀          | 서버리스용. 상시 서버인 이 API에는 필요하지 않음                             |

- 기본 구성: `DATABASE_URL` 하나에 Session pooler 주소를 넣고 실행과 마이그레이션에 함께 쓴다.
- 마이그레이션을 다른 주소로 돌려야 할 때만 `MIGRATION_DATABASE_URL`을 추가한다.
- Session pooler는 동시 연결 수 한도가 있으므로 `DATABASE_POOL_MAX`를 작게 유지한다.

## Render 배포 설정 (예정)

| 항목              | 값                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Root Directory    | (비움, 저장소 루트)                                                                                                                      |
| Build Command     | `npm ci --include=dev && npm run build:api` (린트·Prisma CLI·TypeScript가 devDependencies라서 `NODE_ENV=production`이어도 설치되게 한다) |
| Start Command     | `npm start -w @kemi/api`                                                                                                                 |
| Environment       | `TRUST_PROXY_HOPS`는 배포 후 실제 `X-Forwarded-For`를 확인한 값으로 넣는다. 확인 전에는 요청 제한이 모든 사용자를 같은 IP로 볼 수 있다   |
| Health Check Path | `/health`                                                                                                                                |
| Environment       | `NODE_ENV=production`, `DATABASE_URL` 등                                                                                                 |

헬스 체크는 DB를 보지 않는 `/health`를 쓴다. DB 장애 때문에 Render가 서버를 계속 재시작하지 않게 하기 위해서다. DB까지 확인하려면 `/health/ready`를 사용한다.

무료 플랜은 15분 동안 요청이 없으면 잠들고, 다음 첫 요청에서 약 1분 동안 깨어난다. 시연 전에는 `/health`를 미리 호출해 깨워둔다.

## 오류 응답 형식 (프론트엔드와 합의 전 초안)

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "입력값을 확인해주세요.",
    "details": []
  }
}
```

- `code`: `@kemi/shared`의 `ERROR_CODES` 중 하나. 화면은 `message` 문구가 아니라 `code`로 분기한다.
- 알 수 없는 서버 오류는 내부 내용을 숨기고 `500 INTERNAL_ERROR`로 응답한다.

## 검증 상태

**확인한 것** (2026-10-19)

- PostgreSQL 버전: 팀 개발용 Supabase 17.11 (팀원 확인) = 로컬 테스트 DB·CI 이미지 `postgres:17.11-alpine`
- 로컬 Docker 테스트 DB(PostgreSQL 17.11) 연결: DB 테스트 2개 통과 (DB 이름 확인, 실제 DB로 `/health/ready` 200)
- GitHub Actions(PostgreSQL 서비스)에서 타입 검사·단위 테스트·DB 테스트·빌드 통과
- 안전장치: `TEST_DATABASE_URL`이 없거나 `_test`가 아닌 DB를 가리키면 DB 테스트가 시작되지 않음
- 테스트 DB(17.11)에 첫 마이그레이션(`20261019051147_auth_tables`) 적용, 인증 DB 테스트 통과 (회원가입·로그인·회전·최대 수명·재사용 감지·동시 갱신·로그아웃·CHECK와 shared 상태값 일치)
- 팀 개발용 Supabase 연결과 마이그레이션 3개 적용·검증, Data API 꺼짐 확인 (2026-10-19, [이슈 #5](https://github.com/Jubileekim/KEMI/issues/5))

**아직 확인하지 않은 것**

- Render 배포와 헬스 체크 동작
- Vercel rewrite를 거친 `/api/*` 호출
- 실제 브라우저에서의 Refresh 쿠키 동작 (`Secure` 쿠키는 `http://localhost`에서는 대부분의 브라우저가 허용하지만, 프론트엔드 연동 때 확인한다)

## TypeScript 버전 (5.9.3 고정)

`typescript@5.9.3`으로 고정한다(팀 리뷰 확정). `package.json`에는 범위(`^`) 없이 `5.9.3`으로 적고, lockfile에도 5.9.3이 기록돼 있다. 근거는 다음과 같다. (2026-10-19 npm 레지스트리 기준)

- 함께 쓸 예정인 `typescript-eslint@8.71.2`의 peer 의존성이 `typescript >=4.8.4 <6.1.0`이다. 최신 `typescript@7.0.2`는 이 범위 밖이라 설치할 때 peer 경고가 나고, 공식 지원 대상이 아니다.
- `prisma@7.10.1`의 peer 의존성은 `typescript >=5.4.0`이라 5.9로 충분하다.
- TypeScript 7로 이 코드를 직접 빌드·검사해 보지는 않았다. 실제로 동작하지 않는다고 확인한 것은 아니다.
- 6.0.3도 위 범위에 들어가지만, 팀 리뷰에서 5.9.3으로 고정하기로 했다. 올릴 때는 `typescript-eslint` 지원 범위를 먼저 확인한다.

## 폴더 구조

```text
apps/api/
├─ prisma/schema.prisma    # DB 모델 (기능별 PR에서 추가)
├─ prisma.config.ts        # Prisma 7 설정 (DB 주소·마이그레이션 위치)
├─ src/
│  ├─ app.ts               # Express 앱 조립 (테스트에서 의존성 주입)
│  ├─ server.ts            # 환경 변수 검증 → DB 연결 → 서버 시작·종료 처리
│  ├─ config/env.ts        # Zod 환경 변수 검증
│  ├─ http/                # AppError·공통 오류 처리
│  ├─ lib/prisma.ts        # Prisma Client (pg 어댑터)
│  ├─ routes/              # API 라우터
│  └─ generated/           # Prisma 생성 코드 (커밋하지 않음)
└─ test/                   # Vitest + Supertest
```
