# 배포 기능 연결과 검증 현황 (2026-10-27)

기준: #79 → #78 병합 후 main `e307fdb`, 후속 수정 브랜치 `fix/production-readiness`.
목표: 실제 API·DB를 사용한 시연, 결제는 Toss 테스트 환경, 정산은 금액 기록이며 실제 송금 아님.
**전체 운영 거래 완료 판정은 아직 하지 않는다.** API 호출 코드가 있는 것, 로컬 실제 API 테스트 통과, 운영 거래 완료는 서로 다른 근거다.

## 발견한 문제와 이번 수정

- 운영 새 브라우저에서 작품·모집 조회가 취소된 뒤 무한 로딩하는 문제를 재현했다. 추적 기록에서 `/api/auth/refresh` 401과 공개 목록 요청 `net::ERR_ABORTED`를 확인했다. 세션 초기화가 Query 캐시와 진행 중 조회를 지웠지만 공개 화면의 관찰자는 이전 조회에 남았다. 공개 라우트를 세션 epoch 변경 시 다시 마운트해 조회를 재개한다. 로그인·회원가입·OAuth 콜백은 처리 중 상태 보존을 위해 제외했다.
- `/onboarding`만 등록된 회원 라우트 중 운영에서 일반 Placeholder로 남아 있었다. 내 프로필 화면(`/me/profile`)으로 이동하도록 연결했다(#82와 같은 방식). 역할·이름은 회원가입 API에서 이미 저장하므로 중복 가입이나 역할 변경 API를 만들지 않았다.
- 하단과 운영 공간에 남은 개발 단계 문구를 정리했다.
- 기본 Web CI는 Mock UI 테스트였다. 이름을 명확히 하고, production 빌드 + 실제 API + 격리 PostgreSQL로 실행하는 `Web Live API CI`를 추가했다. 운영 자격증명이나 운영 DB는 사용하지 않는다.
- 배포 주소의 공개 조회와 로그인 폼 활성화를 확인하는 별도 수동 워크플로를 추가했다. 이는 운영 전체 거래 테스트가 아니다.

## 화면별 연결

| 화면                                         | 실제 연결                                                                                         | 이번 확인 범위 / 남은 사항                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/signup`, `/login`                          | `/api/auth/signup`, `/login`, `/refresh`                                                          | 두 역할 가입·새로고침 세션 복원 로컬 실제 API 통과. 운영 폼 별도 확인                                |
| Google 로그인·콜백                           | `/api/auth/google/start`, `/callback`, `/api/auth/social/signup`                                  | 코드 연결됨. 희년님 Google OAuth 및 Render 설정 후 실제 계정 검증 필요                               |
| `/onboarding`, `/me/profile`                 | GET/PATCH `/api/profiles/me`                                                                      | 온보딩은 내 프로필로 이동. 두 역할 저장·재조회 로컬 검증                                             |
| `/`, `/works/:id`, `/creators/:id`           | `/api/feed`, `/api/portfolios/:id`, `/media`, `/api/creators/:id`                                 | 운영 피드 200·0건 확인. 작품·제작자 상세는 공개 데이터 생성 후 확인 필요                             |
| `/studio/packages`, `/studio/portfolio`      | `/api/creator/packages`, `/portfolios`, `/service/*`, `/api/files`                                | 실제 API 코드 있음. 공개하려면 패키지·서비스·작품 공개 조건 충족 필요. 운영 Storage 업로드 미확인    |
| `/campaigns`, 상세·작성·수정                 | `/api/projects`, `/api/project-drafts`                                                            | 운영 목록 200·0건. 로컬 작성·초안·공개·재조회 통과                                                   |
| 지원·후보 비교                               | `/api/projects/:id/applications`, `/api/applications/:id/discuss`                                 | 로컬 실제 브라우저 지원·협의 통과                                                                    |
| `/requests`, 상세, `/workspace/:id`          | `/api/chat/*`, `/api/direct-requests`, `/api/work-requests/:id/terms`                             | 협의·조건서·양측 서명·계약 로컬 통과. 직접 의뢰는 이번 브라우저 실행 범위 밖                         |
| `/contracts/:id/payment`, `/payments/result` | `/api/contracts/:id/payments`, `/api/payments/confirm`, Toss SDK                                  | 실제 API 사용. 로컬 계약 금액 조회·결제 화면 통과. 배포의 Toss 키 쌍·실제 테스트 승인 별도 확인 필요 |
| 제작 준비·납품                               | `/api/contracts/:id/production`, `/delivery`, `/deliverables`, `/api/files`                       | 실제 API 코드 있음. 운영 Storage 업로드·다운로드와 결제 후 연속 흐름 미확인                          |
| 정산·리뷰                                    | `/api/contracts/:id/delivery`, `/reviews`, `/api/settlements/me`                                  | DB 기록 API 있음. 실제 송금 아님. 운영 거래 완료 후 리뷰 확인 필요                                   |
| 취소·분쟁·운영 검토                          | `/api/contracts/:id/cancellation`, `/disputes`, `/api/admin/disputes`                             | 실제 API 코드 있음. 운영 테스트 결제 취소·환불 확인 필요                                             |
| 내 활동·북마크·추천·알림                     | `/api/activity`, `/api/bookmarks/projects`, `/api/recommendations/projects`, `/api/notifications` | 실제 API 연결. 활동·알림 로컬 브라우저 검증                                                          |
| 신고·제한·이의                               | `/api/reports`, `/api/reports/me`, `/api/admin/reports`                                           | 실제 API·DB 저장·읽기 로컬 브라우저 통과                                                             |

위 동적 경로의 코드상 파라미터 이름은 `campaignId`, `requestId`, `contractId`, `creatorId`, `workId` 등이다. 표의 `:id`는 축약 표기다.

## 미구현과 설정 누락의 구분

- 로고·프로필 이미지·경력·크리에이터 외부 링크: 프로필 저장 스키마/DB 필드가 아직 없다. 화면 안내만 없애도 구현되는 기능이 아니다. 기본 프로필 저장, 의뢰인 홈페이지/SNS, 작품 업로드와는 별개다. 추가 스키마·파일 접근 정책·API 구현이 필요한 후속 범위로 남는다.
- Google: OAuth 관리 설정 필요. 프론트 Mock을 켜서 해결하지 않는다.
- Toss: 프론트 `VITE_TOSS_CLIENT_KEY`, API `TOSS_SECRET_KEY`는 같은 테스트 키 세트여야 한다. 실제 키/값은 문서·PR에 남기지 않는다.
- 파일: API의 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET` 및 실제 버킷 설정을 별도로 확인해야 한다. DB readiness 성공은 Storage 성공을 뜻하지 않는다.
- 빈 목록: 운영 피드·공개 모집은 정상 200이면서 0건이었다. 이번에는 운영 DB를 직접 조회하여 전체 테이블 수를 재확인하거나 시연 데이터를 넣지 않았다.

## 검증 구분과 인수 조건

1. 기존 Mock 회귀는 개발 UI 회귀만 보장한다. 이번 수정의 동작 근거로 사용하지 않았다.
2. 로컬 실제 API: 두 역할 가입·프로필·세션 복원, 공고·지원·서명·계약, 활동·알림·신고. 실제 PostgreSQL과 API 사용. 일부 장애 복구 테스트만 응답 유실/500을 의도적으로 주입하며 정상 응답·결제 성공은 위조하지 않는다.
3. Production 공개 smoke: 수정 전 배포에서 3개 중 로그인 폼 1개 통과, 작품·모집 2개는 요청 취소 후 로딩 지속으로 실패했다. 직접 API 조회 200·0건과 별개의 화면 오류다. 이번 수정 병합·재배포 후 같은 검사를 다시 통과해야 한다. 데이터 쓰기 없음. 회원 거래 성공을 뜻하지 않는다.
4. 운영 전체 인수: 희년님 병합·배포 후 전용 시연 계정으로 가입 → 로그인 → 공고 → 지원 → 계약 → Toss 테스트 승인 → 실제 파일 업로드·납품 → 수령 → 정산 기록 → 양측 리뷰까지 거래 하나를 이어서 확인해야 한다. 실패한 경계는 해결 후 재개하며 DB에 결제 성공을 수동 입력하지 않는다.
5. 별도 시연 환경: PM·백엔드가 환경과 계정을 정한 뒤 API로 데이터를 구성한다. 운영 계정·공고에 시험 데이터를 섞지 않는다. Preview는 별도 환경변수와 API의 APP_ORIGIN/쿠키 정책까지 맞춰야 하며 Production 설정이 자동 적용된다고 가정하지 않는다.

이 PR은 코드·자동 검증 보완이며 병합과 배포는 희년님이 진행한다. 운영 전체 인수 완료나 Google·Toss·Storage 설정 완료를 선언하는 PR이 아니다.
