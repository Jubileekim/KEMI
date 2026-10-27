# KEMI API (`@kemi/api`)

Express 5 · TypeScript · Prisma 7 · Supabase PostgreSQL 백엔드.

## 요구 사항

- Node.js 24 LTS (`.nvmrc`)
- npm 11 이상 (npm Workspaces)

## 처음 실행하기

저장소 루트에서 실행한다.

```bash
npm install
npm run prisma:generate -w @kemi/api     # Prisma Client 생성 (생성 파일은 Git에 포함하지 않는다)
cp apps/api/.env.example apps/api/.env   # 값 채우기 (아래 "DB 연결 주소" 참고)
npm run dev:api
```

- `npm install`과 `dev:api`는 Prisma Client를 만들지 않는다. 처음 받았을 때와 `schema.prisma`가 바뀐 브랜치로 옮겼을 때 `prisma:generate`를 다시 실행한다.

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
# 저장소 루트에서 시작
cd apps/api
cp .env.test.example .env.test
npm run test:db:up
npm run test:db
npm run test:db:down
cd ../..   # 저장소 루트로 돌아온다
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

| 메서드·경로                         | 하는 일                                                              | 성공 응답                                                            |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `POST /api/auth/signup`             | 이메일·비밀번호·이름·역할(`CLIENT`/`CREATOR`)로 가입하고 바로 로그인 | `201` + `{ accessToken, accessTokenExpiresIn, user }` + Refresh 쿠키 |
| `POST /api/auth/login`              | 이메일 로그인                                                        | `200` + 위와 같음                                                    |
| `POST /api/auth/refresh`            | Refresh 쿠키로 토큰 회전 (`Origin` 검사)                             | `200` + 새 Access 토큰 + 새 쿠키                                     |
| `POST /api/auth/logout`             | 로그인 세션 폐기, 쿠키 삭제 (`Origin` 검사)                          | `204`                                                                |
| `GET /api/auth/me`                  | `Authorization: Bearer <accessToken>`으로 현재 사용자 조회           | `200` + `{ user }`                                                   |
| `GET /api/auth/{provider}/start`    | 소셜 로그인 시작 (`google`·`kakao`, 브라우저 이동)                   | `302` 제공자 동의 화면                                               |
| `GET /api/auth/{provider}/callback` | 제공자 콜백. 결과를 프론트엔드 `/auth/social/callback`으로 전달      | `302` + `result=login\|signup` 또는 `error=...`                      |
| `GET /api/auth/social/signup`       | 가입 대기 중인 소셜 계정 정보 (가입 티켓 쿠키)                       | `200` + `{ provider, suggestedName, providerEmail }`                 |
| `POST /api/auth/social/signup`      | 역할·표시 이름으로 소셜 가입 후 바로 로그인 (`Origin` 검사)          | `201` + 회원가입과 같음                                              |

- 사용자 ID는 문자열이다(`"42"`). DB는 `bigint`다.
- Access 토큰은 15분이다. 응답 본문으로 받아 메모리에만 보관한다.
- Refresh 토큰은 `kemi_refresh` 쿠키(`HttpOnly; Secure; SameSite=Lax; Path=/api/auth`)로만 주고받는다. 로그인 세션은 로그인 시점부터 최대 7일이고, 회전해도 연장되지 않는다.
- 요청 제한: 가입 1시간 10회, 로그인 15분 10회, 갱신 15분 60회(IP 기준). 넘으면 `429 RATE_LIMITED`
- 오류 코드: `VALIDATION_FAILED`(400), `INVALID_CREDENTIALS`(401), `TOKEN_EXPIRED`(401), `UNAUTHENTICATED`(401), `SESSION_REVOKED`(401), `FORBIDDEN`(403), `EMAIL_ALREADY_EXISTS`(409), `REFRESH_RACE`(409, `details.retryAfterMs`), `RATE_LIMITED`(429)

### 소셜 로그인 (Google·카카오)

