# 5단계 재현·검증

기준 저장소 루트: `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`.

- 앱/의존성은 기존 npm Workspaces 구성이다. `npm run test:web`, `npm run build:web`, `npm run check:tokens`를 실행한다. 빌드가 모두 끝난 뒤 브라우저 검사를 시작한다. shared 빌드/HMR와 실행을 겹치지 않는다.
- 표준 CI는 `npm run test:web:e2e`(기존 Chromium/모바일 설정·retry0). 로컬 Edge 재현은 `npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-5/playwright.edge.config.ts cancellation.spec.ts refunds-disputes.spec.ts public-recruitment.spec.ts signatures.spec.ts production.spec.ts delivery.spec.ts revisions.spec.ts final.spec.ts settlement.spec.ts --workers=1`.
- 로컬 전용5195를 사용하며 기존 서버를 재사용하지 않는다. 마지막 테스트까지 완료한 뒤 Windows 서버 종료 대기가 남으면 해당 포트의 소유 프로세스가 이번 QA Vite인지 확인하고 그 프로세스만 종료한다. 러너 exit와 최종 JSON을 확인하기 전 완료로 기록하지 않는다.
- 원본 JSON 보고서는 OS 임시 폴더의 `kemi-5-report.json`, trace/실패 캡처는 `kemi-5-results`에 남는다. 종료 후 `node qa/frontend-5/summarize.mjs`로 개별 결과·명령·retry·소스 해시를 요약한다. 최종 기록은 같은 실행의 전체와 5-A/5-B 부분집합이며 별도 실행 수를 합산하지 않는다.
- 운영 검사: 기본 `build:web` 뒤 `node qa/frontend-5/production-check.mjs`. 그 다음 `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`로 운영 빌드한 뒤 `node qa/frontend-5/production-check.mjs --auth-fixtures`. 새3경로의 보호/미연결 안내와 Mock 코드·요청·worker 제외를 검사한다. HTTP 인증 응답은 독립 fixture이며 실제 API/로그인 검증이 아니다. 개발 브라우저 검사와 운영 빌드는 순차 실행한다.

## 검증 경계

기능명세 CANCEL-01/02·REFUND-01·DISPUTE-01, P16/P17을 DEV/MSW에서 확인한다. 20만원/8만원 사례, 동일 버전 양측 확인, 원결제·환불 한도, 상태 미확정/실패/응답 유실, 합의 ZIP의 실제 다운로드 바이트와 전용 수령, 운영 근거 기록/보류 해제, 기존 대화·증빙 접근과 역할/객체 권한을 구분한다. D12 절사/세금·D13/D18 운영 정책을 확정한 것이 아니다.

실제 API/DB/Toss Sandbox/송금/스토리지, 다중 탭/영구복원, 파일 내용·악성파일·ZIP 내부 검사와 증빙 첨부 저장은 미연결·미검증이다. Mock은 새로고침하면 거래 기록이 사라진다. 회신 기한이나 무응답에 따른 자동 종결은 구현하지 않는다. 기존 서명 만료는 기존 검사에서 확인한다.

초기 결과와 최종 결과를 구분한다. `5b-first-e2e.json`은 최종 보완 이전8개 실행이다. 마지막 결과·Git·원격CI는 `docs/frontend-progress.md`를 따른다. 상위 폴더 독립 앱과 기존 outputs/tools는 전달 대상이 아니다.

5-B만 독립 재현하려면 같은 Edge 명령에서 대상 파일을 `cancellation.spec.ts refunds-disputes.spec.ts` 두 개로 제한한다(8개). `public-recruitment.spec.ts`와 전체76개 결과는5-C 전달 묶음이다. 정상 정산 캡처 `normal-*.png`는 같은 최종76개 실행의 기존4-E 정상 통합 검사에서 얻었으며, 4-E 당시 역사 캡처 파일은 덮어쓰지 않았다. 신규 장시간 통합 검사 한도는 취소90초/환불·운영150초/공개 모집120초이며 기존 검사 한도·retry0는 변경하지 않았다.
