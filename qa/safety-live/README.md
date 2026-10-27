# 실제 API 브라우저 검증

실제 production 빌드 + 로컬 API + 명시적인 로컬 `*_test` DB를 사용한다. 외부 결제·Storage를 호출하지 않는다. `api.cjs`는 이 로컬 테스트 DB에만 운영자와 알림 페이지 검증용 fixture를 만든다. 운영/개발 `.env`를 복사하지 않는다.

먼저 별도 테스트 DB에 마이그레이션을 적용하고 아래처럼 실행한다. DB 테스트와 브라우저 검증을 같은 DB에서 동시에 실행하면 안 된다.

```powershell
$env:TEST_DATABASE_URL='postgresql://kemi_test:kemi_test@127.0.0.1:54331/codex_safety_test'
npm run build:api
$env:VITE_ENABLE_AUTH_API='true'
$env:VITE_ENABLE_MOCKS='false'
npm run build:web
$env:KEMI_BROWSER_CHANNEL='msedge' # 설치된 Edge 사용. 기본 Chromium 사용 시 이 변수 생략
npm exec -w @kemi/web -- playwright test --config ../../qa/safety-live/playwright.config.ts
```

브라우저는 비회원 공개 조회, 실제 회원 로그인/활동, 신고, 운영자 제한, 당사자 이의, 해제, 선택 알림 읽음을 확인한다. 추가로 부분 초안 저장·이어쓰기·공개 실패 뒤 수정, 알림 페이지·미확인 필터 URL 복원·전체 읽음·조회 실패 뒤 복구를 확인한다. 운영 조치는 서버 저장 후 응답만 유실시켜 동일 내용 재시도가 이력을 중복 생성하지 않는지도 검증한다. 알림 조회 실패는 의도적으로 500을 주입하고 정상 조회·저장은 실제 API/DB를 사용한다. 데스크톱과 모바일 크기를 각각 실행하며 재시도는 0이다.

기존 개발 Mock 회귀는 별도 명령으로 실행한다. 기본 config의 검사·timeout·retry를 유지하고 설치된 브라우저만 선택할 수 있다.

```powershell
Remove-Item Env:VITE_ENABLE_AUTH_API,Env:VITE_ENABLE_MOCKS -ErrorAction SilentlyContinue
npm exec -w @kemi/web -- playwright test --config ../../qa/safety-live/mock-regression.config.ts auth.spec.ts screen-access.spec.ts
```

포트 4198/4401(실제 빌드 검증), 5174(Mock 검증)를 사용한다. 기존 서버를 재사용하지 않는다. trace와 결과는 무시되는 `test-results/`에 저장한다.