흐름과 규칙은 [결정 기록](../../docs/decisions/2026-10-19-backend-setup.md) 11장, 프론트엔드 연동 방법은 [소셜 로그인 연동 문서](../../docs/handoff/2026-10-21-social-login.md)에 있다.

- 제공자 콘솔에 등록할 콜백 주소: `{APP_ORIGIN}/api/auth/google/callback`, `{APP_ORIGIN}/api/auth/kakao/callback`
  - 로컬: `http://localhost:5173/api/auth/...` (Vite가 `/api`를 API 서버로 넘긴다)
  - 배포: Vercel 도메인 (rewrite로 Render에 전달)
- 환경 변수가 없는 제공자는 `error=SOCIAL_UNAVAILABLE`로 안내한다. 키 없이도 서버는 시작된다.
- 제공자 요청은 요청마다 10초 안에 끝나야 하며, 넘으면 취소하고 `error=SOCIAL_FAILED`로 보낸다.
- 요청 제한: 시작·콜백 각각 IP당 15분 20회(서로 따로 센다). 넘으면 `error=SOCIAL_RATE_LIMITED`로 보낸다.
- **[미검증] 실제 Google·카카오 로그인은 아직 확인하지 않았다.** 테스트는 가짜 제공자로만 실행한다. 준비할 앱 설정·키 이름·콜백 주소는 연동 문서의 "팀원 준비 목록"에 있다.

## 프로필 API

자세한 규칙은 [결정 기록](../../docs/decisions/2026-10-19-backend-setup.md) 10장에 있다. 두 경로 모두 `Authorization: Bearer <accessToken>`이 필요하다.

| 메서드·경로              | 하는 일                                   | 성공 응답                             |
| ------------------------ | ----------------------------------------- | ------------------------------------- |
| `GET /api/profiles/me`   | 본인 프로필 조회 (저장 전이면 빈 기본값)  | `200` + `{ name, profile }`           |
| `PATCH /api/profiles/me` | 보낸 항목만 저장. `name`은 회원 표시 이름 | `200` + 저장 결과 (`GET`과 같은 형식) |

- `profile.type`이 `CLIENT`면 의뢰인, `CREATOR`면 크리에이터 형식이다. 요청 본문도 로그인한 역할의 형식만 받는다.
- 보내지 않은 항목은 그대로다. 자유 입력 칸(문자열·주소)의 빈 문자열은 `null`로 저장하고, 선택지·날짜는 `null`로 지운다. 항목별 규칙은 결정 기록 10장 "PATCH 값 규칙" 표에 있다.
- 모르는 항목·다른 역할 항목·`serviceStatus`는 `400 VALIDATION_FAILED`다.
- 크리에이터의 `serviceStatus`는 `DRAFT`로 시작하며 저장으로 바뀌지 않는다. 공개·비공개는 패키지 PR에서 만든다.
- 관리자 계정은 `403 FORBIDDEN`이다. 이용 제한·탈퇴 회원은 상태가 바뀌기 전에 받은 토큰으로도 `403 FORBIDDEN`이다.
- 선택지 값과 화면 표시 이름 제안: [프로필 선택지 공유 문서](../../docs/handoff/2026-10-21-profile-options.md)
- 이번 구현은 PROFILE-01·02의 텍스트·선택 항목까지다. 로고·이미지·경력·링크·공개 전환은 후속이다(결정 기록 10장 표).

## 공개 프로젝트 API

PRD v2.0의 공개 맞춤 의뢰(PROJ-01·02)다. 공개 목록과 상세는 로그인 없이 조회할 수 있고, 등록·수정·마감·삭제는 `CLIENT`만 할 수 있다.

