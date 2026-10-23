# KEMI 프론트엔드

> 이 문서는 독립 앱의 0-A~0-C 실행 기록에서 가져왔다. GitHub 통합본의 앱은 동일한 `apps/web`이며, 원격의 Router 8.4.0·TypeScript 5.9.3·Vite 8.3.4 및 API/shared·기존 CI를 유지한다. GitHub 통합 검증은 `frontend-progress.md`의 추가 기록이 우선한다. 브라우저 증거/재현 스크립트는 `qa/frontend-0c/`에 있으며, 별도의 `tmp/0-c/`는 이전 로컬 기록이다. 기존 health 진단은 개발 전용 `/__dev/health`에서 수동 실행한다.

현재 **0-A·0-B·0-C 기반 구성**을 진행했다. 기능 기준과 검증 상태는 `docs/frontend-progress.md`, 이후 단계는 `docs/frontend-plan.md`, `docs/frontend-feature-matrix.md`를 따른다.

## 실행

Node.js 24 / npm 11을 사용한다. 검증 환경은 Node 24.19.0, npm 11.17.0이다. 아래 명령은 모두 이 폴더(Workspaces 루트)에서 실행한다.

```powershell
npm ci
npm run dev
```

개발 서버: http://127.0.0.1:5173. 포트가 사용 중이면 실패하므로 출력 주소를 혼동하지 않는다. 종료는 Ctrl+C.

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run check:tokens
npm run preview
```

빌드 결과는 `apps/web/dist/`, 로컬 빌드 미리보기는 http://127.0.0.1:4173 이다. `preview`는 먼저 `build`한 뒤 실행한다. `npm run format`은 web 앱 파일만 정리하며 원본 디자인 키트를 변경하지 않는다.

## 구조와 범위

- `apps/web`: `@kemi/web` React·TypeScript·Vite 앱. `src/app` 앱 진입, `src/styles` 초기 스타일, `src/design-tokens` 제공 토큰 복사본, `public/brand` 제공 SVG 복사본.
- `package-lock.json`: 루트 단일 lockfile. 앱 안에서 별도 install/lockfile을 만들지 않는다.
- `KEMI-Design-System`: 원본 보존. npm Workspace에 포함하지 않는다.
- `apps/api`, `packages/shared`: 백엔드/합의 계약을 위한 향후 경계. 현재 생성하지 않았다. 루트 glob은 이후 해당 패키지를 수용한다.

제품 경로는 기능 미연결 안내 화면이다. 공개/회원/작업/운영 공간을 공통 Shell로 구분하고, 인증 미연결 상태에서는 보호 화면을 차단한다. 공통 UI 예시는 개발 서버의 `/__dev/ui`에 있다.

0-B Tailwind/shadcn/ui와 0-C Router·Query·Axios·MSW를 구성했다. Zustand·폼 도구는 해당 사용처에 맞춰 추가한다. Vitest·Playwright 정식 러너·GitHub Actions는 후속 0단계 범위다.

## 0-C Mock 실행

기본값은 Mock 비활성이다. `apps/web/.env.example`을 참고하거나 루트 PowerShell에서 다음처럼 개발 서버를 시작한다.

```powershell
$env:VITE_ENABLE_MOCKS='true'
npm run dev
```

종료 후 `Remove-Item Env:VITE_ENABLE_MOCKS`로 현재 셸 설정을 해제한다. 개발 도구에서 Mock 역할과 응답을 선택한다. 역할은 메모리에만 보관하며 새로고침하면 비회원으로 초기화된다. 실제 로그인·토큰·갱신·소유자/당사자 검증은 미구현이다. 운영 권한은 D18 확정 전 검증용 가정이다. 신규 소셜 사용자의 onboarding 접근 모델도 실제 계약 확인이 필요하다.

`/__mock__/probe`는 통신 기반 전용 가상 계약이며 제품 API가 아니다. 성공·빈 결과·1.5초 지연·401·403·409·500·네트워크 오류를 확인한다. Query 자동 재시도와 mutation 재전송은 끄고 수동 재시도를 제공한다. 역할 변경 시 진행 중 조회를 취소하고 캐시를 제거한다. 실제 만료 처리 연결은 1단계 범위다.

`VITE_API_BASE_URL`은 향후 서버 Origin 설정용이며 `/api` 접미사를 붙이지 않는다. 현재 제품 API나 health를 호출하지 않는다. 실제 서버·shared enum/스키마와 D05 확정 후 인증 연결이 필요하다. `VITE_*`는 브라우저 공개 값이므로 비밀키를 넣지 않는다.

Mock은 `DEV && VITE_ENABLE_MOCKS === 'true'`일 때만 시작한다. 운영 빌드는 이 값이 true여도 Mock/역할 도구/UI 예시를 제거하고 `dist/mockServiceWorker.js`도 제외한다. 향후 배포 서버에는 SPA의 내부 경로를 index.html로 연결하는 설정이 필요하며 이번에는 배포하지 않았다.

브라우저 QA 증거와 재현 스크립트는 `tmp/0-c/`에 있다. 번들 또는 로컬 Playwright와 Edge가 있는 환경에서 `node tmp/0-c/verify.cjs` 실행. 기본 검증 URL은 Mock 개발 서버 5175, 운영 preview 4175이며 `KEMI_QA_URL`·`KEMI_PREVIEW_URL`로 바꿀 수 있다. 정식 테스트 러너 설정과 구분한다.

설치 기준은 [React Router 경로](https://reactrouter.com/start/declarative/routing), [Query 기본 동작](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults), [Axios 오류 처리](https://axios-http.com/docs/handling_errors), [MSW 브라우저 설정](https://mswjs.io/guides/integrations/browser) 및 설치된 MSW 3 타입/README다. MSW 3의 시작 옵션은 설치 버전을 기준으로 확인했다.

## 도구 선택 근거

2026-10-23 [Vite 공식 안내](https://vite.dev/guide/), [npm Workspaces 공식 안내](https://docs.npmjs.com/cli/v11/using-npm/workspaces/)와 npm 패키지 메타데이터를 확인했다. Vite 8 / React 19, Node 24 실행 환경을 사용한다. TypeScript 최신 7은 typescript-eslint 8.72의 peer 범위 `>=4.8.4 <6.1.0` 밖이므로 호환되는 6.0 계열을 선택했다. 설치한 정확한 버전은 manifest와 lockfile에 고정한다.
