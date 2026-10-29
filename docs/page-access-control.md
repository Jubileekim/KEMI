# 페이지 접근 권한 보강

## 범위와 계획

역할별 전용 페이지와 다른 사람의 의뢰·계약·작업 공간 접근을 모두 처리한다.

1. `apps/web/src/app/route-pages.tsx`: 기존 `screens.roles` 정책을 유지하고, 인증 완료 상태와 허용 역할이 모두 일치할 때만 보호 페이지를 렌더링한다. 거부 화면에는 현재/필요 역할, 홈 이동, 로그아웃 후 다른 계정 로그인 동선을 제공한다. 로그인 복귀 주소는 기존 가드와 `safeReturnTo` 검사를 사용한다.
2. `apps/web/src/features/live/ui.tsx`: API 조회의 403/404를 공통 접근 불가 화면으로 표시한다. 404는 자료 존재 여부를 추측하거나 서버 메시지를 노출하지 않고, 권한 없음/존재하지 않음을 함께 안내한다.
3. `apps/web/src/features/requests/WorkspaceLive.tsx`: 조건서 조회가 거부되면 본문·대화·조건서 작성 화면을 마운트하지 않는다. 조건서가 아직 없는 본인 직접 의뢰는 직접 의뢰 조회 성공으로 허용한다. 두 조회 모두 거부되면 접근 불가 화면으로 종료한다.
4. 전체 보호 경로/역할 조합과 인증 상태를 단위 테스트한다. 브라우저에서 직접 URL·새로고침·계정 전환을 확인하고, 운영 번들의 의뢰/작업 공간/계약 7개 경로에 403/404 응답을 주어 본문과 후속 대화 조회가 차단되는지 검증한다. 본인 의뢰 정상 접근도 함께 확인한다.

## 보안 경계

- 페이지 가드는 사용자 안내와 화면 차단을 담당한다. 최종 자료 접근 권한은 서버가 인증한 사용자와 자료의 당사자 관계로 판정한다.
- 기존 API의 프로젝트 의뢰인 검사와 조건서·대화방의 당사자 검사를 유지한다. 다른 사용자의 자료에 404를 반환하는 존재 은닉 정책을 변경하지 않는다.
- DB 스키마, API 계약, 역할 정책, 의존성 변경은 없다.
- 로컬 브라우저 검증은 MSW 또는 통제된 API 응답을 사용한다. 실제 운영 계정·DB 접근 보안이나 배포 완료를 증명하지 않는다.

## 검증 명령

- `npm run test -w @kemi/web`
- `npm run build -w @kemi/web` (운영 API 경로 검증 시 `VITE_ENABLE_AUTH_API=true`, `VITE_ENABLE_MOCKS=false`)
- `npm exec -w @kemi/web -- playwright test e2e/page-access.spec.ts`
- 운영 번들 빌드 후 `npm exec -w @kemi/web -- playwright test e2e/production/resource-access.spec.ts --config=playwright.production.config.ts`

로컬 Edge 실행에서는 기본 Playwright 설정의 브라우저 채널을 `msedge`로 바꾼 임시 설정을 사용했다. 서버 종료 대기를 분리한 재실행 결과와 실제 통과 수는 PR의 Evidence에 기록한다.
