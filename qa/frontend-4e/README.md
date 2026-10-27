# 4-E 정산·작업 사건 검증

기준은 저장소 루트 `KEMI`다. 원본 기능명세서 SETTLE-01/WORK-04·P16/P19/P22, 계획4단계3·4항과 [정책/설계 경계](../../docs/frontend-settlement-4e.md)를 따른다. **DEV/MSW 및 독립 HTTP 인증 예시 검증이며 실제 API·DB·PG·지급·취소/분쟁 판정 검증이 아니다.**

## 재현

1. Node24와 설치된 의존성에서 `npm run test:web`, `npm run build:web`, `npm run check:tokens`를 실행한다. 빌드는 공유 패키지를 갱신하므로 브라우저 검사 시작 전에 마친다.
2. 로컬 Edge: `npm exec -w @kemi/web -- playwright test settlement.spec.ts --config ../../qa/frontend-4e/playwright.edge.config.ts --workers=1`.
3. 4단계/접근 연관 회귀: 위 명령에서 파일을 `production.spec.ts delivery.spec.ts revisions.spec.ts final.spec.ts settlement.spec.ts screen-access.spec.ts`로 지정한다. 데스크톱/모바일60개다. 기존 timeout/retry/검사는 유지하며 신규4-E는 전체 공개 제안 여정이므로90초다.
4. 기본 Playwright/CI는 기존 `apps/web/playwright.config.ts`와 Chromium을 사용한다. QA 설정만 로컬에 설치된 Edge, 전용5194, 단일 worker, OS 임시 결과/JSON을 사용한다. Windows에서 검사 완료 후 서버 종료 대기가 남으면 이번5194의 소유 프로세스를 확인하고 해당 서버만 종료한 뒤 러너 종료 코드/최종 JSON을 읽는다.
5. 기본 운영 빌드 후 `node qa/frontend-4e/production-check.mjs`. 두 flag(`VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`) 빌드 후 같은 명령에 `--auth-fixtures`를 붙인다. 이 스크립트는 전용4198 preview를 열고 닫으며 실제 API 대신 독립 HTTP 응답만 사용한다.

## 검토 포인트

- 계약과 성공 전액 결제 금액/통화·현재 준비·최신 검토 승인·계약 파일 전달·전용 수령·보류를 Mock 처리기가 검사한다. 사용자 금액/결과 필드를 받지 않는다. 정산 명령은 최신 delivery revision/receipt ID를 고정한다.
- 중복/동시 명령은 계약당 성공1개, 진행 중에는 같은 ID 결과 확인, 실패 확정 후에만 새 요청이다. 저장 후 응답 유실은 재조회/같은 ID로 복구하며 확정 전에는 완료를 숨긴다.
- 10%와0%만 확정 적용한다. 세금/VAT/절사는 미결정이며 소수 원 수수료를 보류한다. 실제 취소/분쟁/보류 해제·부분 환불은 미구현이다.
- 당사자/Bearer/역할 및 본문·지연 이후 session epoch 재검사, 같은 방 사건 조회 권한, 잘못된 정확한 정산 ID 거부, 조회 오류 시 이전 완료 숨김을 확인한다. 입력/출력은 Zod·React 텍스트 처리이며 비밀·외부 이동/코드 실행·새 의존성이 없다.
- UI는 기존 KEMI 공통 카드/버튼/여백·보호 라우트와 DEV lazy 경계를 사용한다. 실제 제작/영상 링크→정산, 정산→같은 방/승인 파일, 같은 방 확정 안내→서명 버전/준비 이력/정산 ID를 확인한다.
- 원거래 저장본에서 시스템 안내를 파생한다. 안내 조회 실패가 정산 성공을 취소하지 않으며 성공하지 않은 정산의 성공 안내는 없다. 일반 대화와 인앱 알림 읽음은 별도다.

## 결과 파일·제한

- `production-disabled.json`: 기본 운영 인증 미설정 가드1역할. `production-fixtures.json`: 독립HTTP4역할(CLIENT/CREATOR 연결 준비, GUEST 로그인, ADMIN 거부), Mock코드/worker/요청 제외와 페이지 오류를 검사한다.
- `settlement-{chromium,mobile-chromium}.png`: 정상 통합의1280/390px 캡처. 실제 검사는320/390/600/768/1024/1280px 넘침도 확인한다. 화면의 Mock 역할 도구·ID/원시각은 개발 예시다.
- 첫8개는4통과/4실패(준비 이력 접힘·오류 해제 후 재조회 누락), 두 번째8개는6통과/2실패(새로고침 후 비회원이라는 잘못된 검사 가정)였다. 준비 링크의 대상 이력을 열도록 수정하고, 오류 해제 후 명시적 재조회와 기존 역할 marker 복원/거래 초기화 계약에 맞게 검사를 고쳤다. 최종 단일 실행 결과와 합산하지 않는다.
- 기존 전체 포맷 검사 실패는 작업 전부터 있던 미추적 `outputs/share/KEMI-interactive.html`, `tools/share-html/{build.mjs,main.tsx,serve.mjs,share.css,ShareGuide.tsx}`6개다. 해당 파일은 변경/전달 제외하며 추적/추가 대상 파일만 별도 검사한다. 기존 MSW favicon/React DevTools 경고도 전체 콘솔 경고0으로 표시하지 않는다.
- 최종 로컬/원격CI·Git 전달 결과는 [진행 기록](../../docs/frontend-progress.md)에 기록한다. 4단계의 정상 Mock 통합과 4단계 전체 완료를 구분하며 후자를 주장하지 않는다.
