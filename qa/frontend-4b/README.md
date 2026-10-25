# 4-B 로컬 검증

실제 API/DB/파일 저장/워터마크 변환/알림 검증과 구분한다. 저장소 루트 기준:

```powershell
npm run test:web
$env:VITE_ENABLE_MOCKS='true'
$env:VITE_ENABLE_AUTH_API='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_MOCKS,Env:VITE_ENABLE_AUTH_API
npm run format:check
npm run check:tokens
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4b/playwright.edge.config.ts delivery.spec.ts
```

설치된 Edge, 전용5190 포트, 기존 workers2/retry0/timeout을 사용한다. CI는 기존 Chromium 설정/명령을 유지한다. 결과/HTML은 시스템 tmp의 `kemi-4b-results`, `kemi-4b-report`다. 실제 재생 검사는 자체 제작 고정 WebM(`apps/web/e2e/fixtures/kemi-review.webm`, 11,810 bytes)을 사용한다. SHA256은 `309a284b5806e63a4cb10dba5e6a0b1a87341f7535ed81d5af7820847ff524c2`다. 생성은 `node qa/frontend-4b/create-video-fixture.cjs`로 재현할 수 있으며 Canvas/VP8 MediaRecorder의 실제 인코딩 사건을 기다린다. 외부 영상은 사용하지 않았다. 재생 가능한 바이트를 확인한 뒤 저장했으며 인코더 시각/출력 해시의 동일 재생성을 보장하지 않는다.

추가 연관 회귀는 `production.spec.ts payments.spec.ts signatures.spec.ts proposals.spec.ts` 등 실제 파일명을 지정하거나 전체 명령에서 파일 인자를 생략한다. shared 재빌드와 브라우저 실행을 겹치지 않는다.

운영 경계는 위 두 flag 빌드 후 별도 셸에서 확인한다:

```powershell
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4194 --strictPort
# 별도 셸
node qa/frontend-4b/production-smoke.cjs
```

독립 HTTP 인증 fixture로 비회원/의뢰인/크리에이터 경로, 제품 API/Mock 요청 없음, 서비스워커 없음과 운영 JS의 개발 Mock 제외를 확인한다. 실제 인증/서버 검증은 아니다.

캡처는 `KEMI_CAPTURE_DIR`을 이 폴더 절대 경로로 지정해 `delivery.spec.ts --grep '4-B 공개 제안 통합'`만 실행한다. 소스·정책은 `docs/frontend-delivery-4b.md`, 최종 결과·실패/해결·Git·원격 CI는 `docs/frontend-progress.md`다.
