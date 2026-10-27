# 기존 화면 접근 점검 · 2026-10-26

기준 저장소: `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`. 조사 기준은 `apps/web/src/app/routes.ts`, `App.tsx`, `layouts/Shell.tsx`, `route-pages.tsx` 및 아래 기능/Mock 컴포넌트다. 상위 폴더의 독립 앱은 대상이 아니다.

## 범위와 검증 계획

4-E 추가: `/contracts/:contractId/settlement`는 양측 보호 라우트다. 기존 제작 준비/영상 버전의 `모의 정산 결과 확인` 링크와 같은 협의방의 확정 정산 시스템 안내에서 접근한다. 실제 정산 API가 없어 운영에서는 연결 준비 안내를 표시한다. 아래 34개 경로 표는 접근 개선 당시 기록이며 4-E에서 정산 경로 1개를 추가했다. 검증 결과는 `frontend-progress.md`의 4-E 기록을 따른다.

1. 34개 제품 경로와 중첩 기능을 분류하고, 메뉴/부모 화면의 연결을 추적한다.
2. `ScreenLinks.tsx`와 `route-pages.tsx`: 홈·내 활동에 기존 화면 이동 안내만 제공한다. 피드/활동 데이터 기능은 구현하지 않는다.
3. `ProfilePage.tsx`: 크리에이터 프로필에서 기존 패키지/작업물 관리로 연결한다. `DiscoveryDetailMock.tsx`: 기존 creator 전용 제안 역할에 맞춰 행동 노출을 제한한다.
4. `e2e/screen-access.spec.ts`: 실제 클릭으로 비회원·의뢰인·크리에이터 흐름과 URL 위조 시 가드 유지를 확인한다. 기존 단위/E2E, 타입·lint·build·format·토큰 검사와 운영 Mock 제외 검사를 실행한다.
5. 이 문서와 `frontend-progress.md`에 검증 결과와 Git 전달을 기록한다. API/shared/정책/인증 설정/배포/병합은 변경하지 않는다.

## 전체 경로와 기존 진입점

권한의 ‘양측’은 client/creator이며 실제 거래 당사자 권한은 데이터 계층에서 별도 검증한다. ‘구현’은 컴포넌트 연결을 뜻한다. 운영 API 연동 완료를 뜻하지 않는다.

