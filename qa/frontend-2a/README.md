# 2-A 검증 재현

실제 API/DB/외부 제공자 검증이 아닌 MSW 및 운영 모의 HTTP 검사다. 저장소 루트에서 실행한다.

- `npm run test:web`: 캠페인 초안·P06·공개 멱등성·D04 후보·소유권·revision을 포함한 회귀 검사.
- `npm run build:web`, `npm run format:check`, `npm run check:tokens`, `git diff --check`.
- `npm run test:web:e2e`: 정식 Chromium 데스크톱/모바일. `campaigns.spec.ts`의 통합·실패 입력 보존·공개 확인 취소·권한·마감·응답 유실·계정 변경·반응형을 포함한다. Mock 결과이며 실제 API 완료 증거가 아니다.
- 로컬 Edge는 무시되는 `tmp/playwright.2a.config.ts`로 base config를 가져오고 channel=msedge, baseURL=5182, webServer=undefined만 지정한다. 정식 CI의 재시도·검사·시간 제한은 유지한다. MSW 서버는 별도 셸에서 `$env:VITE_ENABLE_MOCKS='true'` 후 `npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5182 --strictPort`로 실행한다. 검사 중 shared 재빌드/소스 편집/중복 러너를 피한다.
- 브라우저/폰트에 따라 캡처 차이가 있을 수 있다. `node qa/frontend-2a/capture.cjs`로 390/1280px 편집·공개 확인창을 재현한다. `KEMI_QA_URL`로 서버를 바꿀 수 있다.

개발용 의뢰인 `client@example.test` / `Kemi1234`. 상단 캠페인 작성으로 진입한다. 전체 새로고침하면 캠페인 데이터가 초기화된다. AI 분석·파일 업로드·탐색/제안은 미연결이다. `2-A 개발 전용 시나리오`에서 응답 오류·지연·공개 후 응답 유실을 선택한다. 응답 유실 시 최신 값 확인→목록의 공개 결과 확인으로 실제 모의 처리 결과를 조회한다.

운영 제외 검증: `VITE_ENABLE_AUTH_API=true`, `VITE_ENABLE_MOCKS=true`를 설정하고 `npm run build:web` 후 두 변수를 제거한다. `npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4186 --strictPort`를 실행하고 다른 셸에서 `node qa/frontend-2a/production-smoke.cjs`. 운영 안내/역할 차단·Mock/worker 제외·제품 쓰기 없음 검증이며, HTTP 인증 fixture를 사용한다. `KEMI_PREVIEW_URL`로 URL을 바꿀 수 있다.

결과는 `docs/frontend-progress.md`에 기록한다. dist/report/trace/tmp/환경 파일은 커밋하지 않는다.
