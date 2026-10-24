# 4-A 로컬 검증

저장소 루트에서 실행한다. 실제 API/DB/배송사/파일 저장 검증이 아니다.

```powershell
npm run test:web
npm run build:web
npm run format:check
npm run check:tokens
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4a/playwright.edge.config.ts production.spec.ts
# 전체 기존 회귀 포함
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4a/playwright.edge.config.ts
```

Edge 설치가 필요하며 전용 5189 포트를 사용한다. 기존 timeout/retry/workers를 유지한다. 결과/HTML은 시스템 tmp의 `kemi-4a-results`, `kemi-4a-report`에 생성된다. CI는 기존 기본 Chromium 설정을 사용한다.

운영 경계 검사(독립 HTTP 인증 fixture):

```powershell
$env:VITE_ENABLE_MOCKS='true'
$env:VITE_ENABLE_AUTH_API='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_MOCKS,Env:VITE_ENABLE_AUTH_API
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4193 --strictPort
# 별도 셸
node qa/frontend-4a/production-smoke.cjs
```

비회원/의뢰인/크리에이터의 준비 경로와 운영 JS의 Mock endpoint/코드/worker 제외를 확인한다. 두 플래그를 명시한 빌드가 필요하다. 플래그가 없으면 기존 인증 연결 준비 화면이 정상 동작이다.

캡처는 `KEMI_CAPTURE_DIR`를 이 폴더의 절대 경로로 지정하고 `production.spec.ts --grep '4-A 공개 제안 통합'`만 실행한다. 다른 기능의 캡처를 혼입하지 않는다.

원본·미결정/범위 경계: `docs/frontend-production-4a.md`. 최종 수치·중간 실패·Git/원격 CI: `docs/frontend-progress.md`.
