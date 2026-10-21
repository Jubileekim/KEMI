# 백엔드 인수인계서

- 작성: 2026-10-21, 이전 백엔드 담당(jangseonu / GitHub `seonu2070-droid`)
- 기준: `main` `22f1635` (PR #14 병합, 2026-10-21 08:30 UTC), 열린 PR #16 `843a8ea`·#10 `9609c7d`·#17(이 문서). 2026-10-21 09:17 UTC에 PR·리뷰·CI·개발용 DB 상태를 다시 확인했다.
  - 처음 작성할 때 기준은 `main` `e2ba39f`(PR #13 병합)였다. 그 뒤 #14가 병합돼 1·2·3·4·8·9·10·11장을 고쳤다.
  - 이 문서의 완료 여부는 위 커밋과 GitHub PR·이슈 기록을 직접 확인한 결과다.
  - 확인하지 못한 것은 **[미확인]**으로 표시한다.
- 이 문서는 요약과 연결만 한다. 자세한 규칙은 아래 원본 문서가 기준이다. 둘이 다르면 원본을 따른다.

| 원본 문서                                                   | 내용                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| [결정 기록](../decisions/2026-10-19-backend-setup.md)       | 인프라·인증·DB·프로필 설계와 확정/제안 정책, 다음 작업 표 |
| [API README](../../apps/api/README.md)                      | 설치·실행·테스트·환경 변수·API 목록·폴더 구조             |
| [ERD v0.6 변경 명세](../erd/erd-v0.6-changes.md)            | 실제 테이블과 ERD v0.6의 차이                             |
| [배포·검증 절차서](../runbooks/auth-deploy-verification.md) | 팀 DB 마이그레이션 적용 절차, Render·Vercel·브라우저 검증 |
| [프로필 선택지 공유 문서](2026-10-21-profile-options.md)    | 프론트엔드용 선택지 값·PATCH 규칙                         |
| [소셜 로그인 연동 문서](2026-10-21-social-login.md)         | 화면이 할 일, 콜백 주소, 키 발급 준비 목록                |

---

## 0. 새 담당자가 먼저 알아야 할 것

결정이나 조치가 필요한 항목만 모았다. 자세한 내용은 괄호 안의 장에 있다.

**바로 처리할 것**

1. **PR #16 리뷰·병합.** #14 병합으로 생긴 충돌은 `843a8ea`(최신 `main` 병합)에서 정리했고 CI도 통과했다. 지금은 병합 가능 상태이고 리뷰가 없다(2장).
2. **결정 기록 "다음 작업" 표의 소셜 로그인 행**은 `main`에서 아직 "PR #14 (리뷰 대기)"다. #16의 `843a8ea`에서 "완료 — PR #14 병합"으로 고쳤으므로, #16이 병합되면 함께 바로잡힌다.

**받아야 할 접근 권한** (이전 담당자가 넘겨줄 수 없는 것)

| 대상                               | 필요한 이유                                     | 누구에게                                      |
| ---------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| GitHub `Jubileekim/KEMI` 쓰기 권한 | 브랜치 푸시·PR                                  | 저장소 소유자 Jubileekim                      |
| Supabase 조직 KEMI 멤버            | `DATABASE_URL` 확인, 팀 DB 마이그레이션 적용    | **[미확인] 관리 권한자** (3장 환경 변수 표)   |
| Google Cloud·Kakao Developers      | 소셜 로그인 키 발급·콜백 주소 등록              | **[미확인] 발급 담당 미정**                   |
| Render·Vercel                      | 백엔드 배포, 프론트엔드 도메인·`/api/*` rewrite | **[미확인] 서비스 생성 여부·담당 미정** (8장) |

- 로컬 DB 테스트에는 Docker Desktop이 필요하다(3장).

**팀이 정해야 할 것** (정해지기 전에는 [제안]으로 둔다, 6장)

- 패키지 새 정책 값과 D03·D01 제안 (#16, 결정 기록 12장)
- 분야·스타일 선택지 값 D21
- 소셜 키 발급 담당, Supabase 관리 권한자, Vercel 도메인
- `main` 브랜치 보호 설정과 PR 템플릿 (이슈 #2. 이슈의 체크 상태는 실제보다 늦다, 11장)

**정리 여부를 정할 것** (모두 삭제하지 않고 남겨 두었다, 10장)

- 이전 담당자 PC의 `stash@{0}`: `main`과 비교한 결과 모두 대체됐다. 버려도 잃는 내용이 없다.
- 원격 브랜치 `docs/db-apply-checks`: `main`과 비교한 결과 남은 내용이 없다.
- 병합이 끝난 원격 브랜치들

## 1. `main`에 병합된 백엔드 기능

| PR  | 내용                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| #1  | 백엔드 초기 구성: Express 5, 환경 변수 검증(Zod), `GET /health`·`/health/ready`, Prisma 7, API CI, ESLint(Airbnb+TS) |
| #3  | Prettier 기본 설정, TypeScript 5.9.3 고정, 테스트 DB·CI 이미지 PostgreSQL 17.11 고정                                 |
| #4  | 이메일 회원가입·로그인·토큰 갱신·로그아웃·`/api/auth/me`, Refresh 토큰 회전·재사용 감지, 요청 제한(429), 인증 테이블 |
| #6  | 팀 DB 마이그레이션 적용 전·후 점검과 비상 되돌리기 절차서                                                            |
| #8  | 인증 테이블 Supabase Data API 차단(RLS, `anon`·`authenticated` 권한 회수, 기본 권한 변경)                            |
| #9  | `_prisma_migrations`의 Data API 권한 회수                                                                            |
| #11 | OpenAPI 3.1 문서 `/api/openapi.json`과 Swagger UI `/api/docs` (운영 환경에서는 꺼짐)                                 |
| #12 | 개발용 Supabase 적용 결과·Data API 꺼짐 확인 기록 (문서)                                                             |
| #13 | 역할별 본인 프로필 `GET`·`PATCH /api/profiles/me` (PROFILE-01·02의 텍스트·선택 항목), 프로필 테이블 2개              |
| #14 | Google·카카오 소셜 로그인과 소셜 가입(가입 티켓 10분), 제공자 요청 10초 제한, 시작·콜백 요청 제한 분리. DB 변경 없음 |

- 참고: PR #7(`apps/web` 프론트엔드 작업 공간)은 프론트엔드 담당 작업이다.
- #14는 Dev-Yuncheol 리뷰 2개 항목을 `5c56e54`에서 반영한 뒤 2026-10-21 08:30 UTC에 병합됐다. **실제 Google·카카오 로그인은 아직 검증하지 않았다**(8장).
- 결정 기록 "다음 작업" 표의 소셜 로그인 행은 `main`에서 아직 "PR #14 (리뷰 대기)"로 남아 있다. #16에서 고쳤다(2장).

## 2. 열려 있는 PR과 남은 작업

| PR                                                                   | 브랜치                  | 상태 (2026-10-21)                                                                           | 남은 작업                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [#16](https://github.com/Jubileekim/KEMI/pull/16) 패키지·서비스 공개 | `feat/packages`         | 리뷰 없음. 충돌은 `843a8ea`에서 정리, 병합 가능. CI 통과(`843a8ea`)                         | ① 팀원 리뷰·병합(충돌 정리 내용은 아래)<br>② 새 정책 값 팀 결정(최대 3개 등, 결정 기록 12장)<br>③ 병합 후 마이그레이션 `20261021090000_service_packages`를 팀 DB에 적용(절차는 7장)<br>④ 요청·계약 PR에서 "패키지 수정 후 기존 요청 금액 유지" 테스트                                      |
| [#17](https://github.com/Jubileekim/KEMI/pull/17) 이 인수인계서      | `docs/backend-handover` | Dev-Yuncheol 리뷰(의견, 10/21 08:41) 2개 항목을 `6f98920`에서 반영, **재리뷰 대기**         | ① 리뷰어의 반영 확인·병합<br>&nbsp;&nbsp;- 반영 1: 처음 실행 절차에 `npm run prisma:generate -w @kemi/api` 추가(이 문서 3장·README)<br>&nbsp;&nbsp;- 반영 2: 명령마다 실행 위치 명시(`cd ../..`, `db:deploy -w @kemi/api`)<br>② 병합 전후로 이 문서의 상태 표를 최신 PR 상태와 다시 맞추기 |
| [#10](https://github.com/Jubileekim/KEMI/pull/10) ERD v0.5 검토 보존 | `backend-pm`            | 작성자 Jubileekim(PM). Dev-Yuncheol 리뷰(의견, 10/19) 2개 항목에 대한 반영 커밋은 아직 없음 | 실행 코드가 아닌 검토 자료(`apps/api/prisma/review/`). 리뷰 내용: README의 "완료 사항" 제목을 과거 작업 기록으로 바꾸기, 비교 기준(v0.6·팀 결정 문서 커밋, PRD v1.4 위치) 남기기. 반영·병합·종료는 PM이 정한다. 현재 실행 기준은 ERD v0.6 기반 `schema.prisma`다                           |

**리뷰 기록** (2026-10-21 확인, 모두 Dev-Yuncheol)

남아 있는 리뷰 의견은 #10의 2개 항목뿐이다(PM이 정함). 나머지는 모두 반영 커밋이 있다.

| PR  | 리뷰                                                              | 반영                        |
| --- | ----------------------------------------------------------------- | --------------------------- |
| #6  | 승인                                                              | —                           |
| #9  | 의견: 점검표를 최초·추가 적용으로 분리, 권한 검사에 MAINTAIN 포함 | `f1277a4` 반영 후 병합      |
| #10 | 의견: README 제목 정리, 비교 기준 식별 정보 남기기                | **미반영** (PM 작업)        |
| #11 | 의견: 이메일 형식 문서 표시, Swagger·Origin 403 안내              | `6e051e5` 반영 후 병합      |
| #12 | 의견: 다음 작업 표의 Supabase 연결 상태 구분 → 승인               | `3e93d16` 반영 후 승인·병합 |
| #13 | 의견: PATCH 요청 스키마 `oneOf` → `anyOf`                         | `34002dc` 반영 후 병합      |
| #14 | 의견: 제공자 요청 타임아웃, 시작·콜백 요청 제한 분리 → 승인       | `5c56e54` 반영 후 승인·병합 |
| #16 | 없음                                                              | —                           |
| #17 | 의견: Prisma Client 생성 단계, 명령 실행 위치                     | `6f98920` 반영, 재리뷰 대기 |

- #1·#3·#4·#8은 GitHub에 리뷰 기록이 없다. 병합은 Dev-Yuncheol이 했다. 리뷰를 다른 곳에서 했는지는 **[미확인]**이다.
- #9·#11·#13은 의견(COMMENTED) 리뷰를 반영한 뒤, 승인 기록 없이 작성자(`seonu2070-droid`)가 병합했다. 팀 규칙("작성자 외 1명 리뷰 후 병합")에서 의견 리뷰를 리뷰로 볼지는 팀이 정한다.

**#16 충돌 정리 (완료, `843a8ea`)**

- #16은 #14와 같은 `main` `e2ba39f`에서 분기해, #14가 먼저 병합되면서 충돌했다. 최신 `main`(`22f1635`)을 #16 브랜치에 병합해 정리했다(강제 푸시 없음).
- 충돌 파일 3개
  - `apps/api/src/docs/openapi.ts`: 소셜 경로와 패키지 경로를 모두 남겼다.
  - `apps/api/test/openapi.test.ts`: 경로 치환에 #14의 `{provider}`와 #16의 `{packageId}`·`{creatorId}`, `put`·`delete` 처리를 합쳤다.
  - `docs/decisions/2026-10-19-backend-setup.md`: 10장 프로필, 11장 소셜 로그인, 12장 패키지 순서로 두고, "다음 작업" 표의 소셜 로그인 행을 "완료 — PR #14 병합"으로 고쳤다.
- 정리 내용과 검사 결과는 [#16 댓글](https://github.com/Jubileekim/KEMI/pull/16)에 있다. 리뷰어는 이 병합 커밋도 함께 본다.

## 3. 설치·환경 설정·실행·테스트·빌드

자세한 내용은 [API README](../../apps/api/README.md) "처음 실행하기"·"명령어"·"테스트"에 있다. 요약은 다음과 같다.

```bash
# 시작 위치: 저장소 루트. Node 24 (.nvmrc) · npm 11
npm install
npm run prisma:generate -w @kemi/api            # Prisma Client 생성 (생성 파일은 Git에 없다)
cp apps/api/.env.example apps/api/.env          # 값은 아래 환경 변수 표 참고
npm run dev:api                                 # http://localhost:4000, GET /health

# 테스트 (저장소 루트에서 시작)
npm run test:api                                # 단위 테스트 (DB 불필요)
cd apps/api                                     # 여기부터 apps/api
cp .env.test.example .env.test
npm run test:db:up                              # Docker PostgreSQL 17.11 (포트 54329, 메모리 저장)
npm run test:db                                 # DB 테스트 (TEST_DATABASE_URL만 사용, 원격 DB 차단)
npm run test:db:down
cd ../..                                        # 저장소 루트로 돌아온다

# 검사·빌드 (저장소 루트, CI와 같은 순서)
npm run format:check && npm run lint && npm run typecheck
npm run build:api                               # 린트 경고가 하나라도 있으면 실패
```

- `prisma:generate`는 처음 받았을 때와 `schema.prisma`가 바뀐 브랜치로 옮겼을 때 실행한다. `npm install`과 `dev:api`에는 생성 단계가 없다. 린트·타입 검사·빌드·DB 테스트(`test:db`)는 실행 전에 스스로 생성하지만, 단위 테스트(`test:api`)는 생성하지 않는다.

- **npm 설치 경고**: `npm install` 끝에 `allow-scripts` 경고(prisma·bcrypt·esbuild 등의 설치 스크립트 미실행)가 나온다. 2026-10-21 새 폴더 확인에서는 이 상태로 생성·실행·테스트·빌드가 모두 됐다. 경고만 보고 `approve-scripts`를 실행하지 않아도 된다.
- **테스트 DB 컨테이너 이름**: Docker Compose 프로젝트 이름이 폴더 이름(`api`)이라, 저장소를 두 곳에 받아도 같은 컨테이너 `api-postgres-test-1`(포트 54329)를 함께 쓴다. 한쪽에서 `test:db:down`을 하면 다른 쪽도 멈춘다.
- **Docker Desktop**: 이 PC를 재시작하면 Docker Desktop이 꺼져 있을 수 있다. 켠 뒤 `test:db:up`을 다시 실행한다.
- **테스트 DB 데이터**: 메모리에만 있어 컨테이너가 바뀌면 비어 있다. DB 테스트를 시작할 때 Supabase 역할 재현과 마이그레이션 적용이 자동으로 다시 된다.
- **브랜치를 바꿔 DB 테스트를 돌릴 때**: 컨테이너가 살아 있는 동안에는 앞서 돌린 브랜치의 테이블이 남는다. 예를 들어 #16 브랜치를 돌린 뒤 `main`에서 돌리면 `service_packages`가 남아 `data-api-lockdown` 테스트("앱 테이블은 목록과 같다")가 실패한다. 이때는 `apps/api`에서 `npm run test:db:down` → `npm run test:db:up`으로 테스트 DB를 새로 띄운다(테스트 DB만 지워지고 팀 DB와는 관계없다).
- **CI**: `.github/workflows/api-ci.yml`(job `api`)과 `web-ci.yml`. PR마다 형식·타입·단위·DB 테스트·린트·빌드를 실행한다. 비밀값 없이 동작한다.

### 환경 변수 (값은 이 문서에 적지 않는다)

| 이름                                        | 필요한 곳           | 값을 받는 곳·발급 담당                                                                                                                             |
| ------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | 서버·마이그레이션   | 팀 개발용 Supabase → Connect → Session pooler. 프로젝트 관리 권한자에게 받는다. **[미확인] 관리 권한자 명단**(조직 KEMI)                           |
| `MIGRATION_DATABASE_URL`                    | (선택) 마이그레이션 | 필요할 때만. 현재 쓰지 않는다                                                                                                                      |
| `JWT_ACCESS_SECRET`                         | 서버                | 담당자가 직접 만든다(32자 이상, README의 생성 명령). 환경마다 따로 만들고 공유하지 않는다                                                          |
| `APP_ORIGIN`                                | 서버                | 로컬 `http://localhost:5173`. 배포 값은 프론트엔드 담당(Vercel 도메인). **[미확인] Vercel 도메인 미정**                                            |
| `TRUST_PROXY_HOPS`                          | 서버                | 로컬 0. 배포 값은 Render 배포 후 확인해서 정한다(절차서 4장)                                                                                       |
| `PORT`, `NODE_ENV`, `DATABASE_POOL_MAX`     | 서버                | 기본값 있음. Render는 `PORT`를 자동 지정                                                                                                           |
| `TEST_DATABASE_URL`                         | DB 테스트           | `.env.test.example`의 로컬 Docker 값. 비밀값 아님                                                                                                  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  | 서버 (소셜 로그인)  | Google Cloud Console. **[미확인] 발급 담당 미정**. 둘 중 하나만 넣으면 서버가 시작하지 않는다. 준비 목록은 [연동 문서](2026-10-21-social-login.md) |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` | 서버 (소셜 로그인)  | Kakao Developers. **[미확인] 발급 담당 미정**                                                                                                      |

- 소셜 키는 비워도 서버가 시작한다. 이때 해당 제공자의 소셜 로그인만 동작하지 않는다.
- 비밀값은 로컬 `apps/api/.env`(커밋 금지)와 Render 대시보드 Environment에만 넣는다. 채팅·PR·이슈에 적지 않는다.
- 이전 담당자의 로컬 `.env`는 이 PC에만 있다. 새 담당자는 위 표대로 직접 받는다.

## 4. 주요 폴더와 파일

```text
apps/api/
├─ prisma/schema.prisma          # DB 모델 (ERD v0.6 기준, 실행 기준은 이 파일뿐)
├─ prisma/migrations/            # 적용 순서대로 쌓이는 SQL. 적용된 것은 고치지 않는다
├─ prisma.config.ts              # Prisma 7 설정 (MIGRATION_DATABASE_URL → DATABASE_URL 순)
├─ docker-compose.test.yml       # 테스트 DB (PostgreSQL 17.11)
├─ src/
│  ├─ server.ts                  # 환경 변수 검증 → 의존성 조립 → 서버 시작·종료
│  ├─ app.ts                     # Express 앱 조립 (테스트가 의존성을 주입)
│  ├─ config/env.ts              # 환경 변수 Zod 검증 (오류에 값 미출력)
│  ├─ auth/                      # 회원가입·로그인·토큰(tokens.ts)·요청 제한(rate-limits.ts)
│  │  └─ social/                 # 소셜 로그인 제공자 어댑터·state·가입 티켓
│  ├─ profiles/                  # 본인 프로필 조회·저장
│  ├─ docs/                      # OpenAPI 문서(openapi.ts)·Swagger UI
│  ├─ http/                      # AppError, 오류 응답 처리, Bearer 토큰 읽기
│  ├─ routes/health.ts           # /health, /health/ready
│  └─ lib/prisma.ts              # Prisma Client (pg 어댑터)
└─ test/
   ├─ *.test.ts                  # 단위 테스트
   ├─ db/*.db.test.ts            # DB 테스트 (인증·프로필·Data API 차단·CHECK와 shared 값 일치)
   └─ support/                   # 테스트 앱, 테스트 DB 안전장치, Supabase 역할 재현(globalSetup)
packages/shared/src/             # 요청 Zod 스키마·응답 타입·상태값 배열·오류 코드 (프론트엔드와 공유)
```

- PR #16 추가: `src/packages/`, `packages/shared/src/package.ts`

## 5. 설계 결정 (요약, 근거는 결정 기록)

**인증** (결정 기록 1·5·8장)

- Access 토큰: JWT HS256, 15분. 응답 본문으로 주고 프론트엔드는 메모리에만 둔다.
- Refresh 토큰: `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` 쿠키. 로그인 세션은 최대 7일이고 연장하지 않는다.
- 회전 시 같은 토큰이 다시 오면:
  - 10초 안: `409 REFRESH_RACE`
  - 10초 이후: 재사용으로 보고 세션 전체를 폐기한다.
- Access 토큰을 검증할 때 요청마다 DB에서 세션 폐기 여부와 회원 상태(`ACTIVE`)를 확인한다. 그래서 제한·탈퇴되면 이미 발급된 토큰도 바로 403이다.
- 쿠키로만 동작하는 요청(refresh·logout)은 `Origin` 헤더가 `APP_ORIGIN`과 같아야 한다.
- 요청 제한(429) 횟수는 서버 메모리에 센다. 서버가 재시작되면 초기화되고, 서버를 여러 대로 늘리면 대수만큼 따로 센다(`rate-limits.ts`). Render 무료 플랜 한 대 기준이다.
- bcrypt cost 12, 비밀번호 72바이트 이하
- 가입 역할은 `CLIENT`·`CREATOR`뿐이다. `ADMIN`은 가입으로 만들 수 없다.
- 이메일이 같아도 계정을 자동 병합하지 않는다(소셜 계정 포함).

**권한**

- 본인 자원 API는 항상 "토큰의 회원 본인"만 대상으로 한다. 경로에 회원 ID를 받지 않는다.
- 역할이 맞지 않으면 403, 남의 자원이면 404(존재 여부를 드러내지 않음)

**DB** (결정 기록 6·7·8장, ERD 변경 명세)

- 저장소는 Supabase PostgreSQL 17.11, 마이그레이션은 Prisma로만 한다.
- PK는 bigint이고, API에서는 문자열로 주고받는다.
- 상태값은 `text` + `CHECK`로 저장하고, 허용 값은 `@kemi/shared` 배열과 같아야 한다(`status-check` 테스트가 비교).
- 모든 테이블에 RLS를 켜고 정책은 두지 않는다. Data API 역할(`anon`·`authenticated`)에는 권한이 없다. 서버만 테이블 소유자로 접근한다.
  - 새 테이블 마이그레이션에는 `ENABLE ROW LEVEL SECURITY`를 넣고, `data-api-lockdown` 테스트 목록에도 추가한다.
- 회원은 삭제하지 않고 상태로 관리한다. 회원을 참조하는 FK는 `ON DELETE RESTRICT`다.
- 적용된 마이그레이션은 고치지 않는다. 바꿀 것이 있으면 새 마이그레이션 PR을 만든다.

**프로필** (결정 기록 10장)

- 프로필 행은 처음 저장할 때 만든다(upsert). 부분 수정이고, 역할별 `strictObject`로 검사한다.
- 빈 값·`null` 처리는 10장 "PATCH 값 규칙" 표가 최종 규칙이다.
- 복수 선택 값은 `text[]` + CHECK로 저장한다(ERD의 jsonb와 다름. 이유는 10장).

**패키지** (PR #16, 결정 기록 12장)

- 같은 크리에이터의 패키지·서비스 상태 변경은 모두 `creator_profiles` 행을 `FOR UPDATE`로 잠근 한 트랜잭션에서 실행한다.
- 대표 하나는 부분 UNIQUE 인덱스로 막는다: `UNIQUE (creator_id) WHERE is_representative AND deleted_at IS NULL`
- 삭제는 `deleted_at`만 기록하는 soft delete다. 요청·계약은 금액·조건을 자기 행에 복사해야 한다(ERD `work_requests.brief`, `terms_versions`).

## 6. 확정 정책과 제안 정책

표기는 결정 기록을 따른다. **[확정]**은 팀 결정이라 바꾸려면 합의가 필요하다. **[제안]**은 해당 PR 리뷰에서 확정한다.

| 영역      | [확정]                                                                                   | [제안] (팀 확인 필요)                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 계정      | 이메일·소셜 계정 자동 병합 안 함, 소셜 전용 회원은 비밀번호 없음 (1장)                   | 소셜 가입 흐름·가입 티켓 10분 (11장)                                                                                     |
| 토큰      | 세션 최대 7일·연장 없음, 10초 유예·재사용 감지 정책 유지, bcrypt 12                      | 갱신 재시도 규칙(최대 2회, 500ms·1s), 로그아웃 처리 (5장)                                                                |
| 공고·지원 | 공고당 계약 1개·취소와 환불 원칙, 같은 공고 중복 지원 방지 정책 (2·3장)                  | 제약 설계(부분 UNIQUE 등)·두 번째 서명 트랜잭션·지원 상태 처리 (2·3장)                                                   |
| 파일      | 파일당 한도·형식, 업로드 흐름 (4장)                                                      | 검사 방식 (4장). ZIP 내부 검사·보관 기간은 미결                                                                          |
| 프로필    | 의뢰인 브랜드 정보 모두 선택(P02)                                                        | 분야·스타일 선택지 값(D21 미확정, ERD v0.5 값 임시 사용), 표시 이름 문구                                                 |
| 패키지    | 서비스 공개 전 공개 대표 패키지 1개 이상(P04)                                            | D03: 첫 공개 패키지 자동 대표, 마지막 공개 패키지 비공개·삭제 시 서비스 자동 비공개, 대표는 먼저 바꿔야 비공개·삭제 가능 |
| 패키지    | —                                                                                        | **새 정책(팀 공유 대상)**: 최대 3개, 금액 1,000원~1억 원, 작업 1~90일, 수정 0~10회, 공개 조건 프로필 항목(D01)           |
| 범위      | `ledger_*` 초기 제외, 결제·환불·정산·분쟁 상태와 이력은 기본 범위 (6장)                  | —                                                                                                                        |
| 운영      | `main` 직접 푸시 금지, PR + CI + 작성자 외 1명 리뷰 후 병합, Claude는 직접 병합하지 않음 | `main` 브랜치 보호는 **미설정**(사람이 규칙을 지킴, 이슈 #2)                                                             |

## 7. 개발용 Supabase 마이그레이션

- 대상: 팀 개발용 Supabase 프로젝트(project ref `nibqyycfknurkncdgqps`, ap-northeast-1), PostgreSQL 17.11
- 2026-10-21 09:17 UTC(#14 병합 뒤)에 읽기 전용 `prisma migrate status`로 다시 확인했다: "4 migrations found … Database schema is up to date!" #14는 DB 변경이 없어 적용할 것이 없다.

| 마이그레이션                             | 출처 PR | 적용                           | 기록                                                     |
| ---------------------------------------- | ------- | ------------------------------ | -------------------------------------------------------- |
| `20261019051147_auth_tables`             | #4      | 2026-10-19 적용·검증           | [이슈 #5](https://github.com/Jubileekim/KEMI/issues/5)   |
| `20261019070424_auth_data_api_lockdown`  | #8      | 2026-10-19 적용·검증           | 이슈 #5                                                  |
| `20261019074729_prisma_history_lockdown` | #9      | 2026-10-19 적용·검증           | 이슈 #5                                                  |
| `20261021005250_role_profiles`           | #13     | 2026-10-21 02:42 UTC 적용·검증 | [이슈 #15](https://github.com/Jubileekim/KEMI/issues/15) |
| `20261021090000_service_packages`        | #16     | **미적용** (PR 리뷰 중)        | 병합 후 새 이슈로 진행                                   |

**미적용 항목을 적용하는 절차**

이슈 #5·#15와 같은 순서이며, [절차서](../runbooks/auth-deploy-verification.md) 1장을 따른다.

1. 이슈에 범위(새로 만드는 것, 바뀌지 않는 것)를 공유하고 동의를 받는다.
2. `BEGIN READ ONLY`로 사전 점검한다.
   - 이력이 모두 완료 상태인지
   - 같은 이름의 테이블·제약이 없는지
   - 기본 권한
   - `migrate status`에서 이번 마이그레이션 1개만 대기인지
3. 저장소 루트에서 `npm run db:deploy -w @kemi/api`(`prisma migrate deploy`)로 적용한다. `apps/api`에서는 `npm run db:deploy`다. `migrate dev`·`reset`은 쓰지 않는다.
4. 적용 후 확인
   - 이력
   - RLS·CHECK·인덱스
   - `anon`·`authenticated` 권한 0(MAINTAIN 포함)
   - `/health/ready` 200
5. 이슈에 기록한다. 예상과 다르면 멈추고 보고한다. 되돌리기 SQL은 수동 비상 절차일 뿐이다.

- 점검할 때 `information_schema`는 MAINTAIN 권한을 보여주지 않는다. `has_table_privilege`·`aclexplode`로 확인한다.
- 개발용 Supabase에는 이벤트 트리거 `ensure_rls`가 있어 새 테이블에 RLS를 자동으로 켠다. 트리거 목록은 이슈 #15에 기록돼 있다.
- Data API는 꺼져 있다(PR #12 기록).

## 8. 자동 테스트로 확인한 것과 아직 확인하지 못한 것

**자동 테스트로 확인 (CI와 로컬 Docker 테스트 DB)**

- 인증: 가입·로그인·갱신·회전·재사용 감지·동시 갱신·최대 수명·로그아웃·요청 제한·Origin 검사·제한 회원 차단
- Data API 차단: 모든 앱 테이블 RLS, 두 역할의 테이블·시퀀스 권한 0, 새 테이블에도 권한이 자동으로 붙지 않음
- CHECK 허용 값과 `@kemi/shared` 배열 일치
- 프로필: PATCH 값 규칙 표의 칸마다, 권한, 제한·탈퇴 회원의 기존 토큰 차단
- OpenAPI: 3.1 규격 검증, 문서의 모든 경로가 실제로 존재, PATCH 요청 스키마 JSON Schema 검증
- 소셜 로그인(#14, `main`): 가짜 제공자로 state 검증·가입 티켓 만료·일회성·동시 재사용, 제공자 어댑터 요청 형식, 제공자 응답 지연 시 요청 취소·`SOCIAL_FAILED`, 시작·콜백 요청 제한 분리·안내 화면 이동
- PR #16(브랜치): 패키지 규칙, 동시 요청 5가지, DB 제약, 삭제 후 행 보존
- 주요 검사를 일부러 빼면 테스트가 실패하는지(뮤테이션 확인)도 각 PR에서 확인했다.
- 로컬 기준 테스트 수
  - `main` `22f1635`: 단위 57, DB 148 (2026-10-21 새 폴더에서 다시 확인)
  - #16 브랜치 `843a8ea`(충돌 정리 후): 단위 57, DB 181

**사람이 직접 확인한 것**

- 개발용 Supabase 연결, 마이그레이션 4개 적용·사후 점검 (이슈 #5·#15)
- 로컬 API → 개발용 Supabase `/health/ready` 200
- 3장 명령 순서 (2026-10-21, 생성 파일이 없는 새 폴더에 저장소를 새로 받아서)
  - `npm install` 직후 `apps/api/src/generated`가 없고, 이 상태로 `dev:api`를 실행하면 `ERR_MODULE_NOT_FOUND`(`generated/prisma/client.js`)로 시작하지 않는다.
  - `prisma:generate` 후 `dev:api`가 시작되고 `/health` 200을 확인했다(가짜 DB 주소라 `/health/ready`는 503).
  - 테스트 블록과 검사·빌드 블록을 적힌 순서대로 실행해 경로·스크립트 오류 없이 통과했다. `test:db:down`은 같은 PC의 기존 테스트 컨테이너를 멈추지 않으려고 실행하지 않았다.

**아직 확인하지 못한 것 [미확인·미검증]**

- Render 배포, Render에서의 `/health/ready`, Render 서비스 생성 여부 [미확인]
- Vercel rewrite를 거친 `/api/*` 호출과 쿠키(`Secure`, `Path=/api/auth`)
- 배포 환경의 클라이언트 IP(`TRUST_PROXY_HOPS`) 값
- 실제 브라우저의 Refresh 쿠키 동작, 프론트엔드 프로필 화면 연동(`GET`·`PATCH /api/profiles/me`)
- 실제 Google·카카오 로그인 (앱·키·콜백 주소 미등록), 카카오 실제 응답 필드
- 패키지 마이그레이션의 팀 DB 적용(병합 후), 패키지 화면 연동
- 요청·계약 기능이 생긴 뒤 "패키지 수정·삭제가 기존 요청 금액·조건에 영향 없음"
- Supabase Realtime과 자체 JWT 연동(채팅 전 검증 예정)

## 9. 다음 작업 우선순위

계획서 기준 일정(10/22 포트폴리오·파일·패키지, 10/23 공개 모집·제안·알림 통합 시연)을 바탕으로 한 제안 순서다.

1. **PR #16 리뷰·병합** (#14는 병합 완료, #16 충돌은 `843a8ea`에서 정리)
   - 리뷰어는 작성자 외 팀원이다.
2. **#16 병합 후 패키지 마이그레이션 팀 DB 적용** (7장 절차, 새 이슈)
3. **팀 결정 받기**
   - 패키지 새 정책 값과 D03·D01 제안 (결정 기록 12장)
   - 선택지 값 D21
   - 소셜 앱 키 발급 담당
4. **파일 업로드 (FILE-01)**: Supabase Storage. 브라우저 직접 업로드, 서버 권한 발급·완료 확인(결정 기록 0·4장)
   - 버킷 설정이 필요해 팀과 먼저 맞춘다.
5. **포트폴리오 (PORT-01·02)**: 파일 기능 뒤
6. **공개 모집 공고·지원·알림 (10/23)**
   - 결정 기록 2·3장의 중복 제약을 반영한다.
   - 요청을 만들 때 패키지 금액·조건을 요청 행에 복사하고, 이를 확인하는 테스트를 넣는다.
7. **배포 검증**: Render 배포 → `/health/ready` → `TRUST_PROXY_HOPS` 결정 → Vercel rewrite·브라우저 쿠키 (절차서 2~5장)
8. **실제 소셜 로그인 검증**: 키를 받은 뒤 ([연동 문서](2026-10-21-social-login.md) "키를 받은 뒤 확인할 것")
9. **Supabase Realtime 자체 JWT 검증**: 채팅(10/26) 전

## 10. 로컬에만 남은 작업 (이전 담당자 PC, 2026-10-21 확인)

- **커밋하지 않은 변경**: 없음 (`git status` 깨끗함, 2026-10-21 09:17 UTC 재확인)
- **푸시하지 않은 커밋**: 없음. 모든 로컬 브랜치가 원격과 같다(ahead 0).
- **stash** `stash@{0}` (2026-10-19, `feat/auth-email`): "auth-draft: 인증 세션이 중단 전 만든 초안 (PR #1 병합 후 검토)"
  - 내용: `schema.prisma`, `package.json`, `package-lock.json`, `shared/errors.ts`·`index.ts`의 초기 인증 초안 (158줄)
  - 2026-10-21에 `main`과 비교했다. 모두 PR #4 이후 구현으로 대체됐다.
    - 테이블 5개: `main`에 모두 있다. PK는 초안의 UUID 대신 bigint로 정했다.
    - 의존성: 초안의 `bcryptjs` 대신 `bcrypt`를 쓴다. `jose`·`cookie-parser`는 `main`에 있다.
    - 오류 코드: 초안의 `INVALID_CREDENTIALS`·`EMAIL_ALREADY_EXISTS`·`REFRESH_RACE`는 `main`에 있다. `UNSUPPORTED_MEDIA_TYPE`만 없는데, `main`은 이 코드를 쓰지 않는다.
  - 결론: 버려도 잃는 내용이 없다. 삭제는 이전 담당자가 정한다. stash는 이 PC에만 있어 새 담당자에게는 전달되지 않는다.
- **원격 브랜치** `docs/db-apply-checks`: PR #6이 병합된 뒤 푸시한 커밋 3개가 `main`에 없다.
  - 2026-10-21에 커밋별로 대조했다.
    - `d4cc05d`(기본 권한은 테이블 삭제로 되돌아가지 않음): 같은 문장이 `main` 절차서에 있다.
    - `1311dbe`(마이그레이션 2개를 함께 적용할 때의 예상 결과): 적용 전 기준이다. 3개를 모두 적용한 결과(이슈 #5, PR #12)로 대체됐다.
    - `419a7e8`: `main` 병합 커밋
  - 결론: `main`에 없는 내용이 남아 있지 않다. 정리해도 된다.
- **병합이 끝난 원격 브랜치** (`main`에 없는 커밋 0개)
  - 백엔드: `feat/backend-setup`, `chore/prettier-ts-pin`, `feat/auth-email`, `feat/auth-rls-lockdown`, `fix/prisma-history-lockdown`, `feat/openapi-docs`, `docs/db-apply-results`, `feat/profiles`, `feat/auth-social`
  - 다른 팀원: `chore/frontend-setup`(프론트엔드), `feat/backend-init`
  - 정리 대상 후보다. 삭제하지 않았다.
- **추가 작업 폴더(worktree)**: `C:/Users/USER/KEMI/.claude/worktrees/intelligent-leakey-029e88` (`feat/packages`, `843a8ea`, 변경 없음·원격과 같음)
  - #16 충돌 정리를 위해 Claude 세션이 만든 폴더다. 이 PC의 `.git/info/exclude`로만 Git에서 빠져 있다.
  - 이 폴더 때문에 이 PC의 저장소 루트에서 `npm run format:check`를 돌리면 그 안의 생성 파일 15개가 형식 오류로 나온다. CI와 새로 받은 저장소에는 영향이 없다.
  - 삭제하지 않았다. 정리하려면 `git worktree remove`를 쓴다(이전 담당자가 정한다).
- **저장소 밖 임시 파일**: 팀 DB 읽기 전용 점검 스크립트가 Claude 세션의 임시 폴더에만 있다.
  - 같은 SQL은 절차서 1-3·1-5장과 이슈 #15 댓글에 있다.
- **로컬 비밀 파일**: `apps/api/.env`, `apps/api/.env.test`(무시 대상, 커밋되지 않음). 내용은 전달하지 않는다.

## 11. 링크

- **PR**
  - 열림: [#16 패키지](https://github.com/Jubileekim/KEMI/pull/16), [#10 ERD v0.5 검토](https://github.com/Jubileekim/KEMI/pull/10), [#17 이 인수인계서](https://github.com/Jubileekim/KEMI/pull/17)
  - 병합: #1, #3, #4, #6, #8, #9, #11, #12, #13, [#14 소셜 로그인](https://github.com/Jubileekim/KEMI/pull/14)
- **이슈**
  - [#2 초기 구성 남은 항목](https://github.com/Jubileekim/KEMI/issues/2) (열림)
    - 체크 상태가 실제보다 늦다. 프론트엔드 CI는 PR #7의 `web-ci.yml`로 이미 돈다(테스트, 린트·타입 검사를 포함한 빌드, e2e). Prettier 검사·TypeScript 고정도 PR #3으로 병합됐다.
    - 실제로 남은 것: `main` 브랜치 보호(미설정), PR 템플릿(`.github`에 없음)
  - [#5 인증 마이그레이션 적용](https://github.com/Jubileekim/KEMI/issues/5), [#15 프로필 마이그레이션 적용](https://github.com/Jubileekim/KEMI/issues/15) (둘 다 완료·닫힘)
- **API 문서**
  - 로컬 서버 실행 후 `http://localhost:4000/api/docs`(Swagger UI), `/api/openapi.json`
  - 원본: `apps/api/src/docs/openapi.ts`
  - 운영 환경(`NODE_ENV=production`)에서는 꺼진다.
- **프론트엔드 전달 문서**
  - [프로필 선택지·PATCH 규칙](2026-10-21-profile-options.md)
  - [소셜 로그인 연동·팀원 준비 목록](2026-10-21-social-login.md)
  - 패키지 API: PR #16의 README "패키지·제작 서비스 공개 API"와 결정 기록 12장
  - 오류 응답 형식: README "오류 응답 형식"

## 12. 작업 재개 프롬프트 (새 담당자가 Claude에게 붙여 넣기)

```text
KEMI 저장소(GitHub Jubileekim/KEMI)의 백엔드를 이어받았습니다.
먼저 docs/handoff/backend-handover.md, docs/decisions/2026-10-19-backend-setup.md,
apps/api/README.md를 읽고, 최신 main과 열린 PR·이슈 상태를 직접 확인해 인수인계서와 다른 점을 알려주세요.

지켜야 할 규칙:
- main에 직접 푸시·강제 푸시하지 말고, 작업 브랜치에서 PR로 제출합니다. PR은 직접 병합하지 않습니다.
  병합은 CI 통과와 작성자 외 팀원 1명 리뷰 후 팀원이 합니다.
- 비밀번호·키·토큰·연결 주소 전체를 출력하거나 문서·PR에 남기지 않습니다. 오류에 비밀번호가 섞이면 ****로 가립니다.
- 테스트는 로컬 Docker 테스트 DB(TEST_DATABASE_URL)로만 합니다. 개발용 Supabase로 테스트하지 않습니다.
- 팀 DB 변경은 이슈에 범위 공유·동의 → 읽기 전용 점검 → prisma migrate deploy → 사후 확인 → 이슈 기록 순서로만 하고,
  예상과 다르면 멈추고 보고합니다. 적용된 마이그레이션·이력은 고치거나 지우지 않습니다.
- 코드 규칙: Airbnb + TypeScript ESLint, any·타입 단언(as, <T>, !) 금지(as const만 허용), 불필요한 코드 추가 금지.
  변경은 테스트로 확인하고, 중요한 검사는 일부러 빼서 테스트가 실패하는지(뮤테이션 확인)도 봅니다.
- 확정 정책과 제안을 구분하고, 새 제품 정책은 확정으로 표시하지 말고 팀 공유 대상으로 남깁니다.
- 기존 작업(브랜치·stash·원격 브랜치)은 확인 없이 삭제하지 않습니다.

첫 작업: 인수인계서 0장과 9장 우선순위 1번(PR #16 리뷰·병합과 병합 후 팀 DB 적용 준비)부터 상태를 확인하고 계획을 제안해주세요.
```
