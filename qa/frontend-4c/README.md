# 4-C 재현

저장소 루트 PowerShell에서 실행한다. 실제 API·DB·파일 저장·알림/외부 제공자 검증이 아닌 클라이언트·DEV/MSW 검증이다.

```powershell
npm run test:web
$env:VITE_ENABLE_MOCKS='true'
$env:VITE_ENABLE_AUTH_API='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_MOCKS,Env:VITE_ENABLE_AUTH_API
npm run format:check
npm run check:tokens
$env:KEMI_CAPTURE_DIR="$PWD/qa/frontend-4c"
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4c/playwright.edge.config.ts revisions.spec.ts
Remove-Item Env:KEMI_CAPTURE_DIR
```

shared 빌드와 브라우저 검사를 겹치지 않는다. 설치된 Edge, 전용5191 포트, 기존 workers2/retry0/timeout을 사용한다. 결과/trace/HTML은 시스템 tmp의 `kemi-4c-results`, `kemi-4c-report`다. CI의 기존 Chromium 설정·검사 강도는 유지하며 stacked base `feat/frontend-4b-delivery`만 허용한다.

연관 회귀:

```powershell
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4c/playwright.edge.config.ts delivery.spec.ts production.spec.ts proposals.spec.ts
```

운영 제외는 두 flag를 켠 운영 빌드 후 독립 HTTP 인증 fixture로 확인한다:

```powershell
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4195 --strictPort
# 별도 셸
$env:KEMI_PREVIEW_URL='http://127.0.0.1:4195'
node qa/frontend-4c/production-smoke.cjs
```

영상 fixture는 기존 자체 제작 `apps/web/e2e/fixtures/kemi-review.webm`을 재사용한다. 출처/해시/생성기는 `qa/frontend-4b/README.md`에 있다. WebM은 초기 duration이 Infinity일 수 있어 실제 끝까지 재생해 길이 확인 후 요청한다. 고정 대기·재시도/timeout 확대는 사용하지 않는다.

결과·실패/해결·Git/원격 CI는 `docs/frontend-progress.md`, 정책/API·원문 근거/설계는 `docs/frontend-revisions-4c.md`를 확인한다. 4단계 전체의 최종 수령→정산 검증이 아니다.
