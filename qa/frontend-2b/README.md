# 2-B 검증 근거

모든 경로·명령은 KEMI 저장소 루트 기준. 실제 API·DB·OpenAI 검증이 아닌 개발 MSW/독립 모의 HTTP 검사다.

- `npm run test:web`: shared 호환 분석 입력, 응답 구조·소계/합계·금액/통화/출처/근거 오류, Mock 버전 구분, 마지막 명시 적용액·리포트의 초안 보존.
- `apps/web/e2e/pricing.spec.ts`: 분석 미사용 수동 공개, 명시 적용 전 예산 불변, 반영액 조정→초안 재편집→공개, 조건 변경/지연 응답 무효화·재분석, 401/403/429/503/네트워크/잘못된 합계 실패 후 수동 공개, 취소/재시도·금액 경계, 로그아웃 늦은 응답 차단, 인증 없는 요청 거절, 키보드 반영·320/390/600/768/1024/1280px 넘침, 이후 수동 예산과 과거 적용 기록 구분.
- 기존 전체 E2E도 함께 실행한다. 로컬 Edge와 원격 CI Chromium의 결과는 구분한다. 최종 개수·실패·Git SHA는 진행 문서 참조.
- `capture.cjs`: 5183 Mock 개발 서버에서 390/1280px 분석·명시 반영 후 화면을 캡처한다. 실행은 `node qa/frontend-2b/capture.cjs`. 로컬 루트 node_modules를 NODE_PATH로 지정한다.
- `production-smoke.cjs`: AUTH_API/MOCK 플래그를 모두 켜서 만든 운영 산출물을 검사한다. `/__mock__/pricing`, 고정 Mock 버전·시나리오·worker 제외, 독립 모의 인증 HTTP를 사용한 두 역할/두 작성 경로에서 제품 API/Mock 요청·worker 없음. preview는 기본4187이며 `KEMI_PREVIEW_URL`로 지정 가능. `node qa/frontend-2b/production-smoke.cjs` 실행, `production-results.json` 생성.

빌드/dist·전체 Playwright trace/report·임시 config·로그·node_modules는 커밋하지 않는다. 실제 브라우저 메뉴 200% 확대·스크린리더·다른 브라우저·실제 제공자 검증은 별도다.

로컬 임시 config는 기존 `apps/web/playwright.config.ts`를 확장해 Edge·5183만 선택하며, `outputDir`를 `join(tmpdir(), 'kemi-2b-final-results')`로 둔다. 검사 trace의 HTML이 Vite watcher에 잡혀 화면을 재로딩하는 간섭을 피하기 위한 위치 변경이다. 동일한 170개 검사·프로젝트·기본 timeout·재시도0·workers2를 유지한다. 브라우저 검사 중 shared 빌드/소스 변경·다른 Playwright 실행을 겹치지 않는다.
