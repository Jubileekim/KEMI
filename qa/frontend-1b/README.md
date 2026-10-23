# Google 로그인 QA

기준 저장소 루트에서 실행한다. 실제 API·Google 인증 증거가 아닌 **명시적 Mock/모의 HTTP** 검사다.

- `npm run test:web`: 콜백 분기·복귀·shared 가입 계약·세션·늦은 응답.
- `npm run test:web:e2e`: CI의 Chromium 데스크톱/모바일. 기존 이메일/health와
  Google 신규/기존 회원·취소·오류·만료·중복·재로그인·새로고침·반응형 흐름.
- 이 세션의 로컬 E2E는 무시되는 `tmp/playwright.local.config.ts`에서 Edge와
  5179만 지정했다. 정식 Playwright 설정과 CI의 Chromium 프로젝트는 유지한다.
- `production-results.json`: 운영 빌드에 Playwright가 HTTP 응답을 제공한 7개 검사.
  서버의 state·PKCE·쿠키 검증, DB의 계정 유일성·실제 Google 동의를 검증한 결과가 아니다.
- `google-signup-{390,1280}.png`: 운영 빌드+모의 가입 티켓 화면. 원본 KEMI 토큰·로고 유지.
  전체 trace/report/tmp 로그는 커밋하지 않는다.

## 운영 모드 재현 (PowerShell)

```powershell
$env:VITE_ENABLE_AUTH_API='true'
$env:VITE_ENABLE_MOCKS='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_AUTH_API, Env:VITE_ENABLE_MOCKS
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4182 --strictPort
```

다른 터미널에서 `node qa/frontend-1b/production-smoke.cjs`.
설치된 Edge를 사용한다. URL은 `KEMI_PREVIEW_URL`로 변경할 수 있다.
Mock 플래그를 일부러 켠 빌드에서도 worker/제공자 Mock/개발 도구가 제외돼야 한다.

개발 Mock은 `VITE_ENABLE_MOCKS=true`로 web 실행 후 Google 버튼에서 제공자
시뮬레이션을 선택한다. 기존 이메일 회원과 같은 제공자 이메일을 가진 별도 Google
fixture를 사용한다. 역할만 비밀이 아닌 `kemi_mock_google_role` 세션 쿠키로 유지하며,
표시 이름 편집은 탭 메모리 한정이다. 티켓은 탭 메모리이고 새로고침하면 사라진다.
이 표식은 실제 인증/HttpOnly 쿠키가 아니며 운영 빌드에 포함되지 않는다.
