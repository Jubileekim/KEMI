# 1-C 프로필 편집 QA

기준 저장소 루트 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`에서 실행한다.
실제 API·DB 검증이 아닌 **명시적 MSW/모의 HTTP** 검사다.

- `npm run test:web`: 기존 인증/HTTP 검사와 `test/profiles.test.ts` 계약 검사.
- `npm run build:web`: shared 생성·웹 타입·ESLint·운영 빌드.
- `npm run format:check`, `npm run check:tokens`, `git diff --check`.
- `npm run test:web:e2e`: 정식 CI의 Chromium 데스크톱/모바일.
  `e2e/profiles.spec.ts`에서 개인 의뢰인·미완성 크리에이터·선택값 삭제·오류·재시도·
  중복 제출·계정 전환·추가 Mock 분리·320~1280px 넘침을 확인한다.
- 로컬은 기존 무시되는 `tmp/playwright.local.config.ts`의 Edge·5179를 사용했다.
  테스트가 모두 끝난 뒤 Windows 개발 서버 종료 대기가 이어져, 같은 작업 소유 서버에
  `webServer: undefined`인 `tmp/playwright.profile.config.ts`로 전체를 별도 실행했다.
  정식 Chromium/CI 설정·재시도·타임아웃은 변경하지 않는다. 최종 결과는 진행 기록 참조.

## 개발 Mock 재현

`$env:VITE_ENABLE_MOCKS='true'` 후 `npm run dev:web`.
`client@example.test` 또는 `creator@example.test` / `Kemi1234`로 로그인한다.
Mock 기본 프로필은 탭의 모듈 메모리에만 있으며 전체 새로고침 시 초기화된다.
Mock 추가 정보는 프로필 화면을 나가면 폐기한다. 이미지 bytes를 전송하지 않는다.
개발 도구의 **Mock 프로필 응답**으로 지연·400/403/409/500·네트워크·만료·잘못된 응답을 선택한다.
다른 항목 검사 전 `success`로 되돌린다.

## 운영 빌드 + 모의 HTTP

```powershell
$env:VITE_ENABLE_AUTH_API='true'
$env:VITE_ENABLE_MOCKS='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_AUTH_API,Env:VITE_ENABLE_MOCKS
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4183 --strictPort
```

다른 터미널에서 `node qa/frontend-1c/production-smoke.cjs`.
설치된 Edge를 사용하며 URL은 `KEMI_PREVIEW_URL`로 바꿀 수 있다.

`production-results.json`은 두 역할 부분 PATCH·Bearer·응답 반영·키보드·
공개 상태 유지·실패 입력 보존·명시적 최신 값 조회·개인정보 비노출·운영 Mock 제외의 결과다.
`profile-{client,creator}-{390,1280}.png`는 이 모의 응답 화면이다.
HTTP fixture 자체가 저장 내용을 메모리로 유지하므로 재조회/새로고침 성공은 실제 DB 지속성 증거가 아니다.
화면 캡처를 시각 검토하고 브랜드 원본/토큰을 변경하지 않았다.

실제 API·권한·DB·Origin·쿠키·외부 제공자·파일 저장은 미검증.
전체 trace/report/tmp 로그·dist·환경 값은 커밋하지 않는다.
