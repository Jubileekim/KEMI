# 1-C 프로필 편집 범위와 검증 계획

기준: 저장소의 `케미 기능명세서.xlsx` PROFILE-01·02/P02/D01,
`frontend-plan.md` §3·5·6의 1단계, `frontend-feature-matrix.md` 해당 두 행,
`기술 스택.pdf`, `api문서.txt` 418~468행, 현재 `@kemi/shared/profile`.

## 구현 단위

1. `apps/web/src/features/profiles/{contracts,api}.ts`: 응답 검증·역할별 shared 입력·변경 필드만 PATCH.
   `ProfilePage.tsx`, `ProfileForm.tsx`: Query 조회·RHF/Zod 폼·재시도·저장 결과.
   `/me/profile`만 연결하고 인증 가드/계정별 캐시/취소/자동 쓰기 재전송 금지를 유지한다.
2. `src/mocks/profile-handlers.ts`: 실제 계약의 명시적 MSW fixture.
   `ProfileExtrasMock.tsx`: 계약 없는 로고/이미지·경력·크리에이터 링크의 개발 전용 임시 편집.
   추가 정보는 실제 PATCH에 섞지 않고 화면을 나가면 폐기한다. 파일 업로드 API를 추정하지 않는다.
3. `test/profiles.test.ts`, `e2e/profiles.spec.ts`: 계약·잘못된 입력·삭제/null/배열·미완성 저장·공개 상태 유지·
   오류와 재시도·개인 캐시 제거·역할별 화면·반응형·기존 인증 회귀 확인.
   기존 Web CI 절차를 유지하고 stacked base만 추가한다.

## 완료 기준과 경계

- 의뢰인은 이름만으로 저장 가능. 브랜드·소개·분야·자사몰/SNS는 선택. 이메일·배송지 편집/공개 없음.
- 크리에이터 소개·분야·스타일·제작 역할·작업 방식은 선택 저장. 현재 shared의 작업 가능 여부/날짜도 지원.
- 서버가 반환한 공개 상태만 표시하고 PROFILE-03·04 공개 제어·패키지·포트폴리오를 구현하지 않는다.
- D01 완료/공개 필수 조건, D21 분야/스타일 선택값 확정은 보류. shared의 임시 enum을 사용한다고 표시한다.
- 조회 실패 재시도, 저장 실패 입력 보존, 처리 중 중복 제출 차단, 저장 후 서버 응답으로 폼/캐시 동기화.
  불명확한 저장 결과에는 재저장 전 최신 값 확인을 제공한다.
- 실제 모드는 기존 `VITE_ENABLE_AUTH_API=true`에서 현재 프로필 API 어댑터를 사용한다.
  실행 API 환경/DB가 없어 실제 연결 완료를 주장하지 않는다. Mock은 개발 전용이며 운영 빌드에서 제외한다.
- `npm run test:web`, `npm run build:web`(타입·린트), `npm run format:check`,
  `npm run check:tokens`, 전체 Playwright를 실행하고 변경 내용을 검토한 후 커밋/푸시/Draft PR.
- 1단계 전체 완료 아님. 두 역할의 인증→프로필 저장→재조회 흐름만 추가 검증한다.

## 실패 시나리오

- 이전 계정의 지연 조회/저장이 새 계정 폼을 덮어씀: 기존 세션 epoch 검사 + 사용자 ID별 Query/form key.
- 창 포커스·재접속 재조회가 편집 중 입력을 지움: 자동 재조회를 끄고 명시적 최신 값 확인만 제공.
- 응답 DTO/역할 불일치: Zod 검증으로 거절하고 폼을 열지 않음.
- 통신 실패 후 저장 여부 불명확: 자동 재전송 금지, 입력 유지·최신 값 확인 안내.

공식 도구 동작 확인: [RHF useForm](https://react-hook-form.com/docs/useform),
[TanStack Query 기본값](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).
현재 설치 버전과 기존 인증 구현을 함께 확인했으며 신규 의존성은 추가하지 않는다.