| 경로                                  | 구분 / 컴포넌트                | 권한    | 수정 전 접근 / 수정 후 보완                                                     |
| ------------------------------------- | ------------------------------ | ------- | ------------------------------------------------------------------------------- |
| `/`                                   | Placeholder · 작품 피드 미구현 | 공개    | 로고·작품 메뉴 → 기존 화면 이동 안내 추가                                       |
| `/works/:workId`                      | Placeholder                    | 공개    | 피드/상세 기능 미구현. 임의 샘플 링크 추가 안 함                                |
| `/creators/:creatorId`                | Placeholder                    | 공개    | 공개 프로필 미구현. 관리용 프로필과 구분                                        |
| `/login`                              | 구현 · AuthForm                | 공개    | 주 메뉴 / 홈 안내 추가                                                          |
| `/signup`                             | 구현 · AuthForm                | 공개    | 로그인 폼의 가입 링크 / 홈 안내 추가                                            |
| `/auth/social/callback`               | 구현 · GoogleCallback          | 공개    | Google 인증 복귀 전용. 일반 메뉴에 추가 안 함                                   |
| `/onboarding`                         | Placeholder                    | 양측    | 미구현. Google 신규 가입은 기존 callback 폼에서 처리                            |
| `/me/profile`                         | 구현 · ProfilePage             | 양측    | 주 메뉴·가입 완료 / 홈·내 활동 안내, 제작 관리 연결 추가                        |
| `/studio/portfolio`                   | 구현 · PortfolioPage           | creator | 주 메뉴·패키지 관리 / 홈·내 활동·프로필 안내 추가                               |
| `/studio/packages`                    | 구현 · PackagesPage            | creator | 주 메뉴·작업물 관리 / 홈·내 활동·프로필 안내 추가                               |
| `/campaigns`                          | 구현 · CampaignBrowsePage      | 공개    | 주 메뉴·작성 화면 / 홈·내 활동 안내 추가                                        |
| `/campaigns/:campaignId`              | 구현 · CampaignBrowsePage      | 공개    | 목록 카드·공개 결과 링크. 기존 연결 유지                                        |
| `/campaigns/new`                      | 구현 · CampaignEditor          | client  | 주 메뉴 / 홈·내 활동에서 작성·저장한 초안 안내 추가                             |
| `/campaigns/:campaignId/edit`         | 구현 · CampaignEditor          | client  | 작성 화면의 내 캠페인 목록→초안 이어 쓰기/공개 결과. 기존 연결 유지             |
| `/campaigns/:campaignId/proposals`    | 구현 · ProposalPage            | client  | 본인 공고 상세→제안 후보 확인. 기존 연결 유지                                   |
| `/campaigns/:campaignId/apply`        | 구현 · ProposalPage            | creator | 모집 상세→제안 제출. 비회원은 로그인 후 복귀. 의뢰인에게 잘못 노출되던 CTA 제거 |
| `/requests`                           | 구현 · ProposalPage            | 양측    | 주 메뉴 / 홈·내 활동에서 협의 이어가기 추가                                     |
| `/requests/:requestId`                | 구현 · ProposalPage            | 양측    | 본인 제안·협의 카드→의뢰 상세. 기존 연결 유지                                   |
| `/creators/:creatorId/request`        | Placeholder                    | client  | 직접 의뢰 미구현. 일반 메뉴 추가 안 함                                          |
| `/workspace/:requestId`               | 구현 · ProposalPage            | 양측    | 협의 가능한 제안 카드→대화·작업 공간. 기존 연결 유지                            |
| `/contracts/:contractId/payment`      | 구현 · PaymentPage             | client  | 작업 공간의 확정 서명 계약→테스트 결제. 기존 연결 유지                          |
| `/contracts/:contractId/production`   | 구현 · ReadinessPanel          | 양측    | 확정 계약/결제/영상 화면→준비·납기. 기존 연결 유지                              |
| `/contracts/:contractId/deliveries`   | 구현 · DeliveryVersions        | 양측    | 확정 계약/제작 준비→영상 버전. 기존 연결 유지                                   |
| `/payments/result`                    | 구현 · PaymentResultPage       | 양측    | Mock 결제 결과/크리에이터 확정 계약→결제 내역. 계약 query 필요                  |
| `/contracts/:contractId/cancellation` | Placeholder                    | 양측    | 취소 미구현. 메뉴 추가 안 함                                                    |
| `/disputes/:disputeId`                | Placeholder                    | 양측    | 분쟁 미구현                                                                     |
| `/me/activity`                        | Placeholder · 활동 내역 미구현 | 양측    | 주 메뉴·의뢰인 기본 로그인 복귀점 / 역할별 기존 화면 안내 추가                  |
| `/bookmarks`                          | Placeholder                    | creator | 저장 캠페인 미구현                                                              |
| `/recommendations`                    | Placeholder                    | creator | 추천 미구현                                                                     |
| `/notifications`                      | Placeholder                    | 양측    | 독립 알림 화면 미구현. 작업 공간의 시스템 사건 안내와 구분                      |
| `/contracts/:contractId/review`       | Placeholder                    | 양측    | 리뷰 미구현                                                                     |
| `/reports/new`                        | Placeholder                    | 양측    | 신고 미구현                                                                     |
| `/ops/reports`                        | Placeholder                    | ops     | 운영 신고 검토 미구현·D18                                                       |
| `/ops/disputes`                       | Placeholder                    | ops     | 운영 분쟁 검토 미구현·D18                                                       |

제품 경로 **34개 = 기능 컴포넌트 19개 + Placeholder 15개**. 기능 컴포넌트 19개 중 상위 화면/메뉴에서 완전히 고립된 경로는 없었다. 문제는 홈과 의뢰인 기본 로그인 도착점이 다음 행동을 안내하지 않는 점, 프로필과 제작 관리의 약한 연결, 의뢰인에게 노출되던 creator 전용 CTA였다. 수치상 새로운 기능 경로를 추가하지 않았다.

