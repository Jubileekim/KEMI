# 2-C 검증 근거

모든 명령은 `KEMI` 저장소 루트 기준이다. 실제 API·DB·자동 마감 스케줄러·제안/협의/계약·알림 제공자 검증이 아닌 MSW/독립 모의 HTTP 검사다.

- `npm run test:web`: 공개 투영/초안·참고 자료·AI 리포트 제외, 검색 교집합·안정 정렬·페이지, 오류 URL, 3/7/14일 정각 마감 경계, 활성 본인·revision·멱등 마감/재공개 차단.
- `apps/web/e2e/discovery.spec.ts`: 목록 검색/제품/예산/상태/정렬/URL, 페이지1 초기화, 상세 왕복·뒤로 가기·새로고침, 빈 결과/잘못된 URL/초안404, 작성→공개→목록→상세→키보드 취소/확정 마감→마감 필터, 오류/수동 재시도·응답 유실·충돌, 권한/지연 로그아웃·중복 요청, 기한 도달 표시와 목록 밖 공고의 마감 후 결과 수 갱신. 320/390/599/600/768/1023/1024/1280px 넘침과 새 테스트의 페이지 오류도 검사한다.
- CI는 기존 `npm run test:web:e2e`의 Chromium 두 프로젝트를 사용한다. Windows 로컬은 설치된 Edge를 사용해 `npx playwright test --config qa/frontend-2c/playwright.edge.config.ts`를 실행한다. 동일 전체 검사·두 프로젝트·workers2·재시도0·timeout을 유지한다. 출력/HTML/trace는 OS 임시 폴더 `kemi-2c-results`, `kemi-2c-report`에 보관한다. 저장소 안 trace HTML의 Vite reload 간섭을 피하기 위한 위치다. 전체 회귀198개는 예시 공고의 P06 기간 보정 전 통과했고, 보정 후 영향받는 2-C28개·단위117개·운영7개가 통과했다. 전체198개는 보정 후 반복하지 않았다. 원격 결과는 별개다.
- 초기 제한 환경에서는 검사 완료 뒤 Vite 프로세스 종료 대기가 있었다. 종료 정리가 가능한 실행 환경에서 재실행한다. 다른 서버/프로세스를 종료하지 않는다. 브라우저 검사 중 소스 변경·shared 빌드·다른 E2E를 겹치지 않는다.
- `capture.cjs`: `VITE_ENABLE_MOCKS=true`로 5184 개발 서버를 별도 실행한 뒤 `node qa/frontend-2c/capture.cjs`. 390/1280px 목록·상세 PNG4개 생성. 실행 환경에서 루트 node_modules가 필요한 경우 `NODE_PATH`로 지정한다.
- `production-smoke.cjs`: `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`로 빌드한 운영 산출물을 검사한다. preview4188에서 `node qa/frontend-2c/production-smoke.cjs`. Mock endpoint/fixture/scenario/worker 제외와 비회원/의뢰인/크리에이터 목록·상세의 준비 안내, 제품 API/Mock 요청·worker 없음, 페이지 오류0을 검증한다. 인증은 독립 HTTP fixture이며 실서버가 아니다. 결과는 `production-results.json`.

최종 개수·실패 이력·Git/CI 상태는 `docs/frontend-progress.md`에서 확인한다. dist·전체 trace/report·로그·node_modules·비밀값은 커밋하지 않는다. 실제 브라우저 메뉴200% 확대·스크린리더·다른 브라우저·실제 신규 제출 서버 거절/거래 유지·알림은 미검증이다.
