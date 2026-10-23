# KEMI 프론트엔드 진행 기록

갱신: 2026-10-23 · 현재: 0-A·0-B·0-C 완료. 1-A 이메일과 1-B Google의 클라이언트·Mock 구현/로컬 검증 완료. 실제 Google/API 검증·이메일 가입 정책 충돌은 남음. 카카오 미착수. 0단계·1단계 전체 완료 아님.

## 기준과 결정

- 기능: `../케미 기능명세서.xlsx`. 두 의뢰 경로·계약·테스트 결제·납품·모의 정산 포함.
- 디자인: `../KEMI-Design-System/KEMI-Design-System/`. Leaf Green, 일반 주요 행동 #367345. 문의·상담 예시로 엑셀 범위를 축소하지 않음.
- API: `api문서.txt`는 참고. `frontend-feature-matrix.md`의 API 대조를 확인. 명세와 충돌하면 엑셀 유지, API 조율.
- 기술: `기술 스택.pdf` 기준 TypeScript·React/Vite·React Router·Tailwind/shadcn/ui·TanStack Query·Zustand·React Hook Form/Zod·Axios. npm Workspaces의 `../apps/web/`에 React/TypeScript/Vite·Tailwind/shadcn UI·Router·Query·Axios 적용 완료. Zustand·폼 도구는 해당 사용처의 후속 범위.
- 계획: `frontend-plan.md` 0~8단계 및 기존 기능 순서 유지. KEMI 토큰으로 shadcn/ui를 맞추고 기존 공통 UI를 중복 운영하지 않음.
- 테스트/협업: Vitest·Playwright·ESLint·Prettier·GitHub Actions 계획. Supertest·Express/Prisma/DB는 API팀 협업 경계.

## 0-A 완료 기록 (이전 범위)

- **0-A만 완료:** Node 24.19.0 / npm 11.17.0 확인, 루트 npm Workspaces와 `@kemi/web` React·TypeScript·Vite 실행 기반, ESLint·Prettier 및 루트 검사 명령 구성.
- React 19.3.1 / Vite 8.3.5 / TypeScript 6.0.3 사용. 공식 안내와 npm engines/peerDependencies 확인 후 정확한 버전을 manifest·루트 lockfile에 고정. TypeScript 7.0.2는 typescript-eslint 8.72.0의 지원 범위(`>=4.8.4 <6.1.0`) 밖이므로 사용하지 않음.
- KEMI 로고·토큰을 출처 기록과 함께 복사. 기존 CSS 변수를 사용하는 실행 확인용 안내 화면만 구현. 600/1024px 구간·카드 24px·제공 글꼴 스택 유지. Tailwind/shadcn 의미 토큰 매핑과 공통 UI는 아직 구현하지 않음.
- 기능표의 69개 기능은 모두 미착수 유지. 0-A에 대응하는 제품 기능/API 행은 없음. API 호출·서버 계약·미결정 정책을 추가하거나 변경하지 않음.

### 변경 파일과 실행 방법

- 루트: `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `README.md`.
- 앱 설정: `apps/web/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`.
- 앱 소스: `apps/web/src/main.tsx`, `src/app/App.tsx`, `src/styles/index.css`.
- 제공 자산 복사: `apps/web/src/design-tokens/{tokens.json,tokens.css,README.md}`, `apps/web/public/brand/{logo-primary.svg,symbol-primary.svg}`.
- 진행 기록: 이 파일. 원본 엑셀·계획·기능표·디자인 키트는 수정하지 않음. `apps/api`, `packages/shared`는 원본/계약 미제공 경계를 유지하며 생성하지 않음.
- **루트에서** `npm ci` → `npm run dev` (http://127.0.0.1:5173). 빌드 `npm run build`, 빌드 미리보기 `npm run preview` (4173). 상세는 루트 README.

### 검증 결과

- `npm install` 완료, 최종 설치 출력 audit 164개 패키지·취약점 0개. `npm ls --workspace @kemi/web --depth=0` 정상. `npm ci` 재설치는 별도 실행하지 않음.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`: 모두 종료 코드 0. 빌드 산출물 `apps/web/dist` 생성.
- `npm run check:tokens`: PASS (11개 타이포 역할, 16개 대비 조합, 6개 재생성 결과 등 키트 기존 검사). 별도 바이트 비교로 앱에 복사한 토큰/CSS/SVG 총 4개 원본 일치 확인.
- `npm run dev`: Vite 준비 완료. `/`, `/src/main.tsx`, 로고·심볼 SVG 요청 HTTP 200. 실제 브라우저에서 KEMI 로고·제목·안내 문구 렌더링 확인. 모바일별 시각 QA·HMR 편집 동작·빌드 preview 서버는 별도 미검증.
- **실제 API 연동:** 없음/미검증. **Mock 검증:** 없음(이번 범위에 Mock 구현 없음). 브라우저 로컬 앱 확인은 백엔드 연동 증거가 아님.
- Vitest·Playwright·GitHub Actions는 아직 구성/실행하지 않음. 0단계 전체 완료로 표시하지 않음. Git 커밋·푸시·배포 미실행.

### 남은 일과 결정 경계

