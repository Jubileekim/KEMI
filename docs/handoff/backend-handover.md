# 백엔드 인수인계서

- 작성: 2026-10-21, 백엔드 담당(jangseonu / GitHub `seonu2070-droid`). 이후 작업할 때마다 갱신한다.
- 기준: `main` `2ce6e25` (PR #33 병합, 2026-10-26 00:20 UTC). PR·리뷰·CI·이슈 상태는 2026-10-26에 다시 확인했다.

> **상태 표는 작성 시점 기준이다.** PR의 리뷰·병합·CI 상태는 이 문서가 병합된 뒤에도 계속 바뀐다. 작업을 시작하기 전에 GitHub에서 최신 상태를 직접 확인한다. 이 문서와 다르면 GitHub가 맞다.
>
> - 열린 PR: https://github.com/Jubileekim/KEMI/pulls
> - 리뷰·CI: 각 PR의 "Conversation"·"Checks" 탭, 또는 `gh pr list`·`gh pr view <번호> --comments`·`gh pr checks <번호>`
> - 이슈: https://github.com/Jubileekim/KEMI/issues
> - 개발 DB 마이그레이션 상태: 7장의 읽기 전용 `migrate status`

- 이 문서의 완료 여부는 위 커밋과 GitHub PR·이슈 기록을 직접 확인한 결과다.
- 확인하지 못한 것은 **[미확인]**으로 표시한다.
- 이 문서는 요약과 연결만 한다. 자세한 규칙은 아래 원본 문서가 기준이다. 둘이 다르면 원본을 따른다.

| 원본 문서                                                      | 내용                                                                    |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [결정 기록](../decisions/2026-10-19-backend-setup.md)          | 인프라·인증·DB·프로필·지원·알림 설계와 확정/제안 정책, 다음 작업 표     |
| [API README](../../apps/api/README.md)                         | 설치·실행·테스트·환경 변수·API 목록·폴더 구조                           |
| [ERD v0.6 변경 명세](../erd/erd-v0.6-changes.md)               | 실제 테이블과 ERD v0.6의 차이                                           |
| [배포·검증 절차서](../runbooks/auth-deploy-verification.md)    | 팀 DB 마이그레이션 적용 절차, Render·Vercel·브라우저 검증               |
| [프로필 선택지 공유 문서](2026-10-21-profile-options.md)       | 프론트엔드용 선택지 값·PATCH 규칙                                       |
| [소셜 로그인 연동 문서](2026-10-21-social-login.md)            | 화면이 할 일, 콜백 주소, 키 발급 준비 목록                              |
| [ERD v0.5 검토 보존본](../../apps/api/prisma/review/README.md) | PM의 v0.5 검토 기록과 2026-10-23 MVP 필드 결정 (실행 기준 아님, PR #10) |

**팀 역할 (2026-10-23)**

| 담당                       | 역할                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| 희년님 (`Jubileekim`)      | 팀장·PM. 저장소 소유자, Supabase 조직 `KEMI` Owner, Render 계정 관리자. 팀은 PM 기준을 먼저 따른다 |
| 선우님 (`seonu2070-droid`) | 백엔드 (인증·프로필·지원·알림, 배포 설정, 팀 DB 적용)                                              |
| 윤철님 (`Dev-Yuncheol`)    | 프론트엔드 (`apps/web`, Vercel)                                                                    |

- 리뷰어: 백엔드 PR은 희년님, 프론트엔드가 관련된 PR은 윤철님

---

## 0. 새 담당자가 먼저 알아야 할 것

결정이나 조치가 필요한 항목만 모았다. 자세한 내용은 괄호 안의 장에 있다.

**바로 처리할 것**

1. **팀 개발 DB를 새로 만든다 ([이슈 #24](https://github.com/Jubileekim/KEMI/issues/24), 7장).**
   - 기존 공유 DB(`nibqyycfknurkncdgqps`)는 2026-10-22에 다른 작업 스키마로 바뀌었다. 우리 마이그레이션 4개와 테이블 6개가 없다.
   - PM 결정: 기존 DB는 윤철님 작업용으로 두고 **건드리지 않는다.** KEMI 전용 `KEMI-dev`를 새로 만들어 `main`의 마이그레이션 7개를 적용한다.
   - 지금은 희년님(Supabase Owner)의 프로젝트 생성을 기다리고 있다.
2. **열린 PR 리뷰·병합 (2장)**: #28 Render 배포 설정, #31 OpenAPI 쌍방향 검사, #33 이 문서(우리 PR), #32 Vercel 설정(희년님)
3. **Render 서비스 생성 (8장, [이슈 #27](https://github.com/Jubileekim/KEMI/issues/27))**: #28 병합과 `KEMI-dev` 준비 뒤 희년님이 만든다.

**접근 권한** (2026-10-23 확인)

| 대상                          | 상태                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| GitHub `Jubileekim/KEMI`      | 비공개 개인 저장소. 백엔드 담당은 Write 권한                                                               |
| Supabase 조직 `KEMI` (Free)   | Owner 희년님, 선우님·윤철님 Developer. **Developer는 새 프로젝트를 만들 수 없다.** 백업 없음("No backups") |
| Render (무료 Hobby)           | **희년님 계정 하나로 관리.** Hobby 워크스페이스는 팀원 초대가 안 된다(Pro 이상). 팀원은 PR로 변경한다      |
| Vercel                        | 코드잇 스프린트 지원 팀. 프론트엔드 담당이 연결 (PR #32)                                                   |
| Google Cloud·Kakao Developers | **[미확인] 발급 담당 미정**                                                                                |

- 로컬 DB 테스트에는 Docker Desktop이 필요하다(3장).
- **Vercel 병합 주의 (2026-10-23)**: 연결된 Vercel `KEMI` 팀은 팀원 초대가 안 되는 상태라, 팀 멤버가 아닌 사람이 작성한 커밋은 배포가 막힌다("Deployment was blocked").
  - 그래서 선우님 PR에는 Vercel 검사가 실패로 표시된다. 코드 문제가 아니고, API·Web CI와 병합에는 영향이 없다.
  - 병합 커밋의 작성자는 병합 버튼을 누른 사람이다. 그래서 **당분간 PR 병합은 희년님이 한다.** 그래야 `main` 운영 배포가 된다.
  - 코드잇 스프린트 지원 팀(Pro)으로 옮겨 팀원을 초대하면 이 규칙은 없앤다. Render는 커밋 작성자를 보지 않아 영향이 없다.

**팀이 정해야 할 것**

- 소셜 키 발급 담당
- AI 단가 분석에서 사용자 입력이 외부(OpenAI)로 전송된다는 화면 안내·개인정보 처리방침 반영 여부 (#30)
- 쌓인 PR(stacked PR)에서도 CI를 돌릴지(`pull_request.branches`에 `feat/**` 추가 여부)

**정리 여부를 정할 것** (모두 삭제하지 않고 남겨 두었다, 10장)

- 이전 담당자 PC의 `stash@{0}`, worktree `intelligent-leakey-029e88`(닫힌 #16 브랜치)
- 병합·종료가 끝난 원격 브랜치들

## 1. `main`에 병합된 백엔드 기능

| PR  | 내용                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1  | 백엔드 초기 구성: Express 5, 환경 변수 검증(Zod), `GET /health`·`/health/ready`, Prisma 7, API CI, ESLint(Airbnb+TS)                              |
| #3  | Prettier 기본 설정, TypeScript 5.9.3 고정, 테스트 DB·CI 이미지 PostgreSQL 17.11 고정                                                              |
| #4  | 이메일 회원가입·로그인·토큰 갱신·로그아웃·`/api/auth/me`, Refresh 토큰 회전·재사용 감지, 요청 제한(429), 인증 테이블                              |
| #6  | 팀 DB 마이그레이션 적용 전·후 점검과 비상 되돌리기 절차서                                                                                         |
| #8  | 인증 테이블 Supabase Data API 차단(RLS, `anon`·`authenticated` 권한 회수, 기본 권한 변경)                                                         |
| #9  | `_prisma_migrations`의 Data API 권한 회수                                                                                                         |
| #11 | OpenAPI 3.1 문서 `/api/openapi.json`과 Swagger UI `/api/docs` (운영 환경에서는 꺼짐)                                                              |
| #12 | 개발용 Supabase 적용 결과·Data API 꺼짐 확인 기록 (문서)                                                                                          |
| #13 | 역할별 본인 프로필 `GET`·`PATCH /api/profiles/me` (PROFILE-01·02의 텍스트·선택 항목), 프로필 테이블 2개                                           |
| #14 | Google·카카오 소셜 로그인과 소셜 가입(가입 티켓 10분), 제공자 요청 10초 제한, 시작·콜백 요청 제한 분리. DB 변경 없음                              |
| #17 | 이 인수인계서와 API README의 처음 실행 절차(Prisma Client 생성) (문서)                                                                            |
| #18 | 인수인계서 상태 표 기준 안내 (문서)                                                                                                               |
| #19 | 공개 프로젝트 CRUD·탐색·마감·소프트 삭제 (PROJ-01·02). 희년님 작성, `projects` 테이블                                                             |
| #20 | 프로젝트 북마크·추천 (BOOK-01). 희년님 작성, `project_bookmarks` 테이블                                                                           |
| #22 | 지원·선정·자동 거절·마감과 인앱 알림 5종 (APPLY·STATE·NOTI). `work_requests`·`notifications` 테이블                                               |
| #10 | ERD v0.5 검토 보존본과 2026-10-23 MVP 필드 결정 (`apps/api/prisma/review/`, 실행 기준 아님). 희년님 작성                                          |
| #30 | AI 단가 분석 `POST /api/pricing/analyze` (AI-01, 예산 반영은 기존 `budget` 필드로 AI-02). 희년님 작성. DB 변경 없음                               |
| #31 | 실제 라우터 ↔ OpenAPI 경로·메서드 쌍방향 일치 검사 (하위 라우터·`router.all()` 포함). 라우터에 경로를 추가하고 문서를 고치지 않으면 CI가 실패한다 |
| #33 | 인수인계서 2026-10-23 갱신 (문서)                                                                                                                 |

- 참고: PR #7(`apps/web` 프론트엔드 작업 공간)은 프론트엔드 담당 작업이다.
- **닫은 PR**
  - #16 패키지·서비스 공개: PRD v2.0(B2C 전환)에 맞춰 재설계하기로 해서 병합하지 않고 닫았다(2026-10-23). 패키지와 직접 의뢰는 페이즈 2 범위에서 빠졌다.
  - #23 PR 템플릿: 취소. 이슈 #2에서만 관리한다.
- **PRD v2.0 (B2C 전환, 2026-10-23)**: 의뢰인은 개인 고객, 크리에이터는 영상 편집자다. 영상 목적·스타일 값은 #19의 상위 분류를 쓴다.
- **실제 Google·카카오 로그인은 아직 검증하지 않았다**(8장).

## 2. 열려 있는 PR과 남은 작업

| PR                                                                                        | 작성자 | 상태 (2026-10-23 09:20 UTC)                                   | 남은 작업                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [#28](https://github.com/Jubileekim/KEMI/pull/28) Render Blueprint                        | 선우님 | CI 통과(`80d7643`). 리뷰 요청: 윤철님                         | 리뷰·병합 → `KEMI-dev` 준비 후 희년님이 Render 서비스 생성(절차서 2단계)                                          |
| [#49](https://github.com/Jubileekim/KEMI/pull/49) API 차이 목록·조건서 설계 초안          | 선우님 | 리뷰 요청: 희년님                                             | **선정 모델 결정**(지금 accept vs 기능명세서), 결정 기록 13장 7가지 확인                                          |
| [#32](https://github.com/Jubileekim/KEMI/pull/32) Vercel 설정                             | 희년님 | Web CI 통과. 리뷰 요청 없음                                   | 프론트엔드(윤철님) 리뷰. Render 주소가 정해지면 `/api/:path*` rewrite를 SPA fallback보다 앞에 추가                |
| [#51](https://github.com/Jubileekim/KEMI/pull/51) 조건서·서명·계약 구현 (Draft)           | 선우님 | 리뷰 요청: 희년님                                             | #49 결정에 맞춰 조정 후 병합. 마이그레이션 `20261026090000_terms_contracts`는 병합 뒤 `KEMI-dev`에 적용           |
| [#53](https://github.com/Jubileekim/KEMI/pull/53) 테스트 결제 구현 (Draft, #51 위에 쌓음) | 선우님 | 희년님 변경 요청 반영(fail 조회 대사·상태 검증) → 재리뷰 요청 | Toss Sandbox. 테스트 키(`TOSS_SECRET_KEY`, `test_` 키만) 발급 담당 정하기. 마이그레이션 `20261026120000_payments` |

**리뷰 기록** (2026-10-23 확인)

| PR  | 리뷰                                                                                                                            | 반영                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| #6  | 승인 (Dev-Yuncheol)                                                                                                             | —                                                                                    |
| #9  | 의견: 점검표를 최초·추가 적용으로 분리, 권한 검사에 MAINTAIN 포함                                                               | `f1277a4` 반영 후 병합                                                               |
| #10 | 의견(Dev-Yuncheol): README 제목 정리, 비교 기준 식별 정보 / 의견(선우님): README가 `404: Not Found` 한 줄로 손상 → 승인(선우님) | 제목 `ae54c30`, 손상 복구 `8d1eb47`. 비교 기준 커밋은 선택 사항으로 남김             |
| #11 | 의견: 이메일 형식 문서 표시, Swagger·Origin 403 안내                                                                            | `6e051e5` 반영 후 병합                                                               |
| #12 | 의견: 다음 작업 표의 Supabase 연결 상태 구분 → 승인                                                                             | `3e93d16` 반영 후 승인·병합                                                          |
| #13 | 의견: PATCH 요청 스키마 `oneOf` → `anyOf`                                                                                       | `34002dc` 반영 후 병합                                                               |
| #14 | 의견: 제공자 요청 타임아웃, 시작·콜백 요청 제한 분리 → 승인                                                                     | `5c56e54` 반영 후 승인·병합                                                          |
| #17 | 의견: Prisma Client 생성 단계, 명령 실행 위치 → 승인                                                                            | `6f98920` 반영 후 승인·병합                                                          |
| #19 | 의견(선우님): `updated_at` 기본값 불일치(필수), 일정 CHECK 시간대, 마감 후 수정 409, 비활성 의뢰인 노출 등                      | 희년님 반영 + 선우님 추가 커밋 `0df9691` 후 선우님 병합                              |
| #20 | GitHub 리뷰 기록 없음                                                                                                           | 선우님 병합                                                                          |
| #22 | 의견(희년님): 비활성 의뢰인 프로젝트 지원 차단 등. 승인은 GitHub가 아닌 팀 채팅으로 전달                                        | `e230370` 반영 후 선우님 병합                                                        |
| #30 | 의견(선우님): 요청 제한(필수), 모델 스키마 범위·실패 로그(권장), 외부 전송 안내(제품 결정) → 승인                               | `384d68a` 반영(사용자별 제한·401 미차감·앱별 분리, 스키마 범위, 단계·상태 코드 로그) |
| #31 | 변경 요청(희년님): 하위 라우터와 `router.all()`을 조용히 놓침                                                                   | `bfb5434`·`b238585` 반영(재귀 탐색, `ALL` 보고, 회귀 테스트)                         |

- #1·#3·#4·#8은 GitHub에 리뷰 기록이 없다. 병합은 Dev-Yuncheol이 했다.
- #19·#20·#22는 GitHub에 승인(APPROVED) 기록 없이 병합됐다. 리뷰 의견 반영과 팀 채팅 합의 후 병합했다.
- 팀 규칙: CI 통과 + 작성자 외 팀원 1명 리뷰 후 병합. Claude는 직접 병합하지 않는다.

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
- **브랜치를 바꾼 뒤**: `@kemi/shared` 빌드가 이전 브랜치 것으로 남아 테스트가 이상하게 실패할 수 있다. `npm run build -w @kemi/shared`와 `prisma:generate`를 다시 한다.
- **npm 설치 경고**: `npm install` 끝에 `allow-scripts` 경고(prisma·bcrypt·esbuild 등의 설치 스크립트 미실행)가 나온다. 이 상태로 생성·실행·테스트·빌드가 모두 된다(2026-10-23 `NODE_ENV=production` 빌드에서도 확인). `approve-scripts`를 실행하지 않아도 된다.
- **테스트 DB 컨테이너 이름**: Docker Compose 프로젝트 이름이 폴더 이름(`api`)이라, 저장소를 두 곳에 받아도 같은 컨테이너 `api-postgres-test-1`(포트 54329)를 함께 쓴다. 한쪽에서 `test:db:down`을 하면 다른 쪽도 멈춘다.
- **Docker Desktop**: 이 PC를 재시작하면 Docker Desktop이 꺼져 있을 수 있다. 켠 뒤 `test:db:up`을 다시 실행한다.
- **테스트 DB 데이터**: 메모리에만 있어 컨테이너가 바뀌면 비어 있다. DB 테스트를 시작할 때 Supabase 역할 재현과 마이그레이션 적용이 자동으로 다시 된다.
- **브랜치를 바꿔 DB 테스트를 돌릴 때**: 컨테이너가 살아 있는 동안에는 앞서 돌린 브랜치의 테이블이 남는다. 그러면 `data-api-lockdown` 테스트("앱 테이블은 목록과 같다")가 실패할 수 있다. 이때는 `apps/api`에서 `npm run test:db:down` → `npm run test:db:up`으로 테스트 DB를 새로 띄운다(테스트 DB만 지워지고 팀 DB와는 관계없다).
- **CI**: `.github/workflows/api-ci.yml`(job `api`)과 `web-ci.yml`. **`main`을 대상으로 하는 PR과 `main` 푸시에서만** 형식·타입·단위·DB 테스트·린트·빌드를 실행한다. 다른 브랜치를 base로 쌓은 PR에서는 돌지 않는다.

### 환경 변수 (값은 이 문서에 적지 않는다)

| 이름                                        | 필요한 곳           | 값을 받는 곳·발급 담당                                                                                                                                                            |
| ------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | 서버·마이그레이션   | 팀 개발 DB(`KEMI-dev`, 생성 예정) → Connect → Session pooler. Supabase Owner(희년님)에게 비공개 채널로 받는다                                                                     |
| `MIGRATION_DATABASE_URL`                    | (선택) 마이그레이션 | 필요할 때만. 현재 쓰지 않는다                                                                                                                                                     |
| `JWT_ACCESS_SECRET`                         | 서버                | 로컬은 담당자가 직접 만든다(32자 이상, README의 생성 명령). Render는 `render.yaml`의 `generateValue`로 Render가 만든다                                                            |
| `APP_ORIGIN`                                | 서버                | 로컬 `http://localhost:5173`. 배포 값은 Vercel 운영 주소(프론트엔드 담당). **[미확인] Vercel 주소 미정**                                                                          |
| `TRUST_PROXY_HOPS`                          | 서버                | 로컬 0. 배포 값은 Render 배포 후 확인해서 정한다(절차서 4장)                                                                                                                      |
| `PORT`, `NODE_ENV`, `DATABASE_POOL_MAX`     | 서버                | 기본값 있음. Render는 `PORT`를 자동 지정                                                                                                                                          |
| `TEST_DATABASE_URL`                         | DB 테스트           | `.env.test.example`의 로컬 Docker 값. 비밀값 아님                                                                                                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  | 서버 (소셜 로그인)  | Google Cloud Console. **[미확인] 발급 담당 미정**. 둘 중 하나만 넣으면 서버가 시작하지 않는다. 준비 목록은 [연동 문서](2026-10-21-social-login.md)                                |
| `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET` | 서버 (소셜 로그인)  | Kakao Developers. **[미확인] 발급 담당 미정**                                                                                                                                     |
| `AI_PRICING_API_KEY`, `AI_PRICING_MODEL`    | 서버 (AI 단가 분석) | PR #30. 키가 없으면 그 기능만 503. 실제 연동 테스트를 승인한 뒤에만 Render에 넣는다. **[미확인] 키 발급 담당**                                                                    |
| `TOSS_SECRET_KEY`                           | 서버 (테스트 결제)  | Toss 개발 연동 체험 상점의 **테스트** 시크릿 키(`test_sk_`·`test_gsk_`)만. live 키는 서버가 시작하지 않는다. **[미확인] 발급 담당**. 클라이언트 키는 프론트엔드(Vercel) 환경 변수 |

- 소셜·AI 키는 비워도 서버가 시작한다. 이때 해당 기능만 동작하지 않는다.
- 비밀값은 로컬 `apps/api/.env`(커밋 금지)와 Render 대시보드 Environment에만 넣는다. Render에는 관리자(희년님)가 넣는다. 채팅·PR·이슈에 적지 않는다.

## 4. 주요 폴더와 파일

```text
render.yaml                      # Render Blueprint (PR #28, 병합 전)
apps/api/
├─ prisma/schema.prisma          # DB 모델 (실행 기준은 이 파일뿐)
├─ prisma/migrations/            # 적용 순서대로 쌓이는 SQL. 적용된 것은 고치지 않는다
├─ prisma/review/                # ERD v0.5 검토 보존본 (PR #10, 실행 기준 아님)
├─ prisma.config.ts              # Prisma 7 설정 (MIGRATION_DATABASE_URL → DATABASE_URL 순)
├─ docker-compose.test.yml       # 테스트 DB (PostgreSQL 17.11)
├─ src/
│  ├─ server.ts                  # 환경 변수 검증 → 의존성 조립 → 서버 시작·종료
│  ├─ app.ts                     # Express 앱 조립 (테스트가 의존성을 주입)
│  ├─ config/env.ts              # 환경 변수 Zod 검증 (오류에 값 미출력)
│  ├─ auth/                      # 회원가입·로그인·토큰(tokens.ts)·요청 제한(rate-limits.ts)
│  │  └─ social/                 # 소셜 로그인 제공자 어댑터·state·가입 티켓
│  ├─ profiles/                  # 본인 프로필 조회·저장
│  ├─ projects/                  # 공개 프로젝트 CRUD·탐색, 프로젝트 행 잠금(project-lock.ts)
│  ├─ applications/              # 지원·선정·거절 (라우터에 알림 경로도 있음)
│  ├─ notifications/             # 알림 저장(notify.ts)·조회·읽음
│  ├─ project-discovery/         # 북마크·추천
│  ├─ pricing/                   # AI 단가 분석 (OpenAI Responses API, 사용자별 1시간 10회)
│  ├─ docs/                      # OpenAPI 문서(openapi.ts)·Swagger UI
│  ├─ http/                      # AppError, 오류 응답 처리, Bearer 토큰 읽기
│  ├─ routes/health.ts           # /health, /health/ready
│  └─ lib/prisma.ts              # Prisma Client (pg 어댑터)
└─ test/
   ├─ *.test.ts                  # 단위 테스트
   ├─ db/*.db.test.ts            # DB 테스트 (인증·프로필·프로젝트·지원·탐색·Data API 차단·CHECK와 shared 값 일치)
   └─ support/                   # 테스트 앱, 테스트 DB 안전장치, Supabase 역할 재현(globalSetup)
packages/shared/src/             # 요청 Zod 스키마·응답 타입·상태값 배열·오류 코드 (프론트엔드와 공유)
```

## 5. 설계 결정 (요약, 근거는 결정 기록)

**인증** (결정 기록 1·5·8장)

- Access 토큰: JWT HS256, 15분. 응답 본문으로 주고 프론트엔드는 메모리에만 둔다.
- Refresh 토큰: `HttpOnly; Secure; SameSite=Lax; Path=/api/auth` 쿠키. 로그인 세션은 최대 7일이고 연장하지 않는다.
- 회전 시 같은 토큰이 다시 오면:
  - 10초 안: `409 REFRESH_RACE`
  - 10초 이후: 재사용으로 보고 세션 전체를 폐기한다.
- Access 토큰을 검증할 때 요청마다 DB에서 세션 폐기 여부와 회원 상태(`ACTIVE`)를 확인한다. 그래서 제한·탈퇴되면 이미 발급된 토큰도 바로 403이다.
- 쿠키로만 동작하는 요청(refresh·logout)은 `Origin` 헤더가 `APP_ORIGIN`과 같아야 한다.
- 요청 제한(429) 횟수는 서버 메모리에 센다. 서버가 재시작되면 초기화되고, 서버를 여러 대로 늘리면 대수만큼 따로 센다(`rate-limits.ts`). Render 무료 플랜 한 대 기준이다. **이 때문에 백엔드를 Vercel 서버리스로 옮기지 않는다**(8장).
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

**공개 프로젝트** (PR #19, 희년님 모델)

- 상태: `OPEN`·`MATCHED`·`CLOSED`·`CONTRACTED`, 종료 사유 `close_reason`: `MANUAL`·`EXPIRED`·`NO_SELECTION`
- 공개 목록·상세는 `OPEN`이고 마감 전이며 의뢰인이 `ACTIVE`인 것만 보여 준다. 마감 시각이 지난 프로젝트는 수정할 수 없다(409).
- 일정 CHECK는 KST 날짜 기준이다(`recruitment_end_at AT TIME ZONE 'Asia/Seoul'`).

**지원·선정·알림** (PR #22, 결정 기록 12장)

- 프로젝트당 한 번 지원(`(project_id, creator_id)` UNIQUE). 모든 변경은 프로젝트 행을 `FOR UPDATE`로 잠근 트랜잭션에서 한다.
- 선정하면 프로젝트는 `MATCHED`, 나머지 대기 지원은 `NOT_SELECTED`(`OTHER_SELECTED`)가 되고, 알림이 같은 트랜잭션에서 저장된다.
- 직접 마감은 새 지원만 막고, 대기 지원은 그대로 선정·거절할 수 있다. 서버 스케줄러는 쓰지 않는다(지원할 때 마감 시각 검사).
- 알림은 `(recipient_user_id, event_key)` UNIQUE로 같은 사건을 한 번만 저장한다.

## 6. 확정 정책과 제안 정책

표기는 결정 기록을 따른다. **[확정]**은 팀 결정이라 바꾸려면 합의가 필요하다. **[제안]**은 해당 PR 리뷰에서 확정한다.

| 영역      | [확정]                                                                                                            | [제안] (팀 확인 필요)                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 계정      | 이메일·소셜 계정 자동 병합 안 함, 소셜 전용 회원은 비밀번호 없음 (1장)                                            | 소셜 가입 흐름·가입 티켓 10분 (11장)                              |
| 토큰      | 세션 최대 7일·연장 없음, 10초 유예·재사용 감지 정책 유지, bcrypt 12                                               | 갱신 재시도 규칙(최대 2회, 500ms·1s), 로그아웃 처리 (5장)         |
| 공고·지원 | 공고당 계약 1개·취소와 환불 원칙, 같은 공고 중복 지원 방지. 선정 즉시 나머지 자동 거절, 스케줄러 없음(2026-10-23) | 지원 철회(`WITHDRAWN`), 기한 경과 자동 마감·알림(Cron)            |
| 파일      | 파일당 한도·형식, 업로드 흐름 (4장)                                                                               | 검사 방식 (4장). ZIP 내부 검사·보관 기간은 미결                   |
| 프로필    | 의뢰인 브랜드 정보 모두 선택(P02)                                                                                 | 분야·스타일 선택지 값(D21 미확정), 표시 이름 문구                 |
| 패키지    | PRD v2.0에 맞춰 재설계. 페이즈 2 범위에서 제외(#16 닫음)                                                          | 새 ERD가 나오면 별도 작업                                         |
| 범위      | `ledger_*` 초기 제외, `brief_json`·`currency`·`payment_events.metadata` 삭제(PR #10 README, 2026-10-23 PM 결정)   | —                                                                 |
| 운영      | `main` 직접 푸시 금지, PR + CI + 작성자 외 1명 리뷰 후 병합, Claude는 직접 병합하지 않음                          | `main` 브랜치 보호는 **미설정**(사람이 규칙을 지킴, 이슈 #2 닫힘) |
| 배포      | 백엔드 Render 무료(희년님 관리, `main` CI 통과 시 자동 배포), 프론트엔드 Vercel (2026-10-23)                      | —                                                                 |

## 7. 팀 개발 DB 마이그레이션

### 7-1. 지금 상황 (2026-10-23, [이슈 #24](https://github.com/Jubileekim/KEMI/issues/24))

- 기존 공유 DB(Supabase 조직 `KEMI`, project ref `nibqyycfknurkncdgqps`, ap-northeast-1, PostgreSQL 17.11)에 페이즈 2 마이그레이션 3개를 적용하려고 읽기 전용 점검을 했다.
- **결과: 예상과 달라 적용하지 않았다.**
  - `_prisma_migrations`에는 `20261022000000_init` 1건만 있다(2026-10-22 10:38 UTC). 이 저장소에 없는 마이그레이션이다.
  - 우리 테이블 6개 대신 다른 작업의 테이블 15개(`User`, `FreelancerProfile` 등)와 enum 11개가 있다. 원인은 윤철님 작업 중 스키마 교체였다.
  - 백업이 없어("No backups", 무료 플랜) 10-22 이전 데이터는 복구할 수 없다.
- **PM 결정 (희년님)**
  - 기존 DB의 삭제·재구축은 하지 않는다. 기존 DB는 윤철님 작업용으로 둔다.
  - KEMI 전용 `KEMI-dev`(ap-northeast-1)를 새로 만들고, 빈 DB에 `main`의 마이그레이션 7개를 적용한다.
  - 프로젝트는 Owner(희년님)가 만든다. 연결 정보는 비공개 채널로 받는다.

### 7-2. 마이그레이션 목록

| 마이그레이션                                | 출처 PR | 기존 공유 DB                          | `KEMI-dev` |
| ------------------------------------------- | ------- | ------------------------------------- | ---------- |
| `20261019051147_auth_tables`                | #4      | 10-19 적용(이슈 #5) → 10-22에 사라짐  | 적용 예정  |
| `20261019070424_auth_data_api_lockdown`     | #8      | 10-19 적용(이슈 #5) → 10-22에 사라짐  | 적용 예정  |
| `20261019074729_prisma_history_lockdown`    | #9      | 10-19 적용(이슈 #5) → 10-22에 사라짐  | 적용 예정  |
| `20261021005250_role_profiles`              | #13     | 10-21 적용(이슈 #15) → 10-22에 사라짐 | 적용 예정  |
| `20261023090000_projects`                   | #19     | 미적용                                | 적용 예정  |
| `20261023120000_applications_notifications` | #22     | 미적용                                | 적용 예정  |
| `20261023130000_project_discovery`          | #20     | 미적용                                | 적용 예정  |

### 7-3. 적용 절차

이슈 #5·#15·#24와 같은 순서이며, [절차서](../runbooks/auth-deploy-verification.md) 1장을 따른다.

1. 이슈에 범위(새로 만드는 것, 바뀌지 않는 것)를 공유하고 동의를 받는다.
2. `BEGIN READ ONLY`로 사전 점검한다.
   - 대상 project ref가 맞는지(기존 공유 DB를 가리키면 멈춘다)
   - 이력이 모두 완료 상태인지(빈 DB면 `_prisma_migrations` 없음)
   - 같은 이름의 테이블·제약이 없는지
   - 기본 권한, 이벤트 트리거
   - `migrate status`에서 대기 목록이 예상과 같은지
3. 저장소 루트에서 `npm run db:deploy -w @kemi/api`(`prisma migrate deploy`)로 적용한다. `migrate dev`·`reset`·`db push`는 쓰지 않는다.
   - PM 요청: **함께 확인하면서 한 명이 실행하고 결과를 공유한다.**
4. 적용 후 확인
   - 이력
   - RLS·CHECK·FK·인덱스
   - `anon`·`authenticated` 권한 0(MAINTAIN 포함)
   - `/health/ready` 200
5. 이슈에 기록한다. 예상과 다르면 멈추고 보고한다. 되돌리기 SQL은 수동 비상 절차일 뿐이다.

- 점검할 때 `information_schema`는 MAINTAIN 권한을 보여주지 않는다. `has_table_privilege`·`aclexplode`로 확인한다.
- 기존 공유 DB에는 이벤트 트리거 `ensure_rls`(새 테이블에 RLS 자동 켜기)가 있었다. 새 DB에도 있는지 점검 때 확인한다.
- 새 DB를 만들면 Data API를 끄고, 마이그레이션 2번(`auth_data_api_lockdown`)이 기본 권한을 회수하는지 사후 확인한다.

## 8. 자동 테스트로 확인한 것과 아직 확인하지 못한 것

**자동 테스트로 확인 (CI와 로컬 Docker 테스트 DB)**

- 인증: 가입·로그인·갱신·회전·재사용 감지·동시 갱신·최대 수명·로그아웃·요청 제한·Origin 검사·제한 회원 차단
- Data API 차단: 모든 앱 테이블 RLS, 두 역할의 테이블·시퀀스 권한 0, 새 테이블에도 권한이 자동으로 붙지 않음
- CHECK 허용 값과 `@kemi/shared` 배열 일치
- 프로필: PATCH 값 규칙 표의 칸마다, 권한, 제한·탈퇴 회원의 기존 토큰 차단
- 프로젝트·지원·알림·북마크: 상태 전이, 중복 지원(동시 요청), 선정과 자동 거절, 마감·삭제 경합, 알림 한 번 저장, 권한
- OpenAPI: 3.1 규격 검증, 문서의 모든 경로가 실제로 존재, PATCH 요청 스키마 JSON Schema 검증
  - PR #31(병합 전): 실제 라우터의 모든 경로·메서드가 문서에 있음
- 소셜 로그인: 가짜 제공자로 state 검증·가입 티켓 만료·일회성·동시 재사용, 제공자 응답 지연 시 요청 취소, 시작·콜백 요청 제한 분리
- 주요 검사를 일부러 빼면 테스트가 실패하는지(뮤테이션 확인)도 각 PR에서 확인했다.
- 테스트 수: `main` `5d69389` CI 기준 단위 71, DB 199. #30 병합으로 단위 테스트가 14개 늘었다(#30 브랜치 로컬 85)

**사람이 직접 확인한 것**

- 기존 공유 DB 연결, 마이그레이션 4개 적용·사후 점검 (이슈 #5·#15, 10-22에 다른 스키마로 바뀜)
- 로컬 API → 기존 공유 DB `/health/ready` 200 (10-19)
- Render와 같은 명령(`npm ci --include=dev && npm run build:api`, `npm start -w @kemi/api`)을 로컬에서 `NODE_ENV=production`으로 실행: `/health` 200, `/api/docs` 404 (2026-10-23, PR #28)

**아직 확인하지 못한 것 [미확인·미검증]**

- `KEMI-dev` 생성과 마이그레이션 7개 적용 (이슈 #24)
- Render 서비스 생성·배포, Render에서의 `/health/ready` (이슈 #27)
- Vercel rewrite를 거친 `/api/*` 호출과 쿠키(`Secure`, `Path=/api/auth`)
- 배포 환경의 클라이언트 IP(`TRUST_PROXY_HOPS`) 값
- 실제 브라우저의 Refresh 쿠키 동작, 프론트엔드 화면 연동 (이슈 #26)
- 실제 Google·카카오 로그인 (앱·키·콜백 주소 미등록), 카카오 실제 응답 필드
- 실제 AI 단가 분석 호출 (PR #30 병합, 키 미설정)
- Supabase Realtime과 자체 JWT 연동(채팅 전 검증 예정)

## 9. 다음 작업 우선순위

11/9 발표, 11/8 API 명세 제출(이슈 #25) 기준 제안 순서다.

1. **`KEMI-dev` 생성 → 마이그레이션 7개 적용** (이슈 #24, 7장)
2. **열린 PR 리뷰·병합**: #28, #31, #33(우리 PR), #32(프론트엔드 리뷰)
3. **Render 배포** (이슈 #27, 절차서 2단계): 희년님이 Blueprint로 생성 → `/health`·`/health/ready` 확인 → #27 기록
4. **Vercel 연결과 `/api/*` rewrite, `APP_ORIGIN` 교체** (프론트엔드, #32)
5. **`TRUST_PROXY_HOPS` 확인** (절차서 4단계, 희년님이 임시 배포)
6. **브라우저 E2E** (이슈 #26): 두 테스트 계정으로 등록 → 지원 → 선정 → 알림
   - 시연용 시드 데이터 스크립트가 필요하면 백엔드에서 만든다(실제 개인정보와 분리).
7. **실제 소셜 로그인 검증**: 키를 받은 뒤 ([연동 문서](2026-10-21-social-login.md) "키를 받은 뒤 확인할 것")
8. **심화 기능** (이슈 #29): AI 단가(#30 병합) → 금액 합의·계약·서명 → Sandbox 결제·모의 정산 → 납품·리뷰. API를 추가할 때마다 OpenAPI·테스트를 함께 고친다(#25).
   - 2026-10-26: 프론트엔드 기능 매트릭스와 백엔드 API [차이 목록](2026-10-26-frontend-api-gaps.md)을 정리했다. **선정 모델 충돌**(지금 accept = 즉시 선정 vs 기능명세서 = 양측 서명 때 선정)은 PM 결정이 필요하다.
   - 조건서·서명·계약은 선정 모델과 무관하게 [결정 기록](../decisions/2026-10-19-backend-setup.md) 13장에 설계 초안을 썼다. 팀 확인 뒤 구현한다.
9. **API 명세 제출** (이슈 #25): 기능 동결 후 인증·오류 코드 검수, 외부 열람 링크, PDF

## 10. 로컬에만 남은 작업 (이전 담당자 PC, 2026-10-23 확인)

- **커밋하지 않은 변경**: 없음
- **푸시하지 않은 커밋**: 없음
- **stash** `stash@{0}` (2026-10-19, `feat/auth-email`): 초기 인증 초안. 2026-10-21에 `main`과 비교한 결과 모두 PR #4 이후 구현으로 대체됐다. 버려도 잃는 내용이 없다. 삭제는 이전 담당자가 정한다.
- **추가 작업 폴더(worktree)**: `C:/Users/USER/KEMI/.claude/worktrees/intelligent-leakey-029e88` (`feat/packages`, `843a8ea`)
  - #16 충돌 정리를 위해 Claude 세션이 만든 폴더다. #16은 닫혔다.
  - 이 폴더 때문에 이 PC의 저장소 루트에서 `npm run format:check`를 돌리면 그 안의 생성 파일이 형식 오류로 나온다. `apps`·`packages`·`docs`만 검사하면 된다. CI와 새로 받은 저장소에는 영향이 없다.
  - 삭제하지 않았다. 정리하려면 `git worktree remove`를 쓴다.
- **원격 브랜치**: 병합·종료된 PR의 브랜치가 남아 있다(`feat/projects-api`, `feat/applications-notifications`, `feat/project-discovery`, `feat/packages`, `backend-pm`, `docs/db-apply-checks` 등). 정리 대상 후보이며 삭제하지 않았다.
- **저장소 밖 임시 파일**: 팀 DB 읽기 전용 점검 스크립트가 Claude 세션의 임시 폴더에만 있다. 새 DB용 점검은 기존 DB의 project ref를 가리키면 멈추게 만들었다. 같은 SQL 항목은 절차서 1-3·1-5장과 이슈 #15·#24 댓글에 있다.
- **로컬 비밀 파일**: `apps/api/.env`, `apps/api/.env.test`(무시 대상, 커밋되지 않음). 내용은 전달하지 않는다. `.env`의 `DATABASE_URL`은 아직 기존 공유 DB를 가리킨다. `KEMI-dev`가 생기면 바꾼다.

## 11. 링크

- **PR**
  - 열림 (작성 시점): [#28 Render](https://github.com/Jubileekim/KEMI/pull/28), [#32 Vercel](https://github.com/Jubileekim/KEMI/pull/32), [#49 차이 목록·설계](https://github.com/Jubileekim/KEMI/pull/49), [#51 조건서·서명·계약 구현](https://github.com/Jubileekim/KEMI/pull/51)(Draft), 프론트엔드 #34~#48(Draft)
  - 병합: #1, #3, #4, #6, #8, #9, #10, #11, #12, #13, #14, #17, #18, #19, #20, #22, [#30 AI 단가](https://github.com/Jubileekim/KEMI/pull/30), [#31 OpenAPI 쌍방향](https://github.com/Jubileekim/KEMI/pull/31), [#33 인수인계서](https://github.com/Jubileekim/KEMI/pull/33)
  - 닫음: [#16 패키지](https://github.com/Jubileekim/KEMI/pull/16)(재설계), #23(취소)
- **이슈**
  - 열림: [#24 팀 개발 DB](https://github.com/Jubileekim/KEMI/issues/24), [#25 API 명세](https://github.com/Jubileekim/KEMI/issues/25), [#26 프론트 E2E](https://github.com/Jubileekim/KEMI/issues/26), [#27 배포](https://github.com/Jubileekim/KEMI/issues/27), [#29 심화 기능](https://github.com/Jubileekim/KEMI/issues/29)
  - 닫힘: [#2 초기 구성](https://github.com/Jubileekim/KEMI/issues/2), [#5 인증 마이그레이션](https://github.com/Jubileekim/KEMI/issues/5), [#15 프로필 마이그레이션](https://github.com/Jubileekim/KEMI/issues/15)
- **API 문서**
  - 로컬 서버 실행 후 `http://localhost:4000/api/docs`(Swagger UI), `/api/openapi.json`
  - 원본: `apps/api/src/docs/openapi.ts` (명세 제출의 유일한 원본, 이슈 #25)
  - 운영 환경(`NODE_ENV=production`)에서는 꺼진다.
- **프론트엔드 전달 문서**
  - [프로필 선택지·PATCH 규칙](2026-10-21-profile-options.md)
  - [소셜 로그인 연동·팀원 준비 목록](2026-10-21-social-login.md)
  - 프로젝트·지원·알림·북마크 API: README와 Swagger
  - 오류 응답 형식: README "오류 응답 형식"

## 12. 작업 재개 프롬프트 (새 담당자가 Claude에게 붙여 넣기)

```text
KEMI 저장소(GitHub Jubileekim/KEMI)의 백엔드를 이어받았습니다.
먼저 docs/handoff/backend-handover.md, docs/decisions/2026-10-19-backend-setup.md,
apps/api/README.md를 읽고, 최신 main과 열린 PR·이슈 상태를 직접 확인해 인수인계서와 다른 점을 알려주세요.

지켜야 할 규칙:
- main에 직접 푸시·강제 푸시하지 말고, 작업 브랜치에서 PR로 제출합니다. PR은 직접 병합하지 않습니다.
  병합은 CI 통과와 작성자 외 팀원 1명 리뷰 후 팀원이 합니다.
- 팀장·PM(희년님, Jubileekim)의 결정을 먼저 따릅니다. 다른 사람 코드의 문제는 리뷰·댓글로 알립니다.
- 비밀번호·키·토큰·연결 주소 전체를 출력하거나 문서·PR에 남기지 않습니다. 오류에 비밀번호가 섞이면 ****로 가립니다.
- 테스트는 로컬 Docker 테스트 DB(TEST_DATABASE_URL)로만 합니다. 팀 개발 DB로 테스트하지 않습니다.
- 팀 DB 변경은 이슈에 범위 공유·동의 → 읽기 전용 점검 → prisma migrate deploy → 사후 확인 → 이슈 기록 순서로만 하고,
  예상과 다르면 멈추고 보고합니다. 적용된 마이그레이션·이력은 고치거나 지우지 않습니다.
- 코드 규칙: Airbnb + TypeScript ESLint, any·타입 단언(as, <T>, !) 금지(as const만 허용), 불필요한 코드 추가 금지.
  변경은 테스트로 확인하고, 중요한 검사는 일부러 빼서 테스트가 실패하는지(뮤테이션 확인)도 봅니다.
- 확정 정책과 제안을 구분하고, 새 제품 정책은 확정으로 표시하지 말고 팀 공유 대상으로 남깁니다.
- 작업할 때마다 이 인수인계서의 상태를 갱신합니다.
- 기존 작업(브랜치·stash·원격 브랜치)은 확인 없이 삭제하지 않습니다.

첫 작업: 인수인계서 0장과 9장 우선순위 1~2번(KEMI-dev DB 적용 준비, 열린 PR 상태)부터 확인하고 계획을 제안해주세요.
```
