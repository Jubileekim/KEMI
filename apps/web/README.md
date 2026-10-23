# KEMI Web (`@kemi/web`)

React + Vite + TypeScript 5.9.3. Node 24 / npm 11을 사용한다.
기준: [백엔드 결정 기록](../../docs/decisions/2026-10-19-backend-setup.md), [공통 설정 이슈 #2](https://github.com/Jubileekim/KEMI/issues/2), 작업 폴더의 `기술 스택.pdf`.

## 처음 실행하기 (저장소 루트)

```powershell
npm ci
npm run dev:web
```

`http://localhost:5173`에서 열린다. API 서버 없이도 화면 개발이 가능하다.
`API 연결 확인`은 API가 실행 중이어야 성공한다. 브라우저 새로고침 시 폼·화면 상태는 초기화된다.

백엔드를 함께 실행할 때는 [API 실행 안내](../api/README.md)에 따라 별도 터미널에서 `npm run dev:api`를 실행한다. DB 접속 정보는 API 담당자에게 받는다. 프론트엔드 `.env`에 DB 비밀번호나 JWT 비밀값을 넣지 않는다.

API 기본 주소는 `http://localhost:4000`이다. 바꾸려면:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
# apps/web/.env.local의 API_PROXY_TARGET 수정 후 Vite 재시작
```

브라우저는 `/api/*`로 호출하고 Vite가 API 서버로 전달한다. `/health`, `/health/ready`도 로컬에서 같은 서버로 전달한다. 경로에서 `/api`를 제거하지 않는다. `Origin`은 그대로 유지하므로 추후 인증 API의 허용 출처에 `http://localhost:5173`을 등록해야 한다.

`API_PROXY_TARGET`은 개발 서버 전용이다. `VITE_*` 값은 번들에 공개되므로 비밀값을 넣지 않는다. 현재 클라이언트 환경 변수는 필요 없다. ([Vite 공식 문서](https://vite.dev/guide/env-and-mode))

## 명령어 (저장소 루트)

| 명령                    | 역할                                           |
| ----------------------- | ---------------------------------------------- |
| `npm run dev:web`       | shared 빌드 후 웹 개발 서버                    |
| `npm run typecheck:web` | 웹 소스·설정 파일 타입 검사                    |
| `npm run lint:web`      | 웹 ESLint 검사, 경고도 실패 처리               |
| `npm run test:web`      | Vitest 단위 테스트                             |
| `npm run test:web:e2e`  | Playwright 데스크톱·모바일 브라우저 테스트     |
| `npm run build:web`     | shared 빌드 → 타입 검사 → 린트 → 프로덕션 빌드 |
| `npm run preview:web`   | 빌드 결과 확인 (`http://localhost:4173`)       |
| `npm run format`        | 저장소 공통 Prettier 형식 적용                 |
| `npm run format:check`  | 저장소 공통 형식 검사                          |

preview는 빌드 화면 확인용이며 Vite 개발 서버의 API 프록시는 제공하지 않는다.

## 코드 위치와 규칙

- `src/main.tsx`: QueryClientProvider·BrowserRouter 연결
- `src/App.tsx`: 초기 화면·찾을 수 없는 경로 처리. 실제 서비스 화면은 기능별 작업에서 추가
- `src/lib/api.ts`: 같은 출처의 `/api` Axios 인스턴스, 타임아웃·쿠키 전송·공통 오류 표시
- `src/lib/health.ts`: `/health` 연결 확인과 응답 형식 검증. DB 준비 여부는 `/health/ready`로 별도 확인
- `src/components/ui`: shadcn/ui 컴포넌트, `src/styles.css`: Tailwind와 테마
- `test/`: Vitest 단위 테스트, `e2e/`: Playwright 브라우저 사용자 흐름 테스트
- `@/` 별칭은 `src/`를 가리킨다. 공통 타입·상태값·오류 코드는 `@kemi/shared`에서 가져온다. shared 소스를 변경하면 `npm run build:shared`로 다시 빌드한다.

React Router·TanStack Query·Tailwind·shadcn/ui는 초기 화면에 연결되어 있다. Zustand·React Hook Form·Zod·폼 resolver는 설치되어 있으며 실제 전역 UI 상태·폼은 해당 기능에서 만든다. 서버 데이터는 Query로 관리하고 전역 UI 상태와 구분한다.

루트 ESLint 9(Airbnb + TypeScript), Prettier 기본값을 함께 쓴다. React 규칙은 웹에만 적용한다. `any`, 타입 단언, non-null 단언은 금지하며 `as const`는 허용한다. shadcn의 UI 래퍼에 한해 props 전달과 스타일 variant export를 허용한다.

shadcn 컴포넌트 추가:

```powershell
npm run ui:add -w @kemi/web -- card
npm run format
npm run build:web
```

CLI가 생성한 코드는 팀 규칙에 맞춰 검토한다. `cn`은 `@/lib/utils`에서 가져온다. TypeScript 5.9.3과 ESLint 9를 개별적으로 최신 버전으로 올리지 않는다.

## Playwright 브라우저 테스트

최초 한 번 Chromium을 설치한 뒤 실행한다. ([Playwright 공식 문서](https://playwright.dev/docs/intro))

```powershell
npm run test:e2e:install -w @kemi/web
npm run test:web:e2e
```

테스트가 전용 개발 서버(`http://127.0.0.1:5174`)를 자동으로 켜고 종료한다. 평소 개발하는 5173 서버는 그대로 사용할 수 있다. 5174를 이미 사용 중이면 다른 포트로 자동 변경하거나 기존 서버를 재사용하지 않고 실패한다. 해당 서버를 종료한 뒤 다시 실행한다.

- Desktop Chrome과 Pixel 7 모바일 에뮬레이션에서 초기 화면, 경로 직접 진입·새로고침·홈 이동, API 대기 중 중복 클릭 차단, 성공·실패·재시도, 잘못된 응답을 검사한다.
- `/health` 응답은 브라우저에서 모의 처리한다. 백엔드 서버·DB·외부 서비스 접속 정보가 필요 없다. 실제 API 프록시나 배포 연결을 검증한 결과와 구분한다.
- 현재 개발 모드 화면을 검사한다. 프로덕션 빌드 검사는 별도 `build:web`가 담당하며, Firefox·WebKit·실제 모바일 기기는 검사하지 않는다.
- 실패 시 `apps/web/test-results/`에 trace·스크린샷, `apps/web/playwright-report/`에 HTML 보고서를 만든다. 생성물은 Git·린트·형식 검사에서 제외한다.
- 보고서: `npm run test:e2e:report -w @kemi/web`, 대화형 테스트: `npm run test:e2e:ui -w @kemi/web`.

## 인증 연결 기준

최신 main의 백엔드에는 인증 API가 추가되어 있다. 프론트엔드의 인증 화면·API 연동·자동 토큰 갱신은 아직 구현하지 않았다. 결정 문서의 확정·제안 표기를 유지하며 인증 화면 작업에서 연결한다.

- ID는 API 계약대로 문자열로 취급한다.
- 인증 저장 방식 제안: Access 토큰은 메모리, Refresh 토큰은 HttpOnly 쿠키. localStorage에 저장하지 않는다.
- 갱신 요청을 하나로 모으는 것은 확정 사항이다. Web Locks·`REFRESH_RACE` 재시도 횟수 등은 문서의 제안 기준을 인증 PR에서 맞춘다.
- 오류 화면은 서버 메시지 문구 대신 shared의 오류 코드로 분기한다. 오류 코드가 추가되면 shared도 함께 갱신한다.

## Vercel 배포·운영 현황

**2026-10-23 최초 Production 배포 완료 (`Ready`, 사용자 대시보드 확인).** 운영 주소는 **https://kemi-web-sigma.vercel.app/** 이다. 배포·연동·후속 검증 현황과 기록은 [배포 환경 및 운영 기록](../../docs/runbooks/deployment-environments.md)에서 관리한다.

- Vercel 팀: `KEMI` (Pro Trial), 프로젝트: `kemi-web`, 연결 저장소: `Jubileekim/KEMI`, Production Branch: `main`.
- Root Directory: `apps/web`; 모노레포 루트 및 `packages/shared` 접근 설정을 확인한다.
- Install Command: `cd ../.. && npm ci --include=dev`
- Build Command: `cd ../.. && npm run build:web`
- Output Directory: `dist`; Framework: `Vite`; Node.js: 저장소 `.nvmrc`는 24.
- 최초 확인 커밋: [`73057fe`](https://github.com/Jubileekim/KEMI/commit/73057fe69916631b553723c8e14869629c17de53).
- API 서버 주소는 아직 확정되지 않았다. 현재 프로덕션 초기 화면 표시만 성공했으며 실제 API·인증 검증을 마쳤다는 의미는 아니다.

Render 주소가 확정되면 `vercel.json`의 `/api/:path*` rewrite를 Render의 같은 경로로 전달하도록 추가하고, **SPA fallback보다 먼저** 두어야 한다. SPA fallback 기본 구성은 [PR #32](https://github.com/Jubileekim/KEMI/pull/32)에서 검토 중이며, `main` 반영 이후 실제 페이지 직접 진입·새로고침을 검증한다.

배포 연결은 Render 서비스 주소의 `/health`를 직접 열어 확인하고, DB 준비 상태는 `/health/ready`로 확인한다. `/api/health`를 사용하지 않는다. Render의 `APP_ORIGIN`에는 `https://kemi-web-sigma.vercel.app` (끝 슬래시 없음)을 넣고, 로그인 화면 구현 이후 쿠키·Origin 검사·OAuth 콜백을 검증한다.

## CI와 작업 방식

`Web CI`의 `web` 작업이 main 대상 PR과 main push에서 형식·단위 테스트·타입·린트·빌드·Playwright를 검사한다. CI에서 Chromium과 Linux 의존성을 설치하고, 취소된 실행을 제외하면 HTML 보고서를 7일간 보관한다. 원격 DB나 비밀값은 필요 없다. GitHub에서의 실제 CI 실행은 PR 생성 후 확인한다.

작업 브랜치에서 PR을 제출하고 CI 통과 및 다른 팀원 1명 리뷰 후 병합한다. main 직접 푸시·강제 푸시는 하지 않는다. 브랜치 보호 설정은 이 작업에서 변경하지 않는다.
