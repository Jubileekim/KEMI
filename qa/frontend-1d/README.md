# 1-D 검증 재현

저장소 루트에서 실행한다. 실제 API/DB/외부 제공자 검증이 아닌 개발 MSW 및 운영 모의 HTTP 검사다.

- `npm run test:web`: `studio-packages.test.ts`의 후보 모델·불변 참조·대표/공개 조건과 기존 인증/프로필 검사.
- `studio-portfolio.test.ts`는 초안·샘플·고객 동의·역할/권한·D02 URL 차단·파일 보호 한도·수정/비공개/삭제 뒤 별도 모의 제출 참조 유지도 검사한다.
- `npm run build:web`: 타입·기존 ESLint·운영 산출물 생성. `npm run format:check`, `npm run check:tokens`, `git diff --check` 유지.
- `npm run test:web:e2e`: 정식 CI Chromium 데스크톱/모바일. `studio-packages.spec.ts`는 실제 화면과 MSW를 통해 다중 상품·명시적 대표·D01·공개·수정·비공개·조회·권한·revision 충돌·지연/로그아웃·오류/재시도·반응형을 검사한다.
- `studio-portfolio.spec.ts`는 작업물 편집·고객 동의·파일 선택/실제 로컬 재생/모의 업로드 완료/저장 분리·URL 초안·파일 오류·blob URL 정리·삭제 모달의 취소/실패/재시도/포커스 복귀와 **프로필→패키지→대표→공개→샘플→서비스 비공개**의 1-D 통합을 검사한다. 1단계 전체 통합 완료를 뜻하지 않는다.
- 로컬은 무시되는 `tmp/playwright.1d.config.ts`로 설치된 Edge와 작업 소유 5180 서버를 사용한다. 정식 CI 설정/재시도/타임아웃을 바꾸지 않는다. 여러 러너를 같은 출력 디렉터리에서 동시에 실행하지 않는다.

개발 시 `$env:VITE_ENABLE_MOCKS='true'` 후 `npm run dev:web`.
Mock 크리에이터 `creator@example.test` / `Kemi1234`로 로그인해 상단 패키지·서비스로 이동한다.
`1-D 개발 전용 시나리오`에서 응답·D01 모의 조건을 바꿀 수 있다. 기본은 공개 기준 미결정이다.
전체 새로고침하면 관리 데이터가 초기화된다. 실제 서버·공개 피드·신규 활동 API에는 쓰지 않는다.

작업물은 상단 `작업물 관리`로 이동한다. 외부 URL은 D02가 미결정이라 초안만 지원한다. 파일은 MP4/WebM·50MiB 이하의 명시적 모의 미리보기 보호 한도를 쓰며 실제 업로드 정책이 아니다. 테스트의 유효 영상은 1,349바이트의 무음 녹색 합성 fixture다. [출처/재생성](../../apps/web/e2e/fixtures/README.md)을 참고한다. 파일 bytes·사용자 영상은 API로 전송하지 않는다.

`node qa/frontend-1d/capture.cjs`, `node qa/frontend-1d/capture-portfolio.cjs`로 390/1280px 편집·목록·삭제 모달 캡처를 재현할 수 있다. 영상 캡처는 자체 fixture를 사용한다. 로컬 브라우저/글꼴에 따라 캡처가 달라질 수 있다.

운영 검사:

```powershell
$env:VITE_ENABLE_AUTH_API='true'
$env:VITE_ENABLE_MOCKS='true'
npm run build:web
Remove-Item Env:VITE_ENABLE_AUTH_API,Env:VITE_ENABLE_MOCKS
npm exec -w @kemi/web vite -- preview --host 127.0.0.1 --port 4184 --strictPort
```

다른 터미널에서 `node qa/frontend-1d/production-smoke.cjs`.
환경 플래그가 있어도 운영에서 Mock이 제외되는지 산출물/브라우저를 모두 확인한다.
인증은 독립 모의 HTTP 응답이다. 운영 계약 준비 화면·역할 차단·미정의 쓰기 없음과 페이지 오류를 검사한다.
전체 report/trace/dist/환경 값/tmp는 커밋하지 않는다. 실행 결과와 시각 검토 경계는 진행 기록을 따른다.