`/__dev/ui`, `/__dev/health`, `/__mock__/google`은 DEV 전용 부가 경로이며 위 집계에 포함하지 않는다. `*`는 404다. 개발용 경로를 사용자 메뉴에 넣지 않는다.

## 경로 없이 중첩된 기존 기능

- AI 예산 분석: 캠페인 작성/초안 → 기존 PricingPanel. 분석·예산 반영은 별도 명시 행동 유지.
- 조건서·버전·양측 서명·48시간 만료·최종 선정: 본인 제안 → 협의 요청 → 작업 공간 → TermsMock/TermsEditor/SignaturePanel. 계약 확정 전 계약 ID를 만들거나 임의 링크를 제공하지 않는다.
- 수정 요청·원요청 연결 수정본·회차 완료, 검토 승인·최종 파일·ZIP·다운로드·수령/문제 보류: 계약 → 영상 버전 → RevisionPanelMock/FinalPanelMock. 정확한 계약/버전 링크와 기존 당사자/상태 조건 유지.
- 위 중첩 기능은 기존 부모 흐름으로 접근 가능하다. 전역 메뉴를 추가하지 않았다.

## 인증과 API 경계

- Guard는 auth 미설정이면 ‘인증 연결 준비 중’, 설정 시 guest는 안전한 returnTo와 함께 로그인으로 이동한다. 허용되지 않은 역할은 거부한다. session bootstrap/refresh/logout/cache 제거·안전한 복귀 정책을 변경하지 않았다.
- `VITE_ENABLE_MOCKS=true` **및 DEV**에서만 기존 MSW 구현을 이용한다. 운영 빌드에는 새 안내 링크가 보여도 캠페인/제안/계약/결제/제작 화면은 기존 미연결 안내를 유지한다. 링크 추가는 API 연결을 만들지 않는다.
- 기존 이메일/Google 인증과 프로필 기본 정보의 API 어댑터는 명시적 auth API 설정으로만 사용한다. 실제 서버·쿠키·DB·외부 제공자 연결은 이번 작업에서 검증하지 않는다. 운영 회원가입·이미지/추가 정보와 이후 단계의 Mock 전용 경계도 유지한다.
- 운영 API 미연결과 미구현 Placeholder는 라우팅 누락으로 해결할 수 없다. 15개 Placeholder에 가짜 데이터·고정 거래 ID·개발 역할 우회를 추가하지 않는다. 백엔드의 별도 미병합 PR 기능을 이 브랜치에 임의 통합하지 않는다.
- ops는 기존 운영 전용 Placeholder만 허용되며 회원 역할로 승격하지 않는다. 홈 안내에는 공개 모집만 표시한다.

## 검증·전달

실행 결과와 최종 전달 상태는 `frontend-progress.md`의 ‘기존 화면 접근 개선’ 기록을 따른다. 재현: 저장소 루트에서 `npm run test:web`, `npm run build:web`, `npm run test:web:e2e`. Edge 로컬 대안은 `qa/frontend-access/playwright.edge.config.ts`를 사용한다(프로젝트명 chromium/mobile-chromium이지만 실제 channel은 msedge). 이번 전체 회귀는 같은 설정의 기존 `qa/frontend-4d/playwright.edge.config.ts`로 실행했다. timeout/retry/기존 검사를 완화하지 않는다. 빌드가 shared 산출물을 갱신하므로 E2E 서버 시작 전에 끝낸다.

운영 검증은 기본 빌드 후 `node qa/frontend-access/production-check.mjs`, 두 flag(`VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`) 빌드 후 `node qa/frontend-access/production-check.mjs --auth-fixtures`로 재현한다. 자체 Vite preview는 로컬 4197을 사용하고 종료한다. 결과 JSON과 역할별 캡처는 같은 디렉터리에 저장한다. HTTP fixture는 실제 API/DB 검증을 대신하지 않는다.
