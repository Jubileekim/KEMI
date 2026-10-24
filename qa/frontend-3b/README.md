# 3-B 검증 재현

저장소 루트 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI` 기준. 실제 API/DB·알림·전자서명·결제 검증과 단일 탭 MSW 검증을 구분한다.

```powershell
npm run test:web
npm run build:web
npm run format:check
npm run check:tokens
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-3b/playwright.edge.config.ts signatures.spec.ts terms.spec.ts
```

- 로컬 Edge 데스크톱/모바일·workers2·retry0·기존 timeout 유지. 전용 포트5187, 보고서/trace는 OS 임시 폴더 `kemi-3b-{results,report}`. 전체 회귀는 파일 인자를 생략한다. 원격은 기존 Chromium CI다.
- `$env:KEMI_CAPTURE_DIR=(Resolve-Path qa/frontend-3b).Path`로 관련3-B 통합 검사를 실행하면390/1280px 서명 캡처를 생성한다. 전체 회귀에서는 다른 단계의 캡처를 섞지 않도록 해당 변수를 제거한다.
- 브라우저 검증과 shared 재빌드(단위/빌드)를 겹쳐 실행하지 않는다. 만료 검사는 탐색 전 Playwright Clock을 설치한다. 후보/권한은 실제 UI 로그인과 기존 Mock endpoint fixture로 검증하며 서버 원자성 증거가 아니다.
- 운영 제외: `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`로 빌드 후4191 preview에서 `node qa/frontend-3b/production-smoke.cjs`. 독립 HTTP 인증 fixture16개와 Mock/worker·서명 코드 제외를 확인한다. 실제 인증/API 검증이 아니다.