| 메서드·경로                            | 하는 일                                        |
| -------------------------------------- | ---------------------------------------------- |
| `GET /api/projects`                    | 모집 중인 프로젝트 검색·필터·정렬·페이지네이션 |
| `GET /api/projects/{projectId}`        | 모집 중인 프로젝트 상세 조회                   |
| `GET /api/projects/me`                 | 마감된 항목을 포함한 내 프로젝트 목록          |
| `POST /api/projects`                   | 공개 프로젝트 등록                             |
| `PATCH /api/projects/{projectId}`      | 본인 프로젝트 부분 수정                        |
| `POST /api/projects/{projectId}/close` | 모집 마감                                      |
| `DELETE /api/projects/{projectId}`     | 소프트 삭제                                    |

- 검색: `q`
- 필터: `purpose`, `styles`(쉼표 구분), `budgetMin`, `budgetMax`
- 정렬: `LATEST`, `BUDGET_LOW`, `BUDGET_HIGH`, `DEADLINE`
- 페이지: `page`, `pageSize`(최대 50)
- 공개 목록에는 `OPEN`, 미삭제, 모집 마감 전 항목만 나온다.
- 영상 목적과 스타일의 허용 값 및 요청·응답 형식은 Swagger UI(`/api/docs`)가 기준이다.
- 삭제는 행을 지우지 않고 `CLOSED`와 `deleted_at`으로 보존한다.

## 지원·알림 API

자세한 규칙은 [결정 기록](../../docs/decisions/2026-10-19-backend-setup.md) 12장에 있다. 모두 `Authorization: Bearer <accessToken>`이 필요하다.

| 메서드·경로                                            | 누가       | 하는 일                                           |
| ------------------------------------------------------ | ---------- | ------------------------------------------------- |
| `POST /api/projects/{projectId}/applications`          | 크리에이터 | 지원 (모집 중·마감 시각 전, 프로젝트당 1회)       |
| `GET /api/projects/{projectId}/applications`           | 의뢰인     | 내 프로젝트의 지원자 목록                         |
| `GET /api/applications/me`                             | 크리에이터 | 내 지원 내역 (`page`, `pageSize`)                 |
| `POST /api/applications/{applicationId}/discuss`       | 의뢰인     | 협의 요청 → 그 지원만 `DISCUSSING` (선정 아님)    |
| `POST /api/applications/{applicationId}/decline`       | 의뢰인     | 대기·협의 중 지원 거절 (조건서 무효)              |
| `POST /api/applications/{applicationId}/withdraw`      | 크리에이터 | 계약 전 본인 지원 철회                            |
| `POST /api/projects/{projectId}/end-without-selection` | 의뢰인     | 무선정 종료: 활성 지원 미선정                     |
| `GET /api/notifications`                               | 모두       | 내 알림(`unread=true`로 미확인만) + `unreadCount` |
| `GET /api/notifications/unread-count`                  | 모두       | 미확인 개수                                       |
| `POST /api/notifications/{notificationId}/read`        | 모두       | 하나 읽음                                         |
| `POST /api/notifications/read-all`                     | 모두       | 모두 읽음                                         |

- **선정 모델(기능명세서 APPLY-02·CONTRACT-01, 2026-10-26):** 협의 요청은 선정이 아니다. 여러 후보와 동시에 협의할 수 있고, 같은 조건서 버전에 양측이 서명하면 그 후보가 선정되며 나머지 활성 지원은 `NOT_SELECTED`가 된다. 프로젝트 `MATCHED` 상태는 더 이상 쓰지 않는다.
- 알림: `APPLICATION_SUBMITTED`·`APPLICATION_WITHDRAWN`(의뢰인), `DISCUSSION_REQUESTED`, `APPLICATION_AUTO_REJECTED`, `APPLICATION_DECLINED`, `PROJECT_CLOSED`, `PROJECT_ENDED_NO_SELECTION`(크리에이터), 조건서·계약의 `TERMS_SIGNING_REQUESTED`·`CONTRACT_SIGNED`, 결제의 `PAYMENT_SUCCEEDED`(아래)
- 모집 마감은 스케줄러 없이 처리한다. 지원할 때 마감 시각을 검사하고, 직접 마감하면 대기 지원자에게 알린다. 마감 시각이 지났다는 알림은 보내지 않는다.

