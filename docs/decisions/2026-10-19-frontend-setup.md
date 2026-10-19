# 프론트엔드 초기 구성 (2026-10-19)

- 상태: `chore/frontend-setup`의 로컬 구현. main 병합·원격 CI·배포는 미확인.
- 기준: [백엔드 결정 기록](2026-10-19-backend-setup.md), [이슈 #2](https://github.com/Jubileekim/KEMI/issues/2), 사용자 작업 폴더의 `기술 스택.pdf`.

## 구성과 이유

- 기존 npm Workspaces에 `apps/web`(`@kemi/web`)을 추가한다. 공통 타입·상태값·오류 코드는 `@kemi/shared`를 사용한다.
- React·Vite·React Router를 사용한다. API는 기존 Express 서버가 담당하므로 SSR 서버는 추가하지 않는다.
- TypeScript는 팀 결정대로 5.9.3, Node는 24, ESLint는 루트의 9를 유지한다. Node 타입도 24 계열이다.
- Tailwind 4의 Vite 플러그인과 shadcn/ui 버튼·테마를 연결한다. 별도 웹 ESLint·Prettier 설정은 만들지 않는다.
- TanStack Query는 서버 데이터, Zustand는 향후 필요한 전역 UI 상태에 사용한다. React Hook Form·Zod와 폼 resolver를 설치하되 실제 폼은 기능 PR에서 만든다.
- `@hookform/resolvers` 6.0.0은 설치 시 선택적 effect 의존성 충돌이 발생했다. 강제 설치 대신 Zod 4와 호환되는 5.9.2를 사용한다.
- Axios 서비스 인스턴스는 `/api`, 쿠키 전송, 15초 타임아웃, JSON 헤더를 기본으로 한다. 인증 API·토큰 저장·자동 갱신은 아직 구현하지 않는다.
- 로컬 `/api/*`, `/health`, `/health/ready`는 Vite가 `API_PROXY_TARGET`(기본 `http://localhost:4000`)으로 전달한다. Origin은 유지한다.
- Render 주소가 없어 실제 `vercel.json`은 만들지 않는다. `vercel.example.json`에 API rewrite → SPA fallback 순서를 준비했다. 실제 주소 확정 후 적용한다.

## 확인한 범위

- 웹 타입 검사·ESLint·Prettier·프로덕션 빌드.
- Vitest: 정상 헬스 응답, HTML 응답 거부, 공통 오류 메시지, 시간 초과·네트워크 오류 표시.
- 브라우저: 초기 화면, 연결 확인 버튼 성공·실패, 없는 경로 처리, 홈 복귀.
- 연결 검증에는 기존 Express `createApp`을 사용했다. DB 확인 함수만 실패하도록 주입한 임시 서버로 `/health` 200, `/health/ready` 503을 구분했다. 실제 DB 연결을 확인한 결과가 아니다.
- `/api/frontend-smoke-missing` 호출이 서버의 JSON 404로 돌아와 경로 보존과 프록시 전달을 확인했다.
- 전체 타입 검사와 백엔드 빌드는 통과했다.

## 남은 검증

- 백엔드 단위 테스트는 이 Windows / Node 24.19 환경에서 `ECONNRESET`으로 19/20개 통과했다. 실패 위치는 실행에 따라 달랐다. 백엔드 소스·테스트와 기존 lockfile 패키지 버전은 변경하지 않았다. 원인은 미확정이며 백엔드 테스트가 모두 통과했다고 판단하지 않는다.
- DB 테스트는 실행하지 않았다. 실제 Supabase 연결·마이그레이션도 수행하지 않았다.
- GitHub Actions의 실제 실행, Vercel·Render 배포 연결, 인증 쿠키·OAuth 검증은 미수행.
- 설치 시 전체 의존성 감사에는 개발 도구의 높은 심각도 경고가 있다. 운영 의존성만 검사한 `npm audit --omit=dev`에서는 0건이었다. 강제 업그레이드는 하지 않았다.

## 실행과 다음 작업

[웹 README](../../apps/web/README.md)에 실행·검사 명령과 배포 준비 순서를 정리했다.
화면 기능은 별도 PR에서 추가한다. 인증 연동 시 결정 문서의 확정·제안 항목을 구분하며 단일 갱신 요청·오류 코드 계약을 백엔드와 맞춘다.

## 후속: Playwright 구성 (2026-10-19)

- 기술 스택 PDF의 Playwright를 추가했다. `test:web:e2e`로 데스크톱 Chromium과 Pixel 7 모바일 에뮬레이션을 검사한다.
- 평소 개발 서버(5173)와 충돌하지 않도록 자동 실행 서버는 5174를 쓴다. 기존 서버를 재사용하지 않고 테스트 종료 시 전용 서버를 정리한다.
- 검증 대상은 초기 화면, 경로 새로고침·홈 복귀, 연결 확인 중 중복 클릭 차단, 연결 성공·네트워크 실패 후 재시도·HTML 응답 거부·공통 서버 오류 표시다.
- 네트워크 응답은 모의 처리하며 실제 API·DB·배포 연결을 검증한 것으로 간주하지 않는다. 프로덕션 화면과 다른 브라우저 엔진은 후속 기능·배포 검증 범위다.
- 웹 CI에 Chromium 설치·브라우저 테스트·HTML 보고서 보관을 추가했다. 원격 CI 실행은 아직 확인하지 않았다.
- 로컬 검증: Playwright 1.64.1 / Chromium에서 데스크톱 6개·모바일 에뮬레이션 6개, 총 12개 통과. 첫 샌드박스 실행은 브라우저 프로세스 생성 권한(`spawn EPERM`)으로 실패했고, 일반 실행 환경에서 같은 테스트가 모두 통과했다.

## 후속: 최신 main과 충돌 정리 (2026-10-19, PR #7)

- 기준 main: `15b18e9`(인증 PR #4 병합). 기존 인증 소스·마이그레이션·shared 변경은 그대로 반영했다.
- README에는 웹 실행 안내와 인증 배포 절차 링크를 모두 남겼다.
- lockfile은 웹의 설치 기록을 기반으로 병합된 API·shared·web의 package.json에 맞춰 재생성했다. 세 워크스페이스의 의존성 목록이 일치하며 `npm ci`가 통과했다.
- 병합 후 전체 타입 검사, 웹 단위 테스트 4개, Playwright 12개가 통과했다.
- 백엔드 단위 테스트는 이 환경에서 `ECONNRESET`으로 24개 중 4개 실패했다. API·shared 소스는 기준 main과 동일하며 원인은 미확정이다. DB 테스트·공용 Supabase 변경은 수행하지 않았다.
