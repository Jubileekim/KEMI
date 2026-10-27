# 6단계 로컬 검증 근거

대상은 이 저장소의 `apps/web`이다. DEV/MSW 단일 탭 메모리와 로컬 Edge의 검증이며 실제 API/DB/PG/송금/스토리지/외부영상·운영 인증·알림 검증이 아니다. 새로고침하면 거래 데이터는 초기화된다.

- `6a-e2e.json`: 당시6-A 관련24/24. `6b-e2e.json`: 당시6-B4/4. 최종 통합과 중복되는 실행이므로 합산하지 않는다.
- `final-e2e.json`: 최종 직접 의뢰/공통 거래 통합과 관련 회귀의 개별 결과·명령·소스 해시. 최초150개149/1, 보완 후30개29/1, 기존30초 단독2개1/1, 긴4-A 통합 한 건의 전체 예산60초 적용 후2/2의 최신 결과를 고유 케이스별로 합쳐150통과다. 단일150/150 실행 또는 전체336개 통과 주장이 아니다.
- `production-disabled.json`, `production-fixtures.json`: 기본/두flag 운영 빌드의 공개3·직접 발송·목록/작업방6경로. 후자는 독립 HTTP4역할 fixture다. 실제 인증 서버/권한 검증이 아니다.
- `*-final-{390,1280}.png`: 실제 메뉴/라우트/역할 화면과320~1280px 넘침 확인 뒤 본문 캡처. `direct-workspace-*`, `partial-*`: 정상 정산 후 같은 직접 의뢰방과 취소·분쟁/환불/합의 파일/잔여 정산의 같은 실행 캡처.
- `capture.mjs`: 자체 합성 영상의 첫 프레임 재생성·초기 피드 캡처. 실행하면 DEV poster 파일을 다시 쓰므로 브라우저 회귀 실행과 겹치지 않는다. 고객 영상이나 외부 자료는 사용하지 않았다.

## 재현

루트에서 `npm run test:web`, `npm run build:web`, `npm run check:tokens`를 먼저 마친다. shared 빌드/HMR과 브라우저 실행을 겹치지 않는다. 전용5196에서 Mock Vite를 시작하고, 다른 터미널에서 다음을 실행한다.

```powershell
$env:KEMI_QA_EXTERNAL_SERVER='true'
$env:KEMI_QA_OUTPUT_DIR=Join-Path $env:TEMP 'kemi-6-final-results'
$env:KEMI_QA_REPORT=Join-Path $env:TEMP 'kemi-6-final-report.json'
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-6/playwright.edge.config.ts direct-request.spec.ts direct-send.spec.ts public-feed.spec.ts direct-visual.spec.ts
node qa/frontend-6/summarize.mjs focused-e2e
```

위 명령은 신규 기능 집중 검사다. 최종 관련150개의 정확한18파일 명령은 `final-e2e.json`의 command에 보존한다. 같은 산출물 폴더를 쓰는 Playwright 실행을 병행하지 않는다. 병행해야 한다면 report와 outputDir를 모두 다른 경로로 지정한다. 시각 검사는 최초150개 실행과 보완 후30개 실행에 각각 포함했다. `finalize-evidence.mjs`는 TMP의 네 보고서(final/focused/production/production-budget)를 읽어 초기 실패를 보존하고 고유 케이스별 최신 결과를 만든다.

운영 검증은 기본 빌드 뒤 `node qa/frontend-6/production-check.mjs`, 두flag 운영 빌드 뒤 `node qa/frontend-6/production-check.mjs --auth-fixtures`다. 전용 preview4206을 스크립트가 닫는다. 환경 변수는 해당 터미널에서만 지정하고 종료 후 제거한다. 기존 다른 개발 서버는 건드리지 않는다.

초기 파서/새로고침 세션 대기·검사 산출물 경로 충돌과 중단/최종 결과의 구분은 `docs/frontend-progress.md`에 기록한다. 기존 긴4-A 전거래 한 건은 trace의30초 테스트/정리 경계를 근거로 전체 예산만60초로 조정했다. 전역/action/expect 제한·assertion·자동retry0·제품 권한/기한 정책은 유지한다.
