# 프론트엔드 실제 API 연결 (2026-10-27)

브랜치 `feat/web-real-api`. 백엔드 묶음(#51~#64) 위에 최신 `main`을 합친 뒤 작업했다.

## 무엇이 바뀌었나

`main`의 프론트엔드는 로그인·프로필만 실제 API였다. 나머지 기능 화면은 개발 모드 전용 Mock(`src/mocks/*Mock.tsx`, `/__mock__/...` 경로)이었다. 그래서 배포 빌드에서는 모든 기능 화면이 "연결 준비 중" 안내만 보였다.

이 브랜치는 그 안내 자리에 **실제 `/api` 호출 화면**을 넣었다.

- 개발 Mock(`VITE_ENABLE_MOCKS=true`)과 Mock 파일은 그대로 둔다. 기존 Mock E2E에 영향을 주지 않는다.
- 디자인 시스템(`components/ui`, `design-tokens`, `styles`)은 바꾸지 않았다. 기존 컴포넌트와 클래스만 쓴다.

| 영역                               | 경로                                                                             | 파일                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 실제 API 호출                      | —                                                                                | `shared/api/kemi.ts` (백엔드 라우터·`@kemi/shared` 타입 그대로)                 |
| 실제 파일 업로드                   | —                                                                                | `shared/api/upload.ts` (서명 업로드 → Storage 직접 PUT → 서버 확인 READY)       |
| 공개 모집                          | `/campaigns`, `/campaigns/:id`, `/campaigns/new`, `/campaigns/:id/edit`          | `features/campaigns/*Live.tsx`                                                  |
| 지원·후보 비교·의뢰 현황·작업 공간 | `/campaigns/:id/apply`, `/campaigns/:id/proposals`, `/requests`, `/requests/:id` | `features/requests/*Live.tsx`, `features/terms/TermsLive.tsx`                   |
| 테스트 결제                        | `/contracts/:id/payment`, `/payments/result`                                     | `features/payments/PaymentLive.tsx`, `toss.ts`                                  |
| 제작 준비·납품·정산·리뷰           | `/contracts/:id/production`, `/deliveries`, `/settlement`                        | `features/production/*Live.tsx`, `features/resolution/SettlementLive.tsx`       |
| 취소·환불·분쟁                     | `/contracts/:id/cancellation`, `/disputes/:id`                                   | `features/resolution/CancellationLive.tsx`                                      |
| 운영자                             | `/ops/disputes`                                                                  | `features/operations/OpsLive.tsx`                                               |
| 피드·작품·제작자·직접 의뢰         | `/`, `/works/:id`, `/creators/:id`, `/creators/:id/request`                      | `features/portfolio/CatalogLive.tsx`, `features/requests/DirectRequestLive.tsx` |
| 스튜디오                           | `/studio/packages`, `/studio/portfolio`                                          | `features/packages/StudioLive.tsx`                                              |
| 알림·내 활동                       | `/notifications`, `/me/activity`                                                 | `features/activity/ActivityLive.tsx`                                            |

**이메일 가입**

- 가입 폼 규칙(8~64자, 영문+숫자)에 API의 72바이트 상한을 더했다. 이제 폼을 통과한 비밀번호는 항상 서버도 받는다.
- 그래서 실제 가입 차단(`signup && !mockEnabled`)을 풀었다.

## 배포 환경 변수

| 어디            | 변수                                                                     | 값                                                                                     |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Vercel (프론트) | `VITE_ENABLE_AUTH_API`                                                   | `true`                                                                                 |
| Vercel (프론트) | `VITE_ENABLE_MOCKS`                                                      | `false`                                                                                |
| Vercel (프론트) | `VITE_TOSS_CLIENT_KEY`                                                   | Toss **테스트 클라이언트 키** (`test_gck_` 결제위젯 또는 `test_ck_` 결제창). 공개 키다 |
| Render (백엔드) | `TOSS_SECRET_KEY`                                                        | 같은 세트의 **테스트 시크릿 키** (`test_gsk_` 또는 `test_sk_`). Vercel에 넣지 않는다   |
| Render (백엔드) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET=kemi-files` | 서버 전용                                                                              |

`VITE_` 값은 빌드할 때 들어가므로, 바꾼 뒤 Vercel을 재배포한다.

## 검증 (2026-10-27)

로컬 구성은 다음과 같다.

- DB: 운영 스키마 복제 DB
- API: 배포 빌드(`NODE_ENV=production`)
- Storage: 실제 Supabase `kemi-files` 버킷
- 결제: Toss 테스트 키
- 프론트: Mock을 끈 실제 모드(`VITE_ENABLE_MOCKS=false`)

이 구성에서 브라우저로 직접 눌러 확인했다.

- **공개 모집 정상 거래(UI)**
  - 이메일 가입(의뢰인·크리에이터) → 모집 공개 → 지원 → 협의 요청(선정 아님) → 대화
  - → 조건서 작성·서명 요청 → 양측 서명·계약
  - → 자료(메모·**실제 파일 업로드**) → 자료 확인 → 제작 시작
  - → 검토본·최종본 **실제 업로드** → 승인 → 수령 → 모의 정산(수수료 2만·지급 18만) → 리뷰
- **결제(UI)**
  - **실제 Toss 샌드박스 결제위젯 결제 성공**: 서버 승인 `SUCCEEDED`, 계좌이체
  - 이 결제 이전 거래 1건은 키가 없어 `[모의]` 결제 기록을 DB에 넣고 진행했다.
- **취소·환불**
  - 취소 제안은 UI로 보냈다.
  - 승인은 API로 했고, 이때 **실제 Toss 샌드박스 부분 환불 12만원이 성공**했다.
  - 남은 대가 8만원은 수수료 8천·지급 7만2천으로 정산됐다.
- **카탈로그(UI)**
  - 패키지 초안·공개·대표 지정, 서비스 공개
  - 작업물 등록(**실제 영상·이미지 업로드**)·공개
  - 피드·작품 상세(서명 URL 영상), 제작자 페이지, 직접 의뢰 보내기
- **자동 테스트**: 웹 단위 222개, 린트, 타입, 빌드 통과

### 아직 확인하지 못한 것

- 브라우저로 누르지 못한 화면이 있다. API·DB 테스트로는 검증됐다.
  - 수정 요청 폼, 납기 변경, 분쟁 신고·운영자 처리 화면, 알림·내 활동 화면
- 업로드에 쓴 파일은 형식 머리만 맞춘 시험 파일이다. 실제 영상의 재생 화질은 확인하지 않았다.
- 기존 개발 Mock Playwright E2E는 이 컴퓨터에 브라우저가 없어 돌리지 못했다. CI에서 확인한다.
- 윤철님 PR #73·#74·#76의 기능(북마크 묶음 화면, 신고·제한 등)은 이 브랜치 범위가 아니다.
