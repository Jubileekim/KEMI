# 3-C QA

저장소 루트에서 실행한다. 명시적 개발용 PG Mock과 운영 산출물의 독립 HTTP 인증 fixture 검사이며 실제 API/DB·Toss Sandbox 검증이 아니다.

```powershell
npm run test:web
npm run build:web
npm run format:check
npm run check:tokens
npm exec -- playwright test --config qa/frontend-3c/playwright.edge.config.ts payments.spec.ts
# 전체 회귀 (shared 빌드/단위 검사와 겹쳐 실행하지 않는다)
$env:KEMI_CAPTURE_DIR='qa/frontend-3c'
npm exec -- playwright test --config qa/frontend-3c/playwright.edge.config.ts
Remove-Item Env:KEMI_CAPTURE_DIR
```

Edge 두 프로젝트·workers2·retry0·기존 timeout을 사용한다. 개발 서버5188은 검사 러너가 시작/종료한다. 결과/HTML 보고서는 시스템 temp의 `kemi-3c-results`, `kemi-3c-report`에 보관하며 커밋하지 않는다. 390/1280px 캡처는 전체 회귀의 공개 제안 통합 검사에서 생성한다. CI는 기존 Chromium 두 프로젝트와 기존 명령/규칙을 유지한다.

운영 경계는 아래처럼 두 flag를 켜서 빌드해도 Mock 코드·endpoint·worker가 제외되는지 확인한다. preview는 별도 셸에서 실행하고 검사 후 종료한다.

```powershell
$env:VITE_ENABLE_MOCKS='true'
$env:VITE_ENABLE_AUTH_API='true'
npm run build:web
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4192 --strictPort
# 다른 셸, 프로젝트 node_modules의 Playwright 사용
node qa/frontend-3c/production-smoke.cjs
```

로그인·의뢰인·크리에이터 × 결제/결과2경로와 운영 Mock 제외 총7검사다. `production-results.json`은 실서버·PG 증거가 아니다. 각 실행의 최종 결과는 `docs/frontend-progress.md`를 확인한다.
