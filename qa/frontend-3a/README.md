# 3-A 검증 재현

저장소 루트 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI` 기준이다. 실제 API/DB·서명/알림·외부 제공자 검증과 개발용 단일 탭 MSW 검증을 구분한다.

```powershell
npm run test:web
npm run build:web
npm run format:check
npm run check:tokens
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-3a/playwright.edge.config.ts terms.spec.ts
```

- Edge 설치 환경의 데스크톱·모바일 2개 프로젝트. 기존 workers2/retries0/timeout을 유지하며 5186 전용 서버를 실행한다. 보고서/trace는 OS 임시 폴더 `kemi-3a-{results,report}`에 저장한다. 전체 회귀는 마지막 명령의 `terms.spec.ts`만 생략한다. 원격 CI는 기존 Chromium 설정이다.
- `$env:KEMI_CAPTURE_DIR=(Resolve-Path qa/frontend-3a).Path`를 설정한 관련 검사에서 조건서 390/1280px 캡처를 재생성한다. 원본 요구/가정은 `docs/frontend-terms-3a.md`를 확인한다.
- 실제 공개/제안/협의 UI와 기존 Mock 서비스 fixture로 준비한다. 충돌은 동일 Mock endpoint의 별도 POST로, 계정 전환은 기존 로그인 UI로 검증한다. 영구 저장·실제 동시성 증거가 아니다.
- 빌드/형식 검사와 브라우저 회귀를 동시에 실행하지 않는다. 원격 CI와 로컬 결과·중간 실패/최종 통과는 진행 문서에 별도 기록한다.
- 운영 제외 검사: `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`로 `npm run build:web` 실행 후 4190 포트 preview에서 `node qa/frontend-3a/production-smoke.cjs`를 실행한다. 기존 제안 경로의 독립 HTTP 인증 fixture에 조건서 코드/문구/endpoint 제외 검사를 추가했다. 16개 결과는 `production-results.json`에 기록하며 실제 인증·서버 통합 증거가 아니다.
- 제한 환경의 첫 관련 실행은 10개 검사 출력 뒤 서버 종료가 대기했다. 해당 KEMI Vite/5186 명령을 확인해 전용 서버만 정리한 뒤 최종 `10 passed`, exit0을 확인했다. 최종 전체 회귀는 별도 실행으로 기록하며 중간에 검토 때문에 중단한 실행은 통과로 계산하지 않는다.
