# KEMI 프론트엔드 진행 기록

갱신: 2026-10-24 · 현재: 0-A·0-B·0-C 완료. 1-A 이메일·1-B Google·1-C 프로필·1-D 패키지/대표/서비스 공개/작업물과 2-A 캠페인 작성·임시 저장·공개, 2-B 선택 AI 분석·명시 예산 반영과 2-C 모집 목록·검색·상세·마감 및 2-D 제안·후보·협의·텍스트 채팅의 클라이언트·명시적 Mock 구현 및 각 묶음 통합 검증 완료. 실제 API/DB/파일 저장·외부 제공자 검증과 정책 조율은 남음. 카카오 미착수. 0단계·1단계·2단계 전체 완료 아님.

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

**2-C 제품 분야·상태 필터·마감 후 공개 권한·자동 마감/알림 API 계약 조율:** 실제 목록·상세·마감 연결 조건을 합의한다. 별도 요청 후 착수한다. 기존 0-D·인증/소셜·프로필·1-D 실환경/정책 검증은 여전히 미완료다.

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
- 계약·세션/단위 검사 [377eacc](https://github.com/Jubileekim/KEMI/commit/377eacc), 화면·Mock·E2E·문서 [a408d94](https://github.com/Jubileekim/KEMI/commit/a408d94)를 푸시했다. 로컬과 원격 SHA 일치, 작업 트리 clean 확인. 기존 제한 fetch 설정에는 이번 브랜치 추적 항목만 추가했다.
- [Draft PR #36](https://github.com/Jubileekim/KEMI/pull/36) 생성·이 채팅 연결 완료. base `feat/frontend-1a-email-auth`, 선행 PR #35 병합 후 재지정 검토 필요. 실제 API/Google·D01/D05 검증 경계 때문에 Draft 유지. 병합/자동 병합/배포 없음.
- **원격 Web CI:** 기능 커밋 `a408d94fd9787cc51aedbbb3d4ade789094c209c`의 [run 83](https://github.com/Jubileekim/KEMI/actions/runs/39968996079) **success**. Ubuntu/Node 24에서 npm ci·형식·단위 59개·타입/린트/빌드·Chromium 데스크톱/모바일 **64/64**·report 업로드 성공을 확인했다. 로컬 Edge 64/64와 구분하는 별도 증거다. API CI/DB/Google 실연동 성공을 뜻하지 않는다.
- 위 링크와 원격 결과를 기록하는 최종 전달 커밋은 이 문서만 변경하며 소스·테스트는 검증한 `a408d94`와 같다. 문서 형식/공백 검사 후 푸시한다. 이 문서 커밋의 새 CI는 PR Checks에서 최신 SHA별로 확인하며, 기능 커밋의 성공으로 최신 실행을 통과 처리하지 않는다.

## 1-C 의뢰인·크리에이터 프로필 편집 (2026-10-23~24)

### 완료 범위·변경 파일

- 지정 Git 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`의 npm workspace `apps/web` 기준. **PROFILE-01·02 클라이언트/Mock 범위**다. 기능 엑셀 해당 행·P02/D01, 기술 PDF·수정 계획 1단계·기능별 API 대조·현재 shared와 API 구현을 확인했다. 상위 독립 앱은 수정하지 않았다.
- `/me/profile`에 두 역할의 조회·선택 입력·변경 취소·부분 저장·로딩/오류/명시적 재시도를 연결했다. 의뢰인은 표시 이름만 변경해도 저장 가능하며 브랜드 정보는 모두 선택이다. 이메일·배송지 편집/표시·타인 ID 입력은 없다. 캠페인 공개/직접 의뢰 기능 자체는 이번에 구현하거나 검증하지 않았다.
- 크리에이터는 소개·분야·복수 스타일/제작 역할·작업 방식·현재 shared의 작업 가능 여부/날짜를 미완성 저장한다. 서버 응답의 초안/공개/비공개만 표시하고 공개 제어를 추가하지 않았다. `serviceStatus`·다른 역할 필드·Mock 추가 정보는 PATCH에서 제외한다.
- shared 검증으로 공백·삭제/null·빈 배열·선택지/날짜를 처리한다. 서버가 반환한 정규화 값으로 폼과 계정별 Query 캐시를 갱신한다. 편집 중 자동 재조회는 끄고, 저장 실패 입력 보존·중복 제출 차단·불명확한 저장 결과의 명시적 최신 값 조회를 제공한다. 기존 세션 epoch·취소·로그아웃 캐시 제거·쓰기 자동 재전송 금지를 유지한다.
- 신규: `apps/web/src/features/profiles/{api,contracts}.ts`, `{ProfilePage,ProfileForm}.tsx`; `src/mocks/{profile-handlers.ts,ProfileExtrasMock.tsx}`; `test/profiles.test.ts`, `e2e/profiles.spec.ts`; `docs/frontend-profile-1c.md`; `qa/frontend-1c/{README.md,production-smoke.cjs,production-results.json,profile-{client,creator}-{390,1280}.png}`.
- 연결 수정: `apps/web/src/app/{App.tsx,layouts/Shell.tsx}`, `src/mocks/{browser.ts,auth-handlers.ts,DevTools.tsx}`. `.github/workflows/web-ci.yml`은 기존 검사 절차를 유지하고 stacked PR의 base 브랜치만 추가했다. API/shared·DB·의존성/lockfile·브랜드 원본/복사 토큰은 변경하지 않았다.
- 계약 없는 로고·이미지·경력·크리에이터 링크는 **개발 전용 Mock 미리보기**로 분리했다. 기본 프로필 저장과 별개이며 프로필 화면 이동/새로고침/로그아웃 시 폐기한다. 이미지 bytes는 업로드하지 않고 blob URL을 해제한다. PNG/JPEG/WebP는 이 미리보기의 지원 형식이며 실제 파일 정책으로 확정하지 않는다.

### 로컬 검증

- `npm run test:web`: **70/70** 통과(기존 59개 + 프로필 11개). shared 정책·부분 PATCH·선택값 삭제·URL/이름/길이/날짜/중복·역할/응답 검증·취소 signal·재전송 금지를 확인했다. 기존 인증 HTTP 검사는 `/api/profiles/me`의 만료·늦은 개인 응답 경계도 검사한다.
- `npm run build:web`(타입·ESLint 포함), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 토큰 검사 11개 타입 역할·16개 대비·6개 재생성 PASS. 신규 의존성 설치 없음.
- 최종 전체 Playwright **92/92 통과, 종료 코드 0**. 기존 64개 + 프로필 28개이며 로그인→역할별 저장→재조회, 선택값 삭제·만료 쓰기 재전송 금지·로그아웃 뒤 늦은 저장 응답·오류/재시도·개인 캐시·Mock 분리·반응형을 검사했다. 프로필 전용 초기 실행은 데스크톱/모바일 24개 테스트가 모두 통과했으나 Windows 개발 서버 종료 대기가 이어졌다. 같은 작업 소유 서버에 무시되는 `tmp/playwright.profile.config.ts`의 `webServer: undefined`로 전체를 별도 실행했다. 정식 CI의 Chromium/프로젝트/자동 재시도/타임아웃은 유지했다.
- 운영 빌드+**Playwright 모의 HTTP smoke 9개 통과, 페이지 오류 0**. 두 역할 Bearer/부분 PATCH·응답 반영·키보드·재조회/새로고침·오류 입력 보존·최신 값 확인, PUBLIC 유지·운영 Mock/worker/추가 정보/개인 이메일 비노출 확인. `production-results.json` 및 QA README 참조. HTTP fixture가 메모리로 보관한 저장값이며 실제 DB 지속성 증거가 아니다.
- 390/1280px의 두 역할 캡처를 시각 검토했다. 프로필 E2E에서 320/390/600/768/1024/1280px 가로 넘침을 확인한다. 스크린리더 낭독·브라우저 메뉴 200% 확대·다른 브라우저는 미검증이다.
- 중간 실패: 신규 코드/검사의 기존 ESLint(라벨 연결·중첩 조건·순차 반복·effect 상태 갱신) 위반을 수정했다. 테스트 반복을 바꾸는 과정의 문법 오류를 수정한 뒤 타입/린트/빌드/단위를 다시 통과했다. 검사 규칙 완화/자동 재시도는 추가하지 않았다.
- 최종 자체 검토는 명세·코드·보안 축으로 분리했다. 본인 경로·역할별 allowlist·서버 응답 검증·개인 캐시/지연 응답·오류 메시지·URL/이미지·운영 Mock 제외를 코드와 실행 증거로 대조했다. 사용자 입력을 HTML로 삽입하지 않고, 선택 링크를 자동 열지 않는다. 실제 서버 권한 검증을 대체하지 않는다.

### 남은 일·다음 작업 하나

- **실제 API/DB 미검증:** 이 체크아웃에 API `.env`/실행 서버가 없다. 기존 `VITE_ENABLE_AUTH_API=true`에서 실제 프로필 어댑터를 켤 수 있으나 Origin/쿠키·실계정·DB 저장·권한 검증은 별도 환경에서 필요하다. 개발 MSW와 운영 모의 HTTP는 실연동 증거가 아니다. 외부 제공자 검증도 이번에 실행하지 않았다.
- **로고·이미지·경력·크리에이터 링크 실제 저장 미연결:** 현재 API/shared에 해당 계약이 없어 Mock으로만 제공했다. 파일 업로드/프로필 연결·삭제·공개 범위와 경력/링크 계약이 필요하다. 실제 모드는 준비 중 안내를 표시한다.
- D01 완료/공개 필수 조건·D21 분야/스타일 확정은 보류. 개인 의뢰인의 브랜드 선택은 P02 확정대로 유지한다. D01을 추정해 가입 후 자동 완료 판정/이동을 만들지 않았다. 기존 D05·이메일 가입 정책 충돌도 유지한다.
- 1-C 클라이언트/Mock 검증이며 **실제 프로필 기능 전체·1단계 전체 완료가 아니다**. 카카오·패키지·포트폴리오·공개 제어가 남아 1단계 전체 통합 완료로 표시하지 않는다. 이번 기능 묶음의 로그인→역할별 저장→재조회만 통합 확인한다.
- 다음 작업 하나: **1-C 프로필 API 실환경 검증 및 누락 선택정보 계약 조율**. 준비된 API/DB에서 두 역할 저장·재조회·권한을 확인하고 추가 정보의 저장 계약을 합의한다. 자동 착수하지 않는다. PR 병합·자동 병합·배포 없음.

### Git 전달 상태

- 기존 1-C 프론트 브랜치/PR 없음 확인. 백엔드 프로필 PR #13은 참고 계약이며 이번 프론트 PR이 아니다. 열린 1-B Draft PR #36의 `9734384`에서 `feat/frontend-1c-profiles` 생성. PR base는 `feat/frontend-1b-google-auth`로 두어 1-C만 검토하며 선행 PR 병합 뒤 재지정 검토가 필요하다.
- 계약·단위 검사 [b0c0367](https://github.com/Jubileekim/KEMI/commit/b0c0367), 화면·Mock·E2E·QA·진행 기록 [39c00d4](https://github.com/Jubileekim/KEMI/commit/39c00d4)를 푸시했다. 제한된 기존 fetch 목록에 이번 브랜치만 추가하고 원격/로컬 SHA 일치를 확인했다.
- [Draft PR #37](https://github.com/Jubileekim/KEMI/pull/37) 생성·이 채팅 연결 완료. base `feat/frontend-1b-google-auth`. 실제 API/DB와 누락 선택정보 계약·미결정 경계 때문에 Draft로 전달한다. 병합/자동 병합/배포 없음.
- 초기 24개 프로필 테스트의 서버 종료 대기는 작업 소유 프로세스만 경로·포트·PID로 확인 후 수동 정리했다(초기 러너 종료 코드 1). 이후 완료한 최종 전체 **92/92·종료 코드 0**과 구분한다. 사용한 5179 테스트/4183 preview 서버도 종료했다.
- **별도 Vercel 상태:** 기존 GitHub 연동이 커밋 작성자의 Vercel 프로젝트 접근 권한 부족으로 `failure`를 보고했다. Web CI 결과와 별도이며 코드 빌드/테스트 실패나 배포 성공으로 해석하지 않는다. 배포/권한 변경은 실행하지 않았다.
- **원격 Web CI:** 기능 커밋 `39c00d45155c5f57cb5fe24bb6dcb0c42f26c149`의 [run 85](https://github.com/Jubileekim/KEMI/actions/runs/39973660712) **success**. Ubuntu/Node 24에서 npm ci·형식·단위 **70/70**·타입/ESLint/빌드·Chromium 설치·데스크톱/모바일 **92/92**·report 업로드 성공과 실제 job 로그를 확인했다. 로컬 Edge 92/92와 구분하는 별도 증거다. API CI/실서버·DB·외부 제공자 검증 결과가 아니다.
- 위 원격 결과·커밋/PR 링크를 기록하는 최종 전달 커밋은 이 문서만 변경한다. 소스·검사는 검증한 `39c00d4`와 동일하다. 문서 형식/공백 검사를 수행한 뒤 푸시하며 해당 SHA의 새 CI는 PR Checks에서 별도로 확인한다. 기능 SHA의 성공으로 새 실행을 통과 처리하지 않는다.

## 1-D-A 패키지·대표 지정·서비스 공개 (2026-10-24)

### 완료 범위·변경 파일

- 지정 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`의 `apps/web`에서 PACK-01~03·PROFILE-03/04의 **명시적 클라이언트/Mock** 구현. 기능 엑셀 해당 행과 P04/P05·D01/D03, 기술 PDF·계획 1단계·API 대조·현재 API/shared·KEMI 디자인을 확인했다. 상위 독립 앱은 수정하지 않았다.
- 여러 독립 상품의 초안/공개 저장·조건 조회·수정·비공개와 명시적 대표 단일 지정, 별도 서비스 공개/비공개를 구현했다. 공개 후보는 조건 누락·숫자·상업 광고 활용을 검사한다. 미완성 저장을 허용하고 상품 저장으로 대표/서비스를 자동 지정하지 않는다. 패키지는 협의 출발점이며 옵션 구매를 추가하지 않았다.
- D01은 UNKNOWN/READY/MISSING 모의 결과만 사용한다. 실제 필수 프로필을 임의로 정하지 않는다. P04 공개 대표가 필요하고 작업물은 필수가 아니다. 공개 서비스의 대표 비공개는 다른 대표 지정 또는 서비스 명시적 비공개를 먼저 안내한다. 마지막 상품과 서비스 자동 연동 D03은 미확정으로 유지한다.
- 계정별 Query·모듈 메모리·revision 명령으로 저장/충돌/지연 응답을 처리한다. 오류 입력 보존·명시적 최신 조회·중복 제출 차단·쓰기 자동 재시도 없음·epoch 확인을 유지한다. 최신 조회 실패도 기존 폼을 보존한다. 기존 프로필의 Mock 상태 표시와 일치시켰다.
- 신규: `apps/web/src/features/packages/PackagesPage.tsx`, `src/mocks/{studio-model,studio-api,studio-handlers}.ts`, `src/mocks/{StudioMock,PackageEditorMock}.tsx`, `test/studio-packages.test.ts`, `e2e/studio-packages.spec.ts`, `docs/frontend-studio-1d.md`, `qa/frontend-1d/{README.md,capture.cjs,production-smoke.cjs,production-results.json,package-{editor,list}-{390,1280}.png}`.
- 연결 수정: `src/app/{App.tsx,layouts/Shell.tsx}`, `src/mocks/{browser,profile-handlers}.ts`; Web CI의 기존 절차를 유지하고 stacked base `feat/frontend-1c-profiles`만 허용했다. API/shared·DB·의존성/lockfile·브랜드 원본/토큰 변경 없음.

### 로컬 검증과 검토

- `npm run test:web`: **82/82** (기존 70 + 후보 모델 12). 여러 상품·빈 초안·숫자/상업 조건·대표 단일성·미공개 차단·D01·수동 비공개·모의 계약 참조 불변을 확인했다.
- `npm run build:web` (타입·기존 ESLint 포함), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 11개 타입 역할·16개 대비·6개 재생성 유지.
- 패키지 전용 Edge 데스크톱/모바일 E2E **18/18, 종료 코드 0**. 로그인→초안/다중 상품→대표→모의 공개→가격 변경→비공개→프로필 상태 일치, 오류 401/403/409/500/network/malformed 입력 보존·재시도, revision 충돌·권한·지연/중복/로그아웃·320/390/600/768/1024/1280px 넘침 확인.
- 운영 빌드에 AUTH_API/MOCK 플래그를 켜도 Mock 코드/엔드포인트/worker 제외. 독립 모의 HTTP 인증 smoke **3개 통과, 페이지 오류 0**: 산출물 제외·CREATOR 준비 안내·CLIENT 차단·미정의 기능 쓰기/Mock 요청 없음. 실제 API 검증이 아니다.
- 390/1280px 편집/목록 캡처 4개 생성, 모바일 편집·데스크톱 목록을 시각 확인했다. 큰 화면/작은 화면 가로 넘침은 브라우저로 확인했다. 스크린리더·브라우저 메뉴 200% 확대·다른 브라우저는 미검증.
- 명세·코드 품질·보안 축의 자체 검토와 대표 비밀값 패턴 검사를 수행했다. UI 가드와 별개로 Mock 계정/역할·버전·늦은 응답을 실행 검증했다. 실제 서버 권한/원자성·다중 탭 경쟁 검증을 대체하지 않는다.
- 중간 실패: 기존 lint 라벨/선언 규칙·unknown JSX 타입을 수정하고 빌드 재통과. D01 오류가 공통 문구로 숨겨져 화면 사전 검사를 추가했다. 의뢰인 로그인 완료 전 이동하는 신규 E2E 경쟁을 수정했다. 초기 겹친 별도 러너의 trace ENOENT와 1회 초기 탐색 타임아웃 뒤 전용 검사를 단독 실행해 18/18을 확인했다. 검사 완화/자동 재시도 추가 없음.
- 기존 전체 110개 회귀 검사는 공용 shared 빌드와 실행이 겹쳤고 프로필 성공 문구 검사 실패가 발생했다. trace에서 중간 페이지 재로드·refresh/me/프로필 재조회가 확인됐다. 이후 아래 1-D-B에서 소스/빌드 변경 없이 단독 전체 **124/124**를 통과해 해소했다. 최초 실패와 최종 통과를 구분한다.

### 남은 일·Git 전달

- 실제 API·DB·권한·서비스 공개/탐색/신규 활동·계약 보존 미검증. 7개 기능의 API 정의가 없어서 가상 `/__mock__/studio`로만 동작한다. 모의 계약 참조는 별도 테스트 복사본이며 실제 계약/제안 보존 구현이 아니다. 기존 API `.env`/실행 서버도 없다. D01/D03·기존 인증/외부 제공자 경계는 유지한다.
- 이 묶음 전달 시 작업물 PORT-01/02와 최종 통합은 미완료였으며, 이후 결과는 아래 1-D-B에 기록한다. **1단계 전체 완료는 아니다.** 다음 외부 작업·병합/자동 병합/배포는 실행하지 않는다.
- 기존 1-D 브랜치/PR 없음 확인 후 열린 1-C Draft #37의 `ff71bab`에서 `feat/frontend-1d-packages`를 생성했다. 기능 커밋·푸시·Draft PR 링크와 원격 CI는 생성 후 기록한다. 로컬 결과를 원격 CI 통과로 표시하지 않는다.

## 1-D-B 작업물 관리 및 1-D 통합 (2026-10-24)

### 완료 범위·변경 파일

- **1-D의 7개 기능 클라이언트/명시적 Mock 범위 완료:** PACK-01~03·PROFILE-03/04에 더해 PORT-01/02 작업물 등록·초안/공개 후보 저장·수정·비공개·삭제를 연결했다. 실제 API/shared에 동작 계약이 없어 전체를 개발 전용으로 유지하며 운영은 계약 준비 안내를 보여 준다.
- 작업물의 제목·영상·설명·본인 역할·스타일/유형·자작 샘플/외부 고객/플랫폼 작업·출처·권한·고객 동의를 편집한다. 자작 샘플에 거래 이력/후기를 요구하지 않는다. 고객/플랫폼 작업은 동의 없이 공개 후보로 저장되지 않으며 거래물을 자동 가져오지 않는다. 서비스와 작업물이 모두 공개일 때만 모의 노출 목록에 표시한다.
- **파일 선택→로컬 재생 미리보기→명시적 Mock 업로드 완료→작업물 저장**을 분리했다. MIME/0바이트/50MiB 임시 보호·재생 준비 실패를 검사하고 blob URL을 변경/취소/화면 종료 때 해제한다. 파일 bytes는 전송하지 않으며 메타데이터만 탭 메모리에 저장한다. 편집 재진입은 메타데이터만 표시하고 재생하려면 파일 재선택을 안내한다. 실제 업로드·재생 제공자·파일 저장 완료가 아니다.
- 외부 URL은 자격 정보 없는 https 형식의 초안만 허용한다. D02 허용 제공자·공개/재생 정책을 임의 확정하지 않아 URL 공개·임베드·외부 요청은 미연결이다. D21 스타일/유형은 임시 자유 입력으로 표시하고 본인 역할은 기존 shared 선택지를 쓴다.
- 삭제 대상·영향 모달, 취소/Escape·처리 중·실패/명시적 재시도·포커스 복귀를 제공한다. 성공 시 내 목록과 모의 공개 후보에서 제외한다. 별도 복사한 **모의 제출 메타데이터 참조**는 수정·비공개·삭제 뒤에도 유지한다. 실제 제출 파일 bytes·계약 증빙 보존 방식은 D02 미결정이다.
- 신규 소스: `apps/web/src/features/portfolio/PortfolioPage.tsx`, `src/mocks/{portfolio-model.ts,WorkEditorMock.tsx,PortfolioManagerMock.tsx}`, `src/shared/files/{FileUpload.tsx,local-preview.ts}`.
- 신규 검사·QA: `apps/web/test/studio-portfolio.test.ts`, `e2e/{studio-helpers.ts,studio-portfolio.spec.ts,fixtures/README.md,fixtures/local-preview.webm}`, `qa/frontend-1d/{capture-portfolio.cjs,create-video-fixture.cjs,portfolio-{editor,delete}-{390,1280}.png}`. 1,349바이트 무음 녹색 영상은 자체 생성 테스트 fixture이며 출처·SHA·재생성 방법을 기록했다. 외부/사용자 영상과 불필요한 대형 산출물을 포함하지 않는다.
- 연결 수정: `src/app/{App.tsx,layouts/Shell.tsx}`, `src/mocks/{StudioMock.tsx,studio-model.ts}`, `.github/workflows/web-ci.yml`의 이번 stacked base 허용, `docs/frontend-studio-1d.md`, 이 진행 기록, `qa/frontend-1d/{README.md,production-smoke.cjs,production-results.json}`. API/shared·DB·의존성/lockfile·브랜드 원본·토큰·기존 검사 규칙/명령은 변경하지 않았다.

### 최종 로컬 검증·통합 결과

- `npm run test:web`: **94/94** (기존 70 + 패키지 12 + 작업물 12). 공개/초안·역할/권한/동의·URL/파일 보호·대표/서비스 조건·상품/작업물 변경 후 별도 모의 참조 보존을 검사했다.
- `npm run build:web`의 타입·ESLint·운영 빌드, `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 11개 타입 역할·16개 대비·6개 재생성 결과 유지. 운영 검사 빌드는 AUTH_API/MOCK 플래그를 모두 켜서 생성했다.
- 작업물 전용 Edge 데스크톱/모바일 **14/14, 종료 코드 0** 이후 최종 전체 **124/124, 종료 코드 0**. 최종은 기존 인증/프로필 92 + 패키지 18 + 작업물/통합 14개이며 검사 중 소스 편집·shared 빌드·중복 러너 없이 단독 실행했다. 이전 shared 재빌드 중 페이지 재로드로 실패한 프로필 두 항목도 최종 통과했다. 정식 CI의 Chromium·재시도 0·타임아웃·검사 명령을 바꾸지 않았다.
- **1-D 통합 Mock 흐름:** 로그인→프로필 저장(자동 공개 안 됨)→패키지 공개 저장→명시적 대표 지정→D01 모의 충족→서비스 공개→개인 샘플 파일 선택/실제 로컬 재생/모의 완료→공개 후보 저장→서비스 비공개→노출 제외·패키지 상태 재조회. 포트폴리오 없이 서비스 공개가 가능함도 패키지 흐름에서 확인했다. 실제 탐색·직접 의뢰/제안·기존 거래 API 흐름을 검증한 것은 아니다.
- 파일 형식/재생 실패·URL 외부 요청 없음·blob 해제·삭제 실패/재시도·취소/Escape/포커스 복귀·공개 목록 제외·제출 참조 보존, 조회 실패에도 입력 유지, 320/390/600/768/1024/1280px 가로 넘침을 확인했다.
- 운영 빌드+독립 모의 HTTP smoke **5개 통과, 페이지 오류 0**. 산출물의 Mock/worker/전용 경로 제외, CREATOR의 두 준비 화면·CLIENT의 두 권한 차단, 미정의 기능 쓰기/Mock 요청/worker 없음. HTTP 인증 fixture이며 실제 API 검증이 아니다.
- 작업물 편집/삭제 모달 390/1280px 캡처 4개를 생성했고 데스크톱 편집·모바일 모달을 시각 검토했다. 모달 캡처는 애니메이션 완료 뒤 촬영했다. 패키지 캡처/반응형과 KEMI 색상·카드·여백을 유지한다. 스크린리더·브라우저 메뉴 200% 확대·다른 브라우저는 미검증.
- 명세·코드 품질·보안·React 축의 최종 자체 검토: 개발 import 제외·본인 역할/계정·revision·epoch/캐시·로컬 파일 수명·원격 URL 요청 금지·오류·별도 참조를 코드와 실행 결과로 대조했다. 새 외부 의존성·비밀값·HTML 직접 삽입 없음. 실제 권한/DB·다중 탭 원자성·제공자 검증은 남는다.
- 중간 실패를 숨기지 않는다: RHF watch의 기존 React lint 경고를 useWatch로 수정했다. 위험 URL 테스트 표현·전역 참조 lint와 복수 오류 선택자를 수정했다. 브라우저 즉석 합성 영상의 빈 프레임/부정확한 MIME으로 초기 전용 검사 실패가 있어 native canplay로 확인한 유효 fixture로 바꿨다(재생성 시 디코딩 실패면 교체 금지). 두 번째 수정 중 러너는 중단했고, 이후 전용 14/14·최종 124/124를 통과했다. 공개/파일 검사를 완화하거나 자동 재시도를 추가하지 않았다.

### 남은 일·다음 작업 하나

- **실제 API·DB·파일 저장·외부 제공자 연동은 미검증/미연결.** 7개 동작의 API/버전/권한·서비스/대표 원자성·실제 공개 노출/신규 활동 차단·기존 거래/제출 당시 파일 보존 계약이 필요하다. Mock 단일 탭·로컬 영상·복사 메타데이터 결과를 실서버 보장으로 표시하지 않는다.
- D01 필수 프로필, D02 파일/외부 URL 및 삭제 후 보존, D03 대표/마지막 상품 자동 연동, D21 분류는 미결정으로 남는다. 현재 파일/문자/숫자 보호 한도는 Mock 후보 기준이며 팀 정책이 아니다. 기존 카카오 미착수·이메일 가입 충돌/D05·Google 실동의·프로필 누락 선택정보 저장 경계도 유지한다.
- **1-D 클라이언트/Mock 묶음의 통합 검증까지 완료이며 1단계 전체 완료는 아니다.** 다음 작업 하나: **1-D 누락 API와 공개·파일 정책 계약 조율**. 자동 착수하지 않는다. 병합·자동 병합 설정·배포 없음.

### Git 전달 상태

- 패키지·서비스: 모델/검사 [91c9620](https://github.com/Jubileekim/KEMI/commit/91c9620), UI/Mock/E2E/QA [566447a](https://github.com/Jubileekim/KEMI/commit/566447a)를 `feat/frontend-1d-packages`로 푸시. [Draft PR #38](https://github.com/Jubileekim/KEMI/pull/38), base `feat/frontend-1c-profiles`, 이 채팅 연결·원격/로컬 SHA 일치 확인. PR #37이 선행이다.
- 작업물: 기존 대응 원격 브랜치/PR 없음 확인 후 `566447a`에서 `feat/frontend-1d-portfolio` 생성. 모델·화면/검사/문서 커밋을 나눠 푸시하고 base를 `feat/frontend-1d-packages`로 둔 Draft PR로 전달한다. 링크와 최신 원격 상태는 생성 후 아래에 기록한다. 선행 PR 병합 후 base 재지정 검토가 필요하다.
- **원격 Web CI #38:** 기능 SHA `566447af0d543e2c05ef5b9394af5462b967979e`의 [run 87](https://github.com/Jubileekim/KEMI/actions/runs/39978492856) 첫 시도는 **브라우저 의존성 다운로드 중 10분 제한으로 cancelled**, E2E/report는 skipped. job 로그에서 Ubuntu azure 미러의 font/xserver 다운로드 지연을 확인했다. npm ci·형식·단위·타입/린트/빌드는 success다. 동일 검사를 한 번 재실행했으나 두 번째 시도도 의존성 다운로드/Chromium 설치가 10분 제한에 도달해 cancelled·E2E/report skipped로 끝났다. 두 job의 실제 로그를 확인했으며 추가 자동 재시도는 하지 않는다. 로컬 124/124와 별개이며 원격 통과로 기록하지 않는다. CI 명령·러너/타임아웃을 완화하지 않았다.
- 기존 GitHub 연결의 Vercel 상태는 별도 **failure**로 확인했다(작성자 프로젝트 초대/접근 화면). Web CI와 별개이며 빌드 실패/배포 성공 증거가 아니다. 권한/배포 설정을 변경하지 않았다.

- 작업물 모델/단위 [b8fd618](https://github.com/Jubileekim/KEMI/commit/b8fd618), 화면·Mock·검사·QA·기록 [01e7213](https://github.com/Jubileekim/KEMI/commit/01e7213)를 푸시했다. [Draft PR #39](https://github.com/Jubileekim/KEMI/pull/39), base `feat/frontend-1d-packages`, 이 채팅 연결 완료. 원격/로컬 SHA 일치와 미커밋 변경 없음(이 종료 기록 갱신 전)을 확인했다.
- **원격 Web CI #39:** 기능 SHA `01e72134ed500725e4109e8ded09eaf926072254`의 [run 88](https://github.com/Jubileekim/KEMI/actions/runs/39982279331)은 확인 시 npm ci·형식·단위·타입/린트/빌드 **success**, Chromium 설치 **in_progress**, 브라우저 E2E/report **pending**이다. 로컬 94/124/운영5 통과와 구분한다. 원격 E2E 최종 결과는 미검증이므로 Draft를 유지한다. #38의 반복 설치 시간 제한과 같은 환경 구간이다.
- 마지막 링크·CI 경계 갱신은 **이 문서만 바꾸는 별도 전달 커밋**으로 푸시한다. 소스·테스트는 검증한 `01e7213`와 같고 형식/공백을 다시 확인한다. 동일 PR의 `cancel-in-progress` 설정 때문에 새 SHA 푸시 시 기능 SHA의 실행이 교체될 수 있다. 최신 문서 SHA의 Web CI는 [PR #39 Checks](https://github.com/Jubileekim/KEMI/pull/39/checks)에서 별도로 확인하며 기능 SHA의 부분 성공으로 최신 CI를 통과 처리하지 않는다. 실제 API CI·DB·제공자 검증 성공을 뜻하지 않는다.
- 두 PR은 모두 Draft·미병합이며 자동 병합 설정·배포·다음 범위 착수 없음. 작업 소유 5180 개발/4184 preview 서버를 종료했고 해당 포트의 listener 없음도 확인했다.

- **Vercel 추가 경계:** 최종 문서 SHA의 GitHub Vercel 상태도 failure이며 대상은 기존 프로젝트의 실행 링크다. #38의 초대 화면과 같은 실패 원인이라고 단정하지 않는다. 연결된 Vercel 도구로 해당 팀/프로젝트·SHA를 읽기 전용 조회했으나 팀 범위 권한 없음 **403**으로 원인 로그를 확인하지 못했다. 이 결과는 배포 원인 미검증이며 Web CI/로컬 빌드 실패를 뜻하지 않는다. 팀 접근 승인·권한/자동 배포 설정 변경·새 배포·재배포는 이번 범위에서 실행하지 않았다.

## 2-A 캠페인 작성·임시 저장·공개 (2026-10-24)

### 구현과 변경 파일

- **CAMP-01/02의 클라이언트·명시적 Mock 범위.** `/campaigns/new`, `/campaigns/:campaignId/edit`에 제목·제품/서비스·목적·작업 범위·예산·선택 참고 텍스트, 불완전 비공개 초안 저장·본인 목록·재편집·명시적 공개 확인을 연결했다. 개인 의뢰인에게 브랜드 프로필을 요구하지 않는다. 공개 후 편집/삭제·AI·탐색/상세·제안·마감 상태 전이는 이번 범위 밖이다.
- P06의 3/7/14일·기본7일을 적용한다. 저장 시각 대신 모의 공개 처리 시각을 사용하고 같은 시각에 마감, 한국 시간으로 표시한다. 동일 ID의 중복 공개는 내용·최초 공개/마감 시각을 유지한다. 응답 유실은 성공으로 표시하지 않고 최신 값 확인→공개 결과 확인으로 조회한다.
- 엑셀 CAMP-01/02·P06·D04, 기술 PDF, 계획 2단계, 기능표 해당 행과 로컬 API/shared를 대조했다. 기존 POST는 즉시 OPEN이며 초안/별도 공개/제품·작업 범위·참고 자료/공개 기준 일수 계약이 없다. `/__mock__/campaigns`로 분리하고 운영은 계약 준비 안내만 표시한다. D04 필수값·4,000자·양의 안전한 정수 예산은 **Mock 후보/입력 보호 기준**으로 표시하며 팀 정책을 확정하지 않는다.
- 폼·진입: `apps/web/src/features/campaigns/CampaignEditor.tsx`, `src/app/{App.tsx,layouts/Shell.tsx}`. 개발 전용 모델/통신/handler/화면: `src/mocks/{campaign-model.ts,campaign-api.ts,campaign-handlers.ts,CampaignMock.tsx,CampaignFormMock.tsx,browser.ts}`.
- 검사·근거: `apps/web/test/campaigns.test.ts`, `apps/web/e2e/campaigns.spec.ts`, `docs/frontend-campaigns-2a.md`, 이 진행 기록, `qa/frontend-2a/{README.md,capture.cjs,production-smoke.cjs,production-results.json,editor-390.png,editor-1280.png,confirm-390.png,confirm-1280.png}`. `.github/workflows/web-ci.yml`에는 stacked base `feat/frontend-1d-portfolio`만 추가했다. 기존 검사 명령·재시도·시간 제한을 유지한다.
- API/shared·DB·의존성/lockfile·원본 엑셀/PDF·계획/기능표·브랜드/디자인 토큰은 변경하지 않았다. 탭 내 메모리 저장이며 전체 새로고침하면 초기화된다. 파일/외부 URL 요청·영구 저장은 미연결이다.

### 로컬 검증과 검토

- `npm run test:web`: **104/104** (기존94 + 캠페인10). 빈 초안/재편집·노출 제외·브랜드 없이 공개·D04 후보 오류·3/7/14일/연말/월말/KST·공개 처리 시각·멱등 공개·역할/소유권/비활성·revision·입력 한도를 확인했다.
- `npm run build:web`(타입·기존 ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 토큰 검사 11개 타입 역할·16개 대비·6개 재생성 결과 유지. 운영 빌드는 AUTH_API/MOCK 플래그를 모두 켠 조건으로 생성했다.
- 전체 Edge 데스크톱/모바일 **146/146, 종료 코드0**. 기존124 + 캠페인22이며 6.0분 실행했다. 2-A 통합은 로그인→불완전 비공개 저장→본인 목록→재편집→누락 검사→공개 확인/취소/Escape/포커스 복귀→브랜드 없이 공개→한국 시간 마감→재조회다. 실패 입력 보존·응답 유실 후 결과 조회·중복 공개 시 내용/마감 유지·revision·비회원/크리에이터 차단·지연 로그아웃 쓰기/캐시 차단·임의 초안ID·외부 참고 URL 요청 없음·320/390/600/768/1024/1280px 넘침 없음도 확인했다. 정식 CI Chromium과 구분하며 로컬 임시 config로 Edge/5182만 지정, 소스·shared 빌드 변경 없이 단일 러너로 실행했다.
- 독립 운영 모의 HTTP smoke **5개 통과·페이지 오류0**: 운영 산출물의 캠페인 Mock/worker 제외, CLIENT의 작성/재편집 준비 안내와 CREATOR 권한 차단, 제품 API 요청·Mock 요청·worker 없음. 실제 서버/제공자 검증이 아니다.
- 390/1280px 편집·공개 확인창 캡처4개를 생성하고 모두 시각 확인했다. KEMI 로고·색상·버튼·카드·여백을 유지한다. 스크린리더/브라우저 메뉴 200% 확대/다른 브라우저는 미검증이다.
- 명세·코드·보안·React 자체 검토: DEV 지연 import·운영 제외, Bearer/본인/역할/ACTIVE와 요청 전후 epoch·지연 계정 변경, 캐시 키/취소·자동 재시도 없음·입력 보존, 외부 URL은 텍스트만, React 이스케이프, 의존성/비밀값 추가 없음 확인. 실제 보안/DB 원자성은 검증하지 않았다.
- 중간 실패: 중첩 삼항·E2E 반복문의 기존 lint 규칙 위반을 규칙 변경 없이 수정했다. 첫 캠페인 전용 실행은20/22로, 크리에이터 로그인 시 안전한 기본 복귀 동작을 잘못 예상한 두 검사가 실패했다. 기본 이동 후 캠페인 직접 진입 차단을 검사하도록 수정했으며 최종146/146에서 통과했다. 실패를 숨기거나 권한 가드·검사·재시도 기준을 완화하지 않았다.

### 남은 일·다음 작업 하나·Git 전달

- **실제 API·DB·공개 목록·외부 제공자 연동은 미연결/미검증.** 초안/재편집·멱등 공개·P06·필드/권한/버전 계약이 필요하다. 단일 탭 MSW 결과를 영구 저장·다중 탭·실서버 원자성 보장으로 표시하지 않는다. D04·파일/참고 자료 저장 정책은 미결정이다.
- 이번 2-A 통합 Mock 흐름만 검증하며 **2단계 전체 완료가 아니다.** 다음 작업 하나는 **2-A 초안·공개 API와 D04 입력 정책 계약 조율**이다. 다음 범위 자동 착수·병합·자동 병합 설정·명시적 배포/재배포는 하지 않는다.
- 기존 대응 브랜치/PR 없음·작업 트리 깨끗함을 확인하고 #39 최신 `ae65867`에서 `feat/frontend-2a-campaigns`를 만들었다. 모델/단위/계약 경계 [6a382b1](https://github.com/Jubileekim/KEMI/commit/6a382b1), 화면/Mock/검사/기록 [4566c1a](https://github.com/Jubileekim/KEMI/commit/4566c1a) 푸시 완료. [Draft PR #40](https://github.com/Jubileekim/KEMI/pull/40)을 이 채팅에 연결했다. base는 `feat/frontend-1d-portfolio`이며 #39가 선행이다. PR의 원격 head와 로컬 기능 SHA가 일치함을 확인했다. 선행 PR 병합 후 base 조정 검토가 필요하다.
- **원격 Web CI:** 기능 SHA `4566c1a25325f30a44c3dda117d8abe2928d4b79`의 [run91](https://github.com/Jubileekim/KEMI/actions/runs/40039317360)은 확인 시 checkout·Node 설정 success, npm ci in_progress, 형식/단위/빌드/Chromium/E2E pending이었다. 로컬104/146/운영5 결과와 별개이며 원격 최종 통과로 기록하지 않는다. 최종 링크·결과 기록은 문서만 바꾸는 별도 전달 커밋으로 푸시하므로 cancel-in-progress에 의해 실행이 교체될 수 있다. **최신 문서 SHA의 원격 CI 최종 결과는 미검증**이며 [PR #40 Checks](https://github.com/Jubileekim/KEMI/pull/40/checks)에서 확인한다. Draft를 유지하고 CI 설정/검사/시간 제한을 완화하거나 재실행하지 않는다.
- **기존 Vercel 연결 상태:** 기능 SHA의 상태가 failure이며 GitHub status 설명은 `Git author Dev-Yuncheol must have access to the project on Vercel to create deployments.`다. Web CI/로컬 빌드와 다른 접근 권한 문제이며 배포 성공 증거가 아니다. 초대·권한/배포 설정 변경·배포/재배포 명령은 실행하지 않았다. 푸시/PR로 발생한 연결 서비스 검사는 직접 실행한 배포와 구분한다.

## 2-B 선택 AI 분석·명시적 예산 반영 (2026-10-24)

### 구현·변경 파일

- **AI-01/02·P20의 클라이언트/명시적 Mock 범위.** 2-A 작성·초안 재편집 안에서 예산 없이도 제작 조건을 선택 분석하고, 항목·소계/합계·산정 이유·가정·누락 안내를 확인한다. 분석 생성은 예산을 바꾸지 않는다. 반영액을 확인·조정하고 명시 적용해야 예산 입력이 바뀌며 저장·공개는 별도다. 이후 수동 수정도 가능하다.
- 제작 조건/설명 변경·지연 응답은 이전 리포트 반영을 차단한다. 구조·항목 계산·합계·입력 일치 검사를 통과한 결과만 반영한다. 취소·권한·429·503·네트워크·형식 오류에도 수동 예산/공개가 가능하다. 화면 이탈/로그아웃 시 취소·epoch로 늦은 결과를 차단한다. 자동 재시도 없음.
- 마지막 명시 적용액·리포트 ID/입력/결과·고정 Mock 모델/프롬프트 버전을 모의 초안에 보존한다. 수동 변경 후에는 과거 기록임을 표시한다. 실제 계약 금액과 연결하지 않는다. 공고의 다른 필드·파일·참고 자료는 분석에 자동 전송하지 않으며 명시 입력한 설명만 보낸다.
- **API 재대조:** `api문서.txt`와 기존 기능표는 경로가 없지만 현재 코드에는 `POST /api/pricing/analyze`와 shared pricing 스키마가 있다. shared 입력/구조·단가/수량 제약을 재사용한다. 비용 범위·누락 전용 필드·실제 버전/근거·리포트 저장/공고 적용 계약은 부족하여 `/__mock__/pricing/analyze` 고정 예시로 분리했다. 실제 API 호출/제공자 연결 완료로 표시하지 않는다. D16 정책과 현재 서버의 사용자별 10회/시간 구현은 별개다.
- 모델·통신·handler·화면: `apps/web/src/mocks/{pricing-model.ts,pricing-api.ts,pricing-handlers.ts,PricingMock.tsx}`, 연결 `CampaignFormMock.tsx`, `campaign-model.ts`, `browser.ts`. 검사 `apps/web/test/pricing.test.ts`, `apps/web/e2e/pricing.spec.ts`. 근거/기록 `docs/frontend-pricing-2b.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-2b/{README.md,capture.cjs,production-smoke.cjs,production-results.json,editor-390.png,editor-1280.png}`.
- `.github/workflows/web-ci.yml`에는 선행 `feat/frontend-2a-campaigns` base만 추가했다. 검사 명령·재시도0·timeout 유지. API/shared·원본 엑셀/PDF·계획·의존성/lockfile·브랜드/토큰 변경 없음. 상위 독립 앱은 수정하지 않았다.

### 검증·검토

- `npm run test:web`: **109/109**(기존104+신규5). 요청 길이/허용 필드·구조·계산·범위/통화/출처/근거 오류·Mock 버전 구분·명시 적용액/초안/수동 수정 기록 검증.
- `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 운영 빌드는 AUTH_API/MOCK 플래그를 모두 켠 조건도 통과했다. 키트11개 타입·16개 대비·6개 재생성 검사 유지.
- 첫 전체 Edge 실행은 **169/170·exit1**, 이번 2-B는 **24/24** 통과. 기존 프로필 만료 후 재저장1건은 성공 문구 대기 실패였고 단독 재현은 데스크톱/모바일 **2/2** 통과했다. 실패 trace에서 두 번째 PATCH200 뒤 앱 재로딩/초기 인증·조회가 확인됐고 Vite 로그는 trace HTML 생성 시 page reload를 기록했다. 산출물을 저장소 밖 OS 임시 폴더로만 바꿔 직렬 재검증한 최종 전체는 **170/170·실패0·exit0·7.0분**이다. 동일 검사·두 프로젝트·workers2·timeout·재시도0을 유지했고 앱/API/shared 코드를 바꾸지 않았다. 2-B 통합 흐름은 선택 분석→예산 불변→반영액 조정/명시 적용→초안 저장/재편집→공개이며, 2단계 전체 통합 완료를 뜻하지 않는다.
- 독립 모의 HTTP 운영 smoke **5개 통과·페이지 오류0**. pricing/campaign Mock 엔드포인트·버전/시나리오·worker 운영 제외, CLIENT/CREATOR의 두 작성 경로·제품 API/Mock 호출/worker 없음을 확인했다. 실제 서버/DB 검증이 아니다.
- 390/1280px 분석·명시 적용 화면 캡처2개 생성·시각 확인. KEMI 로고/주요 색/버튼/카드/600·1024px 구간 유지. 스크린리더·실제 브라우저 메뉴200% 확대·다른 브라우저는 미검증.
- 명세/코드·React·보안 자체 검토: DEV lazy import 경계/운영 제외, Bearer·활성 의뢰인·epoch·요청 취소, 입력 최소화/외부 요청 없음·React 이스케이프·로컬 오류 문구·비밀값/의존성 추가 없음 확인. 실제 인증/권한/DB 보안의 증거가 아니다. Hook 구독은 공식 React Hook Form useWatch 안내를 확인했다.
- 중간 실패: 초기 form.watch React Compiler 경고·이름 shadow·리스트 index key·E2E 반복문 lint 위반은 기존 규칙을 바꾸지 않고 수정했다. 초기 분석 전용 실행17/18은 전체 실행을 겹쳐 시작해 trace 파일 ENOENT/timeout이 발생했다. 실행 중첩은 작업 실수로 기록하며 통과로 계산하지 않는다. 전체 실행의 기존 프로필 만료 재저장 실패도 따로 재현/기록한다.

### 남은 일·다음 작업 하나

- **실제 API·OpenAI·DB·영구 리포트/적용 기록은 미연결/미검증.** D16 입력/출력·비용 범위·한도·저장·재분석·버전/근거 계약과 실제 공고 연결이 남는다. UI의 금액·문자 제한은 Mock 보호 후보이며 정책 확정이 아니다. 단일 탭 메모리/고정150,000원 예시를 실제 분석·시장 평균으로 표시하지 않는다.
- 다음 작업 하나: **2-B D16 리포트·버전·저장/예산 적용 API 계약 조율**. 자동 착수하지 않는다. 공개 후 수정/삭제·탐색/상세·제안/협의와 2단계 전체는 미완료다.

### Git 전달 상태

- 2-B 기존 원격 브랜치·PR 없음 확인. 선행 #40의 원격/로컬 일치 SHA `35c9357`에서 `feat/frontend-2b-ai-budget` 생성. 모델·응답/적용 기록·단위 검사 커밋 [747a2b8](https://github.com/Jubileekim/KEMI/commit/747a2b8). 화면/통신/검사/QA/기록 [260d44f](https://github.com/Jubileekim/KEMI/commit/260d44f)와 함께 푸시했다. [Draft PR #41](https://github.com/Jubileekim/KEMI/pull/41)을 생성·이 채팅에 연결했다. 기능 SHA `260d44f94deab4e2c6bccc2c0bcc0820dbfd0b11`과 PR head 일치를 확인했다.
- base는 `feat/frontend-2a-campaigns`(#40 선행). 선행 PR 병합 후 base 조정 검토 필요. PR 병합·자동 병합 설정·명시적 배포/재배포·다음 범위 착수 없음. 푸시/PR로 생기는 기존 연결 서비스 검사는 명시적 배포 실행과 구분한다.

- **원격 Web CI 기능 SHA:** [run93](https://github.com/Jubileekim/KEMI/actions/runs/40041952608)에서 npm ci·형식·단위·타입/린트/빌드·Chromium 설치는 success, 확인 시 브라우저 E2E는 in_progress·report pending이다. 로컬170/170과 원격 결과는 별개다. 최신 결과 기록은 문서/QA 안내만 바꾸는 전달 커밋으로 푸시하며 cancel-in-progress에 따라 기존 실행이 교체될 수 있다. **최신 문서 SHA의 최종 CI는 미검증**이고 [PR #41 Checks](https://github.com/Jubileekim/KEMI/pull/41/checks)에서 별도 확인한다. 검사/재시도/timeout을 완화하거나 원격 재실행하지 않았다.
- **Vercel 연결 상태:** 기능 SHA의 GitHub status는 failure이고 target은 기존 팀 초대 링크다. 이번에는 status 결과만 확인했으며 새 원인 로그는 미검증이다. Web CI·로컬 빌드 실패 또는 배포 성공으로 해석하지 않는다. 초대/권한/배포 설정 변경·배포/재배포 명령은 실행하지 않았다.
- **종료 경계:** 2-B 클라이언트·명시적 Mock의 통합 검증까지이며 2단계 전체 완료가 아니다. 최종 기록과 QA 안내는 별도 전달 커밋으로 푸시한다. 다음 작업 자동 착수·병합·자동 병합·배포 없음.

## 2-C 모집 목록·검색·상세·마감 (2026-10-24)

### 구현·변경 파일

- **CAMP-03/05·P06/P07의 클라이언트·명시적 Mock 범위.** 공개 목록의 검색어·제품 문자열·예산·모집 상태·최신/마감임박/예산 정렬·페이지를 URL로 보관한다. 조건 적용 시 페이지1, 상세 왕복·뒤로 가기·새로고침 유지, 오류 URL·빈 결과·페이지 범위 밖 복귀를 제공한다. 기존 작성→공개 Mock 저장소와 목록/상세를 연결한다.
- 공개 응답은 제목·제품·목적·범위·예산·기간·시각·모집 상태의 허용 필드만 투영한다. 비공개 초안·참고 자료·AI 리포트/입력·비공개 첨부·주소는 공개하지 않는다. 제품 분야는 목적 enum으로 치환하지 않는다.
- 본인 활성 의뢰인만 확인창을 거쳐 모의 수동 마감한다. Bearer/소유자/활성 역할·revision·epoch 재검사, 처리 중 중복 행동 차단, 자동 재시도 없음. 응답 유실/409는 명시 재조회, 중복 마감·재공개로 내용/마감 재설정 없음. 마감은 공고 상태만 바꾸며 기존 협의·서명·계약을 취소하는 동작을 추가하지 않았다.
- 3/7/14일·공개 기준 한국 시간은 기존 모델을 유지한다. 화면은 기한 도달을 유효 마감으로 판정한다. 페이지/필터 밖 공고도 포함한 다음 기한을 받아 목록 수를 재조회한다. 작성/본인 목록에도 유효 마감을 표시한다. 실제 제출은 아직 연결 준비 중이고 마감 시 신규 제안 종료로 표시한다.
- **계약 가정:** 실서버 목록은 OPEN·마감 전만, 마감 상세는 작성자/지원자만 접근한다. 제품 분야·상태 필터·자동 상태 전이 계약이 부족하다. Mock은 제품 문자열 부분 검색·페이지6개·예시9개, 마감 상태 필터 확인을 위한 마감 공고 공개 투영을 사용한다. 분류 체계·마감 공개 범위를 제품 정책으로 확정하지 않았다. 실제 `/api/projects`는 호출하지 않는다. D04는 유지한다.
- 화면/경로: `apps/web/src/features/campaigns/CampaignBrowsePage.tsx`, `src/app/App.tsx`. Mock: `src/mocks/{discovery-model.ts,discovery-api.ts,discovery-ui.ts,DiscoveryMock.tsx,DiscoveryListMock.tsx,DiscoveryDetailMock.tsx}`, `campaign-{model,handlers}.ts`, `Campaign{Mock,FormMock}.tsx`.
- 검사/근거: `apps/web/test/discovery.test.ts`, `apps/web/e2e/discovery.spec.ts`, `docs/frontend-discovery-2c.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-2c/{README.md,playwright.edge.config.ts,capture.cjs,production-smoke.cjs,production-results.json,list-390.png,list-1280.png,detail-390.png,detail-1280.png}`. `.github/workflows/web-ci.yml`은 선행 `feat/frontend-2b-ai-budget` base만 추가한다.
- 기존 Workspaces·API/shared·CI 명령/검사/재시도/timeout·의존성/lockfile·브랜드/토큰·원본 엑셀/PDF·계획은 유지했다. 상위 독립 앱은 수정하지 않았다.

### 검증·검토

- `npm run test:web`: **117/117**(기존109+신규8). 투영·비공개 제외·잘못된 공개 응답·필터/안정 정렬/페이지·검색 입력·기한 정각·활성 본인/revision·멱등/재공개 차단 검증.
- `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true` 조건의 `npm run build:web`(타입·ESLint·운영 빌드): 통과. `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 최종 문서 반영 후 형식/diff도 재확인한다.
- **전체 회귀: 198/198·실패0·exit0·6.9분.** 예시 모집일 보정 전 실행이며 보정 후 영향받는 **2-C 28/28·exit0·1.2분**도 재검증 통과했다. 전체198개는 보정 후 다시 실행하지 않았으며 다른 기능이 예시 목록 데이터를 사용하지 않음을 확인했다. 로컬 Edge 두 프로젝트·workers2·재시도0·기존 timeout, 별도5184 서버·OS 임시 출력으로 실행한다. 원격 CI와 구분한다.
- 운영 산출물+독립 HTTP 인증 fixture **7개 통과·페이지 오류0**: Mock 코드/endpoint/scenario/worker 제외, 비회원/의뢰인/크리에이터의 목록/상세 준비 안내, 제품 API/Mock 요청·worker 없음. 실서버 인증/API 검증이 아니다.
- 390/1280px 목록/상세 캡처4개 생성·시각 확인. KEMI 로고·주요 색·11개 타이포 역할·카드24px·600/1024px 구간 유지. 실제 브라우저 메뉴200% 확대·스크린리더·다른 브라우저는 미검증이다.
- 커밋 전 `fresh-context-review`·`security-review` 관점 자체 검토: 원본 CAMP-03/05와 계약 경계, DEV lazy/운영 제외, 허용 필드 투영·React 이스케이프, Bearer/활성 본인·epoch/캐시, 무단/지연 요청 검사를 확인했다. 실제 서버 보안 검토/인증·권한/DB 보장으로 표시하지 않는다. 새 의존성·비밀값·외부 링크 방문/파일 업로드 없음. 사람 검토가 필요한 계약 가정 때문에 Draft로 전달한다.
- **중간 실패·수정:** 최초 단위112/115의3건은 strictObject.pick이 비공개 필드를 거부하던 투영 실수였다. 투영 단계에서만 제거하고 응답 스키마는 strict 유지 후 수정 검증했다. 초기 lint/형식 문제는 기존 규칙 변경 없이 수정했다. 최초 2-C 브라우저는 개별22개 통과·2개 실패(상세 재조회 중 disabled 버튼에 키보드 focus를 시도한 검사 대기 누락)였다. 활성 대기를 추가한 통합 재검증2/2·exit0. 제한 환경의 종료 대기 때문에 첫 실행은 최종 완료 요약 없이 중단했으며 통과 실행으로 계산하지 않는다. 전용 Vite PID/명령을 확인해 정리했다.
- 첫 전체 실행은 자체 검토에서 목록 밖 공고 마감 시 결과 수 갱신 누락을 발견해 중단했다. 다음 기한 응답/재조회와 목록/마감 필터 검사2개(두 프로젝트4개)를 추가했다. 중단 실행을 최종 통과로 계산하지 않고 완전한 전체 실행을 다시 검증한다. 검사/재시도/timeout을 완화하지 않았다.
- 추가한 타이머 검사2건은 최초 실행에서 실패했다. trace의 discovery 요청은 최초1회뿐이었고, 설치된 Playwright 타입 문서의 "install the clock before navigating" 안내와 달리 페이지 로드 뒤 Clock을 설치하여 이미 등록된 timeout이 제어되지 않았다. Clock 설치를 탐색 전으로 옮긴 목록/마감 필터 두 프로젝트4/4·exit0 재검증이 통과했다. 이 실패가 나온 전체 실행도 중단/미완료로 남기고 최종 전체 실행을 다시 진행한다.

- 최종 명세 대조에서 예시 공고의 공개일/모집일 간격을 P06의 3/7/14일과 정확히 맞췄다. 모든 예시가 과거/현재 공개이며 기간 차이가 일치하는 단위 검사를 추가해117/117 통과했다. 동작 코드는 바꾸지 않았으며 보정 후 관련 2-C28개·운영7개를 재검증하고 캡처4개를 다시 생성했다. 제한 환경의 지연 로그아웃 검사는 모달이 배경 클릭을 막으므로 실제 session controller의 logout 호출로 계정 변경을 발생시킨다.

### 남은 일·다음 작업 하나·Git 전달

- **실제 API·DB·자동 마감 스케줄러·신규 제출 서버 거절·기존 거래/서명 유지·관련자 알림은 미연결/미검증.** 단일 탭 메모리/클라이언트 시각을 실서버 원자성·영구 저장·다중 탭·알림 증거로 표시하지 않는다. CAMP-04/06·제안/협의·2단계 전체 통합은 범위 밖이다.
- 다음 작업 하나: **2-C 제품 분야·상태 필터·마감 후 공개 권한·자동 마감/알림 API 계약 조율**. 자동 착수하지 않는다. PR 병합·자동 병합 설정·명시적 배포/재배포 없음.
- 기존 2-C 브랜치/PR 없음과 깨끗한 작업 트리, 선행 #41의 원격/로컬 일치 `0b76df2`를 확인한 뒤 `feat/frontend-2c-discovery`에서 작업했다. 모델/단위/근거 커밋은 푸시 완료한 [8811f16](https://github.com/Jubileekim/KEMI/commit/8811f16). 화면·통신·검사·QA/기록 [204e86e](https://github.com/Jubileekim/KEMI/commit/204e86e)도 푸시 완료했다. [Draft PR #42](https://github.com/Jubileekim/KEMI/pull/42)를 생성하고 이 채팅에 연결했다. 기능 SHA `204e86e25f7e89dfafd020902d818b597b8c1cdd`와 PR head 일치, Draft/open·미병합·충돌 없음(mergeable=true)을 확인했다. base는 `feat/frontend-2b-ai-budget`이며 선행 #41 병합 뒤 base 조정 검토가 필요하다.
- **원격 Web CI:** 기능 SHA의 [run40062812220](https://github.com/Jubileekim/KEMI/actions/runs/40062812220) / web job120779748327은 확인 시 `in_progress`, 최종 결론 없음이었다. 로컬117/28/198/운영7과 별개다. 이 최종 Git/CI 기록은 문서 전용 전달 커밋으로 푸시하므로 cancel-in-progress에 따라 실행이 교체될 수 있다. **최신 문서 SHA의 최종 CI는 미검증**이며 [PR #42 Checks](https://github.com/Jubileekim/KEMI/pull/42/checks)에서 확인한다. 검사/재시도/timeout 완화나 수동 CI 재실행은 하지 않았다.
- **기존 Vercel 연결 검사:** 기능 SHA의 status는 failure이며 설명은 `Git author Dev-Yuncheol must have access to the project on Vercel to create deployments.`다. Web CI/로컬 검사 실패와 다른 접근 권한 문제다. 초대·권한·배포 설정 변경·배포/재배포 명령은 실행하지 않았다. Git 푸시/PR에 따라 생긴 기존 연결 서비스 검사와 명시적 배포는 구분한다.
- **종료 경계:** 2-C 클라이언트·명시적 Mock 통합/관련 재검증 완료. 2단계 전체 완료가 아니다. 다음 작업 자동 착수·병합·자동 병합 설정·배포 없음. 사용한 전용 QA 개발 서버/preview는 정리했다. 문서 전달 커밋까지 푸시 후 PR head/작업 트리를 최종 확인한다.

## 2-D 제안 제출·후보 조회·협의 진입·기본 채팅 (2026-10-24)

### 완료 범위·변경 파일

- **APPLY-01~03·CAMP-06·CHAT-02/03/05의 공개 제안 경로와 CHAT-01 텍스트 기본 채팅을 명시적 Mock으로 연결.** 공개 서비스/본인 공개 작업물의 제안, 제출 확인·견적/기간/작업물 제목 사본, 본인 후보 비교, 협의 요청, 당사자별 방 생성·재사용, 거절/철회/무선정 종료·사유/기록 보존을 구현했다. 협의만으로 선정/계약하거나 타후보를 종료하지 않는다.
- 일반 채팅에48시간 만료를 적용하지 않고 모집 마감 뒤에도 기존 협의를 유지한다. 협의 자체가 종료되면 기존 방을 읽기 전용으로 표시한다. 텍스트 전송 중/실패/같은 ID 수동 재시도·중복 차단, 최근 대화·방별 미확인 수·명시적 읽음을 제공한다. 채팅 읽음과 인앱 알림을 혼합하지 않고 대화의 동의로 계약·승인·납품·정산을 처리하지 않는다.
- 실제 API의 accept는 조기 MATCHED/타후보 종료로 P07과 충돌한다. 철회·무선정·채팅 API도 없으므로 `/__mock__/proposals`로 분리했다. Bearer·활성 역할·소유자/당사자·지연 후 epoch를 재검사한다. 운영 경로는 연결 준비 안내이며 실제 제품 API를 추정해 호출하지 않는다.
- **D06/D07/D19/D20 유지:** 종료 후 재지원은 결정 대기 안내와 임시 차단, 글자수4,000/작업물20개·양의 정수 견적/기간·수동 갱신/읽음은 Mock 보호 후보다. 미디어 snapshot/재생·첨부 업로드·자동 갱신/다중 기기·계약 완료/분쟁/보관/재개 정책은 구현 완료로 표시하지 않는다. 상세는 `frontend-proposals-2d.md`.
- 모델/통신: `apps/web/src/mocks/{proposal-model,proposal-api,proposal-handlers}.ts`, 기존 `campaign-handlers.ts`·`studio-handlers.ts`의 상태 읽기/무선정 마감 연결과 `auth-handlers.ts`의 Mock 상대 표시 이름 조회, `browser.ts` 등록.
- 화면/경로: `apps/web/src/features/campaigns/ProposalPage.tsx`, `src/mocks/{ProposalMock,ProposalCard,ProposalConfirm,ProposalEditorMock,ChatPanelMock}.tsx`, `src/app/{App.tsx,layouts/Shell.tsx}`, `DiscoveryDetailMock.tsx`. 기존 Guard·Shell·KEMI 로고/색/타이포·카드24px·600/1024px 구간을 유지한다.
- 검사/근거: `apps/web/test/proposals.test.ts`, `apps/web/e2e/{proposal-helpers.ts,proposals.spec.ts}`, `docs/frontend-proposals-2d.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-2d/{README.md,playwright.edge.config.ts,production-smoke.cjs,production-results.json,candidates-390.png,candidates-1280.png,workspace-390.png,workspace-1280.png}`. CI는 선행 base `feat/frontend-2c-discovery`만 추가하며 검사·재시도·timeout은 유지한다.
- API/shared·Workspaces/의존성/lockfile·원본 엑셀/PDF/디자인 토큰·수정된 계획과 상위 독립 앱은 수정하지 않았다. Senior Engineer Mindset는 사용하지 않았다.

### 검증·검토

- 로컬 `npm run test:web`: **130/130**(기존117+신규13). 공개/마감 정각/권한·중복/D06·작업물 제목 사본·후보/의뢰 분리·마감 후 대화·거절/철회/무선정·계약 합성 경계·읽음 전진·메시지 멱등을 확인했다.
- `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true` 조건의 `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 최종 문서/검토 보정 후 관련 검사를 다시 확인한다.
- 2-D Edge 전용 **10/10·exit0·51.2초**: 두 후보 유지/타후보 조회·전송 차단, 공개→제안→협의→마감 후 양방향 대화·읽음→거절, 무선정 종료, 응답 유실 후 동일 ID 재전송1회 저장, 빈 상태/실패/Bearer 거절을 확인했다. 기존 검사/timeout/재시도는 완화하지 않았다.
- 운영 산출물+독립 HTTP 인증 fixture **16개 통과·페이지 오류0**: 비회원/의뢰인/제작자×5경로의 인증·역할·연결 준비 안내, 제품 API/Mock 호출·worker 없음, Mock 코드/endpoint/scenario/worker 제외. 실제 서버 인증/API/외부 제공자 검증이 아니다.
- 최초 전체 회귀는 **204/208·4실패·exit1·8.0분**이었다. 새 목록의 H1을 바꾸면서 기존 인증/Google 복귀가 기대하는 `의뢰 현황` 제목을 깨뜨렸다. 기존 제목을 복원하고 해당 기존 검사4개와 2-D10개를 합친 **14/14·exit0·1.1분** 재검증이 통과했다. 확인창을 Radix DialogTrigger에 연결하여 Escape 취소 후 초점 복귀·Enter 재진입도 검증했다. 390/1280px 후보·대화 캡처4개는 재조회 완료 대기 후 재생성·시각 확인했다. 수정 후 기능 SHA `37e79e1`의 **최종 전체 회귀208/208·실패0·exit0·7.8분**이 통과했다. 포트5185·로컬 Edge 두 프로젝트/workers2·retry0·기존 timeout을 사용했다. 로컬과 원격 CI를 구분한다.
- 커밋 전 fresh-context-review·security-review·React 품질 관점 자체 검토: 원본 기능/정책과 API 대조, DEV lazy/운영 제외, 당사자 권한·지연 epoch·React 텍스트 이스케이프·입력/출력 스키마·단방향 읽음·중복 ID·상태별 전송 차단을 확인했다. 무단 조회/전송과 script 문자열을 브라우저로 실행 검증했다. 새 의존성/비밀값/파일 bytes/외부 링크 방문 없음. 실제 서버 보안/인증/DB 검증으로 표시하지 않고 남은 계약/정책/미디어 연동 때문에 Draft로 전달한다.
- 초기 실패: ChatPanel의 마지막 배열 원소 타입·테스트의 잘못된 SUSPENDED enum·브라우저 동적 import의 TS 경로 및 기존 ESLint의 assertion/중첩 조건/label/순차 처리 규칙 위반을 규칙 변경 없이 수정했다. 첫 브라우저 실행 중 소스 편집으로 모바일1건의 실행 context가 사라져 중단했으며 최종 통과로 계산하지 않는다. 전용 프로세스를 확인해 종료하고 고정된 소스로 다시 실행했다. 운영 smoke의 최초 로그인 제목 assertion을 실제 제목으로 수정하고16개를 재검증했다.

### 남은 일·다음 작업 하나·Git 전달

- **실제 API·DB·원자적 마감/계약·알림·파일 저장·외부 제공자는 미연결/미검증.** 제목 사본은 실제 미디어 snapshot/열람 권한 검증이 아니다. CHAT-01 첨부·CHAT-04 계약 후 전환·CAMP-04 공개 후 수정/삭제 등이 남아 **2단계 전체 완료가 아니다**. 이번 범위의 클라이언트/텍스트 Mock 통합과 구분한다.
- 다음 작업 하나: **2-D 협의/선정 분리·철회/무선정·채팅/읽음 API 계약 조율**. 자동 착수하지 않는다. PR 병합·자동 병합 설정·배포/재배포 명령은 실행하지 않는다.
- 기존 2-D 브랜치/PR 없음과 깨끗한 작업 트리, 선행 #42의 로컬/원격 일치 `5e6fa5e`를 확인하고 `feat/frontend-2d-proposals-chat`을 만들었다. 모델/단위/근거 커밋 [1c1b072](https://github.com/Jubileekim/KEMI/commit/1c1b072)은 푸시 완료했다. 화면·통신·통합검사·Git/PR/원격 CI 최종 상태는 아래에 추가한다.

- 화면·통신·통합검사·QA/기록 커밋 [37e79e1](https://github.com/Jubileekim/KEMI/commit/37e79e1)을 푸시했고 [Draft PR #43](https://github.com/Jubileekim/KEMI/pull/43)을 생성·이 채팅에 연결했다. 기능 SHA `37e79e1d4ae506bf633829cbd5d5ad3b420c6c2d`와 PR head 일치, Draft/open·미병합·mergeable=true를 확인했다. base는 선행 `feat/frontend-2c-discovery`(#42)이며 선행 병합 뒤 base 조정 검토가 필요하다. 제안→협의→채팅은 같은 독립 검증 흐름으로 한 PR에 묶고 모델/상태와 화면/통신을 기능 커밋 두 개로 나눴다.
- **원격 Web CI 기능 SHA:** [run40065071852](https://github.com/Jubileekim/KEMI/actions/runs/40065071852) / job120786476906에서 npm ci·형식·단위·타입/린트/빌드·Chromium 설치는 success, 확인 시 브라우저 E2E는 in_progress·report pending이었다. 로컬 결과와 별개다. 최종 기록은 문서 전용 전달 커밋으로 푸시하여 실행이 교체될 수 있다. **최신 문서 SHA의 최종 CI는 미검증**이며 [PR #43 Checks](https://github.com/Jubileekim/KEMI/pull/43/checks)에서 별도 확인한다. 수동 CI 재실행·timeout/재시도 완화 없음.
- **기존 Vercel 연결 검사:** 기능 SHA의 status는 failure이며 target은 기존 팀 초대 링크다. 이번 상세 원인 로그는 미검증이다. 이를 Web CI/로컬 검사 실패 또는 배포 성공으로 표시하지 않는다. 초대·권한·배포 설정 변경·배포/재배포 명령은 실행하지 않았다.

- **최종 검증/종료 경계:** 최종 전체208/208, 관련14/14, 단위130/130, 운영16개(최종 flag 빌드 후 반복도 통과), 타입·린트·빌드·형식·토큰·diff 검사 통과. 기존4개 실패는 제목 복원으로 해결했고 중단/실패 실행을 통과로 합산하지 않았다. 실제 API/DB·미디어·첨부·알림·미결정 정책과 2단계 전체는 미완료다. 다음 범위·병합·자동 병합·명시적 배포 없음. 전용 QA 서버는 실행 종료로 정리했고 preview도 종료했다. 이 최종 기록을 문서 전달 커밋으로 푸시한 뒤 head/PR/작업 트리를 확인한다.