- 0-B 공통 UI·의미 토큰, 0-C Router·Query·Axios·MSW, 이후 테스트/CI 기반이 남음. 이번 작업에서 자동 착수하지 않음.
- Pretendard 웹폰트 파일은 제공 키트에 없어 시스템 대체 글꼴로 표시. 웹폰트 공급 방식은 후속 확인.
- 기존 API 충돌(조기 선정·비밀번호·모집 상태 등)과 D01~D23은 유지. 관련 기능 착수 시 원본 기능표에 따라 Mock 분리/계약 조율. 이번 범위를 막는 정책 결정은 없음.

## 0-B 완료 기록 (이전 범위)

- **0-B만 완료:** Tailwind CSS 4.3.3 + Vite 플러그인, 공식 shadcn/ui new-york-v4 기반 Button·Input·Textarea·Select·Checkbox·Badge·Tabs·Dialog·Label·Sonner 적용. 패키지 버전은 manifest·lockfile에 고정. 공식 지침과 Vite 8/React 19 peerDependencies 확인. Next.js 전용 next-themes는 설치하지 않음.
- `kemi-theme.css`에서 KEMI 원본 → shadcn 의미 색상·Tailwind 글꼴/간격·sm=600px/lg=1024px 연결. 주요 행동 #367345/흰색, hover #2C623A, pressed #245331. 11개 타이포 역할과 모바일 축소·16/24/32px 여백·1280px 최대 너비·카드 24px·모달 28px·버튼 999px 유지. 라이트 우선, 동작 줄이기 대응.
- 원본 로고·심볼·아이콘·파비콘·매니페스트 연결. 토큰과 브랜드 자산 19개 원본 바이트 일치 확인. 0-A의 두 로고 경로는 호환용으로 유지. 키트 원본은 수정하지 않음.
- 앱 `/`는 공통 UI 확인 화면. 라벨·오류 연결·비활성/읽기 전용·처리 중·성공/오류/빈 결과/재시도 표현, 키보드 선택·탭·모달·토스트 확인. 이름 필수 검사는 화면 오류 연결 시연이며 제품 정책이 아님. 69개 제품 기능은 미착수 유지.

### 변경 파일

- 의존성: `apps/web/package.json`, 루트 `package-lock.json`.
- 설정: `apps/web/{vite.config.ts,tsconfig.app.json,components.json,index.html}`.
- 화면·스타일: `apps/web/src/app/{App,UiShowcase}.tsx`, `src/styles/{index,kemi-theme}.css`, `src/lib/utils.ts`.
- 공통 UI: `apps/web/src/components/ui/{button,input,textarea,select,checkbox,badge,tabs,dialog,label,sonner}.tsx`, `README.md`, `LICENSE.md`.
- 서비스 공통: `apps/web/src/components/kemi/{brand,empty-state}.tsx`.
- 자산·출처: `apps/web/public/brand/{svg,icons}/`, `src/design-tokens/README.md`.
- 검증 증거: 루트 `tmp/0-b/verify-ui.cjs`, `qa-results.json`, `ui-{390,768,1280}.png`, `dialog-{desktop,mobile}.png`. 임시 레지스트리 원본도 같은 폴더에 보관. 이 진행 기록 갱신.

### 검증 결과

- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `npm run check:tokens`: **최종 모두 종료 코드 0**. 키트 검사 11개 타이포 역할·16개 대비 조합·6개 재생성 결과 PASS. 설치 audit 256개 패키지·취약점 0개.
- Edge/Chromium 기반 실제 브라우저에서 **17개 검사 통과**: 320/390/599/600/768/1023/1024/1280px 가로 넘침 없음·구간별 여백/열 수, 주요 버튼 기본/hover/pressed, 건너뛰기·키보드 포커스, 오류 설명 연결·재시도 입력 보존·readonly/disabled, 체크박스 Space, Select 방향키, Tabs 방향키/비활성 건너뛰기, Dialog 포커스 가두기·Escape·닫기/포커스 복귀, 모바일 모달, 큰 글꼴·동작 줄이기·OS 다크에서도 라이트 유지, 브랜드 경로 HTTP 200·콘솔 오류 0건·API 요청 0건.
- 390/768/1280px와 모바일·데스크톱 모달 스크린샷 확인. 640px 뷰포트+루트 글꼴 200%에서 넘침 검사. 브라우저 메뉴의 실제 200% 확대·스크린리더 낭독·다른 브라우저는 미검증.
- 기존 5173 포트가 사용 중이어서 이번 QA는 **루트 기준** `npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5174 --strictPort`로 별도 실행. 5173 기존 프로세스는 종료하지 않음. 일반 개발 명령은 기존 `npm run dev` 유지.
- QA 재현: Playwright를 제공하는 환경에서 루트의 `node tmp/0-b/verify-ui.cjs` 실행. 이 세션은 번들 Playwright를 `NODE_PATH`로 지정하고 설치된 Edge를 사용. 앱에 Playwright 패키지/정식 테스트 러너·CI를 구성한 것은 아님. 기본 QA URL은 5174이며 `KEMI_QA_URL`로 변경 가능.
- **실제 API 연동:** 없음/미검증. **Mock 검증:** 없음(API Mock 구현 없음). 성공/오류/재시도는 명시된 로컬 UI 예시이며 백엔드 저장·정책·계약 검증 증거가 아님.

