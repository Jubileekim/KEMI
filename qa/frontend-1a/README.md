# 1-A 프론트 인증 QA

`apps/web/test/auth*.test.ts`: 계약·경계·경합 검사. `apps/web/e2e/auth.spec.ts`: MSW 기반 화면 흐름. 서버·DB·실제 쿠키 연동을 증명하지 않는다.

기본 실행은 루트 `npm run test:web:e2e`이며 기존 Chromium/모바일 프로젝트를 사용한다. 이 Windows 세션은 기존 포트 충돌과 설치된 브라우저에 맞춰 무시되는 `tmp/playwright.local.config.ts`에 base config를 확장했다:

```typescript
import { defineConfig } from "@playwright/test";
import base from "../apps/web/playwright.config";
export default defineConfig({
  ...base,
  testDir: "../apps/web/e2e",
  use: { ...base.use, baseURL: "http://127.0.0.1:5179", channel: "msedge" },
  webServer: {
    command:
      "npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5179 --strictPort",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: false,
    env: { VITE_ENABLE_MOCKS: "true" },
  },
});
```

`npm exec -w @kemi/web -- playwright test --config ../../tmp/playwright.local.config.ts`.

운영 모드 smoke는 별도 셸에서:

```powershell
$env:VITE_ENABLE_AUTH_API='true'
$env:VITE_ENABLE_MOCKS='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_AUTH_API
Remove-Item Env:VITE_ENABLE_MOCKS
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4181 --strictPort
```

다른 셸에서 `node qa/frontend-1a/production-smoke.cjs`. Chromium 미설치·Edge 환경은 `$env:KEMI_BROWSER_CHANNEL='msedge'`. `KEMI_PREVIEW_URL`로 preview URL 변경 가능. 명령이 `production-results.json`을 갱신한다. **응답은 Playwright fixture이며 실제 API 요청 성공 증거가 아니다.** worker 미등록·개발 도구 미표시·API 모드 가입 차단을 포함한다.

시각 증거는 Mock 가입 화면 390/1280px이며 원본 토큰/브랜드 자산은 수정하지 않았다. 전체 테스트 trace/report는 무시되는 로컬 산출물이고 PR에 포함하지 않는다.
