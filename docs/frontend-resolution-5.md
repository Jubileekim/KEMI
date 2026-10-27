# 5단계 취소·환불·분쟁 작업 계획

기준: 2026-10-27. 기능명세 CANCEL-01/02·REFUND-01·DISPUTE-01, P16/P17, D12/D13/D18; frontend-plan §5. API 문서/현재 API/shared에 대응 계약이 없어 DEV/MSW 전용으로 구현한다.

## 작업 단위와 완료 조건

1. 선행 4-E 미커밋 화면/경로/검사를 보존하고 단위·빌드·정산 E2E를 실행, 검토 후 별도 커밋/전달한다. 기존 outputs/tools는 제외한다.
2. 5-A: `mocks/resolution-{model,store,handlers,api}.ts`, `features/resolution/{CancellationForm,CancellationAgreement}.tsx`, `mocks/CancellationMock.tsx`. 사유/진행 내역/희망 금액, 버전별 완료 대가/환불/파일/미완성/원본/사용권, 동일 버전 양측 확인. 기존 계약→취소 라우트 링크. 단위와 역할별 E2E 후 별도 Draft PR.
3. 5-B: 환불 상태/분쟁/운영 검토 화면과 처리기. 원결제·합의 버전·멱등성·금액 한도, 미확정/실패 잠금, 파일 인도와 수령, 근거 있는 보류 해제 후 부분 정산. 정산/수령 처리기의 보류 연계. 운영자는 당사자 확인을 대행하지 않는다. 운영 권한은 DEV Mock ADMIN fixture만 사용. 별도 Draft PR.
4. 5-C: `e2e/public-recruitment.spec.ts`, `cancellation.spec.ts` 및 QA 기록. 정상 공개 모집→정산, 취소 부분/전액 환불, 미합의/분쟁/권한/구버전/결과 불명확과 실제 라우트/버튼 진입을 데스크톱·모바일 검증한다. 통합 검증 전용 PR.

## 보존 경계

- npm Workspaces `apps/web`, 기존 React Router/Query/Axios/Zod/공통 UI/KEMI 토큰/CI 명령 유지. 의존성 추가 없음.
- 운영 인증/권한·API/shared 수정 없음. 실제 PG·DB·파일 저장/악성파일 검사·외부 제공자 미검증.
- D12 세금·절사, D13 완료 후 취소/기한/증빙·해제 권한, D18 운영 권한 미확정. Mock에서는 완료/불명확 정산 뒤 취소를 보호 차단하고 소수 원 수수료를 보류한다. 자동 지급/환불/기한 종결 없음.
- 단일 탭 메모리. 다음 단계 착수·병합·자동 병합·명시적 배포 없음.

## 진행 기록

- PM 재검토(2026-10-27): 선행 프론트 #67(4-E DEV/MSW 모의 정산)은 CI 확인 후 `main`에 병합되었다(`bf6156b`). 이 #68은 `main` 기준으로 PR base를 변경해 단독 변경 범위만 리뷰한다. 본 PR은 개발용 취소 합의 화면이며 실제 API/DB·PG 취소와 연계되지 않는다. 신규 head의 원격 Web CI·팀원 리뷰 통과 전 병합하지 않는다.

- 진행 문서를 먼저 읽고 관련 계획/기능표만 대조했다. 기존 4-E 미커밋 변경을 이어서 사용하도록 사용자 확인. 선행 단위 200/200 exit0. 선행 빌드 진행 중.
- 원본 XLSX 일반 읽기는 잘못된 조건부서식 참조로 실패했고 read_only=True로 원본 변경 없이 관련 행을 읽었다. 기술 PDF 내용도 확인했다.
- 열린 PR 검색에서 이번 프론트 5단계 PR은 없음. #65/#66은 선행이며 백엔드 PR #59 등의 별도 변경은 통합하지 않는다.