### 남은 일과 결정 경계

- 0-B 범위의 미완료 항목 없음. Pretendard 웹폰트 공급은 기존 미결정으로 유지하며 현재 시스템 대체 글꼴 사용. 다크 모드는 확장안 유지.
- 0-C Router·Query·Axios·MSW, 이후 Vitest·Playwright 정식 구성·CI와 기능 개발은 미착수. 0단계 전체 완료로 표시하지 않음.
- D01~D23 및 기존 API 충돌 유지. 이번 범위에 제품 API를 만들거나 기능표·계획·미결정 정책을 변경하지 않음.
- Git 커밋·푸시·배포와 다음 범위 자동 착수 없음.

## 0-C 완료 기록 (이번 범위)

- **0-C만 완료:** React Router DOM 7.18.4·TanStack Query 5.104.5·Axios 1.20.0·개발 의존성 MSW 3.0.3을 정확한 버전으로 설치. 공식 문서·npm engines/peerDependencies·설치된 MSW 3 타입/README 확인. Node 24/React 19/Vite 8/TypeScript 6과 호환. 설치 audit 331개 패키지·취약점 0개.
- 계획 §4의 S01~S15에 해당하는 **32개 경로**를 연결. 공개/회원/작업/운영 구분을 공통 Shell의 레이아웃 모드로 구성. 브랜드 헤더·내비게이션·본문·푸터·404·문서 제목·화면 이동 시 본문 포커스·건너뛰기 제공. KEMI 원본 토큰·로고·타이포 역할·600/1024px 구간·최대 1280px·16/24/32px 여백·카드 24px 유지.
- 제품 화면은 모두 **기능 미연결 안내 화면**. 기능표의 69개 기능은 미착수 유지. 기존 공통 UI 예시는 개발 전용 `/__dev/ui`로 이동. 작업 화면의 채팅/작업 패널은 후속 기능/D20 경계이며 이번에는 공간 구분만 구성.
- Mock 비회원/의뢰인/크리에이터/운영 역할로 접근 가드 검증. 비회원은 로그인 경로로 이동하고 허용된 내부 경로로만 복귀. 역할 변경 시 진행 중 조회 취소·캐시 제거. 새로고침은 비회원 초기화. 서버 인증 미연결 상태에서는 보호 데이터를 렌더링하지 않고 준비 상태를 표시. 가드는 서버의 소유자/당사자/파일 권한 검증을 대체하지 않음.
- Axios에 서버 Origin 설정·10초 타임아웃·취소 보존·HTTP/네트워크 오류 변환을 구성. API 문서의 `error.code/message` 외피만 참고하고 화면에는 로컬 오류 안내 사용. Query 조회·변경 모두 자동 재시도 비활성; 명시적인 수동 재요청 제공. 실제 인증 갱신·401 세션 만료 연결은 1단계 범위.
- MSW 성공·빈 결과·1.5초 지연·401·403·409·500·네트워크 오류를 **`/__mock__/probe` 전용 가상 계약**으로 분리. 실제 제품 엔드포인트/DTO를 추정하지 않음. Mock 준비를 기다린 뒤 앱 시작, 준비 실패 시 오류 안내. 개발 환경과 명시적 플래그가 모두 켜져야 시작하며 운영 산출물에서 도구·UI 예시·MSW 코드·worker 파일을 제외.

### 변경 파일과 실행 방법

- 의존성: `apps/web/package.json`, 루트 `package-lock.json`.
- 설정: `apps/web/{.env.example,.prettierignore,eslint.config.js,vite.config.ts}`. 생성 worker는 포맷/lint 대상에서 제외하고 MSW 원본 유지.
- 앱 진입·경로·세션·레이아웃: `apps/web/src/main.tsx`, `src/app/{App,providers,route-pages}.tsx`, `src/app/{routes,session,query-client}.ts`, `src/app/layouts/Shell.tsx`.
- 통신·Mock: `apps/web/src/shared/api/client.ts`, `src/mocks/{browser,handlers}.ts`, `src/mocks/DevTools.tsx`, `apps/web/public/mockServiceWorker.js`.
- 스타일: `apps/web/src/styles/index.css`. 원본 키트·복사 토큰·공통 UI 소스는 변경하지 않음.
- 안내·증거: 루트 `README.md`, 이 진행 기록, `tmp/0-c/{verify.cjs,results.json,layout-390.png,layout-768.png,layout-1280.png}`.
- **루트 PowerShell:** `$env:VITE_ENABLE_MOCKS='true'` → `npm run dev`. 기본은 비활성. 종료 후 `Remove-Item Env:VITE_ENABLE_MOCKS`. 서버 Origin은 `apps/web/.env.example` 참조; VITE 값에 비밀키 금지.
- 이번 QA만 Mock 개발 서버 5175와 운영 preview 4175 사용. 기존 5173/5174 프로세스는 변경하지 않음. 재현은 Playwright+Edge 환경에서 `node tmp/0-c/verify.cjs`; URL은 `KEMI_QA_URL`, `KEMI_PREVIEW_URL`로 변경. 이 세션은 번들 Playwright를 NODE_PATH로 지정했으며 정식 러너 설치와 구분.

