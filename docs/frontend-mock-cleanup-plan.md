# 프론트엔드 Mock 정리 계획 (제안, 2026-10-27)

**아직 아무것도 지우지 않았다.** 이 문서는 무엇을 어떤 순서로 정리할지에 대한 제안이다. 정리 여부와 시점은 프론트엔드 담당(윤철님)과 PM(희년님)이 정한다.

## 배경

- #77로 배포 빌드의 기능 화면은 실제 `/api`로 동작한다.
- 개발 Mock(`VITE_ENABLE_MOCKS=true`)은 개발 모드에서만 쓰인다. 배포 번들에는 들어가지 않는다.
- 그래서 **지금 Mock을 두어도 배포에는 영향이 없다.** 다만 같은 화면이 Mock용과 실제용으로 두 벌이라, 앞으로 고칠 때 두 곳을 맞춰야 하는 부담이 있다.

## 지워도 사라지지 않는 것

- **실제 사용자 사진·영상**: Supabase Storage(`kemi-files`)와 DB에 있다. 프론트엔드 코드와 무관하다.
- **디자인 시스템**: `components/ui`, `design-tokens`, `styles`는 Mock과 무관하다.
- **Git 이력**: 지운 파일도 이력에서 되살릴 수 있다.

## 정리 대상 (현재 `feat/web-real-api` 기준)

| 구분                           | 대상                                                                                                                           | 규모                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Mock 화면·가짜 서버            | `src/mocks/` 전체 (`*Mock.tsx`, `*-handlers.ts`, `*-model.ts`, `*-api.ts`, `browser.ts`, `DevTools.tsx`, `GoogleProvider.tsx`) | 90개 파일, 약 1만3천 줄                      |
| 시연 샘플 미디어               | `src/mocks/assets/catalog-sample.webm`, `catalog-poster.png`                                                                   | 팀이 만든 합성 테스트 영상. 고객 콘텐츠 아님 |
| MSW 워커·의존성                | `public/mockServiceWorker.js`, `package.json`의 `msw` 의존성·설정                                                              | —                                            |
| Mock 연결 코드                 | `src/main.tsx`(워커 시작), `src/app/App.tsx`(DevTools·Google Mock 라우트), 각 `*Page.tsx`의 `mockEnabled && *Mock` 분기        | 약 20개 페이지                               |
| Mock 모델을 쓰는 기존 컴포넌트 | 아래 목록                                                                                                                      | 13개 파일                                    |
| Mock 기반 단위 테스트          | `test/` 중 18개                                                                                                                | 아래 목록                                    |
| Mock 기반 E2E                  | `e2e/` 24개 spec 대부분(`playwright.config.ts`가 `VITE_ENABLE_MOCKS=true`로 띄움)                                              | 22개 이상                                    |

**Mock 모델을 쓰는 기존 컴포넌트**

- `features/portfolio/PortfolioCard.tsx`
- `features/production/`: `FinalReceiptPanel`, `ReviewActions`, `RevisionRequestForm`
- `features/resolution/`: `CancellationAgreement`, `DisputePanel`, `RefundStatusPanel`
- `features/terms/`: `SignaturePanel`, `TermsEditor`, `TermsVersionView`
- `features/profiles/ProfilePage.tsx`의 `ProfileExtrasMock` 분기

이 파일들은 Mock 화면에서만 쓰인다. 실제 화면은 `*Live.tsx`가 맡는다.

**Mock 기반 단위 테스트**: `campaigns`, `cancellation`, `catalog`, `delivery`, `direct`, `discovery`, `final`, `payments`, `pricing`, `production`, `proposals`, `resolution-workflow`, `revisions`, `settlement`, `signatures`, `studio-packages`, `studio-portfolio`, `terms`

**그대로 두는 테스트**: `auth`, `auth-transport`, `google`, `health`, `profiles`, `live-api`

## 지우면 바뀌는 것

1. **개발 방식**
   - 로컬에서 화면을 보려면 실제 API(+ 테스트 DB)를 같이 띄워야 한다.
   - 백엔드 없이 프론트만 빠르게 보던 방식이 없어진다.
   - 대신 `npm run dev -w @kemi/api` + `API_PROXY_TARGET`으로 실제 흐름을 본다.
2. **E2E**
   - 지금 E2E는 Mock 서버의 시나리오 전환(지연·오류·응답 유실)으로 화면 예외 처리를 검사한다.
   - Mock을 지우면 이 검사들을 다음 둘 중 하나로 옮겨야 한다.
     - Playwright의 `page.route()`로 실제 `/api` 응답을 가로채는 방식
     - 테스트 DB를 쓰는 실제 API E2E
   - 옮기지 않고 지우면 예외 처리 회귀를 잡지 못한다.
3. **열린 프론트 PR #73·#74·#76**
   - Mock 위에 쌓여 있어 충돌이 난다.
   - 먼저 실제 API 기준으로 옮긴 뒤 정리해야 한다.
   - 대조표는 각 PR의 리뷰 댓글에 있다.
4. **화면 문구·구성 차이**
   - Mock 화면에만 있던 기능은 실제 화면에 아직 없다.
   - 예: 시나리오 전환 DevTools, 일부 세부 안내, 신고·제한 Mock
   - 필요한 것은 실제 API가 생긴 뒤 실제 화면에 다시 만든다.

## 제안 순서

1. **#51~#64 → #77 병합·배포.** 배포 빌드는 실제 화면으로 동작한다. Mock은 아직 그대로 둔다.
2. **E2E 이전.**
   - 핵심 거래 흐름 E2E를 실제 API(테스트 DB) 기준으로 1개 만든다.
   - 예외 처리 E2E는 `page.route()`로 옮긴다.
   - 옮긴 Mock E2E부터 하나씩 지운다.
3. **열린 PR 정리.** #73·#74·#76을 실제 API 기준으로 옮기거나 닫는다(윤철님 판단).
4. **Mock 삭제(한 PR).**
   - `src/mocks/`, Mock 연결 분기, Mock 모델 컴포넌트, Mock 단위 테스트, MSW 의존성·워커를 지운다.
   - 각 페이지는 실제 화면만 남긴다(`*Page.tsx` → `*Live.tsx` 직접 사용).
5. **확인.** 웹 단위·빌드·실제 API E2E가 통과하고 배포 화면이 같은지 확인한다.

단계 2~4는 서로 독립이 아니다. 2가 끝나야 4에서 테스트를 안전하게 지울 수 있다.
