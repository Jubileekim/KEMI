# 7단계 로컬 검사 근거

- `playwright.edge.config.ts`: 기존 두 기기 프로젝트·retry0·worker1·별도5197. 변경한
  앱은 원본 KEMI의6-B `8fecb83`에서 분리한 worktree다. CI의 기본 Chromium 설정은 유지한다.
- 브라우저 전에 `npm run test:web`, `npm run build:web`를 끝낸다. 검사 중 shared 재빌드나
  앱 소스 수정은 HMR/단일 탭 메모리 세션을 교체하므로 병행하지 않는다.
- 재현: 저장소 루트에서 `npm exec -- playwright test --config qa/frontend-7/playwright.edge.config.ts activity.spec.ts engagement.spec.ts safety-analytics.spec.ts screen-access.spec.ts direct-send.spec.ts`.
  종료 후 `node qa/frontend-7/summarize-e2e.mjs`가 전체 결과와 변경 코드 SHA256을 저장한다. 부분 재검증에는 검사 개수를 마지막 인자로 전달한다(최종 `6`).
- `partial-e2e.json`: 전체24개 실행22통과/모바일2실패 원본의 축약이다. 변경 없는20개는 모두 통과했다.
- `final-engagement-e2e.json`: 두 실패 수정 후 영향받는 알림·리뷰 데스크톱/모바일 재검증과 변경 코드 SHA256. 선행 정산 성공 조건 동기화 후 최종6개 결과로 갱신했다. 앞선 실행과 합쳐 단일24/24로 주장하지 않는다.
  기능 검증과 역할·오류·기존 메뉴·직접 발송 회귀를 포함하며 전체 웹 테스트 실행 결과가 아니다.
- `safety-{chromium,mobile-chromium}.png`: 같은 통합에서 수동 제한·이의·해제 이력 화면.
- `production-check.mjs`:4207 preview의 기본 빌드7경로·두flag 빌드4역할×7경로 검사.
  두flag 검사에는 `KEMI_PRODUCTION_MODE=flags`를 사용한다. 독립 HTTP 인증 fixture와 운영
  산출물 검사이며 실제 인증/서버/DB 검증이 아니다. Mock/분석 코드·worker·요청 제외도 검사한다.

실제 API/DB/저장소/추천·분석 제공자·사이트 종료/다중 기기 보관과 D14/D15/D18/D22는
미검증·미결정이다. 실제 제한 계정은 기존 인증이 거부하므로 운영 정책을 변경하지 않았다.
최종 검사 수·실패 원인·Git 링크·원격 CI는 `docs/frontend-progress.md`를 따른다.