### 검증 결과

- 최종 `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `npm run check:tokens` **모두 종료 코드 0**. 키트 11개 타이포 역할·16개 대비 조합·6개 재생성 결과 PASS.
- Edge/Chromium 브라우저 QA **19개 검사 그룹 통과**, 실패 0. 32개 경로 직접 진입·정적/동적 경로 우선순위·역할별 화면·운영 거부·크리에이터 전용 제한·비회원 리다이렉트·외부 복귀 차단·역할 변경 시 개인 캐시 제거·로그아웃 후 뒤로 가기·404·새로고침·본문 포커스 확인.
- 실제 브라우저의 Axios→MSW→Query 흐름에서 성공/빈 결과/지연/401/403/409/500/네트워크 오류·수동 재요청·처리 중 재요청 버튼 비활성 확인. 페이지 런타임 오류 0, 제품 `/api/` 요청 0. 예상된 HTTP/네트워크 실패 로그는 오류 시나리오의 일부이며 콘솔 전체 오류 0이라고 주장하지 않음.
- 320/390/599/600/768/1023/1024/1280px **실제 렌더링 완료 후** 가로 넘침 없음 확인. 390/768/1280px 캡처 저장, 모바일 캡처 시각 확인. 초기 QA의 요청 집계가 소스 경로 `src/shared/api/client.ts`를 제품 호출로 오인한 문제와 렌더링 대기 누락을 스크립트에서 수정 후 재검증.
- `VITE_ENABLE_MOCKS=true`인 셸에서 운영 빌드해도 Mock 코드/역할 도구/UI 예시/worker 파일이 제외됨을 산출물 검색과 preview 브라우저로 확인. 운영 보호 화면 차단, 개발 UI 경로 404, worker 등록·Mock 요청 없음 확인. 배포 서버 SPA rewrite는 미검증.
- **실제 API 연동:** 없음/미검증. 서버 주소·서버 실행 환경 미제공으로 health도 호출하지 않음. **Mock 검증:** 위 통신/경로 기반만 검증. 인증/상품/결제/계약 등 제품 기능이나 실제 권한·DB 저장을 검증한 것이 아님.

### 남은 일과 결정 경계

- 0-C 범위의 미완료 항목 없음. Vitest·Playwright 정식 러너·CI는 후속 0단계 범위. 0단계 전체 완료로 표시하지 않음.
- D01~D23과 기능표의 API 충돌은 유지. D05 토큰 저장/갱신·D18 운영 권한·신규 소셜 사용자의 onboarding 세션 모델은 실제 계약 확인 전 확정하지 않음. Mock의 역할 enum/접근 구분은 경로 검증용 내부 값이며 shared enum이나 최종 권한표를 대신하지 않음.
- 실제 API 계약이 없는 기능은 이번에 구현하지 않음. 기능 착수 시 엑셀·기능별 API 대조 결과에 맞춰 명시적 Mock 또는 실제 연결을 구분한다.
- Git 커밋·푸시·배포·다음 범위 자동 착수 없음.

## 다음 작업 하나

**1-A API 정합화·실서버 검증:** P01 가입 비밀번호와 프로필 완료 판정 계약·D05를 조율한 후 실제 Origin/쿠키/세션을 검증한다. API팀 계약·실행 환경 준비가 필요하다. 별도 요청 후 착수하며 1-B를 자동 시작하지 않는다. 기존 0-D 전체 정합화는 여전히 미완료다.

## GitHub 통합 PR 준비 (2026-10-23 추가 요청)

- 지속 작업 경로는 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`이다. 상위 폴더의 독립 앱은 보존한 이전 원본이므로 이후 커밋/PR 작업은 이 Git 복제본에서 진행한다. 이동 후 workspace 링크를 오프라인 재설치로 갱신하고 shared 모듈 경로를 확인했다.
- 구현 커밋 `76fd896e431551b7e54f9af7cd3f22dab7d2bdd2` 푸시 완료. [Draft PR #34](https://github.com/Jubileekim/KEMI/pull/34) 생성·이 채팅에 연결 완료. API 단위 검사 실패를 PR 본문에 명시했다. 원격 CI의 최종 결과는 미확인이고 자동 병합·배포는 실행하지 않았다.

- 사용자가 단계 종료 후 커밋·푸시·PR을 요청함에 따라 위 0-C 종료 당시의 Git 미실행 상태에서 별도 진행. 기준은 `Jubileekim/KEMI` main `73057fe69916631b553723c8e14869629c17de53`이며 작업 브랜치는 `feat/frontend-0abc-foundation`이다. 이 첫 PR에는 원격에 없던 0-A·0-B 기반과 0-C를 함께 포함한다.
- 위 0-A~0-C 기록은 독립 로컬 앱에서 검증한 당시 이력이다. 원격에는 API/shared와 웹 테스트·CI가 이미 있어 보존했다. `apps/api`, `packages/shared`, 기존 workflow 파일은 변경하지 않았다. 실제 프론트 제품 기능·API 연동을 새로 완료한 것은 아니다.
- 통합본은 원격의 React Router 8.4.0·TypeScript 5.9.3·Vite 8.3.4를 유지한다. Router DOM 7/TypeScript 6 별도 설치와 ESLint 10 덮어쓰기를 피하고, 기존 Airbnb/TypeScript 규칙·Prettier 기본 형식에 새 소스를 맞췄다. MSW는 devDependency, 서버 오류는 unknown+Zod로 검증, 타입 단언 없이 CSS 변수와 역할 입력을 처리한다.
- 원격의 기존 health 진단과 API 클라이언트·단위 검사는 보존하고 화면만 개발 전용 `/__dev/health`로 옮겼다. 기존 E2E는 새 홈/404와 진단 경로를 반영하고, `/health`만 정확히 가로채도록 수정했다. health E2E의 가상 응답은 실제 서버 검증과 구분한다.
- 루트의 기존 `dev:web`, `build:web`, `test:web` 등 명령을 유지하며 `dev`·`build`·`preview` 별칭과 `check:tokens`를 추가했다. 원본 키트·기능 엑셀·기술 PDF·당시 API 문서 스냅샷·프론트 계획을 함께 버전 관리해 근거와 토큰 검사를 재현한다. 원본 키트·복사한 브랜드/토큰·MSW 생성 worker는 포맷/린트에서 제외한다.
- 통합본의 근거/재현 스크립트는 `qa/frontend-0c/`로 옮겼다. Mock 서버 5176·preview 4176에서 19개 검사 그룹 통과, 페이지 오류 0·제품 API 요청 0. 실제 API는 미연결. 최신 API/shared가 원격에 존재한다는 사실과 현재 프론트에 연결했다는 것은 구분한다.
- 기존 Playwright E2E는 데스크톱·모바일 12/12 통과, 종료 코드 0. 로컬 검증에만 임시 config로 Edge와 별도 포트 5179를 지정했으며 저장소의 Chromium 프로젝트·CI 파일은 유지했다. 제한된 환경에서 발생한 서버 종료 대기는 권한이 허용된 동일 검사 실행으로 분리 확인했다.
- `npm run build:web`(타입·린트 포함), `npm run format:check`, `npm run test:web`(4/4), `npm run check:tokens`, `npm ci --ignore-scripts --dry-run` 통과. 전체 workspace 타입·린트도 Prisma 생성 후 통과했다. Prisma 생성은 코드 생성만 수행했으며 DB 연결/마이그레이션은 실행하지 않았다.
- 추가로 실행한 **기존 API 단위 검사**는 Windows에서 timeout/ECONNRESET이 발생: 최종 74/85 통과·11개 실패. 샌드박스 밖 동일 명령에서도 재현되어 통과라고 표시하지 않는다. API 소스·검사·shared는 diff 없음. 원인 확정이나 백엔드 수정은 이 PR 범위에 넣지 않고 원격 Linux CI 결과와 별도로 기록한다. 실제 DB 검사·외부 제공자 검증은 미실행.
- `npm audit`는 high 9건을 보고했다. 전부 main의 기존 개발 도구(braces/micromatch/fast-glob, Airbnb ESLint, shadcn CLI 등)와 설치 경로·버전이 동일함을 lockfile로 확인했다. 일괄 audit fix/주요 버전 변경은 수행하지 않음. 신규 파일의 대표 비밀키/개인키 패턴 검사 결과 의심 경로 0.
- PR은 검토용으로 생성하며 자동 병합·배포·다음 기능 개발은 하지 않는다. 원격 CI 성공 여부는 로컬 검사와 별도 확인한다.

## 실제 API 연결 전 필요한 것

- 생성된 OpenAPI JSON 또는 @kemi/shared 입력 스키마·enum. 실제 서버 주소/개발 환경·Origin 설정.
- P07과 accept API 동작의 정합화. API 문서 없는 기능은 계약 추가 필요.
- D01~D23 중 해당 기능을 막는 항목만 순서대로 결정. 미정값은 확정 정책으로 표시하지 않음.

## 작업 종료 시 갱신할 항목

1. 이번 범위와 완료/미완료
2. 변경 파일과 실행 방법
3. 검증 명령·결과·미검증 경계
4. 결정 사항·차단 원인
5. 다음 작업 하나

전체 원본·전체 계획을 매 턴 다시 요약하지 않는다. 필요한 기능 행과 관련 절을 우선 확인한다. 사용자 요청 범위까지만 진행한다.

## 1-A 이메일 회원가입·로그인·로그아웃·만료 (2026-10-23)

### 완료 범위와 변경 파일

- 지정 Git 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`, npm workspace `apps/web`만 기준으로 구현. 상위 독립 앱은 수정하지 않았다. 중단 후 미커밋 변경이 보존된 것을 확인하고 검사를 재실행했다.
- AUTH-01·02·03·05의 이메일 클라이언트 범위: RHF/Zod 가입·로그인 폼, Mock 가입 후 자동 로그인→프로필, 역할별 기본 경로/안전한 복귀, refresh→me 초기 확인, TOKEN_EXPIRED 갱신, 실패·폐기·로그아웃·서버 로그아웃 재시도.
- `apps/web/src/features/auth/{AuthForm.tsx,config.ts,contracts.ts,redirect.ts,session-controller.ts}` 신규. 세션/라우터/레이아웃은 `src/app/{App.tsx,providers.tsx,session.ts,route-pages.tsx,layouts/Shell.tsx}`, 통신은 `src/shared/api/client.ts`, 스타일은 `src/styles/index.css` 수정.
- 개발용 `src/mocks/{auth-handlers.ts,browser.ts,DevTools.tsx}`, `.env.example`, `src/vite-env.d.ts` 갱신. 토큰은 메모리만 사용하고 Query 변수에 비밀번호를 보관하지 않는다. Mock 계정은 탭 메모리 한정이며 실제 가입 저장이 아니다.
- 검사: `apps/web/test/auth{,-transport}.test.ts`, `e2e/auth.spec.ts` 신규. 기존 `e2e/app.spec.ts`는 MSW와 함께 health 요청을 가로채도록 context.route 적용. `playwright.config.ts`는 검사 서버에서 Mock을 명시적으로 활성화한다.
- `.github/workflows/web-ci.yml`의 기존 검사 절차를 유지하고, 아직 열린 기반 PR #34 위의 별도 1-A PR도 실행하도록 기반 브랜치를 허용 목록에 추가했다. API CI·API/shared 소스·lockfile·브랜드 원본/토큰은 변경하지 않았다.
- 상세 경계/실행: `docs/frontend-auth-1a.md`, 관련 기능 상태 `docs/frontend-feature-matrix.md`, 증거·재현 `qa/frontend-1a/{README.md,production-smoke.cjs,production-results.json,signup-390.png,signup-1280.png}`.

### 로컬 검증 결과

- 최종 `npm run test:web`: **32/32 통과**. 비밀번호 경계·이메일 정규화·위험한 복귀 경로·초기 확인·동시 갱신·409 횟수/3초 예산·네트워크 재시도 제한·서버 로그아웃 실패·늦은 응답·계정 변경 캐시 제거·변경 요청 재전송 금지 확인.
- 최종 `npm run build:web`(타입·ESLint 포함), `npm run format:check`, `npm run check:tokens`, `git diff --check`: **통과**. 토큰 검사 11개 타입 역할·16개 대비·6개 재생성 PASS. 신규 의존성 설치 없음.
- 최신 전체 Playwright **36/36 통과, 종료 코드 0**. 기존 health 12개와 인증 24개를 데스크톱·모바일 Edge/Chromium으로 검사했다. 가입→프로필→로그아웃→동일 계정 로그인 통합 흐름을 두 역할에서 추가 확인했다. 지연/오류/제한/429/500/네트워크·안전한 복귀·새로고침·로그아웃 캐시 제거·실패 후 재시도·뒤로 가기·세션 폐기·320/390/768/1280px 넘침을 포함한다. 390/1280px 캡처 시각 확인.
- 로컬은 무시되는 `tmp/playwright.local.config.ts`에서 Edge와 포트 5179를 사용. 일반 명령·CI는 기존 Chromium 프로젝트와 별도 개발 서버를 유지한다. 전체 trace/report·tmp 로그는 커밋에서 제외했다.
- 중간 실패 기록: 초기 로컬 config에서 Mock env 누락, 기존 page.route가 MSW 요청을 놓치는 문제를 수정했다. shared 재빌드/소스 갱신과 E2E를 겹쳐 실행했을 때 초기 checking 상태 대기가 실패했다. 빌드 종료 후 개발 서버를 새로 띄운 단독 전체 실행은 **36/36**. 이 정황과 최종 결과를 구분하며 타임아웃 완화·자동 재시도 추가로 숨기지 않았다.
- 운영 모드 build/preview(4181): Mock 플래그가 있어도 worker·Mock 계정/도구가 산출물에서 제외되는지 검색했고, Playwright가 HTTP를 모의 응답한 브라우저 smoke **7개 검사 통과**, 페이지 오류 0. 이메일 정규화·보호 화면 복귀·로그아웃·실제 모드 가입 차단·개발 도구/worker 미등록 확인. `production-results.json` 참조. 이 결과도 실제 서버 검증이 아니다.
- 독립 보안/명세 검토의 계정 전환 캐시와 정적/동적 경로 우선순위 지적을 수정·회귀 검사했다. 추가로 쿠키를 쓰는 login/logout/refresh를 같은 큐/지원 환경 Web Lock으로 묶었다. 실제 다중 탭/쿠키 응답 순서는 미검증이다.

### 남은 일과 정책 경계

- **AUTH-01 실제 가입 미연결:** 엑셀 P01(8~64자·영문/숫자)과 현재 shared/API(8자 이상·72바이트) 충돌. 엑셀을 따르는 Mock으로 분리했고 실제 가입 버튼/호출을 차단했다. API/shared 정책을 임의 수정하지 않았다.
- **AUTH-02 미완성 프로필 자동 이동 미완료:** AuthUser/MeResponse에 완료 판정 계약이 없고 D01 미정. 브랜드/공개 여부로 추정하지 않고 역할별 기본 이동만 제공한다. 프로필 화면 편집은 이번 범위 아님.
- **실제 API·DB·Origin/HttpOnly/Secure/SameSite·세션 폐기·외부 제공자 미검증:** 이 체크아웃에는 API 환경 파일/실행 서버가 없다. Mock과 모의 HTTP 응답의 성공을 실제 연결로 표시하지 않는다. 실제 모드는 `VITE_ENABLE_AUTH_API=true`로 명시하며 D05 팀 승인은 별도다.
- 기존 API Windows 단위 실패 이력은 앞선 기반 PR 기록을 유지하며 이번에 재실행하거나 백엔드를 변경하지 않았다. API CI와 원격 웹 CI 결과는 아래 Git 전달 기록에서 별도 관리한다.
- 1-A의 클라이언트/Mock 검증까지 완료. **1-A 실제 인증 전체·0단계 전체·1단계 전체는 완료가 아니다.** 소셜·프로필·패키지·다음 작업, PR 병합·자동 병합·배포는 실행하지 않았다.

### Git 전달 상태

- 기존 인증 1-A 브랜치/PR 없음 확인. 기반 Draft PR #34의 `314c831`에서 `feat/frontend-1a-email-auth`를 만들었다. 별도 PR은 기반 브랜치를 대상으로 하여 0-A~0-C diff를 중복하지 않는다.
- 세션/계약·검사 커밋: [4320db7](https://github.com/Jubileekim/KEMI/commit/4320db7). 화면/Mock·통합검사·문서 커밋: [130219e](https://github.com/Jubileekim/KEMI/commit/130219e). 두 커밋 모두 원격 브랜치에 푸시했고 로컬/원격 SHA 일치를 확인했다.
- [Draft PR #35](https://github.com/Jubileekim/KEMI/pull/35) 생성·이 채팅 연결 완료. base는 아직 열린 기반 PR #34의 `feat/frontend-0abc-foundation`. 기반 병합 뒤 main 대상 재지정 검토가 필요하다. Draft는 실제 가입 정책 충돌·프로필 완료 판정 부재·실서버 검증 경계 때문에 유지한다.
- **원격 Web CI:** 기능 커밋 `130219e`의 [run 81](https://github.com/Jubileekim/KEMI/actions/runs/39943799612) **success** 확인. Ubuntu/Node 24에서 npm ci·형식·단위·타입/린트/빌드·Chromium 설치·데스크톱/모바일 **36/36**·report 업로드가 모두 성공했다. 로컬 Edge 결과와 별도 증거다. 기존 API CI는 이 base에서 실행 대상이 아니며 API/DB 성공을 주장하지 않는다.
- 이 결과/PR 링크를 추가한 최종 전달 커밋은 문서만 변경한다. 해당 커밋의 최신 CI는 PR Checks에서 SHA와 함께 확인할 수 있다. 문서 변경 후 형식/공백 검사를 수행하고 푸시한다. 소스·테스트는 검증한 `130219e`와 같다.
- 다음 작업 하나는 위의 **1-A API 정합화·실서버 검증**이며 자동 착수하지 않는다.

## 1-B Google 로그인 화면과 콜백 처리 (2026-10-23)

### 완료 범위·변경 파일

- 기준 저장소는 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`, 앱은 npm workspace `apps/web`이다. 상위 독립 앱은 수정하지 않았다. AUTH-04/P03만 구현했고 **AUTH-06 카카오 로그인은 미착수**로 남긴다.
- Google 시작은 실제 모드에서 `/api/auth/google/start`로 브라우저 이동. 기존 회원 콜백은 개인 캐시 제거→refresh→me 확인→역할별 안전한 복귀. 신규 회원은 서버 티켓 조회 후 공개 콜백에서 역할/이름을 받고 shared 계약으로 가입→프로필 이동한다. 이메일/비밀번호를 요구하거나 제공자 이메일로 기존 계정을 합치지 않는다.
- `apps/web/src/features/auth/{google.ts,GoogleButton.tsx,GoogleCallback.tsx,SocialSignupForm.tsx}` 신규. 같은 폴더의 `AuthForm.tsx`, `session-controller.ts`, `src/app/{App,providers}.tsx`와 `.env.example` 연결. OAuth state·PKCE·토큰 교환은 기존 서버 책임이며 프론트에서 대체하지 않는다.
- 개발 전용 `src/mocks/GoogleProvider.tsx` 신규, `auth-handlers.ts`에 명시적 Google fixture/티켓/오류 추가. 기존 이메일 회원과 같은 제공자 이메일을 가진 별도 Google fixture로 자동 병합 없는 UI를 검사한다. 비밀이 아닌 Mock 역할 표식으로 새로고침 역할을 보존하며 이름 편집은 탭 메모리 한정이다. 실제 DB 저장/계정 유일성 증거가 아니다.
- 검사 `apps/web/test/google.test.ts`, `e2e/google.spec.ts`와 증거 `qa/frontend-1b/` 신규. 계약/판단은 `docs/frontend-auth-1b.md`, 해당 기능 상태는 `frontend-feature-matrix.md`에 기록했다. `.github/workflows/web-ci.yml`은 아직 열린 1-A 브랜치를 PR base 허용 목록에 추가했고 기존 검사 절차를 유지한다.
- API/shared·DB·의존성/lockfile·원본 엑셀·디자인 토큰/로고 변경 없음. 다음 기능·병합·자동 병합·배포는 실행하지 않았다.

### 로컬 검증·검토

- 최종 `npm run test:web`: **59/59**. Google 신규 단위 27개와 기존 32개. 콜백 단일 분기/중복 키·위조 값 거절, 복귀 경로/만료, 캐시 초기화, 제한 계정, 로그아웃 이후 늦은 가입 응답을 확인했다.
- 최종 `npm run build:web`의 타입/ESLint/운영 빌드, `npm run format:check`, `npm run check:tokens`, `git diff --check`: **통과**. 키트 11개 타이포 역할·16개 대비·6개 재생성 PASS. 대표 비밀키/개인키 패턴 의심 경로 없음.
- 최종 전체 Playwright: **64/64, 종료 코드 0**. 기존 이메일/health 36개와 Google 28개를 데스크톱·모바일 Edge/Chromium으로 검사. 두 역할 신규 가입→프로필→로그아웃→동일 ID/역할 재로그인→새로고침, 기존 회원 복귀, 취소/실패/설정 없음/요청 제한/이용 제한, 티켓 없음/만료/409/500/429, 이름 수정·역할 필수·중복 제출, 320/390/599/600/768/1023/1024/1280px 넘침·키보드·오류 연결·주요 색상을 확인했다.
- 로컬 명령은 `npm exec -- playwright test --config tmp/playwright.local.config.ts` (Edge·5179). 정식 CI의 Chromium 설정을 변경하지 않았다. 로그/trace/report/tmp는 제외한다. 기존 MSW의 정적 파일/health 통과 요청 경고는 남으며 실제 서버 성공으로 해석하지 않는다.
- 운영 빌드(인증/Mock 플래그를 모두 켬)+preview 4182에서 **모의 HTTP 7개 검사 통과·페이지 오류 0**. 시작 API가 fetch가 아닌 주소 이동인지, refresh/me 후 인증, 크리에이터 전용 복귀, 신규 역할/이름 POST 1회, 카카오 티켓 거절, worker/Google Mock/개발 도구/카카오 버튼 제외 확인. 390/1280px 캡처 시각 검토. `qa/frontend-1b/README.md`, `production-results.json`으로 재현한다.
- 중간 실패와 수정: 재로그인 검사의 복귀 기대값을 기존 로그아웃의 프로필 복귀 규칙에 맞췄고, 개발 도구 label 대신 응답의 사용자 ID/역할로 확인하도록 바꿨다. 빠른 운영 모의 응답에서 세션 캐시 초기화가 가입 폼을 다시 만들어 완료 이동이 누락되는 문제를 재현·수정한 뒤 운영 smoke와 전체 E2E를 다시 통과했다. 기존 ESLint 규칙 위반을 수정했으며 검사 완화/자동 재시도는 추가하지 않았다. 중단/재개 뒤 종료된 preview는 다시 실행했다.
- 명세·코드 품질·보안 축의 최종 자체 검토 완료. 토큰/티켓 URL 수락 금지, provider 검증, 외부 복귀 차단, 쿠키 요청 순서·개인 캐시·늦은 응답·운영 Mock 제외를 실행 증거와 대조했다. 실제 보안/제공자 검증을 대체하지 않으므로 Draft로 전달한다.

### 남은 일·다음 작업 하나

- **실제 API/Google/DB 미검증:** 이 체크아웃에는 API `.env`와 실행 서버가 없고 실제 Google 설정·동의 세션도 없다. APP_ORIGIN·같은 Origin proxy/rewrite·Google 콘솔 콜백, 실제 HttpOnly/Secure/SameSite 쿠키·동의 취소·계정 재로그인·동일 이메일 분리는 실환경에서 확인해야 한다. Mock/모의 HTTP 결과를 실제 연결 완료로 표시하지 않는다.
- D01 프로필 완료 판정·D05 팀 결정과 기존 1-A 이메일 가입 정책 충돌은 유지한다. **1-B 클라이언트/Mock 범위까지 완료이며 실제 Google 연동 전체·1단계 전체 완료가 아니다.** 프로필·패키지와 단계 통합 완료 조건은 남아 있어 1단계 전체 통합 검증을 완료로 표시하지 않는다. 이번 Google 기능 묶음의 연속 흐름은 위 E2E로 확인했다.
- 카카오 AUTH-06: **미착수**. 백엔드/shared의 기존 정의만 보존하며 프론트 버튼·카카오 신규 가입은 연결하지 않았다.
- 다음 작업 하나: **1-B 실제 Google 동의·콜백·계정 상태 검증**. 서버/Google 콘솔/팀 승인 준비 후 별도 요청으로 진행한다. 이번에는 자동 착수하지 않는다.

### Git 전달 상태

- 기존 Google 백엔드 PR #14는 참고 계약이며 이번 프론트 PR이 아니다. 기존 1-B 브랜치/PR 없음 확인 후 1-A Draft PR #35의 `c9a78e0`에서 `feat/frontend-1b-google-auth`를 만들었다. 1-A가 아직 열려 있어 새 PR의 base도 해당 브랜치로 두어 이번 Google 변경만 검토한다.
- 커밋·푸시·Draft PR과 해당 SHA의 원격 CI는 아래 전달 기록에 추가한다. 로컬 검사 성공은 원격 CI 성공을 뜻하지 않는다.