## 최종 조건서·서명·계약 API (TERMS-01~03, CONTRACT-01)

자세한 규칙은 [결정 기록](../../docs/decisions/2026-10-19-backend-setup.md) 13장에 있다. 모두 `Authorization: Bearer <accessToken>`이 필요하고, 그 요청의 의뢰인·크리에이터만 쓸 수 있다(다른 사람에게는 `404`). 공개 지원의 요청 ID는 지원 ID와 같다.

| 메서드·경로                                                          | 하는 일                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/work-requests/{id}/terms`                                  | 참조 사본, 모든 버전(값·상태·서명), 계약(있으면)                                 |
| `POST /api/work-requests/{id}/terms/versions`                        | 새 버전 저장 `{ commandId, baseVersionNo, values }`. 비어 있어도 저장됨          |
| `POST /api/work-requests/{id}/terms/versions/{versionNo}/signing`    | 서명 요청. 48시간 기한, 금액·조건 7개 필수                                       |
| `POST /api/work-requests/{id}/terms/versions/{versionNo}/signatures` | 본인 서명 `{ signerName, consent: true, termsHash }`. 두 번째 서명이면 계약 체결 |
| `GET /api/work-requests/{id}/contract`                               | 계약서 조회                                                                      |

- 협의 중(`DISCUSSING`)인 요청에서만 저장·서명할 수 있다. 모집 마감은 진행 중인 협의를 막지 않는다.
- 버전 상태: `DRAFT` → `SIGNING`(48시간) → `SIGNED`. 새 버전을 저장하면 이전 버전은 `SUPERSEDED`, 기한이 지나면 `EXPIRED`, 협의가 끝나면 `VOID`. 값과 서명은 지우지 않는다.
- `baseVersionNo`가 마지막 버전과 다르면 `409`다(다른 당사자가 먼저 저장함). 같은 `commandId`·같은 서명의 재전송은 `200`으로 이전 결과를 준다.
- 두 번째 서명은 한 트랜잭션에서 계약 생성, 요청·프로젝트 `CONTRACTED`, 같은 프로젝트의 다른 활성 지원 `NOT_SELECTED`와 그 조건서 `VOID`, 알림(`CONTRACT_SIGNED`, `APPLICATION_AUTO_REJECTED`)까지 처리한다. 공고당 계약은 하나다.
- 만료는 스케줄러 없이 처리한다. 기한이 지난 `SIGNING`은 조회할 때 `EXPIRED`로 보이고, 다음 저장 때 `EXPIRED`로 기록된다.

## 파일 API (FILE-01)

결정 기록 4장의 흐름대로 **브라우저가 Supabase Storage(비공개 버킷)에 직접 올리고** 서버는 권한·확인만 한다.

| 메서드·경로                     | 하는 일                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `POST /api/files`               | 업로드 준비 `{ purpose, fileName, mimeType, sizeBytes, workRequestId? }` → 서명 업로드 URL |
| `POST /api/files/{id}/complete` | 실제 크기·매직 바이트 확인 → `READY` 또는 `REJECTED`                                       |
| `GET /api/files/{id}`           | 파일 정보                                                                                  |
| `GET /api/files/{id}/download`  | 다운로드·재생 서명 URL (10분)                                                              |

- 한도: 영상(MP4·MOV)·ZIP 50MB, 이미지(JPG·PNG·WebP) 10MB. DB CHECK에도 같은 한도가 있다.
- 거래 파일(`CHAT_ATTACHMENT`·`MATERIAL`·`DELIVERABLE`·`REVISION`)은 요청 당사자만, 프로필·작업물 파일은 올린 사람만 본다.
- 채팅 메시지에 `attachmentFileIds`(최대 5개)로 확인이 끝난 본인 첨부를 붙인다.
- `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`가 없으면 업로드·다운로드는 503. **[검증 필요] 실제 Supabase 버킷으로는 아직 호출해 보지 않았다.** 버킷은 비공개로 만들고, 버킷에도 같은 크기·MIME 제한을 건다.

## 요청별 대화 API (CHAT-01~05, WORK-04)

| 메서드·경로                                  | 하는 일                                                             |
| -------------------------------------------- | ------------------------------------------------------------------- |
| `GET /api/chat/rooms`                        | 내 대화방 목록 (최근 메시지 순, 미확인 수, 읽기 전용 여부)          |
| `GET /api/work-requests/{id}/chat/messages`  | 메시지 (기본 최신 50개, `before`·`after`·`limit`)                   |
| `POST /api/work-requests/{id}/chat/messages` | 텍스트 메시지 `{ clientMessageId, body }` (4,000자, 재전송은 한 번) |
| `POST /api/work-requests/{id}/chat/read`     | 읽음 위치 `{ lastReadMessageId }` (뒤로 가지 않음)                  |

- 방은 협의 요청 때 생기고, 계약 뒤에도 같은 방·기록을 쓴다. 당사자만 볼 수 있다(후보별 방은 서로 보이지 않음).
- 거절·철회·미선정된 협의의 방은 읽기만 된다. 모집 마감·조건서 만료만으로는 닫히지 않는다.
- 서명 요청·계약 체결·결제 완료는 `SYSTEM` 메시지로 남는다(WORK-04). 대화·첨부만으로 계약·납품 상태가 바뀌지 않는다.
- 실시간 전송은 없다. 화면이 `after`로 새 메시지를 다시 받는다(D07 결정 대기).

## 테스트 결제 API (PAY-01·02, Toss Sandbox)

자세한 규칙은 [결제 설계](../../docs/decisions/2026-10-26-payments.md)에 있다. 모두 `Authorization: Bearer <accessToken>`이 필요하다. **실제 돈은 움직이지 않는다.** 서버는 Toss 테스트 시크릿 키(`test_sk_`·`test_gsk_`)만 받고, `live_` 키는 서버가 시작하지 않는다.

| 메서드·경로                         | 누가        | 하는 일                                                           |
| ----------------------------------- | ----------- | ----------------------------------------------------------------- |
| `GET /api/contracts/{id}/payments`  | 계약 당사자 | 결제 내역 (실패·취소 포함)                                        |
| `POST /api/contracts/{id}/payments` | 의뢰인      | 계약 전액 주문 `{ commandId }` → `orderId`·금액을 결제창에 넘긴다 |
| `POST /api/payments/confirm`        | 의뢰인      | successUrl 값 `{ paymentKey, orderId, amount }`로 승인            |
| `POST /api/payments/{orderId}/sync` | 계약 당사자 | 결과가 불명확한 주문을 Toss 조회로 다시 맞춤                      |
| `POST /api/payments/{orderId}/fail` | 의뢰인      | failUrl 값 `{ code, message }` 기록 + Toss 조회로 확인 뒤 닫음    |

- 금액은 서명된 계약 금액만 쓴다. 승인 요청의 `amount`가 주문 금액과 다르면 Toss를 부르지 않고 `400`이다.
- 주문 상태: `READY` → `SUCCEEDED`·`FAILED`·`CANCELED`, 응답을 받지 못하면 `UNKNOWN`(sync로 맞춤). 계약당 진행 중·완료 주문은 하나뿐이다.
- `TOSS_SECRET_KEY`가 없으면 주문·승인·sync는 `503`이고 내역 조회만 된다.

## AI 단가 분석 (AI-01·AI-02)

`POST /api/pricing/analyze` — 활성 의뢰인 `Authorization: Bearer <accessToken>` 필수.

- 입력: `description`(10~5000자) 및 선택 입력 `title`, `purpose`, `styles`, `expectedDurationSeconds`.
- 출력: `workUnits`(작업·수량·추정 단가·산정 근거·소계), `estimatedBudgetKrw`(KRW 정수 합계), `assumptions`, `notice`.
- **AI 출력은 참고용 추정치**이며 거래 확정가·실제 시장 단가가 아니다. 모델이 낸 수치의 범위를 서버가 검증하고 합계는 서버가 다시 계산한다.
- 예산 반영은 자동으로 저장하지 않는다. 프론트엔드에서 확인 후 새 프로젝트 등록 시 `budget`으로 사용하거나, 모집 중인 본인 프로젝트에 `PATCH /api/projects/{projectId}`와 `{ "budget": 추정금액 }`을 보낸다. 기존 프로젝트 권한·마감 검증이 그대로 적용된다.
- 키가 없으면 `503 SERVICE_UNAVAILABLE`, 호출/응답 오류는 `502 SERVICE_UNAVAILABLE`, 로그인 사용자당 1시간 10회 초과 시 `429 RATE_LIMITED`(인증 실패는 차감하지 않음).
- API 키는 **백엔드** `AI_PRICING_API_KEY`에서만 읽는다. 미설정 시 가짜 AI 견적을 반환하지 않는다. 기본 모델은 `AI_PRICING_MODEL=gpt-4o-mini`이며 서버에서 변경 가능하다. AI 모델 호출은 외부 API 과금과 데이터 전송을 수반하므로, 사용자 화면에는 해당 사실과 민감정보 미입력 안내가 필요하다.
- 실제 외부 모델·프론트엔드·DB E2E 검증은 별도 작업이다. 요청·응답 세부 형식은 Swagger의 `pricing` 태그를 참조한다.

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

| 이름                                        | 필수 | 기본값         | 설명                                                                                                                            |
| ------------------------------------------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                  |      | `development`  | `development` / `test` / `production`                                                                                           |
| `PORT`                                      |      | `4000`         | Render는 자동으로 지정한다                                                                                                      |
| `DATABASE_URL`                              | ✅   |                | 실행용 PostgreSQL 주소                                                                                                          |
| `DATABASE_POOL_MAX`                         |      | `5`            | 서버 한 대의 최대 DB 연결 수                                                                                                    |
| `MIGRATION_DATABASE_URL`                    |      | `DATABASE_URL` | 마이그레이션 전용 주소가 따로 필요할 때만                                                                                       |
| `JWT_ACCESS_SECRET`                         | ✅   |                | Access 토큰 서명 키 (32자 이상)                                                                                                 |
| `APP_ORIGIN`                                | ✅   |                | 프론트엔드 주소. refresh·logout 요청의 `Origin`과 같아야 한다                                                                   |
| `TRUST_PROXY_HOPS`                          |      | `0`            | 앞단 프록시 개수. 요청 제한의 클라이언트 IP 판단에 쓴다. 배포 값은 배포 후 확인해서 정한다 (결정 기록 8장 "클라이언트 IP 판단") |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  |      |                | Google 로그인. 둘 다 넣어야 켜진다                                                                                              |
| `KAKAO_REST_API_KEY`                        |      |                | 카카오 로그인(REST API 키). 넣으면 켜진다                                                                                       |
| `KAKAO_CLIENT_SECRET`                       |      |                | 카카오 Client Secret. 앱에서 끈 경우에만 비운다                                                                                 |
| `AI_PRICING_API_KEY`                        |      |                | 심화 AI 단가 분석 서버 키. 없으면 요청 시 503 (브라우저에 노출 금지)                                                            |
| `AI_PRICING_MODEL`                          |      | `gpt-4o-mini`  | AI 단가 분석용 Responses API 모델                                                                                               |
| `TOSS_SECRET_KEY`                           |      |                | 테스트 결제. Toss **테스트** 시크릿 키(`test_sk_`·`test_gsk_`)만. 없으면 결제 경로 503 (브라우저에 노출 금지)                   |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |      |                | 파일 저장소. 개발용 Supabase URL과 service role 키(서버 전용). 없으면 파일 경로 503                                             |
| `STORAGE_BUCKET`                            |      | `kemi-private` | 비공개 버킷 이름                                                                                                                |

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

## Render 배포 설정

아래는 **목표 설정**이다. 현재 `kemi-api`는 수동으로 만든 서비스라 [`render.yaml`](../../render.yaml)(Blueprint)과 연결돼 있지 않고, 기존 서비스는 대시보드에서 이 값에 맞춘다. 현재 상태와 변경 체크리스트는 [배포 절차서](../../docs/runbooks/auth-deploy-verification.md) 2단계에 있다. Blueprint는 새 환경을 처음 만들 때만 쓴다.

| 항목              | 값                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Root Directory    | (비움, 저장소 루트)                                                                                                                      |
| Build Command     | `npm ci --include=dev && npm run build:api` (린트·Prisma CLI·TypeScript가 devDependencies라서 `NODE_ENV=production`이어도 설치되게 한다) |
| Start Command     | `npm start -w @kemi/api`                                                                                                                 |
| Health Check Path | `/health`                                                                                                                                |
| 플랜·리전         | `free`, `singapore`                                                                                                                      |
| 자동 배포         | `checksPass` (`main`의 CI를 통과한 커밋만)                                                                                               |
| Environment       | `NODE_ENV=production`, `DATABASE_URL`·`APP_ORIGIN`(생성 시 입력), `JWT_ACCESS_SECRET`(Render 생성), `TRUST_PROXY_HOPS=0`(4단계에서 확정) |

마이그레이션은 배포 때 자동으로 돌리지 않는다. 팀 DB 적용 절차를 따로 거친다.

Render 계정은 희년님이 관리한다(무료 워크스페이스는 팀원 초대 불가). 팀원은 대시보드 대신 PR로 바꾸고, 배포 결과는 이슈 #27에서 공유한다. 자세한 역할은 절차서 2-0.

**운영 DB 마이그레이션은 배포·서버 시작에 자동으로 묶지 않는다.** `npm start -w @kemi/api`는 앱만 시작한다. `main`에 DB 변경이 들어오기 전에 백업 및 기존 데이터 보존 여부를 확인하고, 별도 개발용 DB에서 해당 커밋의 마이그레이션과 API/DB 테스트를 검증한 다음 담당자 승인 후 `npm run db:deploy -w @kemi/api`로 명시적으로 적용한다. Render 무료 플랜은 pre-deploy command를 제공하지 않으므로 새 코드 배포 전에 이 절차를 별도 수행한다. `prisma migrate status`와 `/health/ready`를 확인하고, 병합·자동 배포 뒤에는 실제 `/api/projects` 조회와 Render 오류 로그를 점검한다. 앱 롤백이 DB 마이그레이션을 되돌리지는 않으므로, 문제가 생겨도 `migrate reset`이나 레거시 테이블 삭제를 운영 DB에 실행하지 않는다. 이미 적용된 7개 이력과 기존 테이블 보존 상태는 [이슈 #24](https://github.com/Jubileekim/KEMI/issues/24)에 기록되어 있다.

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
│  ├─ auth/                # 회원가입·로그인·토큰
│  ├─ profiles/            # 역할별 본인 프로필
│  ├─ applications/        # 프로젝트 지원·협의 요청·거절·철회
│  ├─ notifications/       # 인앱 알림 생성(notify)·조회·읽음
│  ├─ docs/                # OpenAPI 문서·Swagger UI
│  ├─ http/                # AppError·공통 오류 처리·Bearer 토큰 읽기
│  ├─ lib/prisma.ts        # Prisma Client (pg 어댑터)
│  ├─ routes/              # API 라우터
│  └─ generated/           # Prisma 생성 코드 (커밋하지 않음)
└─ test/                   # Vitest + Supertest
```
