# 1-B Google 로그인

범위: AUTH-04만. 카카오 AUTH-06 미착수. 기준: 기능 엑셀 AUTH-04/P03,
frontend-plan §3/§4/§6 1단계, feature-matrix AUTH-04, api문서 317~397행과
현재 API/shared 계약. 기술 PDF의 React/Vite·Router·Query·RHF/Zod·Axios 유지.

## 구현·검증 순서

1. `features/auth/google.ts`: 콜백 쿼리의 단일 결과 검증, 안전한 복귀 경로만
   탭 저장소에 보존. `session-controller.ts`: 소셜 가입 쿠키 요청을 기존 큐에 연결.
   `test/google.test.ts`에서 잘못된 콜백·세션 수락/거절·중복/늦은 응답을 검사.
2. `GoogleButton.tsx`, `GoogleCallback.tsx`, `SocialSignupForm.tsx`: 시작·기존 로그인
   확인·신규 역할/이름·취소/실패/만료/충돌/재시도. `App.tsx`, `providers.tsx` 연결.
   `mocks/GoogleProvider.tsx`, `auth-handlers.ts`: 개발 전용 명시적 제공자 시뮬레이션.
3. `e2e/google.spec.ts`: 두 역할·복귀·동일 계정 재로그인·취소·오류·중복 제출·
   티켓 만료·자동 병합 금지·모바일/PC 확인. 웹 전체 단위/E2E와
   build:web·format:check·check:tokens·diff 검사를 실행하고 변경 내용을 검토.
4. 독립 기능 묶음인 1-B를 커밋·푸시하고 1-A 브랜치를 base로 Draft PR 생성.
   원격 CI와 로컬 결과를 분리하여 frontend-progress에 전달 상태를 기록.

## 실패 시나리오와 경계

- 쿼리는 인증 증거가 아니다. login은 refresh→me, signup은 서버 티켓 조회/가입
  응답 검증 후에만 인증 상태로 전환. OAuth state·PKCE·코드 교환은 기존 서버 책임.
- StrictMode 중복 실행·중복 제출·늦은 세션 응답을 제어. 가입 변경 요청 자동 재시도 없음.
  네트워크 결과 불명확/409/만료 시 Google부터 다시 시작하도록 안내.
- 제공자 이메일은 표시 전용. 기존 이메일 계정 로그인/자동 병합을 수행하지 않는다.
- 새 사용자는 인증 전이므로 보호된 `/onboarding` 대신 공개 콜백 안에서 역할/이름을
  받는다. 성공 후 `/me/profile`. 프로필 완료 판정 계약 부재(D01)는 유지.
- 실제 APP_ORIGIN·proxy/rewrite·Google 콘솔·HttpOnly/Secure 쿠키·DB·동시 탭은
  실행 환경이 없어 미검증. D05 미결정 상태 유지. 이 범위/1단계 전체 완료와 구분.

## 연결 방법과 검토

- 기본 인증 비활성 유지. `VITE_ENABLE_AUTH_API=true`일 때 현재 API 계약 어댑터를
  사용한다. `VITE_API_BASE_URL`은 공개 API Origin만 지정하며 비밀키는 넣지 않는다.
  권장 연결은 동일 Origin의 `/api` proxy/rewrite. 서버의 `APP_ORIGIN` 및 제공자
  콜백 `{APP_ORIGIN}/api/auth/google/callback`을 기존 인수인계 절차대로 준비해야 한다.
- 콜백 결과에는 제공자 정보가 없는 기존 API 계약을 유지한다. login은 서버가
  검증한 refresh→me만 신뢰하고, signup 조회에서는 `provider=google`만 허용한다.
  카카오 티켓을 받으면 폼/가입을 차단한다. 카카오 프론트 구현은 미착수다.
- query의 중복 키·모호한 결과·알 수 없는 값·토큰/코드는 거절한다. React StrictMode의
  중복 effect에서도 login 확인은 한 흐름으로 공유한다. 탭 저장소에는 10분 이내
  내부 복귀 경로만 두고 사용 후 지운다. 로그인/가입 전 이전 개인 캐시를 지운다.
- 제출 중 재시작/로그인 링크는 잠시 비활성. 신규 티켓 조회 결과는 현재 콜백에만
  보존해 세션의 개인 Query 캐시 초기화가 입력 폼을 다시 만들지 않게 한다.
  빠른 모의 HTTP 응답에서 완료 이동이 누락되던 실패를 재현하고 수정했다.
- 최종 diff는 명세와 코드 품질/보안 축으로 자체 검토했다. 입력 스키마·외부 복귀·
  provider 거부·토큰 노출·계정 캐시·늦은 응답·개발 코드 제외를 검사한다.
  서버 보안/DB·실제 제공자 검증을 대체하지 않으며 사람의 검토를 위해 Draft 유지.
- 의존성/lockfile·API/shared·DB·원본 디자인/기능 엑셀 변경 없음. 검사 규칙을
  완화하지 않았다. CI는 stacked PR의 base `feat/frontend-1a-email-auth`만 추가 허용.

검증 명령/증거: `qa/frontend-1b/README.md`. 최종 수치·Git 전달 상태:
`frontend-progress.md`의 1-B 절.

동작 확인에 참고한 공식 문서: [React effect](https://react.dev/reference/react/useEffect),
[Query 재시도](https://tanstack.com/query/latest/docs/framework/react/guides/query-retries).
설치된 React 19·Query 5의 기존 프로젝트 사용 방식/타입과 대조했다.
