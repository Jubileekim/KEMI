# 4-D 재현

루트에서 실행한다. 실제 API/DB/스토리지/정산이 아닌 DEV/MSW 검증이다. shared 빌드와 E2E를 겹치면 HMR로 메모리 기록이 초기화되므로 순서대로 실행한다.

```powershell
npm run test:web
$env:VITE_ENABLE_MOCKS='true'
$env:VITE_ENABLE_AUTH_API='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_MOCKS,Env:VITE_ENABLE_AUTH_API
npm run check:tokens
$env:KEMI_CAPTURE_DIR="$PWD/qa/frontend-4d"
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4d/playwright.edge.config.ts final.spec.ts
Remove-Item Env:KEMI_CAPTURE_DIR
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4d/playwright.edge.config.ts delivery.spec.ts production.spec.ts --workers=1
```

설치된 Edge, 전용5192, workers2/retry0를 유지한다. 신규4-D 통합 검사는 선행 공개 제안부터 수령까지 반복 로그인·서명·제작을 포함해 테스트당60초를 사용한다. 기본30초 실행은 실제 수령 직후 전체 실행 한도에 도달했다. 기존 회귀의30초·assertion5초와 CI 설정은 변경하지 않는다. 시스템 tmp의 kemi-4d-results/report에 실패 증거를 저장한다. CI에는 stacked base 4-C 허용1행만 추가하고 원격에서 전달받은60분 job과 검사 강도를 유지한다.

운영 제외: 두 flag 운영 빌드 후 `npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4196 --strictPort`를 실행하고 별도 셸에서 `$env:KEMI_PREVIEW_URL='http://127.0.0.1:4196'; node qa/frontend-4d/production-smoke.cjs`. 기존 HTTP 인증 fixture를 재사용하며 실제 서버 인증 증거가 아니다.

검토 fixture는4-B의 자체 제작 `kemi-review.webm`을 재사용한다. `apps/web/e2e/fixtures/kemi-final.zip`은 기존 자체 제작 `local-preview.webm`을 `final.webm`으로 담은 결정적 ZIP이며 개인정보/실제 고객 파일이 아니다. SHA256 `a0a607d72ccfefc5a1c89c95e57f5551aa6822e41c51ca9dfa802570f5150032`. Python 표준 zipfile의 ZipInfo('final.webm',(2026,10,26,0,0,0))와 ZIP_STORED로 재생성할 수 있다. 브라우저 다운로드 바이트 해시를 원본 ZIP과 대조한다. 파일 내용/워터마크/ZIP 내부 검사를 앱이 구현한 것은 아니다.

최종 연관 회귀는4-B12개+4-A10개를 로컬 단일 worker로 실행한다. 기존30초 한도·assertion5초·retry0는 그대로이며 다른 앱/브라우저와의 자원 경합을 줄이는 실행 선택이다.4-C/제안·채팅 전체 브라우저 회귀를 통과했다고 표시하지 않는다. 신규4-D에는 오류 요청→시정 동의→수정본→최신 버전 승인 연결도 포함한다.

결과·실패/해결·최종 SHA·PR/CI는 `docs/frontend-progress.md`, 근거·정책 경계는 `docs/frontend-final-4d.md`를 확인한다. 정산을 포함한4단계 전체 완료 검증이 아니다.
