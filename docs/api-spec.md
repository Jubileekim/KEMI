# KEMI API 명세서

> 이 문서는 `apps/api/src/docs/openapi.ts`에서 자동으로 만든다. 직접 고치지 말고 OpenAPI 정의를 고친 뒤
> `npm run docs:api -w @kemi/api`로 다시 만든다. `test/api-spec.test.ts`가 코드와 어긋나면 실패한다.

- 버전: 0.1.0
- 엔드포인트: 128개 (21개 영역)
- 실시간 문서: 개발 서버에서 `/api/docs`(Swagger UI), `/api/openapi.json`

## 공통 규칙

- KEMI 백엔드 API. 오류 응답은 모두 `{ error: { code, message, details? } }` 형식이다. 사용자 ID는 문자열이다.
- 기본 주소: 운영 `https://kemi-api.onrender.com`, 로컬 `http://localhost:4000`. 모든 경로는 이 주소 뒤에 붙는다.
- 요청·응답 본문은 JSON(`Content-Type: application/json`)이다. 본문 크기는 1MB까지다.
- 인증: 로그인·가입·갱신 응답의 `accessToken`(15분)을 `Authorization: Bearer <토큰>` 헤더로 보낸다.
  Refresh 토큰은 `kemi_refresh` HttpOnly 쿠키로만 오가며 `POST /api/auth/refresh`로 새 Access 토큰을 받는다.
- 표의 "인증: 로그인 필요"는 Access 토큰이 있어야 한다는 뜻이다. 역할(의뢰인·크리에이터·운영자)·당사자 제한은 각 설명과 403 응답에 적었다.
- 시간은 ISO 8601(UTC) 문자열, 금액은 원 단위 정수다.
- 파일은 서버를 거치지 않는다: `POST /api/files`로 서명 업로드 주소를 받아 Storage에 직접 올린 뒤 `POST /api/files/{fileId}/complete`로 확인한다.

### 오류 형식

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "사람이 읽는 설명", "details": [] } }
```

| 코드 | 주로 쓰는 HTTP 상태 |
| --- | --- |
| `VALIDATION_FAILED` | 400 |
| `INVALID_JSON` | 400 |
| `UNAUTHENTICATED` | 401 |
| `TOKEN_EXPIRED` | 401 |
| `SESSION_REVOKED` | 401 |
| `INVALID_CREDENTIALS` | 401 |
| `EMAIL_ALREADY_EXISTS` | 409 |
| `REFRESH_RACE` | 409 |
| `RATE_LIMITED` | 429 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `SERVICE_UNAVAILABLE` | 503 (외부 연동 실패는 502) |
| `RESTRICTED` | 403 (이용 제한 회원) |
| `INTERNAL_ERROR` | 500 |

## 엔드포인트 목록

### 상태 확인 (`health`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/health`](#op-get-health) | 프로세스 생존 확인 (DB를 보지 않음) | 없음 |
| GET | [`/health/ready`](#op-get-health-ready) | DB 연결까지 확인 | 없음 |

### 인증 (`auth`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | [`/api/auth/signup`](#op-post-api-auth-signup) | 이메일 회원가입 후 바로 로그인 | 없음 |
| POST | [`/api/auth/login`](#op-post-api-auth-login) | 이메일 로그인 | 없음 |
| POST | [`/api/auth/refresh`](#op-post-api-auth-refresh) | Refresh 토큰 회전 | 없음 |
| POST | [`/api/auth/logout`](#op-post-api-auth-logout) | 로그인 세션 폐기 | 없음 |
| GET | [`/api/auth/{provider}/start`](#op-get-api-auth-provider-start) | 소셜 로그인 시작 (브라우저 이동) | 없음 |
| GET | [`/api/auth/{provider}/callback`](#op-get-api-auth-provider-callback) | 소셜 로그인 콜백 (제공자가 호출) | 없음 |
| GET | [`/api/auth/social/signup`](#op-get-api-auth-social-signup) | 소셜 가입 대기 정보 조회 | 없음 |
| POST | [`/api/auth/social/signup`](#op-post-api-auth-social-signup) | 소셜 가입 완료 후 바로 로그인 | 없음 |
| GET | [`/api/auth/me`](#op-get-api-auth-me) | 현재 사용자 조회 | 로그인 필요 |

### 프로필 (`profiles`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/profiles/me`](#op-get-api-profiles-me) | 본인 프로필 조회 | 로그인 필요 |
| PATCH | [`/api/profiles/me`](#op-patch-api-profiles-me) | 본인 프로필 저장 (부분 수정) | 로그인 필요 |

### 공개 모집 (`projects`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/projects`](#op-get-api-projects) | 모집 중인 공개 프로젝트 탐색 | 없음 |
| POST | [`/api/projects`](#op-post-api-projects) | 공개 프로젝트 등록 | 로그인 필요 |
| GET | [`/api/projects/me`](#op-get-api-projects-me) | 내 프로젝트 목록 | 로그인 필요 |
| GET | [`/api/projects/{projectId}`](#op-get-api-projects-projectid) | 공개 프로젝트 상세 조회 | 없음 |
| PATCH | [`/api/projects/{projectId}`](#op-patch-api-projects-projectid) | 내 프로젝트 부분 수정 | 로그인 필요 |
| DELETE | [`/api/projects/{projectId}`](#op-delete-api-projects-projectid) | 내 프로젝트 삭제 (소프트 삭제) | 로그인 필요 |
| POST | [`/api/projects/{projectId}/end-without-selection`](#op-post-api-projects-projectid-end-without-selection) | 무선정 종료 (CAMP-06) | 로그인 필요 |
| POST | [`/api/projects/{projectId}/close`](#op-post-api-projects-projectid-close) | 내 프로젝트 모집 마감 | 로그인 필요 |

### 지원·선정 (`applications`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/projects/{projectId}/applications`](#op-get-api-projects-projectid-applications) | 내 프로젝트의 지원자 목록 | 로그인 필요 |
| POST | [`/api/projects/{projectId}/applications`](#op-post-api-projects-projectid-applications) | 프로젝트에 지원 (APPLY-01) | 로그인 필요 |
| GET | [`/api/applications/me`](#op-get-api-applications-me) | 내 지원 내역 (크리에이터) | 로그인 필요 |
| POST | [`/api/applications/{applicationId}/discuss`](#op-post-api-applications-applicationid-discuss) | 협의 요청 (APPLY-02) | 로그인 필요 |
| POST | [`/api/applications/{applicationId}/decline`](#op-post-api-applications-applicationid-decline) | 지원 거절 (APPLY-03) | 로그인 필요 |
| POST | [`/api/applications/{applicationId}/withdraw`](#op-post-api-applications-applicationid-withdraw) | 지원 철회 (APPLY-03) | 로그인 필요 |

### 알림 (`notifications`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/notifications`](#op-get-api-notifications) | 내 알림 목록 (NOTI-01) | 로그인 필요 |
| GET | [`/api/notifications/unread-count`](#op-get-api-notifications-unread-count) | 미확인 알림 개수 | 로그인 필요 |
| POST | [`/api/notifications/read`](#op-post-api-notifications-read) | 고른 알림 여러 개 읽음 (NOTI-02) | 로그인 필요 |
| POST | [`/api/notifications/read-all`](#op-post-api-notifications-read-all) | 내 알림 모두 읽음 | 로그인 필요 |
| POST | [`/api/notifications/{notificationId}/read`](#op-post-api-notifications-notificationid-read) | 알림 하나 읽음 | 로그인 필요 |

### 모집 탐색·추천 (`discovery`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/bookmarks/projects`](#op-get-api-bookmarks-projects) | 내 프로젝트 북마크 목록 | 로그인 필요 |
| PUT | [`/api/bookmarks/projects/{projectId}`](#op-put-api-bookmarks-projects-projectid) | 프로젝트 북마크 저장 | 로그인 필요 |
| DELETE | [`/api/bookmarks/projects/{projectId}`](#op-delete-api-bookmarks-projects-projectid) | 프로젝트 북마크 해제 | 로그인 필요 |
| GET | [`/api/recommendations/projects`](#op-get-api-recommendations-projects) | 내 추천 프로젝트 목록 | 로그인 필요 |

### AI 가격 제안 (`pricing`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | [`/api/pricing/analyze`](#op-post-api-pricing-analyze) | AI 제작 단가 분석 (AI-01) | 로그인 필요 |
| POST | [`/api/pricing/reports/{reportId}/apply`](#op-post-api-pricing-reports-reportid-apply) | AI 분석 결과를 예산에 반영 (AI-02) | 로그인 필요 |

### 파일 (`files`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | [`/api/files`](#op-post-api-files) | 업로드 준비 (FILE-01) | 로그인 필요 |
| POST | [`/api/files/{fileId}/complete`](#op-post-api-files-fileid-complete) | 업로드 확인 (FILE-01) | 로그인 필요 |
| GET | [`/api/files/{fileId}`](#op-get-api-files-fileid) | 파일 정보 | 로그인 필요 |
| GET | [`/api/files/{fileId}/download`](#op-get-api-files-fileid-download) | 다운로드·재생 URL | 로그인 필요 |

### 대화 (`chat`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/chat/rooms`](#op-get-api-chat-rooms) | 내 대화방 목록 (CHAT-03) | 로그인 필요 |
| GET | [`/api/work-requests/{workRequestId}/chat/messages`](#op-get-api-work-requests-workrequestid-chat-messages) | 메시지 조회 (CHAT-01·04) | 로그인 필요 |
| POST | [`/api/work-requests/{workRequestId}/chat/messages`](#op-post-api-work-requests-workrequestid-chat-messages) | 메시지 보내기 (CHAT-01) | 로그인 필요 |
| POST | [`/api/work-requests/{workRequestId}/chat/read`](#op-post-api-work-requests-workrequestid-chat-read) | 읽음 처리 (CHAT-03) | 로그인 필요 |

### 취소·환불·분쟁 (`cancel`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/contracts/{contractId}/cancellation`](#op-get-api-contracts-contractid-cancellation) | 취소·환불·분쟁 현황 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/cancellations`](#op-post-api-contracts-contractid-cancellations) | 취소 제안 (CANCEL-01·02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/cancellations/{cancellationId}/accept`](#op-post-api-contracts-contractid-cancellations-cancellationid-accept) | 취소 승인 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/cancellations/{cancellationId}/reject`](#op-post-api-contracts-contractid-cancellations-cancellationid-reject) | 취소 거절 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/cancellations/{cancellationId}/withdraw`](#op-post-api-contracts-contractid-cancellations-cancellationid-withdraw) | 취소 제안 거두기 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/refund/retry`](#op-post-api-contracts-contractid-refund-retry) | 환불 재시도 (REFUND-01) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/refund/sync`](#op-post-api-contracts-contractid-refund-sync) | 환불 결과 조회 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/handover/confirm`](#op-post-api-contracts-contractid-handover-confirm) | 인도 파일 수령 확인 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/disputes`](#op-post-api-contracts-contractid-disputes) | 분쟁 신고 (DISPUTE-01) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/disputes/{disputeId}/evidence`](#op-post-api-contracts-contractid-disputes-disputeid-evidence) | 분쟁 증빙 추가 | 로그인 필요 |
| GET | [`/api/admin/disputes`](#op-get-api-admin-disputes) | 분쟁 목록 (OPS-01) | 로그인 필요 |
| GET | [`/api/admin/disputes/{disputeId}`](#op-get-api-admin-disputes-disputeid) | 분쟁 상세 | 로그인 필요 |
| POST | [`/api/admin/disputes/{disputeId}/resolve`](#op-post-api-admin-disputes-disputeid-resolve) | 분쟁 처리 (OPS-01) | 로그인 필요 |
| GET | [`/api/admin/operation-records`](#op-get-api-admin-operation-records) | 운영 처리 기록 | 로그인 필요 |

### 작품 피드·직접 의뢰 (`direct`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | [`/api/packages/{packageId}/direct-requests`](#op-post-api-packages-packageid-direct-requests) | 직접 의뢰 보내기 (DIRECT-01, ORDER-01~03) | 로그인 필요 |
| GET | [`/api/me/work-bookmarks`](#op-get-api-me-work-bookmarks) | 작품 저장함 목록 (SAVE-01) | 로그인 필요 |
| PUT | [`/api/portfolios/{portfolioId}/bookmark`](#op-put-api-portfolios-portfolioid-bookmark) | 작품 저장 (SAVE-01) | 로그인 필요 |
| DELETE | [`/api/portfolios/{portfolioId}/bookmark`](#op-delete-api-portfolios-portfolioid-bookmark) | 작품 저장 해제 (SAVE-01) | 로그인 필요 |
| POST | [`/api/direct-inquiries`](#op-post-api-direct-inquiries) | 저장한 작품의 제작자들에게 일괄 문의 (INQ-01) | 로그인 필요 |
| GET | [`/api/direct-requests`](#op-get-api-direct-requests) | 내 직접 의뢰 목록 | 로그인 필요 |
| GET | [`/api/direct-requests/{requestId}`](#op-get-api-direct-requests-requestid) | 직접 의뢰 상세 | 로그인 필요 |
| POST | [`/api/direct-requests/{requestId}/accept`](#op-post-api-direct-requests-requestid-accept) | 협의 수락 (DIRECT-02) | 로그인 필요 |
| POST | [`/api/direct-requests/{requestId}/decline`](#op-post-api-direct-requests-requestid-decline) | 거절 (DIRECT-03) | 로그인 필요 |
| POST | [`/api/direct-requests/{requestId}/withdraw`](#op-post-api-direct-requests-requestid-withdraw) | 의뢰 거두기 | 로그인 필요 |
| GET | [`/api/feed`](#op-get-api-feed) | 작업물 피드 (FEED-01~03) | 없음 |
| GET | [`/api/admin/metrics`](#op-get-api-admin-metrics) | 운영 지표 (METRIC-01) | 로그인 필요 |

### 패키지·작업물·제작 서비스 (`catalog`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/creator/packages`](#op-get-api-creator-packages) | 내 패키지 목록 | 로그인 필요 |
| POST | [`/api/creator/packages`](#op-post-api-creator-packages) | 패키지 초안 저장 (PACK-01) | 로그인 필요 |
| PATCH | [`/api/creator/packages/{packageId}`](#op-patch-api-creator-packages-packageid) | 패키지 수정 | 로그인 필요 |
| POST | [`/api/creator/packages/{packageId}/publish`](#op-post-api-creator-packages-packageid-publish) | 패키지 공개 (PACK-02) | 로그인 필요 |
| POST | [`/api/creator/packages/{packageId}/hide`](#op-post-api-creator-packages-packageid-hide) | 패키지 내리기 | 로그인 필요 |
| POST | [`/api/creator/packages/{packageId}/representative`](#op-post-api-creator-packages-packageid-representative) | 대표 패키지 지정 (PACK-03) | 로그인 필요 |
| GET | [`/api/creator/portfolios`](#op-get-api-creator-portfolios) | 내 작업물 목록 | 로그인 필요 |
| POST | [`/api/creator/portfolios`](#op-post-api-creator-portfolios) | 작업물 초안 저장 (PORT-01) | 로그인 필요 |
| PATCH | [`/api/creator/portfolios/{portfolioId}`](#op-patch-api-creator-portfolios-portfolioid) | 작업물 수정 | 로그인 필요 |
| POST | [`/api/creator/portfolios/{portfolioId}/publish`](#op-post-api-creator-portfolios-portfolioid-publish) | 작업물 공개 (PORT-02) | 로그인 필요 |
| POST | [`/api/creator/portfolios/{portfolioId}/hide`](#op-post-api-creator-portfolios-portfolioid-hide) | 작업물 내리기 | 로그인 필요 |
| POST | [`/api/creator/service/publish`](#op-post-api-creator-service-publish) | 제작 서비스 공개 | 로그인 필요 |
| POST | [`/api/creator/service/hide`](#op-post-api-creator-service-hide) | 제작 서비스 내리기 | 로그인 필요 |
| GET | [`/api/creators/{userId}`](#op-get-api-creators-userid) | 제작자 공개 페이지 (PORT-01, PACK-01) | 없음 |
| GET | [`/api/packages/{packageId}`](#op-get-api-packages-packageid) | 공개 패키지 상세 | 없음 |
| GET | [`/api/portfolios/{portfolioId}`](#op-get-api-portfolios-portfolioid) | 공개 작업물 상세 | 없음 |
| GET | [`/api/portfolios/{portfolioId}/media`](#op-get-api-portfolios-portfolioid-media) | 공개 작업물 재생 주소 | 없음 |

### 모집 초안 (`project-drafts`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/project-drafts`](#op-get-api-project-drafts) | 내 임시 저장 공고 | 로그인 필요 |
| POST | [`/api/project-drafts`](#op-post-api-project-drafts) | 공고 임시 저장 (CAMP-01) | 로그인 필요 |
| PATCH | [`/api/project-drafts/{draftId}`](#op-patch-api-project-drafts-draftid) | 임시 저장 공고 수정 | 로그인 필요 |
| DELETE | [`/api/project-drafts/{draftId}`](#op-delete-api-project-drafts-draftid) | 임시 저장 공고 삭제 | 로그인 필요 |
| POST | [`/api/project-drafts/{draftId}/publish`](#op-post-api-project-drafts-draftid-publish) | 공고 공개 (CAMP-02) | 로그인 필요 |

### 납품·수정·승인 (`delivery`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/contracts/{contractId}/delivery`](#op-get-api-contracts-contractid-delivery) | 납품·수정·정산·리뷰 현황 | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/deliverables`](#op-post-api-contracts-contractid-deliverables) | 버전 제출 (DEL-01·02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/deliverables/{deliverableId}/revision-requests`](#op-post-api-contracts-contractid-deliverables-deliverableid-revision-requests) | 수정 요청 (REV-01·02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/deliverables/{deliverableId}/approve`](#op-post-api-contracts-contractid-deliverables-deliverableid-approve) | 검토본 승인 (DEL-03) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/deliverables/{deliverableId}/receive`](#op-post-api-contracts-contractid-deliverables-deliverableid-receive) | 최종본 수령 확인 (DEL-04·05, SETTLE-01) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/reviews`](#op-post-api-contracts-contractid-reviews) | 리뷰 작성 (REVIEW-01) | 로그인 필요 |
| GET | [`/api/settlements/me`](#op-get-api-settlements-me) | 내 모의 정산 내역 | 로그인 필요 |
| GET | [`/api/users/{userId}/reviews`](#op-get-api-users-userid-reviews) | 받은 리뷰 (공개) | 없음 |

### 제작 준비·진행 (`production`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/contracts/{contractId}/production`](#op-get-api-contracts-contractid-production) | 제작 정보 (READY·WORK) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/materials`](#op-post-api-contracts-contractid-production-materials) | 제작 자료 내기 (READY-01) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/materials/{materialId}/confirm`](#op-post-api-contracts-contractid-production-materials-materialid-confirm) | 자료 정상 확인 (READY-02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/materials/{materialId}/issue`](#op-post-api-contracts-contractid-production-materials-materialid-issue) | 자료 누락·문제 신고 (READY-02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/start`](#op-post-api-contracts-contractid-production-start) | 제작 시작 (WORK-01) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/deadline-changes`](#op-post-api-contracts-contractid-production-deadline-changes) | 납기 변경 요청 (WORK-02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/deadline-changes/{changeId}/approve`](#op-post-api-contracts-contractid-production-deadline-changes-changeid-approve) | 납기 변경 승인 (WORK-02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/production/deadline-changes/{changeId}/reject`](#op-post-api-contracts-contractid-production-deadline-changes-changeid-reject) | 납기 변경 거절 (WORK-02) | 로그인 필요 |

### 결제·정산 (`payments`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/contracts/{contractId}/payments`](#op-get-api-contracts-contractid-payments) | 계약의 결제 내역 (PAY-02) | 로그인 필요 |
| POST | [`/api/contracts/{contractId}/payments`](#op-post-api-contracts-contractid-payments) | 결제 주문 만들기 (PAY-01) | 로그인 필요 |
| POST | [`/api/payments/confirm`](#op-post-api-payments-confirm) | 결제 승인 (PAY-01) | 로그인 필요 |
| POST | [`/api/payments/{orderId}/sync`](#op-post-api-payments-orderid-sync) | 결제 결과 다시 확인 (PAY-02) | 로그인 필요 |
| POST | [`/api/payments/{orderId}/fail`](#op-post-api-payments-orderid-fail) | 결제 취소·실패 기록 | 로그인 필요 |

### 조건 확정·서명 (`terms`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/work-requests/{workRequestId}/terms`](#op-get-api-work-requests-workrequestid-terms) | 최종 조건서 조회 (TERMS-01) | 로그인 필요 |
| POST | [`/api/work-requests/{workRequestId}/terms/versions`](#op-post-api-work-requests-workrequestid-terms-versions) | 조건서 새 버전 저장 (TERMS-01·03) | 로그인 필요 |
| POST | [`/api/work-requests/{workRequestId}/terms/versions/{versionNo}/signing`](#op-post-api-work-requests-workrequestid-terms-versions-versionno-signing) | 서명 요청 (TERMS-02) | 로그인 필요 |
| POST | [`/api/work-requests/{workRequestId}/terms/versions/{versionNo}/signatures`](#op-post-api-work-requests-workrequestid-terms-versions-versionno-signatures) | 본인 서명 (CONTRACT-01) | 로그인 필요 |
| GET | [`/api/work-requests/{workRequestId}/contract`](#op-get-api-work-requests-workrequestid-contract) | 계약서 조회 (SIGN-01) | 로그인 필요 |

### 내 활동 (`activity`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| GET | [`/api/activity`](#op-get-api-activity) | 내 활동 묶음 조회 (ACT-01) | 로그인 필요 |

### 신고·이용 제한 (`safety`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | [`/api/reports`](#op-post-api-reports) | 신고 (OPS-01) [제안, D18] | 로그인 필요 |
| GET | [`/api/reports/me`](#op-get-api-reports-me) | 내 신고·제한 안내 (OPS-01·02) | 로그인 필요 |
| POST | [`/api/reports/{reportId}/appeal`](#op-post-api-reports-reportid-appeal) | 이의 제기 (OPS-02) | 로그인 필요 |
| GET | [`/api/admin/reports`](#op-get-api-admin-reports) | 신고 목록 (운영자) | 로그인 필요 |
| POST | [`/api/admin/reports/{reportId}/actions`](#op-post-api-admin-reports-reportid-actions) | 신고 조치 (운영자, OPS-01) | 로그인 필요 |

### 행동 기록 (`analytics`)

| 메서드 | 경로 | 설명 | 인증 |
| --- | --- | --- | --- |
| POST | [`/api/analytics/events`](#op-post-api-analytics-events) | 행동 기록 (METRIC-01) [제안, D22] | 없음 |
| GET | [`/api/admin/analytics`](#op-get-api-admin-analytics) | 행동 집계 (운영자) | 로그인 필요 |

## 엔드포인트 상세

## 상태 확인 (`health`)

<a id="op-get-health"></a>

### GET `/health`

**프로세스 생존 확인 (DB를 보지 않음)**

- 인증: 없음

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 정상 | [HealthResponse](#schema-healthresponse) |

<a id="op-get-health-ready"></a>

### GET `/health/ready`

**DB 연결까지 확인**

준비 여부(status·HTTP 상태)는 DB만 본다. `checks.storage`는 파일 저장소 진단용이다: ok(버킷 접근 가능), not_configured(저장소 환경변수 없음), missing_bucket(STORAGE_BUCKET 버킷 없음), unauthorized(키 거부), error(연결·기타 오류).

- 인증: 없음

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | DB 연결 정상 | [ReadinessResponse](#schema-readinessresponse) |
| 503 | DB 연결 실패 | [ReadinessResponse](#schema-readinessresponse) |

## 인증 (`auth`)

<a id="op-post-api-auth-signup"></a>

### POST `/api/auth/signup`

**이메일 회원가입 후 바로 로그인**

이메일은 앞뒤 공백 제거·소문자로 정규화한다. 역할은 `CLIENT`·`CREATOR`만 받는다. 비밀번호는 8자 이상, 72바이트 이하. 요청 제한: IP당 1시간 10회.

- 인증: 없음

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `email` | string(email) | 예 | 최대 길이 254 | - |
| `password` | string | 예 | 최소 길이 8 | - |
| `name` | string | 예 | 최소 길이 2, 최대 길이 20 | - |
| `role` | `CLIENT`, `CREATOR` | 예 | - | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 가입·로그인 성공. Refresh 토큰은 `kemi_refresh` 쿠키(HttpOnly; Secure; SameSite=Lax; Path=/api/auth)로 설정된다. | [AuthTokenResponse](#schema-authtokenresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 409 | 이미 가입된 이메일 (`EMAIL_ALREADY_EXISTS`) | [Error](#schema-error) |
| 429 | 요청 제한 초과 (`RATE_LIMITED`). `Retry-After`·`RateLimit` 헤더가 함께 온다. | [Error](#schema-error) |

<a id="op-post-api-auth-login"></a>

### POST `/api/auth/login`

**이메일 로그인**

요청 제한: IP당 15분 10회.

- 인증: 없음

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `email` | string(email) | 예 | 최대 길이 254 | - |
| `password` | string | 예 | 최소 길이 1, 최대 길이 1024 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 로그인 성공. Refresh 토큰은 `kemi_refresh` 쿠키(HttpOnly; Secure; SameSite=Lax; Path=/api/auth)로 설정된다. | [AuthTokenResponse](#schema-authtokenresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 401 | 이메일·비밀번호 불일치, 없는 이메일, 소셜 전용 계정 모두 같은 응답 (`INVALID_CREDENTIALS`) | [Error](#schema-error) |
| 403 | 이용 제한된 계정 (`FORBIDDEN`) | [Error](#schema-error) |
| 429 | 요청 제한 초과 (`RATE_LIMITED`). `Retry-After`·`RateLimit` 헤더가 함께 온다. | [Error](#schema-error) |

<a id="op-post-api-auth-refresh"></a>

### POST `/api/auth/refresh`

**Refresh 토큰 회전**

Refresh 쿠키(`kemi_refresh`)로만 동작한다. `Origin` 헤더가 프론트엔드 주소(`APP_ORIGIN`)와 같아야 한다. 요청 제한: IP당 15분 60회. `409 REFRESH_RACE`를 받으면 `details.retryAfterMs` 뒤 최대 2번까지 다시 시도하고, 그래도 실패하면 재로그인으로 안내한다.

- 인증: 없음

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 회전 성공. 새 Access 토큰과 새 쿠키를 받는다. Refresh 토큰은 `kemi_refresh` 쿠키(HttpOnly; Secure; SameSite=Lax; Path=/api/auth)로 설정된다. | [AuthTokenResponse](#schema-authtokenresponse) |
| 401 | 쿠키 없음, 세션 폐기·만료, 재사용 감지 (`SESSION_REVOKED`). 쿠키를 삭제한다. | [Error](#schema-error) |
| 403 | 허용되지 않은 Origin 또는 이용 제한된 계정 (`FORBIDDEN`) | [Error](#schema-error) |
| 409 | 다른 요청이 먼저 갱신함 (`REFRESH_RACE`, `details.retryAfterMs`). 새 토큰은 발급하지 않는다. | [Error](#schema-error) |
| 429 | 요청 제한 초과 (`RATE_LIMITED`). `Retry-After`·`RateLimit` 헤더가 함께 온다. | [Error](#schema-error) |

<a id="op-post-api-auth-logout"></a>

### POST `/api/auth/logout`

**로그인 세션 폐기**

Refresh 쿠키(`kemi_refresh`)로만 동작한다. `Origin` 헤더가 프론트엔드 주소(`APP_ORIGIN`)와 같아야 한다. 이후 이 세션의 Refresh·Access 토큰은 모두 거부된다.

- 인증: 없음

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 204 | 로그아웃 완료. 쿠키를 삭제한다. | - |
| 403 | 허용되지 않은 Origin (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-get-api-auth-provider-start"></a>

### GET `/api/auth/{provider}/start`

**소셜 로그인 시작 (브라우저 이동)**

fetch가 아니라 브라우저 주소 이동으로 연다. 제공자 동의 화면으로 302 이동하고, state·PKCE 값을 `kemi_oauth_state` 쿠키(10분)에 담는다. 서버에 제공자 설정이 없으면 프론트엔드로 `error=SOCIAL_UNAVAILABLE`과 함께 돌려보낸다. 요청 제한: IP당 15분 20회, 콜백과 따로 센다 [제안]. 넘으면 429 JSON 대신 프론트엔드로 `error=SOCIAL_RATE_LIMITED`와 함께 보낸다.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `provider` | 경로 | 예 | `google`, `kakao` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 302 | 제공자 동의 화면, 또는 프론트엔드(설정 없음 `SOCIAL_UNAVAILABLE`, 요청 제한 `SOCIAL_RATE_LIMITED`)로 이동 | - |
| 404 | 지원하지 않는 제공자 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-auth-provider-callback"></a>

### GET `/api/auth/{provider}/callback`

**소셜 로그인 콜백 (제공자가 호출)**

제공자 콘솔에 `{APP_ORIGIN}/api/auth/{provider}/callback`으로 등록한다. state가 쿠키와 같아야 한다. 같은 이메일의 기존 회원과 자동으로 병합하지 않는다. Access 토큰은 주소에 싣지 않으며, `result=login`이면 프론트엔드가 `POST /api/auth/refresh`로 받는다. 제공자 요청(토큰 교환·회원 정보)은 요청마다 10초 안에 끝나야 하며, 넘으면 요청을 취소하고 `error=SOCIAL_FAILED`로 보낸다 [제안]. 요청 제한: IP당 15분 20회, 시작과 따로 센다. 넘으면 `error=SOCIAL_RATE_LIMITED`로 보낸다.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `provider` | 경로 | 예 | `google`, `kakao` | - |
| `code` | 쿼리 |  | string | - |
| `state` | 쿼리 |  | string | - |
| `error` | 쿼리 |  | string | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 302 | 프론트엔드 `/auth/social/callback`으로 이동. 쿼리는 `result=login`(Refresh 쿠키 설정됨), `result=signup`(가입 티켓 쿠키 설정됨) 또는 `error=SOCIAL_CANCELLED\|SOCIAL_FAILED\|SOCIAL_UNAVAILABLE\|SOCIAL_RATE_LIMITED\|FORBIDDEN` 중 하나다. | - |
| 404 | 지원하지 않는 제공자 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-auth-social-signup"></a>

### GET `/api/auth/social/signup`

**소셜 가입 대기 정보 조회**

`result=signup`으로 돌아온 뒤 가입 화면에 보여줄 제공자·이름 후보·제공자 이메일. 가입 티켓 쿠키(`kemi_social_signup`, 10분)가 필요하다.

- 인증: 없음

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 가입 대기 중인 소셜 계정 | [SocialSignupPendingResponse](#schema-socialsignuppendingresponse) |
| 401 | 가입 티켓 없음·만료 (`UNAUTHENTICATED`) | [Error](#schema-error) |

<a id="op-post-api-auth-social-signup"></a>

### POST `/api/auth/social/signup`

**소셜 가입 완료 후 바로 로그인**

가입 티켓 쿠키로 동작하며 `Origin` 헤더가 프론트엔드 주소와 같아야 한다. 로그인 이메일·비밀번호 없이 가입하며, 제공자 이메일은 소셜 계정 정보로만 저장한다. 요청 제한: 가입과 같음.

- 인증: 없음

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `name` | string | 예 | 최소 길이 2, 최대 길이 20 | - |
| `role` | `CLIENT`, `CREATOR` | 예 | - | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 가입·로그인 성공. Refresh 토큰은 `kemi_refresh` 쿠키(HttpOnly; Secure; SameSite=Lax; Path=/api/auth)로 설정된다. | [AuthTokenResponse](#schema-authtokenresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 401 | 가입 티켓 없음·만료·위조 (`UNAUTHENTICATED`) | [Error](#schema-error) |
| 403 | 허용되지 않은 Origin (`FORBIDDEN`) | [Error](#schema-error) |
| 409 | 이 소셜 계정으로 이미 가입함 (`CONFLICT`). 소셜 로그인을 다시 시작한다. | [Error](#schema-error) |
| 429 | 요청 제한 초과 (`RATE_LIMITED`). `Retry-After`·`RateLimit` 헤더가 함께 온다. | [Error](#schema-error) |

<a id="op-get-api-auth-me"></a>

### GET `/api/auth/me`

**현재 사용자 조회**

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 현재 사용자 | [MeResponse](#schema-meresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한된 계정 (`FORBIDDEN`) | [Error](#schema-error) |

## 프로필 (`profiles`)

<a id="op-get-api-profiles-me"></a>

### GET `/api/profiles/me`

**본인 프로필 조회**

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 표시 이름과 역할별 프로필. 저장한 적이 없으면 빈 기본값. | [MyProfileResponse](#schema-myprofileresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 관리자 계정, 또는 이용 제한·탈퇴된 계정(상태 변경 전에 받은 토큰 포함) (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-patch-api-profiles-me"></a>

### PATCH `/api/profiles/me`

**본인 프로필 저장 (부분 수정)**

보낸 항목만 바꾼다. 요청 형식은 로그인한 역할의 것만 받으며(두 형식 중 무엇을 쓸지는 토큰의 역할로 정해진다), 모르는 항목(다른 역할 항목·`serviceStatus` 포함)은 400이다. 보내지 않은 항목은 그대로다. 자유 입력 문자열·주소는 빈 문자열·공백만이면 null로 저장하고, null로도 지운다. 선택지(`industry`·`niche`)·날짜는 null로 지우며 빈 문자열은 400이다. 복수 선택은 목록 전체를 보내고 []로 비운다(빈 문자열·null은 400). `isAvailable`·`name`은 빈 문자열·null이 400이다. `name`은 회원 표시 이름을 바꾼다. 저장해도 제작 서비스는 공개되지 않는다.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

타입: object 또는 object

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 표시 이름과 역할별 프로필. 저장한 적이 없으면 빈 기본값. | [MyProfileResponse](#schema-myprofileresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 관리자 계정, 또는 이용 제한·탈퇴된 계정(상태 변경 전에 받은 토큰 포함) (`FORBIDDEN`) | [Error](#schema-error) |

## 공개 모집 (`projects`)

<a id="op-get-api-projects"></a>

### GET `/api/projects`

**모집 중인 공개 프로젝트 탐색**

마감 전이며 삭제되지 않은 OPEN 프로젝트만 반환한다. 이용 제한·탈퇴 회원이 등록한 프로젝트는 제외한다. 제목·설명을 검색하고 목적·스타일·예산으로 필터링한다.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `q` | 쿼리 |  | string (최소 길이 1, 최대 길이 100) | - |
| `purpose` | 쿼리 |  | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` | - |
| `styles` | 쿼리 |  | string | 쉼표로 구분한 영상 스타일 (예: EMOTIONAL,CINEMATIC) |
| `budgetMin` | 쿼리 |  | integer (최소 1) | - |
| `budgetMax` | 쿼리 |  | integer (최소 1) | - |
| `sort` | 쿼리 |  | `LATEST`, `BUDGET_LOW`, `BUDGET_HIGH`, `DEADLINE` (기본값 `"LATEST"`) | - |
| `page` | 쿼리 |  | integer (최소 1, 기본값 `1`) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50, 기본값 `20`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 프로젝트 목록 | [ProjectListResponse](#schema-projectlistresponse) |
| 400 | 잘못된 검색 조건 (`VALIDATION_FAILED`) | [Error](#schema-error) |

<a id="op-post-api-projects"></a>

### POST `/api/projects`

**공개 프로젝트 등록**

CLIENT만 등록할 수 있다. 모집 마감은 현재 이후, 희망 납품일은 모집 마감일 이후여야 한다.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string | 예 | 최소 길이 2, 최대 길이 200 | - |
| `description` | string | 예 | 최소 길이 10, 최대 길이 5000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` | 예 | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] | 예 | 최소 개수 1, 최대 개수 5 | - |
| `budget` | integer | 예 | 최소 1, 최대 1000000000 | - |
| `expectedDurationSeconds` | integer 또는 null |  | 최소 1, 최대 21600 | - |
| `recruitmentEndAt` | string(date-time) | 예 | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))T(?:(?:[01]\d\|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z\|([+-](?:[01]\d\|2[0-3]):[0-5]\d)))$` | - |
| `deliveryDueDate` | string(date) | 예 | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 공개 맞춤 영상 제작 의뢰 | [Project](#schema-project) |
| 400 | 잘못된 입력 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-get-api-projects-me"></a>

### GET `/api/projects/me`

**내 프로젝트 목록**

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `q` | 쿼리 |  | string (최소 길이 1, 최대 길이 100) | - |
| `purpose` | 쿼리 |  | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` | - |
| `styles` | 쿼리 |  | string | 쉼표로 구분한 영상 스타일 (예: EMOTIONAL,CINEMATIC) |
| `budgetMin` | 쿼리 |  | integer (최소 1) | - |
| `budgetMax` | 쿼리 |  | integer (최소 1) | - |
| `sort` | 쿼리 |  | `LATEST`, `BUDGET_LOW`, `BUDGET_HIGH`, `DEADLINE` (기본값 `"LATEST"`) | - |
| `page` | 쿼리 |  | integer (최소 1, 기본값 `1`) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50, 기본값 `20`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 마감된 항목을 포함한 내 프로젝트 목록 | [ProjectListResponse](#schema-projectlistresponse) |
| 400 | 잘못된 검색 조건 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-get-api-projects-projectid"></a>

### GET `/api/projects/{projectId}`

**공개 프로젝트 상세 조회**

모집 중(OPEN)이고 마감 전이며, 이용 제한·탈퇴되지 않은 회원의 프로젝트만 보여준다. 다만 `Authorization`을 보낸 작성자와 이 프로젝트에 지원한 크리에이터는 마감·선정 뒤에도 볼 수 있다(삭제한 프로젝트는 제외). 토큰이 잘못되면 401, 그 밖에는 404다.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 공개 맞춤 영상 제작 의뢰 | [Project](#schema-project) |
| 400 | 잘못된 프로젝트 ID (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 404 | 공개 모집 중인 프로젝트가 없음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-patch-api-projects-projectid"></a>

### PATCH `/api/projects/{projectId}`

**내 프로젝트 부분 수정**

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string |  | 최소 길이 2, 최대 길이 200 | - |
| `description` | string |  | 최소 길이 10, 최대 길이 5000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` |  | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] |  | 최소 개수 1, 최대 개수 5 | - |
| `budget` | integer |  | 최소 1, 최대 1000000000 | - |
| `expectedDurationSeconds` | integer 또는 null |  | 최소 1, 최대 21600 | - |
| `recruitmentEndAt` | string(date-time) |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))T(?:(?:[01]\d\|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z\|([+-](?:[01]\d\|2[0-3]):[0-5]\d)))$` | - |
| `deliveryDueDate` | string(date) |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 공개 맞춤 영상 제작 의뢰 | [Project](#schema-project) |
| 400 | 잘못된 입력 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 모집 중인 프로젝트가 아니거나, 모집 마감 시각이 지남 (`CONFLICT`). 마감 시각이 지나면 제목만 고치거나 마감을 연장하는 요청도 받지 않는다. | [Error](#schema-error) |

<a id="op-delete-api-projects-projectid"></a>

### DELETE `/api/projects/{projectId}`

**내 프로젝트 삭제 (소프트 삭제)**

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 204 | 삭제 완료 | - |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 거래가 시작된 프로젝트 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-projects-projectid-end-without-selection"></a>

### POST `/api/projects/{projectId}/end-without-selection`

**무선정 종료 (CAMP-06)**

아무도 선정하지 않고 모집을 끝낸다(직접 마감과 다름). 프로젝트는 `CLOSED` + `NO_SELECTION`, 대기·협의 중인 지원은 `NOT_SELECTED`(`NO_SELECTION`), 미확정 조건서는 `VOID`가 되고 각 크리에이터에게 `PROJECT_ENDED_NO_SELECTION` 알림이 간다. 모집 중이거나 마감(직접·기한)된 프로젝트에서만 할 수 있고, 계약이 있으면 409다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 공개 맞춤 영상 제작 의뢰 | [Project](#schema-project) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 계약됐거나 이미 종료됨 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-projects-projectid-close"></a>

### POST `/api/projects/{projectId}/close`

**내 프로젝트 모집 마감**

신규 지원만 막는다. 이미 들어온 지원과는 계속 협의할 수 있고(CAMP-05), 대기 지원자에게 `PROJECT_CLOSED` 알림이 간다. 마감 시각이 지나도 서버가 자동으로 상태를 바꾸지는 않으며(스케줄러 없음), 지원할 때 마감 시각을 검사해 막는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 공개 맞춤 영상 제작 의뢰 | [Project](#schema-project) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 이미 모집이 종료됨 (`CONFLICT`) | [Error](#schema-error) |

## 지원·선정 (`applications`)

<a id="op-get-api-projects-projectid-applications"></a>

### GET `/api/projects/{projectId}/applications`

**내 프로젝트의 지원자 목록**

프로젝트를 등록한 의뢰인만. 지원 순서대로 준다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 지원자 목록 | [ProjectApplicationListResponse](#schema-projectapplicationlistresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-projects-projectid-applications"></a>

### POST `/api/projects/{projectId}/applications`

**프로젝트에 지원 (APPLY-01)**

크리에이터만. 모집 중(`OPEN`)이고 마감 시각 전인 프로젝트에만 지원할 수 있다. 같은 프로젝트에는 상태와 관계없이 한 번만 지원한다(결정 기록 3장). 의뢰인에게 `APPLICATION_SUBMITTED` 알림이 간다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `message` | string | 예 | 최소 길이 10, 최대 길이 2000 | - |
| `proposedAmount` | integer | 예 | 최소 1, 최대 1000000000 | - |
| `expectedDays` | integer | 예 | 최소 1, 최대 365 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 지원 완료 | [Application](#schema-application) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 없거나 삭제된 프로젝트, 또는 이용 제한·탈퇴 의뢰인의 프로젝트 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 모집 마감 또는 이미 지원한 프로젝트 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-applications-me"></a>

### GET `/api/applications/me`

**내 지원 내역 (크리에이터)**

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `page` | 쿼리 |  | integer (최소 1) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 내 지원 내역 | [MyApplicationListResponse](#schema-myapplicationlistresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-post-api-applications-applicationid-discuss"></a>

### POST `/api/applications/{applicationId}/discuss`

**협의 요청 (APPLY-02)**

대기 중인 지원을 협의 중(`DISCUSSING`)으로 바꾼다. **선정이 아니다.** 프로젝트 상태와 다른 지원은 그대로이고, 여러 후보와 동시에 협의할 수 있다. 선정은 같은 조건서 버전에 양측이 서명할 때 일어난다(`/api/work-requests/{id}/terms`). 모집 마감(직접·기한) 뒤에도 들어온 지원과 협의할 수 있다. 크리에이터에게 `DISCUSSION_REQUESTED` 알림이 간다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `applicationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 협의 중이 된 지원 | [Application](#schema-application) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트의 지원이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 대기 중이 아닌 지원, 또는 계약·무선정 종료된 프로젝트 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-applications-applicationid-decline"></a>

### POST `/api/applications/{applicationId}/decline`

**지원 거절 (APPLY-03)**

대기·협의 중인 지원을 `DECLINED`로 바꾼다. 협의 중이던 미확정 조건서는 `VOID`가 된다. 프로젝트 상태는 그대로다. 지원자에게 `APPLICATION_DECLINED` 알림이 간다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `applicationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 거절된 지원 | [Application](#schema-application) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 프로젝트의 지원이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 이미 처리된 지원, 또는 이미 선정했거나 종료된 프로젝트 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-applications-applicationid-withdraw"></a>

### POST `/api/applications/{applicationId}/withdraw`

**지원 철회 (APPLY-03)**

크리에이터가 계약 전(대기·협의 중) 본인 지원을 `WITHDRAWN`으로 거둔다. 협의 중이던 미확정 조건서는 `VOID`가 된다. 의뢰인에게 `APPLICATION_WITHDRAWN` 알림이 간다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `applicationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 철회된 지원 | [Application](#schema-application) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 본인 지원이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 이미 끝난 지원·계약된 지원 (`CONFLICT`) | [Error](#schema-error) |

## 알림 (`notifications`)

<a id="op-get-api-notifications"></a>

### GET `/api/notifications`

**내 알림 목록 (NOTI-01)**

최신순. `unread=true`면 미확인 알림만. 응답의 `unreadCount`는 필터와 관계없이 전체 미확인 개수다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `unread` | 쿼리 |  | `true`, `false` | - |
| `page` | 쿼리 |  | integer (최소 1) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 알림 목록 | [NotificationListResponse](#schema-notificationlistresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-get-api-notifications-unread-count"></a>

### GET `/api/notifications/unread-count`

**미확인 알림 개수**

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 미확인 개수 | [UnreadCountResponse](#schema-unreadcountresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-post-api-notifications-read"></a>

### POST `/api/notifications/read`

**고른 알림 여러 개 읽음 (NOTI-02)**

본인 알림 ID 1~200개. 남의 알림이 하나라도 섞이면 404이고 아무것도 바꾸지 않는다. 이미 읽은 알림은 처음 읽은 시각을 유지한다.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `ids` | string[] | 예 | 최소 개수 1, 최대 개수 200 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 남은 미확인 개수 | [UnreadCountResponse](#schema-unreadcountresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 본인 알림이 아닌 ID가 있음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-notifications-read-all"></a>

### POST `/api/notifications/read-all`

**내 알림 모두 읽음**

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 남은 미확인 개수(0) | [UnreadCountResponse](#schema-unreadcountresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-post-api-notifications-notificationid-read"></a>

### POST `/api/notifications/{notificationId}/read`

**알림 하나 읽음**

이미 읽은 알림은 처음 읽은 시각을 유지한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `notificationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 읽음 처리된 알림 | [Notification](#schema-notification) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 본인 알림이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

## 모집 탐색·추천 (`discovery`)

<a id="op-get-api-bookmarks-projects"></a>

### GET `/api/bookmarks/projects`

**내 프로젝트 북마크 목록**

CREATOR가 저장한 프로젝트를 최근 북마크 순으로 반환한다. 모집이 끝난 프로젝트도 남기되 삭제된 프로젝트는 제외한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `page` | 쿼리 |  | integer (최소 1, 기본값 `1`) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50, 기본값 `20`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 북마크한 프로젝트 목록 | [ProjectListResponse](#schema-projectlistresponse) |
| 400 | 잘못된 페이지 조건 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-put-api-bookmarks-projects-projectid"></a>

### PUT `/api/bookmarks/projects/{projectId}`

**프로젝트 북마크 저장**

CREATOR만 모집 중인 프로젝트를 저장할 수 있다. 같은 요청을 반복해도 북마크는 한 건만 유지된다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 공개 맞춤 영상 제작 의뢰 | [Project](#schema-project) |
| 400 | 잘못된 프로젝트 ID (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 모집 중인 프로젝트가 없음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-delete-api-bookmarks-projects-projectid"></a>

### DELETE `/api/bookmarks/projects/{projectId}`

**프로젝트 북마크 해제**

북마크가 없어도 성공하는 멱등 요청이다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `projectId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 204 | 북마크 해제 완료 | - |
| 400 | 잘못된 프로젝트 ID (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-get-api-recommendations-projects"></a>

### GET `/api/recommendations/projects`

**내 추천 프로젝트 목록**

북마크의 목적·스타일과 크리에이터 프로필의 분야·스타일에 맞는 모집 중 프로젝트를 최신순으로 반환한다. 선호 정보나 일치 결과가 없으면 최신 프로젝트를 반환하며 이미 북마크한 항목은 제외한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `page` | 쿼리 |  | integer (최소 1, 기본값 `1`) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50, 기본값 `20`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 추천 프로젝트 목록 | [ProjectListResponse](#schema-projectlistresponse) |
| 400 | 잘못된 페이지 조건 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 크리에이터가 아님 (`FORBIDDEN`) | [Error](#schema-error) |

## AI 가격 제안 (`pricing`)

<a id="op-post-api-pricing-analyze"></a>

### POST `/api/pricing/analyze`

**AI 제작 단가 분석 (AI-01)**

활성 의뢰인만 요청할 수 있다. 입력 설명을 바탕으로 작업 단위·단가를 AI로 추정한다. 서버가 합계를 정수로 다시 계산하며, 실측 시장 단가나 확정 견적이 아니다. 분석마다 보고서를 저장하고 `reportId`를 준다. 예산은 자동으로 바뀌지 않으며, 의뢰인이 `POST /api/pricing/reports/{reportId}/apply`로 직접 반영한다(AI-02). 로그인 사용자당 1시간 10회(인증 실패는 차감되지 않음).

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `description` | string | 예 | 최소 길이 10, 최대 길이 5000 | - |
| `title` | string |  | 최소 길이 2, 최대 길이 200 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` |  | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] |  | 최소 개수 1, 최대 개수 5 | - |
| `expectedDurationSeconds` | integer |  | 최소 1, 최대 21600 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | AI 추정 단가 보고서 | [PricingAnalysisResponse](#schema-pricinganalysisresponse) |
| 400 | 입력값 오류 (VALIDATION_FAILED) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인 외 요청·비활성 사용자 (FORBIDDEN) | [Error](#schema-error) |
| 429 | 요청 제한 초과 (`RATE_LIMITED`). `Retry-After`·`RateLimit` 헤더가 함께 온다. | [Error](#schema-error) |
| 502 | 외부 AI 분석 실패 (SERVICE_UNAVAILABLE) | [Error](#schema-error) |
| 503 | AI 서비스 미설정 (SERVICE_UNAVAILABLE) | [Error](#schema-error) |

<a id="op-post-api-pricing-reports-reportid-apply"></a>

### POST `/api/pricing/reports/{reportId}/apply`

**AI 분석 결과를 예산에 반영 (AI-02)**

분석한 본인만. 대상은 본인 공고 초안(`draftId`) 또는 본인의 모집 중 공고(`projectId`) 하나. 보고서당 한 번.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `reportId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

타입: object 또는 object

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 반영 결과 | [AiReportApplyResponse](#schema-aireportapplyresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

## 파일 (`files`)

<a id="op-post-api-files"></a>

### POST `/api/files`

**업로드 준비 (FILE-01)**

선언한 형식·크기·쓰임을 검사하고 Supabase Storage 서명 업로드 URL을 준다. 브라우저는 그 URL로 파일을 직접 올린 뒤 `/complete`를 부른다. 한도: 영상(MP4·MOV)·ZIP 50MB, 이미지(JPG·PNG·WebP) 10MB. 거래 파일(채팅 첨부·자료·납품물·수정 첨부)은 `workRequestId`가 필요하고, 그 요청의 당사자이며 요청이 협의 중이거나 계약 뒤여야 한다. 작업물은 크리에이터만. 저장소 미설정이면 503.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `purpose` | `PROFILE_IMAGE`, `PORTFOLIO`, `CHAT_ATTACHMENT`, `MATERIAL`, `DELIVERABLE`, `REVISION`, `EVIDENCE` | 예 | - | - |
| `fileName` | string | 예 | 최소 길이 1, 최대 길이 200 | - |
| `mimeType` | `video/mp4`, `video/quicktime`, `image/jpeg`, `image/png`, `image/webp`, `application/zip` | 예 | - | - |
| `sizeBytes` | integer | 예 | 최소 1, 최대 9007199254740991 | - |
| `workRequestId` | string |  | 형식 `^[1-9]\d*$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 파일(PENDING)과 업로드 URL | [FileUploadResponse](#schema-fileuploadresponse) |
| 400 | 형식·크기·쓰임 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 작업물을 크리에이터가 아닌 사람이 올림 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 요청이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 협의 중·계약 상태가 아닌 요청 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 파일 저장소 미설정·응답 없음 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-files-fileid-complete"></a>

### POST `/api/files/{fileId}/complete`

**업로드 확인 (FILE-01)**

올린 사람만. 저장소의 실제 크기와 파일 앞부분(매직 바이트)으로 형식을 확인한다. 맞으면 `READY`, 크기·형식이 다르면 `REJECTED`(사유 포함). 아직 올리지 않았으면 409. 이미 끝난 파일은 그대로 돌려준다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `fileId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 확인 결과 | [StoredFile](#schema-storedfile) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 파일이 없거나 올린 사람이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 업로드가 아직 끝나지 않음 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 파일 저장소 미설정·응답 없음 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-get-api-files-fileid"></a>

### GET `/api/files/{fileId}`

**파일 정보**

올린 사람, 또는 거래 파일이면 그 요청의 당사자만 볼 수 있다. 나머지는 404.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `fileId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 파일 | [StoredFile](#schema-storedfile) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 파일이 없거나 볼 권한이 없음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-files-fileid-download"></a>

### GET `/api/files/{fileId}/download`

**다운로드·재생 URL**

확인이 끝난(`READY`) 파일의 서명 URL(10분)을 준다. 권한은 파일 정보와 같다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `fileId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 서명 URL | [FileDownloadResponse](#schema-filedownloadresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 파일이 없거나 볼 권한이 없음 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 확인이 끝나지 않은 파일 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 파일 저장소 미설정·응답 없음 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

## 대화 (`chat`)

<a id="op-get-api-chat-rooms"></a>

### GET `/api/chat/rooms`

**내 대화방 목록 (CHAT-03)**

내가 의뢰인·크리에이터인 요청의 방. 최근 메시지가 있는 방부터. 협의가 끝난(거절·철회·미선정) 방은 `readOnly`다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 대화방 목록 | [ChatRoomListResponse](#schema-chatroomlistresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-get-api-work-requests-workrequestid-chat-messages"></a>

### GET `/api/work-requests/{workRequestId}/chat/messages`

**메시지 조회 (CHAT-01·04)**

기본은 최신 50개를 오래된 순서로 준다. `before`로 이전 페이지, `after`로 새로 온 메시지만 받는다. 시스템 메시지(`SYSTEM`)는 서명 요청·계약 체결·결제 완료 같은 작업 사건 안내다(WORK-04).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `before` | 쿼리 |  | string | - |
| `after` | 쿼리 |  | string | - |
| `limit` | 쿼리 |  | integer (최소 1, 최대 100) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 메시지 | [ChatMessagesResponse](#schema-chatmessagesresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 방이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-work-requests-workrequestid-chat-messages"></a>

### POST `/api/work-requests/{workRequestId}/chat/messages`

**메시지 보내기 (CHAT-01)**

텍스트 메시지(4,000자까지). 같은 `clientMessageId`의 재전송은 200으로 이전 메시지를 준다. 협의가 끝난 방은 409다. 첨부·대화만으로 납품·수정 회차·계약 상태가 바뀌지 않는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `clientMessageId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `body` | string | 예 | 최대 길이 4000 | - |
| `attachmentFileIds` | string[] |  | 최대 개수 5, 기본값 `[]` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 같은 메시지의 재전송 | [ChatMessage](#schema-chatmessage) |
| 201 | 보낸 메시지 | [ChatMessage](#schema-chatmessage) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 방이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 협의가 끝난 방, 같은 식별자로 다른 내용 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-work-requests-workrequestid-chat-read"></a>

### POST `/api/work-requests/{workRequestId}/chat/read`

**읽음 처리 (CHAT-03)**

화면에 보인 마지막 메시지까지 읽음으로 한다. 읽음 위치는 뒤로 가지 않는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `lastReadMessageId` | string | 예 | 형식 `^[1-9]\d*$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 갱신된 방 요약 | [ChatRoomSummary](#schema-chatroomsummary) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 방·메시지가 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

## 취소·환불·분쟁 (`cancel`)

<a id="op-get-api-contracts-contractid-cancellation"></a>

### GET `/api/contracts/{contractId}/cancellation`

**취소·환불·분쟁 현황**

당사자. 결제 금액, 취소 제안 버전·환불 상태, 분쟁·증빙, 정산 보류 사유(`settlementHold`).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-cancellations"></a>

### POST `/api/contracts/{contractId}/cancellations`

**취소 제안 (CANCEL-01·02)**

당사자. 미결제 계약은 대가·환불 모두 0, 결제 완료 계약은 완료 작업 대가 + 환불액 = 원결제 금액. 인도 파일(크리에이터의 DELIVERABLE 파일)·미완성 상태·사용권 합의를 함께 적는다. 대기 중이던 이전 제안은 SUPERSEDED. 결제 확인 중(READY·UNKNOWN)이면 409.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `reason` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |
| `completedWorkKrw` | integer | 예 | 최소 0, 최대 1000000000 | - |
| `refundKrw` | integer | 예 | 최소 0, 최대 1000000000 | - |
| `deliveredFileIds` | string[] |  | 최대 개수 20, 기본값 `[]` | - |
| `unfinishedState` | string |  | 최소 길이 1, 최대 길이 2000 | - |
| `usageRights` | string |  | 최소 길이 1, 최대 길이 2000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-cancellations-cancellationid-accept"></a>

### POST `/api/contracts/{contractId}/cancellations/{cancellationId}/accept`

**취소 승인**

제안하지 않은 당사자. 계약·제작을 CANCELED로 바꾸고, 환불액이 있으면 승인과 환불 시도를 먼저 커밋한 뒤 Toss 부분 취소를 요청한다(`Idempotency-Key: refund-{{cancellationId}}-{{attempt}}`). 결과는 SUCCEEDED(주문 번호·원결제·남은 금액이 모두 맞을 때만)·FAILED·UNKNOWN, 결과 기록이 실패하면 REQUESTED로 남아 조회로 맞춘다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `cancellationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 테스트 결제(환불) 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-cancellations-cancellationid-reject"></a>

### POST `/api/contracts/{contractId}/cancellations/{cancellationId}/reject`

**취소 거절**

제안하지 않은 당사자. 계약은 그대로 진행된다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `cancellationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-cancellations-cancellationid-withdraw"></a>

### POST `/api/contracts/{contractId}/cancellations/{cancellationId}/withdraw`

**취소 제안 거두기**

제안한 당사자.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `cancellationId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-refund-retry"></a>

### POST `/api/contracts/{contractId}/refund/retry`

**환불 재시도 (REFUND-01)**

FAILED 환불만. 시도 번호를 올려 새 멱등 키로 요청한다. 결과 불명확(UNKNOWN) 중에는 재시도할 수 없다(중복 환불 방지).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 테스트 결제(환불) 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-refund-sync"></a>

### POST `/api/contracts/{contractId}/refund/sync`

**환불 결과 조회**

REQUESTED·UNKNOWN 환불을 Toss 주문 조회로 맞춘다. 주문 번호·원결제·남은 금액이 모두 맞으면 SUCCEEDED, 취소 기록이 없으면 FAILED(재시도 가능). 보낸 지 30초가 지나지 않은 REQUESTED는 판정하지 않고 그대로 둔다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 503 | 테스트 결제(환불) 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-handover-confirm"></a>

### POST `/api/contracts/{contractId}/handover/confirm`

**인도 파일 수령 확인**

의뢰인. 승인된 취소 합의의 인도 파일을 받았음을 확인한다. 환불 성공·분쟁 없음이면 완료 작업 대가를 10%로 모의 정산한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-disputes"></a>

### POST `/api/contracts/{contractId}/disputes`

**분쟁 신고 (DISPUTE-01)**

당사자. 계약당 열린 분쟁은 하나. 열려 있는 동안 정산하지 않는다(납품·대화·증빙은 계속). 증빙 파일은 본인 EVIDENCE 파일.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `reason` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |
| `fileIds` | string[] |  | 최대 개수 10, 기본값 `[]` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-disputes-disputeid-evidence"></a>

### POST `/api/contracts/{contractId}/disputes/{disputeId}/evidence`

**분쟁 증빙 추가**

당사자. 열린 분쟁에만.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `disputeId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `note` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |
| `fileIds` | string[] |  | 최대 개수 10, 기본값 `[]` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 취소·환불·분쟁 현황 | [CancellationOverview](#schema-cancellationoverview) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-admin-disputes"></a>

### GET `/api/admin/disputes`

**분쟁 목록 (OPS-01)**

운영자(ADMIN). 열린 분쟁 먼저.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 분쟁 목록 | [DisputeList](#schema-disputelist) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-admin-disputes-disputeid"></a>

### GET `/api/admin/disputes/{disputeId}`

**분쟁 상세**

운영자. 신고·증빙·처리 이력.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `disputeId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 분쟁 | [Dispute](#schema-dispute) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-admin-disputes-disputeid-resolve"></a>

### POST `/api/admin/disputes/{disputeId}/resolve`

**분쟁 처리 (OPS-01)**

운영자. 처리 근거를 남기고 닫는다(operation_records). 지급·환불을 대신 실행하지 않는다. 보류가 풀리면 정산이 이어진다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `disputeId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `reason` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 분쟁 | [Dispute](#schema-dispute) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-admin-operation-records"></a>

### GET `/api/admin/operation-records`

**운영 처리 기록**

운영자. 최근 100건.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 기록 | [OperationRecordList](#schema-operationrecordlist) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

## 작품 피드·직접 의뢰 (`direct`)

<a id="op-post-api-packages-packageid-direct-requests"></a>

### POST `/api/packages/{packageId}/direct-requests`

**직접 의뢰 보내기 (DIRECT-01, ORDER-01~03)**

활성 의뢰인. 공개 서비스의 공개 패키지만. 금액·기간·수정 횟수는 패키지 조건 사본으로 시작한다. 크리에이터는 48시간 안에 답해야 하며, 지나면 만료(EXPIRED)된다. 같은 패키지로 진행 중인 의뢰는 하나뿐이다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `packageId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `message` | string | 예 | 최소 길이 10, 최대 길이 2000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` |  | - | - |
| `eventDate` | string(date) |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |
| `materialType` | `PHOTOS_ONLY`, `PHOTOS_AND_VIDEOS`, `NEEDS_SHOOTING` |  | - | - |
| `desiredDeliveryDate` | string(date) |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |
| `referencePortfolioId` | string |  | 형식 `^[1-9]\d*$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 직접 의뢰 | [DirectRequest](#schema-directrequest) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-me-work-bookmarks"></a>

### GET `/api/me/work-bookmarks`

**작품 저장함 목록 (SAVE-01)**

내가 저장한 작품(최근 저장순, 최대 100개). `available`은 지금도 공개 중이고 의뢰할 수 있는 패키지(연결 패키지 또는 대표 패키지)가 있는지다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 저장한 작품 | [WorkBookmarkList](#schema-workbookmarklist) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-put-api-portfolios-portfolioid-bookmark"></a>

### PUT `/api/portfolios/{portfolioId}/bookmark`

**작품 저장 (SAVE-01)**

공개 작품만 저장한다. 이미 저장했으면 그대로 성공. 최대 100개(넘으면 409).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 저장됨 | object |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용이 제한된 계정 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 공개 작품이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 저장 한도 초과 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-delete-api-portfolios-portfolioid-bookmark"></a>

### DELETE `/api/portfolios/{portfolioId}/bookmark`

**작품 저장 해제 (SAVE-01)**

저장하지 않은 작품이어도 성공한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 해제됨 | object |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-post-api-direct-inquiries"></a>

### POST `/api/direct-inquiries`

**저장한 작품의 제작자들에게 일괄 문의 (INQ-01)**

활성 의뢰인. 작품 1~5개를 골라 각 작품의 제작자에게 같은 조건(요청사항·목적·보유 자료·행사일·희망 납품일)으로 직접 의뢰를 보낸다. 작품마다 연결 패키지(없거나 비공개면 대표 패키지) 조건으로 시작하고, 크리에이터당 한 건이다. 보낼 수 없는 작품은 결과에 이유(`ALREADY_OPEN` 이미 진행 중, `SAME_CREATOR` 같은 제작자, `UNAVAILABLE` 공개 아님)를 남기고 나머지는 보낸다. 같은 `commandId`로 다시 보내면 처음 결과를 돌려준다. 이후 흐름(48시간 응답·조건서·서명·결제)은 직접 의뢰와 같다.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `portfolioIds` | string[] | 예 | 최소 개수 1, 최대 개수 5 | - |
| `message` | string | 예 | 최소 길이 10, 최대 길이 2000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` |  | - | - |
| `eventDate` | string(date) |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |
| `materialType` | `PHOTOS_ONLY`, `PHOTOS_AND_VIDEOS`, `NEEDS_SHOOTING` |  | - | - |
| `desiredDeliveryDate` | string(date) |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 작품별 발송 결과 | [BulkInquiryResponse](#schema-bulkinquiryresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`), 이용 제한 (`RESTRICTED`) | [Error](#schema-error) |
| 409 | 동시에 겹친 요청 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-direct-requests"></a>

### GET `/api/direct-requests`

**내 직접 의뢰 목록**

의뢰인은 보낸 의뢰, 크리에이터는 받은 의뢰. 응답 기한이 지난 대기 의뢰는 이때 만료로 바뀐다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 목록 | [DirectRequestList](#schema-directrequestlist) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-direct-requests-requestid"></a>

### GET `/api/direct-requests/{requestId}`

**직접 의뢰 상세**

당사자만.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `requestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 직접 의뢰 | [DirectRequest](#schema-directrequest) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-direct-requests-requestid-accept"></a>

### POST `/api/direct-requests/{requestId}/accept`

**협의 수락 (DIRECT-02)**

크리에이터. 대기(PENDING) 의뢰만. DISCUSSING이 되고 대화방이 열린다. **계약 확정이 아니다.** 이후 조건서·양측 서명으로 계약한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `requestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 직접 의뢰 | [DirectRequest](#schema-directrequest) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-direct-requests-requestid-decline"></a>

### POST `/api/direct-requests/{requestId}/decline`

**거절 (DIRECT-03)**

크리에이터. 대기·협의 중 의뢰만. 미확정 조건서는 무효가 된다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `requestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 직접 의뢰 | [DirectRequest](#schema-directrequest) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-direct-requests-requestid-withdraw"></a>

### POST `/api/direct-requests/{requestId}/withdraw`

**의뢰 거두기**

의뢰인. 계약 전(대기·협의 중) 의뢰만.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `requestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 직접 의뢰 | [DirectRequest](#schema-directrequest) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-feed"></a>

### GET `/api/feed`

**작업물 피드 (FEED-01~03)**

공개 서비스의 공개 작업물. 최근 공개순 [제안, D21]. 목적·스타일·작업 유형(본인 역할)으로 거른다(쉼표 구분). 고객 납품물은 자동으로 올라오지 않는다. 재생은 `GET /api/portfolios/{id}/media`.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `purpose` | 쿼리 |  | string | - |
| `styles` | 쿼리 |  | string | 예: EMOTIONAL,FUN |
| `roles` | 쿼리 |  | string | 예: FILMING,EDITING |
| `page` | 쿼리 |  | integer (최소 1) | - |
| `pageSize` | 쿼리 |  | integer (최소 1, 최대 50) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 피드 | [FeedResponse](#schema-feedresponse) |
| 400 | 검색 조건 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |

<a id="op-get-api-admin-metrics"></a>

### GET `/api/admin/metrics`

**운영 지표 (METRIC-01)**

운영자(ADMIN)만. 거래 테이블에서 계산한다(중복 없음, 개인정보 없음) [제안, D22]. 시연 계정(이메일 도메인 kemi.test)은 뺀다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 지표 | [MetricsSummary](#schema-metricssummary) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

## 패키지·작업물·제작 서비스 (`catalog`)

<a id="op-get-api-creator-packages"></a>

### GET `/api/creator/packages`

**내 패키지 목록**

크리에이터 본인의 모든 패키지(초안·공개·비공개).

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 내 패키지 목록 | [ServicePackageList](#schema-servicepackagelist) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-creator-packages"></a>

### POST `/api/creator/packages`

**패키지 초안 저장 (PACK-01)**

제목만 있어도 저장한다. 가격·납기·수정 횟수·제공 내용 등은 공개할 때 모두 있어야 한다.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string | 예 | 최소 길이 2, 최대 길이 100 | - |
| `description` | string 또는 null |  | 최소 길이 10, 최대 길이 3000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` 또는 null |  | - | - |
| `priceKrw` | integer 또는 null |  | 최소 1, 최대 1000000000 | - |
| `deliveryDays` | integer 또는 null |  | 최소 1, 최대 365 | - |
| `revisionCount` | integer 또는 null |  | 최소 0, 최대 10 | - |
| `includes` | string[] |  | 최대 개수 20 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 패키지 | [ServicePackage](#schema-servicepackage) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-patch-api-creator-packages-packageid"></a>

### PATCH `/api/creator/packages/{packageId}`

**패키지 수정**

보낸 항목만 바꾼다(null은 지움). 공개·비공개 패키지의 필수 항목은 비울 수 없다(400).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `packageId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string |  | 최소 길이 2, 최대 길이 100 | - |
| `description` | string 또는 null |  | 최소 길이 10, 최대 길이 3000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` 또는 null |  | - | - |
| `priceKrw` | integer 또는 null |  | 최소 1, 최대 1000000000 | - |
| `deliveryDays` | integer 또는 null |  | 최소 1, 최대 365 | - |
| `revisionCount` | integer 또는 null |  | 최소 0, 최대 10 | - |
| `includes` | string[] |  | 최대 개수 20 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 패키지 | [ServicePackage](#schema-servicepackage) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-creator-packages-packageid-publish"></a>

### POST `/api/creator/packages/{packageId}/publish`

**패키지 공개 (PACK-02)**

필수 항목이 모두 있어야 한다(빠진 항목은 `details`).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `packageId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 패키지 | [ServicePackage](#schema-servicepackage) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-creator-packages-packageid-hide"></a>

### POST `/api/creator/packages/{packageId}/hide`

**패키지 내리기**

대표 지정도 풀린다. 공개 중인 서비스의 대표 패키지는 다른 대표를 정하기 전에는 내릴 수 없다(409).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `packageId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 패키지 | [ServicePackage](#schema-servicepackage) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-creator-packages-packageid-representative"></a>

### POST `/api/creator/packages/{packageId}/representative`

**대표 패키지 지정 (PACK-03)**

공개된 패키지만. 크리에이터당 하나이며 이전 대표는 해제된다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `packageId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 패키지 | [ServicePackage](#schema-servicepackage) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-creator-portfolios"></a>

### GET `/api/creator/portfolios`

**내 작업물 목록**

크리에이터 본인의 모든 작업물.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 내 작업물 목록 | [PortfolioList](#schema-portfoliolist) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-creator-portfolios"></a>

### POST `/api/creator/portfolios`

**작업물 초안 저장 (PORT-01)**

영상·대표 이미지는 본인이 올려 확인이 끝난 PORTFOLIO 파일(영상 video/*, 이미지 image/*). 연결 패키지는 본인 것만.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string | 예 | 최소 길이 2, 최대 길이 100 | - |
| `description` | string 또는 null |  | 최소 길이 1, 최대 길이 3000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` 또는 null |  | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] |  | 최대 개수 5 | - |
| `roles` | (`PLANNING`, `ON_CAMERA`, `FILMING`, `EDITING`)[] |  | 최대 개수 4 | - |
| `source` | `OWN_WORK`, `CLIENT_WORK` |  | - | - |
| `clientConsent` | boolean |  | - | - |
| `videoFileId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |
| `thumbnailFileId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |
| `packageId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 작업물 | [Portfolio](#schema-portfolio) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-patch-api-creator-portfolios-portfolioid"></a>

### PATCH `/api/creator/portfolios/{portfolioId}`

**작업물 수정**

보낸 항목만 바꾼다. 공개 중인 작업물의 공개 조건(영상·목적·역할·고객 동의)은 깰 수 없다(400).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string |  | 최소 길이 2, 최대 길이 100 | - |
| `description` | string 또는 null |  | 최소 길이 1, 최대 길이 3000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` 또는 null |  | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] |  | 최대 개수 5 | - |
| `roles` | (`PLANNING`, `ON_CAMERA`, `FILMING`, `EDITING`)[] |  | 최대 개수 4 | - |
| `source` | `OWN_WORK`, `CLIENT_WORK` |  | - | - |
| `clientConsent` | boolean |  | - | - |
| `videoFileId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |
| `thumbnailFileId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |
| `packageId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 작업물 | [Portfolio](#schema-portfolio) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-creator-portfolios-portfolioid-publish"></a>

### POST `/api/creator/portfolios/{portfolioId}/publish`

**작업물 공개 (PORT-02)**

영상·목적·본인 역할(1개 이상)이 있어야 한다. 고객 의뢰 작업(CLIENT_WORK)은 고객 동의 확인 기능이 준비될 때까지 공개할 수 없다(409, DB CHECK로도 막음) [D16]. 고객 납품물은 자동으로 공개되지 않는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 작업물 | [Portfolio](#schema-portfolio) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-creator-portfolios-portfolioid-hide"></a>

### POST `/api/creator/portfolios/{portfolioId}/hide`

**작업물 내리기**

공개 조회에서 빠진다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 작업물 | [Portfolio](#schema-portfolio) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-creator-service-publish"></a>

### POST `/api/creator/service/publish`

**제작 서비스 공개**

공개된 대표 패키지가 있어야 한다(409). 공개해야 제작자 페이지·패키지·작업물이 공개 조회된다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 서비스 상태 | [CreatorServiceStatus](#schema-creatorservicestatus) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-creator-service-hide"></a>

### POST `/api/creator/service/hide`

**제작 서비스 내리기**

공개 조회가 모두 막힌다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 서비스 상태 | [CreatorServiceStatus](#schema-creatorservicestatus) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-creators-userid"></a>

### GET `/api/creators/{userId}`

**제작자 공개 페이지 (PORT-01, PACK-01)**

대표 패키지·대표 외 공개 패키지·공개 작업물·받은 리뷰 요약.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `userId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작자 | [CreatorPublicProfile](#schema-creatorpublicprofile) |
| 400 | ID 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 404 | 공개되지 않았거나 없음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-packages-packageid"></a>

### GET `/api/packages/{packageId}`

**공개 패키지 상세**

가격·납기·수정 횟수·제공 내용.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `packageId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 패키지 | [ServicePackage](#schema-servicepackage) |
| 400 | ID 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 404 | 공개되지 않았거나 없음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-portfolios-portfolioid"></a>

### GET `/api/portfolios/{portfolioId}`

**공개 작업물 상세**

본인 역할·출처·제작자·연결 패키지.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 작업물 | [Portfolio](#schema-portfolio) |
| 400 | ID 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 404 | 공개되지 않았거나 없음 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-get-api-portfolios-portfolioid-media"></a>

### GET `/api/portfolios/{portfolioId}/media`

**공개 작업물 재생 주소**

영상·대표 이미지의 24시간짜리 서명 주소.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `portfolioId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 재생 주소 | [PortfolioMedia](#schema-portfoliomedia) |
| 400 | ID 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 404 | 공개되지 않았거나 없음 (`NOT_FOUND`) | [Error](#schema-error) |
| 503 | 파일 저장소 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

## 모집 초안 (`project-drafts`)

<a id="op-get-api-project-drafts"></a>

### GET `/api/project-drafts`

**내 임시 저장 공고**

공개하지 않은 초안만, 최근 수정순.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 초안 목록 | [ProjectDraftList](#schema-projectdraftlist) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-project-drafts"></a>

### POST `/api/project-drafts`

**공고 임시 저장 (CAMP-01)**

모든 항목이 비어 있어도 저장한다. 모집 기간 `recruitmentDays`는 3·7·14(기본 7).

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string 또는 null |  | 최대 길이 200 | - |
| `description` | string 또는 null |  | 최대 길이 5000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` 또는 null |  | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] |  | 최대 개수 5 | - |
| `budget` | integer 또는 null |  | 최소 1, 최대 1000000000 | - |
| `expectedDurationSeconds` | integer 또는 null |  | 최소 1, 최대 21600 | - |
| `deliveryDueDate` | string(date) 또는 null |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |
| `recruitmentDays` | `3` 또는 `7` 또는 `14` |  | - | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 임시 저장 공고 | [ProjectDraft](#schema-projectdraft) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-patch-api-project-drafts-draftid"></a>

### PATCH `/api/project-drafts/{draftId}`

**임시 저장 공고 수정**

보낸 항목만 덮어쓴다(null은 지움). 공개한 초안은 고칠 수 없다(409).

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `draftId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `title` | string 또는 null |  | 최대 길이 200 | - |
| `description` | string 또는 null |  | 최대 길이 5000 | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` 또는 null |  | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] |  | 최대 개수 5 | - |
| `budget` | integer 또는 null |  | 최소 1, 최대 1000000000 | - |
| `expectedDurationSeconds` | integer 또는 null |  | 최소 1, 최대 21600 | - |
| `deliveryDueDate` | string(date) 또는 null |  | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |
| `recruitmentDays` | `3` 또는 `7` 또는 `14` |  | - | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 임시 저장 공고 | [ProjectDraft](#schema-projectdraft) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-delete-api-project-drafts-draftid"></a>

### DELETE `/api/project-drafts/{draftId}`

**임시 저장 공고 삭제**

공개하지 않은 초안만.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `draftId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 204 | 삭제함 | - |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 이미 공개함 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-project-drafts-draftid-publish"></a>

### POST `/api/project-drafts/{draftId}/publish`

**공고 공개 (CAMP-02)**

바로 등록(`POST /api/projects`)과 같은 검사를 한다. 마감 = 공개 시각 + 모집 기간. 같은 초안은 한 번만 공개한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `draftId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 공개 결과 | [ProjectDraftPublishResult](#schema-projectdraftpublishresult) |
| 400 | 입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 본인 것이 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

## 납품·수정·승인 (`delivery`)

<a id="op-get-api-contracts-contractid-delivery"></a>

### GET `/api/contracts/{contractId}/delivery`

**납품·수정·정산·리뷰 현황**

계약 당사자가 본다. 버전 목록(초안·검토본·최종본), 수정 요청(체크리스트·첨부·회차 차감 여부), 일반 수정 회차(계약·사용·남음), 모의 정산, 리뷰, 리뷰 가능 여부.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 납품·수정·정산·리뷰 현황 | [Delivery](#schema-delivery) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 계약이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-deliverables"></a>

### POST `/api/contracts/{contractId}/deliverables`

**버전 제출 (DEL-01·02)**

크리에이터. 확인이 끝난 본인 DELIVERABLE 파일을 묶어 버전으로 정식 제출한다(파일 업로드만으로는 납품이 아니다). 수정 요청이 열려 있으면 이 버전이 수정본이 되고 요청은 RESOLVED(일반 회차는 이때 한 번 차감). 같은 `commandId` 재전송은 새 버전·차감을 만들지 않는다. 최종본(FINAL)은 검토본 승인 뒤에만, 승인 뒤에는 최종본만 낼 수 있다. 제작 중(IN_PROGRESS)에만.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `kind` | `DRAFT`, `REVIEW`, `FINAL` | 예 | - | - |
| `fileIds` | string[] | 예 | 최소 개수 1, 최대 개수 10 | - |
| `note` | string |  | 최소 길이 1, 최대 길이 2000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 납품·수정·정산·리뷰 현황 | [Delivery](#schema-delivery) |
| 400 | 입력값·파일 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-deliverables-deliverableid-revision-requests"></a>

### POST `/api/contracts/{contractId}/deliverables/{deliverableId}/revision-requests`

**수정 요청 (REV-01·02)**

의뢰인. 최신 버전(검토 대기)에만. 체크리스트(영상 위치·현재 문제·원하는 변경)와 REVISION 첨부. 초안에는 초안 의견(DRAFT_FEEDBACK), 검토본에는 일반 수정(GENERAL)·계약 오류 시정(CONTRACT_FIX), 최종본에는 CONTRACT_FIX만. 일반 수정만 계약 회차에서 차감하며 남은 회차가 없으면 409. 수정본을 기다리는 요청은 하나뿐이다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `deliverableId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `type` | `GENERAL`, `DRAFT_FEEDBACK`, `CONTRACT_FIX` | 예 | - | - |
| `items` | object[] | 예 | 최소 개수 1, 최대 개수 30 | - |
| `items[].position` | string |  | 최대 길이 50 | - |
| `items[].problem` | string | 예 | 최소 길이 1, 최대 길이 1000 | - |
| `items[].desired` | string | 예 | 최소 길이 1, 최대 길이 1000 | - |
| `fileIds` | string[] |  | 최대 개수 10, 기본값 `[]` | - |
| `note` | string |  | 최소 길이 1, 최대 길이 2000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 납품·수정·정산·리뷰 현황 | [Delivery](#schema-delivery) |
| 400 | 입력값·파일 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-deliverables-deliverableid-approve"></a>

### POST `/api/contracts/{contractId}/deliverables/{deliverableId}/approve`

**검토본 승인 (DEL-03)**

의뢰인. 최신 검토본만. 승인만으로는 정산되지 않는다. 이후 크리에이터가 깨끗한 최종본을 낸다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `deliverableId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 납품·수정·정산·리뷰 현황 | [Delivery](#schema-delivery) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-deliverables-deliverableid-receive"></a>

### POST `/api/contracts/{contractId}/deliverables/{deliverableId}/receive`

**최종본 수령 확인 (DEL-04·05, SETTLE-01)**

의뢰인. 최신 최종본만. 채팅의 동의·다운로드로 대신할 수 없다. 결제 완료·보류 없음이면 계약 당시 요율(10%)로 모의 정산(원 단위 내림 [제안, D12])하고 거래를 COMPLETED로 닫는다. 정산할 수 없으면 DELIVERED로 남는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `deliverableId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 납품·수정·정산·리뷰 현황 | [Delivery](#schema-delivery) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-reviews"></a>

### POST `/api/contracts/{contractId}/reviews`

**리뷰 작성 (REVIEW-01)**

최종 수령 완료(COMPLETED)와 모의 정산 성공(SIMULATED)이 확인된 거래의 당사자가 한 번 평가한다. 평점 1~5 정수, 본문 최대 2000자, 선택 태그 최대 5개·각 30자 [제안, D14]. 동일 내용 재전송은 기존 리뷰를 반환하며 다른 내용은 409다. 받은 리뷰 공개 기준은 유지한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `rating` | integer | 예 | 최소 1, 최대 5 | - |
| `comment` | string |  | 최소 길이 1, 최대 길이 2000 | - |
| `tags` | string[] |  | 최대 개수 5, 기본값 `[]` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 납품·수정·정산·리뷰 현황 | [Delivery](#schema-delivery) |
| 400 | 입력값·파일 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-settlements-me"></a>

### GET `/api/settlements/me`

**내 모의 정산 내역**

내가 당사자인 거래의 모의 정산(거래 금액·수수료·지급 예정액). 실제 송금이 아니다.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 정산 내역 | [SettlementListResponse](#schema-settlementlistresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-get-api-users-userid-reviews"></a>

### GET `/api/users/{userId}/reviews`

**받은 리뷰 (공개)**

프로필 화면용. 평균 평점·개수와 최근 50개.

- 인증: 없음

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `userId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 받은 리뷰 | [ReviewListResponse](#schema-reviewlistresponse) |
| 400 | ID 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |

## 제작 준비·진행 (`production`)

<a id="op-get-api-contracts-contractid-production"></a>

### GET `/api/contracts/{contractId}/production`

**제작 정보 (READY·WORK)**

계약 당사자가 본다. 결제 완료 여부, 자료 목록·상태, 시작 가능 여부(`readyToStart`), 시작 시각, 작업 일수·마감일(KST), 납기 변경 이력.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작 정보 | [Production](#schema-production) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 계약이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-materials"></a>

### POST `/api/contracts/{contractId}/production/materials`

**제작 자료 내기 (READY-01)**

의뢰인. 파일(확인이 끝난 본인 MATERIAL 파일)·실물 발송(택배사·송장번호)·메모. 문제가 신고된 자료는 `replacesMaterialId`로 대체한다(원래 자료는 REPLACED). 제작 준비 단계에서만. `commandId`(화면이 만든 UUID)가 같고 내용도 같은 재전송은 자료를 새로 만들지 않고 현재 상태를 준다. 같은 `commandId`에 다른 내용이면 409.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

타입: object 또는 object 또는 object

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 제작 정보 | [Production](#schema-production) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-materials-materialid-confirm"></a>

### POST `/api/contracts/{contractId}/production/materials/{materialId}/confirm`

**자료 정상 확인 (READY-02)**

크리에이터. 제출된 자료로 작업할 수 있음을 확인한다. 발송 등록과 정상 수령은 다르다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `materialId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작 정보 | [Production](#schema-production) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-materials-materialid-issue"></a>

### POST `/api/contracts/{contractId}/production/materials/{materialId}/issue`

**자료 누락·문제 신고 (READY-02)**

크리에이터. 제출·확인된 자료의 문제를 알린다. 의뢰인이 대체 자료를 낼 때까지 제작을 시작할 수 없다. 대화방에 시스템 안내가 남는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `materialId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `note` | string | 예 | 최소 길이 1, 최대 길이 1000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작 정보 | [Production](#schema-production) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-start"></a>

### POST `/api/contracts/{contractId}/production/start`

**제작 시작 (WORK-01)**

크리에이터. 결제 완료, 확인된 자료 1개 이상, 미확인·문제 자료 없음일 때만. 마감일은 이때 한 번 계산한다: 시작일(KST) + 작업 일수(지원 때 제안한 기간, 달력일) [제안, D09].

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작 정보 | [Production](#schema-production) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-deadline-changes"></a>

### POST `/api/contracts/{contractId}/production/deadline-changes`

**납기 변경 요청 (WORK-02)**

제작 중에 어느 당사자든 요청한다. 대기 중인 요청은 하나뿐이다. 상대방이 승인해야 마감일이 바뀐다(대화 속 동의로 바뀌지 않음). 이전 마감일·사유가 이력으로 남는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `newDueDate` | string(date) | 예 | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))$` | - |
| `reason` | string | 예 | 최소 길이 1, 최대 길이 1000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 201 | 제작 정보 | [Production](#schema-production) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-deadline-changes-changeid-approve"></a>

### POST `/api/contracts/{contractId}/production/deadline-changes/{changeId}/approve`

**납기 변경 승인 (WORK-02)**

요청하지 않은 당사자만. 승인하면 마감일이 바뀐다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `changeId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작 정보 | [Production](#schema-production) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-production-deadline-changes-changeid-reject"></a>

### POST `/api/contracts/{contractId}/production/deadline-changes/{changeId}/reject`

**납기 변경 거절 (WORK-02)**

요청하지 않은 당사자만. 기존 마감일을 유지한다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `changeId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 제작 정보 | [Production](#schema-production) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 역할이 맞지 않음 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 지금 상태에서 할 수 없음 (`CONFLICT`) | [Error](#schema-error) |

## 결제·정산 (`payments`)

<a id="op-get-api-contracts-contractid-payments"></a>

### GET `/api/contracts/{contractId}/payments`

**계약의 결제 내역 (PAY-02)**

계약 당사자(의뢰인·크리에이터)가 볼 수 있다. 최근 주문부터. 실패·취소된 주문도 남는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 결제 내역 | [PaymentListResponse](#schema-paymentlistresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-contracts-contractid-payments"></a>

### POST `/api/contracts/{contractId}/payments`

**결제 주문 만들기 (PAY-01)**

계약의 의뢰인만 만들 수 있다. 금액은 서명된 계약 금액이다(요청으로 받지 않는다). `commandId`가 Toss `orderId`가 된다. 진행 중이거나 완료된 주문(`READY`·`UNKNOWN`·`SUCCEEDED`)이 있으면 409다. 같은 `commandId`의 재전송은 200으로 기존 주문을 준다. 테스트 시크릿 키가 없으면 503.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 같은 요청의 재전송 (기존 주문) | [PaymentOrder](#schema-paymentorder) |
| 201 | 만든 주문 (Toss 결제창에 orderId·amount를 넘긴다) | [PaymentOrder](#schema-paymentorder) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 결제할 수 없는 계약, 진행 중·완료된 주문 있음, 다른 계약에서 쓴 식별자 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 테스트 결제 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-payments-confirm"></a>

### POST `/api/payments/confirm`

**결제 승인 (PAY-01)**

Toss successUrl로 돌아온 `paymentKey`·`orderId`·`amount`로 승인한다. `amount`가 저장한 주문 금액과 다르면 Toss를 부르지 않고 400이다. 결과는 주문 상태로 돌려준다: 승인되면 `SUCCEEDED`(크리에이터에게 `PAYMENT_SUCCEEDED` 알림), 거절되면 `FAILED`, 응답을 받지 못하면 `UNKNOWN`(sync로 다시 맞춘다). 같은 승인의 재전송은 이전 결과를 준다. Toss는 결제 요청 뒤 10분 안에 승인해야 한다.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `paymentKey` | string | 예 | 최소 길이 1, 최대 길이 200 | - |
| `orderId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `amount` | integer | 예 | 최소 1, 최대 1000000000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 승인 결과가 반영된 주문 | [PaymentOrder](#schema-paymentorder) |
| 400 | 입력값 오류, 주문 금액과 다른 금액 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 주문이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 이미 처리된 주문 (`CONFLICT`) | [Error](#schema-error) |
| 503 | 테스트 결제 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-payments-orderid-sync"></a>

### POST `/api/payments/{orderId}/sync`

**결제 결과 다시 확인 (PAY-02)**

`READY`·`UNKNOWN` 주문을 Toss 조회 결과로 맞춘다. 계약 당사자 누구나 부를 수 있다. 이미 끝난 주문은 그대로 돌려준다. 브라우저 복귀 값(success·amount·paymentKey)은 결과 증거로 쓰지 않는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `orderId` | 경로 | 예 | string(uuid) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 최신 주문 | [PaymentOrder](#schema-paymentorder) |
| 400 | 주문 번호 형식 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 주문이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 503 | 테스트 결제 미설정 (`SERVICE_UNAVAILABLE`) | [Error](#schema-error) |

<a id="op-post-api-payments-orderid-fail"></a>

### POST `/api/payments/{orderId}/fail`

**결제 취소·실패 기록**

Toss failUrl로 돌아온 `code`·`message`를 기록하고, 서버가 Toss 주문 조회로 결과를 확인한다(브라우저 값만으로 닫지 않는다). 결제 기록이 없으면(`NOT_FOUND_PAYMENT`) `PAY_PROCESS_CANCELED`는 `CANCELED`, 그 밖에는 `FAILED`. 주문과 맞는 `ABORTED`·`EXPIRED`는 `FAILED`, 이미 승인(`DONE`)됐으면 `SUCCEEDED`. 조회가 안 되거나 진행 중·불일치·부분 취소면 `UNKNOWN`으로 두어 새 주문을 막는다(나중에 sync). 이미 끝난 주문은 그대로 돌려준다. 의뢰인만 부를 수 있다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `orderId` | 경로 | 예 | string(uuid) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `code` | string | 예 | 최소 길이 1, 최대 길이 100 | - |
| `message` | string |  | 최대 길이 500 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 닫힌 주문 | [PaymentOrder](#schema-paymentorder) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 의뢰인이 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 주문이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 승인 요청 전 주문이 아님 (`CONFLICT`) | [Error](#schema-error) |

## 조건 확정·서명 (`terms`)

<a id="op-get-api-work-requests-workrequestid-terms"></a>

### GET `/api/work-requests/{workRequestId}/terms`

**최종 조건서 조회 (TERMS-01)**

그 요청의 의뢰인·크리에이터만 볼 수 있다. 참조 사본(첫 저장 때 고정), 모든 버전(값·작성자·상태·서명), 계약(있으면)을 준다. 협의가 끝난 뒤에도 기록을 볼 수 있다. 기한이 지난 `SIGNING` 버전은 `EXPIRED`로 보인다. 공개 지원의 요청 ID는 지원 ID와 같다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 조건서 | [TermsDocument](#schema-termsdocument) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 요청이 없거나 그 요청의 의뢰인·크리에이터가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

<a id="op-post-api-work-requests-workrequestid-terms-versions"></a>

### POST `/api/work-requests/{workRequestId}/terms/versions`

**조건서 새 버전 저장 (TERMS-01·03)**

협의 중(`DISCUSSING`)인 요청에서 양측 누구나 저장할 수 있다. 항목이 비어 있어도 저장된다. 이전 `DRAFT`·`SIGNING` 버전은 `SUPERSEDED`가 되고 서명은 새 버전에 복사되지 않는다. `baseVersionNo`는 화면이 보고 있던 마지막 버전 번호(없으면 0)이며, 다르면 409다. 같은 `commandId`로 같은 내용을 다시 보내면 새 버전 없이 200으로 이전 결과를 준다. 모집 마감은 진행 중인 협의를 막지 않는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `baseVersionNo` | integer | 예 | 최소 0, 최대 9007199254740991 | - |
| `values` | object | 예 | - | - |
| `values.amountKrw` | integer 또는 null | 예 | 최소 1, 최대 1000000000 | - |
| `values.specification` | string 또는 null | 예 | 최대 길이 4000 | - |
| `values.scope` | string 또는 null | 예 | 최대 길이 4000 | - |
| `values.materials` | string 또는 null | 예 | 최대 길이 4000 | - |
| `values.deadline` | string 또는 null | 예 | 최대 길이 4000 | - |
| `values.revisions` | string 또는 null | 예 | 최대 길이 4000 | - |
| `values.usageRights` | string 또는 null | 예 | 최대 길이 4000 | - |
| `values.cancellation` | string 또는 null | 예 | 최대 길이 4000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 같은 요청의 재전송 (이전 결과) | [TermsVersion](#schema-termsversion) |
| 201 | 저장된 새 버전 | [TermsVersion](#schema-termsversion) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 요청이 없거나 그 요청의 의뢰인·크리에이터가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 협의 중이 아님, 계약·종료된 프로젝트, 다른 작성본이 먼저 저장됨, 같은 `commandId`에 다른 내용 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-work-requests-workrequestid-terms-versions-versionno-signing"></a>

### POST `/api/work-requests/{workRequestId}/terms/versions/{versionNo}/signing`

**서명 요청 (TERMS-02)**

마지막 `DRAFT` 버전에 대해 서명을 요청한다. 요청은 서명이 아니다. 기한은 요청 시각부터 48시간이며, 금액과 조건 7개가 모두 있어야 한다. 이미 `SIGNING`이면 기한을 늘리지 않고 그대로 200이다. 상대방에게 `TERMS_SIGNING_REQUESTED` 알림이 간다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `versionNo` | 경로 | 예 | string (형식 `^[1-9]\d{0,8}$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 서명 요청된 버전 | [TermsVersion](#schema-termsversion) |
| 400 | 비어 있는 조건이 있음 (`VALIDATION_FAILED`, `details`에 항목) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 요청이 없거나 그 요청의 의뢰인·크리에이터가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 협의 중이 아님, 최신 버전이 아님, 기한 만료, 서명 요청할 수 없는 상태 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-post-api-work-requests-workrequestid-terms-versions-versionno-signatures"></a>

### POST `/api/work-requests/{workRequestId}/terms/versions/{versionNo}/signatures`

**본인 서명 (CONTRACT-01)**

`SIGNING`이고 기한 전인 버전에만 서명할 수 있다. `termsHash`는 화면이 본 버전의 해시이며 서버 값과 같아야 한다. 같은 버전의 두 번째 서명이면 한 트랜잭션에서 계약을 만들고, 요청·프로젝트를 `CONTRACTED`로, 같은 프로젝트의 다른 활성 지원을 `NOT_SELECTED`(`OTHER_SELECTED`)로, 그 지원들의 미확정 조건서를 `VOID`로 바꾼다. 양측에 `CONTRACT_SIGNED`, 다른 지원자에게 `APPLICATION_AUTO_REJECTED` 알림이 간다. 공고당 계약은 하나다. 이미 서명한 사람이 같은 내용으로 다시 보내면 200으로 이전 결과를 준다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |
| `versionNo` | 경로 | 예 | string (형식 `^[1-9]\d{0,8}$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `signerName` | string | 예 | 최소 길이 1, 최대 길이 100 | - |
| `consent` | `true` | 예 | - | - |
| `termsHash` | string | 예 | 형식 `^[0-9a-f]{64}$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 같은 서명의 재전송 (이전 결과) | [SignatureResponse](#schema-signatureresponse) |
| 201 | 서명 결과 (계약이 체결되면 함께) | [SignatureResponse](#schema-signatureresponse) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 요청이 없거나 그 요청의 의뢰인·크리에이터가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 협의 중이 아님, 서명할 수 없는 버전·기한 만료, 내용 해시 불일치, 이미 다른 내용으로 서명함, 이미 다른 후보와 계약 확정 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-work-requests-workrequestid-contract"></a>

### GET `/api/work-requests/{workRequestId}/contract`

**계약서 조회 (SIGN-01)**

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 계약 | [Contract](#schema-contract) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 이용 제한·탈퇴 회원 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 계약이 없거나 그 요청의 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |

## 내 활동 (`activity`)

<a id="op-get-api-activity"></a>

### GET `/api/activity`

**내 활동 묶음 조회 (ACT-01)**

의뢰인: 내 모집(지원 수·검토 대기 수)과 내 요청. 크리에이터: 내 지원·직접 의뢰와 관심 공고 수. 요청마다 진행 단계(stage)를 계약·결제·제작·정산·취소 상태로 계산해 준다. 미확인 알림 수 포함.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 내 활동 | [ActivityResponse](#schema-activityresponse) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 회원(의뢰인·크리에이터)이 아님 (`FORBIDDEN`) | [Error](#schema-error) |

## 신고·이용 제한 (`safety`)

<a id="op-post-api-reports"></a>

### POST `/api/reports`

**신고 (OPS-01) [제안, D18]**

회원. 공개 모집(PROJECT) 또는 본인이 당사자인 의뢰(WORK_REQUEST)를 신고한다. 신고만으로 제재하지 않는다. 같은 commandId·같은 내용 재전송은 처음 접수(200), 다른 내용이면 409. 본인 신고는 403.

- 인증: 로그인 필요

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `targetType` | `PROJECT`, `WORK_REQUEST` | 예 | - | - |
| `targetId` | string | 예 | 형식 `^[1-9]\d*$` | - |
| `reason` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |
| `evidence` | string |  | 최대 길이 4000, 기본값 `""` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 이미 접수된 같은 신고 | [SafetyReport](#schema-safetyreport) |
| 201 | 접수된 신고 | [SafetyReport](#schema-safetyreport) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 회원이 아니거나 본인 신고 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 대상이 없거나 당사자가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 같은 식별자로 다른 신고 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-reports-me"></a>

### GET `/api/reports/me`

**내 신고·제한 안내 (OPS-01·02)**

내가 낸 신고의 진행 상태와, 나를 대상으로 한 경고·제한·해제 안내. 대상자에게는 신고자·신고 사유를 보여주지 않는다. limited가 true면 새 공고·지원·직접 의뢰가 403 `RESTRICTED`다(진행 중인 거래는 계속).

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 내 신고·제한 안내 | [MySafetyView](#schema-mysafetyview) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |

<a id="op-post-api-reports-reportid-appeal"></a>

### POST `/api/reports/{reportId}/appeal`

**이의 제기 (OPS-02)**

제한된 본인만. 같은 commandId·같은 내용 재전송은 한 번만 남는다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `reportId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `note` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 내 신고·제한 안내 | [MySafetyView](#schema-mysafetyview) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 404 | 본인이 대상인 신고가 아님 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 제한 중이 아니거나 식별자 충돌 (`CONFLICT`) | [Error](#schema-error) |

<a id="op-get-api-admin-reports"></a>

### GET `/api/admin/reports`

**신고 목록 (운영자)**

운영자. 처리 전 신고부터 최근 100건.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 신고 목록 | [SafetyReportList](#schema-safetyreportlist) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 운영자가 아님 (`FORBIDDEN`) | [Error](#schema-error) |

<a id="op-post-api-admin-reports-reportid-actions"></a>

### POST `/api/admin/reports/{reportId}/actions`

**신고 조치 (운영자, OPS-01)**

REVIEW(검토 중)·WARN(경고)·LIMIT(이용 제한)·RELEASE(해제). 근거(note)가 운영 기록에 남고, 대상자에게 경고·제한·해제 알림, 신고자에게 처리 완료 알림이 간다. 같은 commandId 재전송은 한 번만 처리된다.

- 인증: 로그인 필요

**파라미터**

| 이름 | 위치 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- | --- |
| `reportId` | 경로 | 예 | string (형식 `^[1-9]\d*$`) | - |

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `commandId` | string(uuid) | 예 | 형식 `^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\|00000000-0000-0000-0000-000000000000\|ffffffff-ffff-ffff-ffff-ffffffffffff)$` | - |
| `action` | `REVIEW`, `WARN`, `LIMIT`, `RELEASE` | 예 | - | - |
| `note` | string | 예 | 최소 길이 1, 최대 길이 2000 | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 처리된 신고 | [SafetyReport](#schema-safetyreport) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 운영자가 아님 (`FORBIDDEN`) | [Error](#schema-error) |
| 404 | 신고가 없음 (`NOT_FOUND`) | [Error](#schema-error) |
| 409 | 제한 중이 아닌데 해제하거나 식별자 충돌 (`CONFLICT`) | [Error](#schema-error) |

## 행동 기록 (`analytics`)

<a id="op-post-api-analytics-events"></a>

### POST `/api/analytics/events`

**행동 기록 (METRIC-01) [제안, D22]**

로그인 없이도 보낼 수 있다(토큰이 있으면 사용자와 연결). 이벤트 이름·공개 대상 ID·발생 시각만 받는다(개인 입력값 없음). 요청 발송·계약 확정·거래 완료는 사용자별 대상당 한 번만 센다. 시연 계정 이벤트는 집계에서 빠진다. IP당 분당 60회.

- 인증: 없음

**요청 본문** (application/json, 필수)

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `events` | object[] | 예 | 최소 개수 1, 최대 개수 20 | - |
| `events[].name` | `feed_view`, `work_play`, `creator_view`, `request_sent`, `contract_confirmed`, `transaction_completed` | 예 | - | - |
| `events[].objectId` | string | 예 | 형식 `^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$` | - |
| `events[].at` | string(date-time) | 예 | 형식 `^(?:(?:\d\d[2468][048]\|\d\d[13579][26]\|\d\d0[48]\|[02468][048]00\|[13579][26]00)-02-29\|\d{4}-(?:(?:0[13578]\|1[02])-(?:0[1-9]\|[12]\d\|3[01])\|(?:0[469]\|11)-(?:0[1-9]\|[12]\d\|30)\|(?:02)-(?:0[1-9]\|1\d\|2[0-8])))T(?:(?:[01]\d\|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z))$` | - |

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 202 | 저장된 이벤트 수 | [AnalyticsAccepted](#schema-analyticsaccepted) |
| 400 | 입력값 오류 (`VALIDATION_FAILED`) | [Error](#schema-error) |
| 401 | 토큰이 잘못됨 (`UNAUTHENTICATED`) | [Error](#schema-error) |
| 429 | 요청이 너무 많음 (`RATE_LIMITED`) | [Error](#schema-error) |

<a id="op-get-api-admin-analytics"></a>

### GET `/api/admin/analytics`

**행동 집계 (운영자)**

최근 30일, 시연 계정 제외, 이벤트별 건수와 사용자 수.

- 인증: 로그인 필요

**응답**

| 상태 | 설명 | 본문 |
| --- | --- | --- |
| 200 | 집계 | [AnalyticsSummary](#schema-analyticssummary) |
| 401 | 토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`) | [Error](#schema-error) |
| 403 | 운영자가 아님 (`FORBIDDEN`) | [Error](#schema-error) |

## 데이터 형식

응답 본문과 요청 본문에서 참조하는 형식이다.

<a id="schema-pricinganalysisresponse"></a>

### PricingAnalysisResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `reportId` | string 또는 null | 예 | - | 저장한 분석 보고서. 예산 반영(AI-02)에 쓴다. |
| `source` | `"AI_ESTIMATE"` | 예 | - | - |
| `currency` | `"KRW"` | 예 | - | - |
| `summary` | string | 예 | - | - |
| `workUnits` | object[] | 예 | - | - |
| `workUnits[].name` | string | 예 | - | - |
| `workUnits[].quantity` | integer | 예 | - | - |
| `workUnits[].unitPriceKrw` | integer | 예 | 최소 1000 | - |
| `workUnits[].rationale` | string | 예 | - | - |
| `workUnits[].subtotalKrw` | integer | 예 | 최소 1000 | - |
| `estimatedBudgetKrw` | integer | 예 | 최소 1 | - |
| `assumptions` | string[] | 예 | - | - |
| `notice` | string | 예 | - | - |

<a id="schema-error"></a>

### Error

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `error` | object | 예 | - | - |
| `error.code` | `VALIDATION_FAILED`, `INVALID_JSON`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `SESSION_REVOKED`, `INVALID_CREDENTIALS`, `EMAIL_ALREADY_EXISTS`, `REFRESH_RACE`, `RATE_LIMITED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `SERVICE_UNAVAILABLE`, `RESTRICTED`, `INTERNAL_ERROR` | 예 | - | - |
| `error.message` | string | 예 | - | - |
| `error.details` | any |  | - | 공개해도 되는 추가 정보 (예: 검증 실패 필드) |

<a id="schema-authuser"></a>

### AuthUser

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | 형식 `^\d+$` | - |
| `email` | string 또는 null | 예 | - | - |
| `name` | string | 예 | - | - |
| `role` | `CLIENT`, `CREATOR`, `ADMIN` | 예 | - | - |
| `status` | `ACTIVE`, `RESTRICTED`, `WITHDRAWN` | 예 | - | - |

<a id="schema-authtokenresponse"></a>

### AuthTokenResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `accessToken` | string | 예 | - | - |
| `accessTokenExpiresIn` | integer | 예 | - | 초 단위 (900 = 15분) |
| `user` | [AuthUser](#schema-authuser) | 예 | - | - |

<a id="schema-socialsignuppendingresponse"></a>

### SocialSignupPendingResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `provider` | `google`, `kakao` | 예 | - | - |
| `suggestedName` | string 또는 null | 예 | - | 제공자 이름. 가입 화면의 기본값으로만 쓴다(2~20자 아닐 수 있음). |
| `providerEmail` | string 또는 null | 예 | - | 제공자가 확인한 이메일. 로그인 이메일이 아니다. |

<a id="schema-meresponse"></a>

### MeResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `user` | [AuthUser](#schema-authuser) | 예 | - | - |

<a id="schema-clientprofile"></a>

### ClientProfile

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `type` | `"CLIENT"` | 예 | - | - |
| `imageFileId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |
| `brandName` | string 또는 null | 예 | - | - |
| `introduction` | string 또는 null | 예 | - | - |
| `industry` | `BEAUTY`, `FOOD`, `LIFESTYLE`, `TECH`, `OTHER`, `null` | 예 | - | - |
| `websiteUrl` | string 또는 null | 예 | - | - |
| `socialUrl` | string 또는 null | 예 | - | - |

<a id="schema-creatorprofile"></a>

### CreatorProfile

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `type` | `"CREATOR"` | 예 | - | - |
| `imageFileId` | string 또는 null |  | 형식 `^[1-9]\d*$` | - |
| `career` | string 또는 null |  | - | - |
| `websiteUrl` | string 또는 null |  | - | - |
| `socialUrl` | string 또는 null |  | - | - |
| `introduction` | string 또는 null | 예 | - | - |
| `niche` | `BEAUTY`, `FOOD`, `LIFESTYLE`, `TECH`, `OTHER`, `null` | 예 | - | - |
| `contentStyles` | (`MODERN`, `BRIGHT`, `EMOTIONAL`, `PROFESSIONAL`, `OTHER`)[] | 예 | - | - |
| `productionRoles` | (`PLANNING`, `ON_CAMERA`, `FILMING`, `EDITING`)[] | 예 | - | - |
| `workMethod` | string 또는 null | 예 | - | - |
| `serviceStatus` | `DRAFT`, `PUBLIC`, `PRIVATE` | 예 | - | 처음에는 DRAFT. 프로필 저장으로는 바뀌지 않는다. |
| `isAvailable` | boolean | 예 | - | - |
| `availableFrom` | string 또는 null(date) | 예 | - | - |

<a id="schema-myprofileresponse"></a>

### MyProfileResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `name` | string | 예 | - | 회원 표시 이름 |
| `profile` | [ClientProfile](#schema-clientprofile) 또는 [CreatorProfile](#schema-creatorprofile) | 예 | - | - |

<a id="schema-project"></a>

### Project

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | 형식 `^\d+$` | - |
| `clientId` | string | 예 | 형식 `^\d+$` | - |
| `clientName` | string | 예 | - | - |
| `title` | string | 예 | - | - |
| `description` | string | 예 | - | - |
| `purpose` | `WEDDING_COUPLE`, `CHILD_FAMILY`, `THANKS_CELEBRATION`, `TRAVEL_DAILY`, `SNS_SHORTFORM`, `OTHER` | 예 | - | - |
| `styles` | (`EMOTIONAL`, `FUN`, `CINEMATIC`, `CLEAN`, `TRENDY`, `RETRO`, `OTHER`)[] | 예 | - | - |
| `budget` | integer | 예 | 최소 1 | KRW |
| `expectedDurationSeconds` | integer 또는 null | 예 | 최소 1 | - |
| `recruitmentEndAt` | string(date-time) | 예 | - | - |
| `deliveryDueDate` | string(date) | 예 | - | - |
| `status` | `OPEN`, `MATCHED`, `CLOSED`, `CONTRACTED` | 예 | - | - |
| `closeReason` | `MANUAL`, `EXPIRED`, `NO_SELECTION`, `null` | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `updatedAt` | string(date-time) | 예 | - | - |

<a id="schema-projectlistresponse"></a>

### ProjectListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `unavailableIds` | string[] |  | - | 저장 목록에서 삭제된 모집의 ID. 제목 등은 공개하지 않는다. |
| `recommendation` | object |  | - | - |
| `recommendation.basis` | `PREFERENCES`, `LATEST_NO_PREFERENCES`, `LATEST_NO_MATCHES` | 예 | - | - |
| `recommendation.reason` | string | 예 | - | - |
| `items` | [Project](#schema-project)[] | 예 | - | - |
| `pagination` | object | 예 | - | - |
| `pagination.page` | integer | 예 | - | - |
| `pagination.pageSize` | integer | 예 | - | - |
| `pagination.total` | integer | 예 | - | - |
| `pagination.totalPages` | integer | 예 | - | - |

<a id="schema-application"></a>

### Application

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `projectId` | string | 예 | - | - |
| `creatorId` | string | 예 | - | - |
| `creatorName` | string | 예 | - | - |
| `message` | string | 예 | - | - |
| `proposedAmount` | integer | 예 | - | - |
| `expectedDays` | integer | 예 | - | - |
| `status` | `PENDING`, `DISCUSSING`, `CONTRACTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED`, `NOT_SELECTED` | 예 | - | - |
| `closedReason` | `OTHER_SELECTED`, `PROJECT_DELETED`, `NO_SELECTION`, `null` | 예 | - | - |
| `respondedAt` | string 또는 null(date-time) | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-projectapplicationlistresponse"></a>

### ProjectApplicationListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [Application](#schema-application)[] | 예 | - | - |

<a id="schema-myapplicationlistresponse"></a>

### MyApplicationListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | any[] | 예 | - | - |
| `pagination` | [Pagination](#schema-pagination) | 예 | - | - |

<a id="schema-pagination"></a>

### Pagination

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `page` | integer | 예 | - | - |
| `pageSize` | integer | 예 | - | - |
| `total` | integer | 예 | - | - |
| `totalPages` | integer | 예 | - | - |

<a id="schema-notification"></a>

### Notification

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `type` | `APPLICATION_SUBMITTED`, `APPLICATION_ACCEPTED`, `DISCUSSION_REQUESTED`, `APPLICATION_AUTO_REJECTED`, `APPLICATION_DECLINED`, `PROJECT_CLOSED`, `APPLICATION_WITHDRAWN`, `PROJECT_ENDED_NO_SELECTION`, `TERMS_SIGNING_REQUESTED`, `CONTRACT_SIGNED`, `PAYMENT_SUCCEEDED`, `DELIVERABLE_SUBMITTED`, `REVISION_REQUESTED`, `DELIVERABLE_APPROVED`, `DELIVERY_RECEIVED`, `REVIEW_RECEIVED`, `DIRECT_REQUEST_RECEIVED`, `DIRECT_REQUEST_ACCEPTED`, `DIRECT_REQUEST_DECLINED`, `DIRECT_REQUEST_EXPIRED`, `CANCELLATION_PROPOSED`, `CANCELLATION_ACCEPTED`, `CANCELLATION_REJECTED`, `REFUND_SUCCEEDED`, `DISPUTE_OPENED`, `DISPUTE_RESOLVED`, `SAFETY_WARNED`, `SAFETY_LIMITED`, `SAFETY_RELEASED`, `REPORT_RESOLVED` | 예 | - | - |
| `title` | string | 예 | - | - |
| `body` | string | 예 | - | - |
| `projectId` | string 또는 null | 예 | - | - |
| `applicationId` | string 또는 null | 예 | - | - |
| `readAt` | string 또는 null(date-time) | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-notificationlistresponse"></a>

### NotificationListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [Notification](#schema-notification)[] | 예 | - | - |
| `unreadCount` | integer | 예 | - | - |
| `pagination` | [Pagination](#schema-pagination) | 예 | - | - |

<a id="schema-unreadcountresponse"></a>

### UnreadCountResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `unreadCount` | integer | 예 | - | - |

<a id="schema-storedfile"></a>

### StoredFile

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `ownerId` | string | 예 | - | - |
| `purpose` | `PROFILE_IMAGE`, `PORTFOLIO`, `CHAT_ATTACHMENT`, `MATERIAL`, `DELIVERABLE`, `REVISION`, `EVIDENCE` | 예 | - | - |
| `kind` | `VIDEO`, `IMAGE`, `ZIP` | 예 | - | - |
| `mimeType` | `video/mp4`, `video/quicktime`, `image/jpeg`, `image/png`, `image/webp`, `application/zip` | 예 | - | - |
| `fileName` | string | 예 | - | - |
| `sizeBytes` | integer | 예 | - | - |
| `status` | `PENDING`, `READY`, `REJECTED` | 예 | - | - |
| `rejectionReason` | string 또는 null | 예 | - | - |
| `workRequestId` | string 또는 null | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-fileuploadresponse"></a>

### FileUploadResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `file` | [StoredFile](#schema-storedfile) | 예 | - | - |
| `upload` | object | 예 | - | - |
| `upload.url` | string | 예 | - | - |
| `upload.token` | string | 예 | - | - |

<a id="schema-filedownloadresponse"></a>

### FileDownloadResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `url` | string | 예 | - | - |
| `expiresAt` | string(date-time) | 예 | - | - |

<a id="schema-chatmessage"></a>

### ChatMessage

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `kind` | `USER`, `SYSTEM` | 예 | - | - |
| `senderId` | string 또는 null | 예 | - | - |
| `body` | string | 예 | - | - |
| `attachments` | object[] | 예 | - | - |
| `attachments[].fileId` | string | 예 | - | - |
| `attachments[].fileName` | string | 예 | - | - |
| `attachments[].mimeType` | string | 예 | - | - |
| `attachments[].sizeBytes` | integer | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-chatroomsummary"></a>

### ChatRoomSummary

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | string | 예 | - | - |
| `projectId` | string 또는 null | 예 | - | - |
| `projectTitle` | string 또는 null | 예 | - | - |
| `clientId` | string | 예 | - | - |
| `creatorId` | string | 예 | - | - |
| `counterpartName` | string | 예 | - | - |
| `readOnly` | boolean | 예 | - | - |
| `lastMessage` | [ChatMessage](#schema-chatmessage) 또는 null | 예 | - | - |
| `unreadCount` | integer | 예 | - | - |

<a id="schema-chatroomlistresponse"></a>

### ChatRoomListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [ChatRoomSummary](#schema-chatroomsummary)[] | 예 | - | - |

<a id="schema-chatmessagesresponse"></a>

### ChatMessagesResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `room` | [ChatRoomSummary](#schema-chatroomsummary) | 예 | - | - |
| `items` | [ChatMessage](#schema-chatmessage)[] | 예 | - | - |
| `hasMore` | boolean | 예 | - | - |

<a id="schema-refund"></a>

### Refund

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `amountKrw` | integer | 예 | - | - |
| `status` | `REQUESTED`, `UNKNOWN`, `SUCCEEDED`, `FAILED` | 예 | - | - |
| `attempt` | integer | 예 | - | - |
| `failureCode` | string 또는 null | 예 | - | - |
| `failureMessage` | string 또는 null | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `updatedAt` | string(date-time) | 예 | - | - |

<a id="schema-cancellation"></a>

### Cancellation

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `versionNo` | integer | 예 | - | - |
| `status` | `PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`, `WITHDRAWN` | 예 | - | - |
| `proposedBy` | string | 예 | - | - |
| `reason` | string | 예 | - | - |
| `completedWorkKrw` | integer | 예 | - | - |
| `refundKrw` | integer | 예 | - | - |
| `deliveredFileIds` | string[] | 예 | - | - |
| `unfinishedState` | string 또는 null | 예 | - | - |
| `usageRights` | string 또는 null | 예 | - | - |
| `respondedBy` | string 또는 null | 예 | - | - |
| `respondedAt` | string 또는 null(date-time) | 예 | - | - |
| `handoverConfirmedAt` | string 또는 null(date-time) | 예 | - | - |
| `refund` | [Refund](#schema-refund) 또는 null | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-dispute"></a>

### Dispute

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `contractId` | string | 예 | - | - |
| `openedBy` | string | 예 | - | - |
| `status` | `OPEN`, `RESOLVED` | 예 | - | - |
| `reason` | string | 예 | - | - |
| `evidence` | object[] | 예 | - | - |
| `evidence[].id` | string | 예 | - | - |
| `evidence[].submittedBy` | string | 예 | - | - |
| `evidence[].note` | string | 예 | - | - |
| `evidence[].fileIds` | string[] | 예 | - | - |
| `evidence[].createdAt` | string(date-time) | 예 | - | - |
| `resolution` | string 또는 null | 예 | - | - |
| `resolvedBy` | string 또는 null | 예 | - | - |
| `resolvedAt` | string 또는 null(date-time) | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-disputelist"></a>

### DisputeList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [Dispute](#schema-dispute)[] | 예 | - | - |

<a id="schema-cancellationoverview"></a>

### CancellationOverview

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | string | 예 | - | - |
| `contractStatus` | string | 예 | - | - |
| `paidKrw` | integer | 예 | - | - |
| `cancellations` | [Cancellation](#schema-cancellation)[] | 예 | - | - |
| `disputes` | [Dispute](#schema-dispute)[] | 예 | - | - |
| `settlementHold` | string 또는 null | 예 | - | - |

<a id="schema-safetyreport"></a>

### SafetyReport

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `reporterId` | string | 예 | - | - |
| `subjectId` | string | 예 | - | - |
| `targetType` | `PROJECT`, `WORK_REQUEST` | 예 | - | - |
| `targetId` | string | 예 | - | - |
| `reason` | string | 예 | - | - |
| `evidence` | string | 예 | - | - |
| `status` | `RECEIVED`, `REVIEWING`, `RESOLVED` | 예 | - | - |
| `limited` | boolean | 예 | - | - |
| `history` | object[] | 예 | - | - |
| `history[].id` | string | 예 | - | - |
| `history[].actorId` | string | 예 | - | - |
| `history[].action` | `RECEIVED`, `REVIEW`, `WARN`, `LIMIT`, `RELEASE`, `APPEAL` | 예 | - | - |
| `history[].note` | string | 예 | - | - |
| `history[].createdAt` | string(date-time) | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-safetyreportlist"></a>

### SafetyReportList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [SafetyReport](#schema-safetyreport)[] | 예 | - | - |

<a id="schema-mysafetyview"></a>

### MySafetyView

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `limited` | boolean | 예 | - | - |
| `reports` | [SafetyReport](#schema-safetyreport)[] | 예 | - | - |
| `notices` | object[] | 예 | - | - |
| `notices[].reportId` | string | 예 | - | - |
| `notices[].limited` | boolean | 예 | - | - |
| `notices[].history` | object[] | 예 | - | - |
| `notices[].history[].id` | string | 예 | - | - |
| `notices[].history[].actorId` | string | 예 | - | - |
| `notices[].history[].action` | `RECEIVED`, `REVIEW`, `WARN`, `LIMIT`, `RELEASE`, `APPEAL` | 예 | - | - |
| `notices[].history[].note` | string | 예 | - | - |
| `notices[].history[].createdAt` | string(date-time) | 예 | - | - |

<a id="schema-activityresponse"></a>

### ActivityResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `drafts` | [ProjectDraft](#schema-projectdraft)[] | 예 | - | - |
| `role` | `CLIENT`, `CREATOR` | 예 | - | - |
| `projects` | object[] | 예 | - | - |
| `projects[].id` | string | 예 | - | - |
| `projects[].title` | string | 예 | - | - |
| `projects[].status` | string | 예 | - | - |
| `projects[].applicationCount` | integer | 예 | - | - |
| `projects[].pendingCount` | integer | 예 | - | - |
| `requests` | object[] | 예 | - | - |
| `requests[].id` | string | 예 | - | - |
| `requests[].type` | `PROJECT_APPLICATION`, `DIRECT_REQUEST` | 예 | - | - |
| `requests[].title` | string | 예 | - | - |
| `requests[].counterpartName` | string | 예 | - | - |
| `requests[].status` | string | 예 | - | - |
| `requests[].stage` | `PENDING`, `DISCUSSING`, `CLOSED`, `PAYMENT_PENDING`, `PREPARING`, `IN_PROGRESS`, `DELIVERED`, `COMPLETED`, `CANCELED`, `DISPUTED` | 예 | - | - |
| `requests[].contractId` | string 또는 null | 예 | - | - |
| `requests[].needsAction` | boolean | 예 | - | - |
| `requests[].updatedAt` | string(date-time) | 예 | - | - |
| `bookmarkCount` | integer | 예 | - | - |
| `unreadNotifications` | integer | 예 | - | - |

<a id="schema-analyticsaccepted"></a>

### AnalyticsAccepted

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `accepted` | integer | 예 | - | - |

<a id="schema-analyticssummary"></a>

### AnalyticsSummary

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `days` | integer | 예 | - | - |
| `counts` | object[] | 예 | - | - |
| `counts[].name` | `feed_view`, `work_play`, `creator_view`, `request_sent`, `contract_confirmed`, `transaction_completed` | 예 | - | - |
| `counts[].total` | integer | 예 | - | - |
| `counts[].users` | integer | 예 | - | - |

<a id="schema-operationrecordlist"></a>

### OperationRecordList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | object[] | 예 | - | - |
| `items[].id` | string | 예 | - | - |
| `items[].adminId` | string | 예 | - | - |
| `items[].targetType` | string | 예 | - | - |
| `items[].targetId` | string | 예 | - | - |
| `items[].action` | string | 예 | - | - |
| `items[].reason` | string | 예 | - | - |
| `items[].createdAt` | string(date-time) | 예 | - | - |

<a id="schema-directrequest"></a>

### DirectRequest

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `clientId` | string | 예 | - | - |
| `clientName` | string | 예 | - | - |
| `creatorId` | string | 예 | - | - |
| `creatorName` | string | 예 | - | - |
| `package` | object | 예 | - | - |
| `package.packageId` | string | 예 | - | - |
| `package.title` | string | 예 | - | - |
| `package.priceKrw` | integer | 예 | - | - |
| `package.deliveryDays` | integer | 예 | - | - |
| `package.revisionCount` | integer | 예 | - | - |
| `package.includes` | string[] | 예 | - | - |
| `message` | string | 예 | - | - |
| `purpose` | string 또는 null | 예 | - | - |
| `eventDate` | string 또는 null(date) | 예 | - | - |
| `materialType` | `PHOTOS_ONLY`, `PHOTOS_AND_VIDEOS`, `NEEDS_SHOOTING` 또는 null | 예 | - | 보유 자료: 사진만 / 사진·영상 / 촬영도 필요 |
| `desiredDeliveryDate` | string 또는 null(date) | 예 | - | 희망 납품일(행사일과 같거나 빠름) |
| `referencePortfolio` | object 또는 null | 예 | - | 이 의뢰를 시작한 참고 작품 |
| `inquiryGroupId` | string 또는 null(uuid) | 예 | - | 일괄 문의로 보낸 경우 그 묶음 ID |
| `status` | `PENDING`, `DISCUSSING`, `CONTRACTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED`, `NOT_SELECTED` | 예 | - | - |
| `respondDueAt` | string(date-time) | 예 | - | - |
| `respondedAt` | string 또는 null(date-time) | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-bulkinquiryresponse"></a>

### BulkInquiryResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `inquiryGroupId` | string(uuid) | 예 | - | - |
| `results` | object[] | 예 | - | - |
| `results[].portfolioId` | string | 예 | - | - |
| `results[].portfolioTitle` | string 또는 null | 예 | - | - |
| `results[].creatorName` | string 또는 null | 예 | - | - |
| `results[].status` | `SENT`, `ALREADY_OPEN`, `SAME_CREATOR`, `UNAVAILABLE` | 예 | - | - |
| `results[].request` | [DirectRequest](#schema-directrequest) 또는 null | 예 | - | - |

<a id="schema-workbookmarklist"></a>

### WorkBookmarkList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | object[] | 예 | - | - |
| `items[].portfolio` | [Portfolio](#schema-portfolio) | 예 | - | - |
| `items[].creator` | object | 예 | - | - |
| `items[].creator.userId` | string | 예 | - | - |
| `items[].creator.name` | string | 예 | - | - |
| `items[].startingPriceKrw` | integer 또는 null | 예 | - | - |
| `items[].savedAt` | string(date-time) | 예 | - | - |
| `items[].available` | boolean | 예 | - | - |

<a id="schema-directrequestlist"></a>

### DirectRequestList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [DirectRequest](#schema-directrequest)[] | 예 | - | - |

<a id="schema-feedresponse"></a>

### FeedResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | object[] | 예 | - | - |
| `items[].portfolio` | [Portfolio](#schema-portfolio) | 예 | - | - |
| `items[].creator` | object | 예 | - | - |
| `items[].creator.userId` | string | 예 | - | - |
| `items[].creator.name` | string | 예 | - | - |
| `items[].startingPriceKrw` | integer 또는 null | 예 | - | - |
| `page` | integer | 예 | - | - |
| `pageSize` | integer | 예 | - | - |
| `total` | integer | 예 | - | - |

<a id="schema-metricssummary"></a>

### MetricsSummary

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `generatedAt` | string(date-time) | 예 | - | - |
| `projectsPublished` | integer | 예 | - | - |
| `applications` | integer | 예 | - | - |
| `directRequests` | integer | 예 | - | - |
| `contracts` | integer | 예 | - | - |
| `paymentsSucceeded` | integer | 예 | - | - |
| `completedDeals` | integer | 예 | - | - |
| `revisionRequestRate` | number 또는 null | 예 | - | - |
| `averageProductionDays` | number 또는 null | 예 | - | - |
| `aiAnalyses` | integer | 예 | - | - |
| `aiBudgetsApplied` | integer | 예 | - | - |

<a id="schema-aireportapplyresponse"></a>

### AiReportApplyResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `reportId` | string | 예 | - | - |
| `appliedBudgetKrw` | integer | 예 | - | - |
| `draftId` | string 또는 null | 예 | - | - |
| `projectId` | string 또는 null | 예 | - | - |
| `appliedAt` | string(date-time) | 예 | - | - |

<a id="schema-servicepackage"></a>

### ServicePackage

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `creatorId` | string | 예 | - | - |
| `title` | string | 예 | - | - |
| `description` | string 또는 null | 예 | - | - |
| `purpose` | string 또는 null | 예 | - | - |
| `priceKrw` | integer 또는 null | 예 | - | - |
| `deliveryDays` | integer 또는 null | 예 | - | - |
| `revisionCount` | integer 또는 null | 예 | - | - |
| `includes` | string[] | 예 | - | - |
| `status` | `DRAFT`, `PUBLIC`, `PRIVATE` | 예 | - | - |
| `isRepresentative` | boolean | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `updatedAt` | string(date-time) | 예 | - | - |

<a id="schema-servicepackagelist"></a>

### ServicePackageList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [ServicePackage](#schema-servicepackage)[] | 예 | - | - |

<a id="schema-portfolio"></a>

### Portfolio

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `creatorId` | string | 예 | - | - |
| `title` | string | 예 | - | - |
| `description` | string 또는 null | 예 | - | - |
| `purpose` | string 또는 null | 예 | - | - |
| `styles` | string[] | 예 | - | - |
| `roles` | string[] | 예 | - | - |
| `source` | `OWN_WORK`, `CLIENT_WORK` | 예 | - | - |
| `clientConsent` | boolean | 예 | - | - |
| `videoFileId` | string 또는 null | 예 | - | - |
| `thumbnailFileId` | string 또는 null | 예 | - | - |
| `packageId` | string 또는 null | 예 | - | - |
| `status` | `DRAFT`, `PUBLIC`, `PRIVATE` | 예 | - | - |
| `publishedAt` | string 또는 null(date-time) | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `updatedAt` | string(date-time) | 예 | - | - |

<a id="schema-portfoliolist"></a>

### PortfolioList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [Portfolio](#schema-portfolio)[] | 예 | - | - |

<a id="schema-portfoliomedia"></a>

### PortfolioMedia

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `video` | object 또는 null | 예 | - | - |
| `thumbnail` | object 또는 null | 예 | - | - |

<a id="schema-creatorpublicprofile"></a>

### CreatorPublicProfile

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `career` | string 또는 null |  | - | - |
| `websiteUrl` | string 또는 null |  | - | - |
| `socialUrl` | string 또는 null |  | - | - |
| `image` | object 또는 null |  | - | - |
| `image.url` | string(uri) | 예 | - | - |
| `image.expiresAt` | string(date-time) | 예 | - | - |
| `userId` | string | 예 | - | - |
| `name` | string | 예 | - | - |
| `introduction` | string 또는 null | 예 | - | - |
| `niche` | string 또는 null | 예 | - | - |
| `contentStyles` | string[] | 예 | - | - |
| `productionRoles` | string[] | 예 | - | - |
| `isAvailable` | boolean | 예 | - | - |
| `representativePackage` | [ServicePackage](#schema-servicepackage) | 예 | - | - |
| `packages` | [ServicePackage](#schema-servicepackage)[] | 예 | - | - |
| `portfolios` | [Portfolio](#schema-portfolio)[] | 예 | - | - |
| `review` | object | 예 | - | - |
| `review.averageRating` | number 또는 null | 예 | - | - |
| `review.count` | integer | 예 | - | - |

<a id="schema-creatorservicestatus"></a>

### CreatorServiceStatus

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `serviceStatus` | `DRAFT`, `PUBLIC`, `PRIVATE` | 예 | - | - |

<a id="schema-projectdraft"></a>

### ProjectDraft

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `values` | object | 예 | - | 작성 중인 값(공고 항목과 recruitmentDays) |
| `recruitmentDays` | `3`, `7`, `14` | 예 | - | - |
| `publishedProjectId` | string 또는 null | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `updatedAt` | string(date-time) | 예 | - | - |

<a id="schema-projectdraftlist"></a>

### ProjectDraftList

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | [ProjectDraft](#schema-projectdraft)[] | 예 | - | - |

<a id="schema-projectdraftpublishresult"></a>

### ProjectDraftPublishResult

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `draft` | [ProjectDraft](#schema-projectdraft) | 예 | - | - |
| `project` | [Project](#schema-project) | 예 | - | - |

<a id="schema-deliverable"></a>

### Deliverable

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `versionNo` | integer | 예 | - | - |
| `kind` | `DRAFT`, `REVIEW`, `FINAL` | 예 | - | - |
| `status` | `SUBMITTED`, `APPROVED`, `REVISION_REQUESTED`, `SUPERSEDED`, `RECEIVED` | 예 | - | - |
| `fileIds` | string[] | 예 | - | - |
| `note` | string 또는 null | 예 | - | - |
| `resolvesRevisionRequestId` | string 또는 null | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `approvedAt` | string 또는 null(date-time) | 예 | - | - |
| `receivedAt` | string 또는 null(date-time) | 예 | - | - |

<a id="schema-revisionrequest"></a>

### RevisionRequest

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `deliverableId` | string | 예 | - | - |
| `type` | `GENERAL`, `DRAFT_FEEDBACK`, `CONTRACT_FIX` | 예 | - | - |
| `status` | `OPEN`, `RESOLVED` | 예 | - | - |
| `items` | object[] | 예 | - | - |
| `items[].position` | string |  | - | - |
| `items[].problem` | string | 예 | - | - |
| `items[].desired` | string | 예 | - | - |
| `fileIds` | string[] | 예 | - | - |
| `note` | string 또는 null | 예 | - | - |
| `countsTowardLimit` | boolean | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `resolvedAt` | string 또는 null(date-time) | 예 | - | - |

<a id="schema-settlement"></a>

### Settlement

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | string | 예 | - | - |
| `status` | `SIMULATED` | 예 | - | - |
| `grossKrw` | integer | 예 | - | - |
| `feeRateBps` | integer | 예 | - | 만분율. 1000 = 10% |
| `feeKrw` | integer | 예 | - | - |
| `payoutKrw` | integer | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-review"></a>

### Review

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `contractId` | string | 예 | - | - |
| `reviewerId` | string | 예 | - | - |
| `revieweeId` | string | 예 | - | - |
| `rating` | integer | 예 | 최소 1, 최대 5 | - |
| `comment` | string 또는 null | 예 | - | - |
| `tags` | string[] | 예 | 최대 개수 5 | - |
| `createdAt` | string(date-time) | 예 | - | - |

<a id="schema-delivery"></a>

### Delivery

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | string | 예 | - | - |
| `workRequestId` | string | 예 | - | - |
| `productionStatus` | `PREPARING`, `IN_PROGRESS`, `DELIVERED`, `COMPLETED`, `CANCELED` | 예 | - | - |
| `revisionLimit` | integer | 예 | - | - |
| `revisionsUsed` | integer | 예 | - | - |
| `revisionsRemaining` | integer | 예 | - | - |
| `deliverables` | [Deliverable](#schema-deliverable)[] | 예 | - | - |
| `revisionRequests` | [RevisionRequest](#schema-revisionrequest)[] | 예 | - | - |
| `settlement` | [Settlement](#schema-settlement) 또는 null | 예 | - | - |
| `reviews` | [Review](#schema-review)[] | 예 | - | - |
| `canReview` | boolean | 예 | - | - |

<a id="schema-settlementlistresponse"></a>

### SettlementListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `items` | any[] | 예 | - | - |

<a id="schema-reviewlistresponse"></a>

### ReviewListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `averageRating` | number 또는 null | 예 | - | - |
| `count` | integer | 예 | - | - |
| `items` | [Review](#schema-review)[] | 예 | - | - |

<a id="schema-production"></a>

### Production

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `contractId` | string | 예 | - | - |
| `workRequestId` | string | 예 | - | - |
| `status` | `PREPARING`, `IN_PROGRESS`, `DELIVERED`, `COMPLETED`, `CANCELED` | 예 | - | - |
| `paid` | boolean | 예 | - | - |
| `materials` | object[] | 예 | - | - |
| `materials[].id` | string | 예 | - | - |
| `materials[].kind` | `FILE`, `SHIPMENT`, `NOTE` | 예 | - | - |
| `materials[].status` | `SUBMITTED`, `CONFIRMED`, `ISSUE_REPORTED`, `REPLACED` | 예 | - | - |
| `materials[].fileId` | string 또는 null | 예 | - | - |
| `materials[].carrier` | string 또는 null | 예 | - | - |
| `materials[].trackingNumber` | string 또는 null | 예 | - | - |
| `materials[].note` | string 또는 null | 예 | - | - |
| `materials[].issueNote` | string 또는 null | 예 | - | - |
| `materials[].replacesMaterialId` | string 또는 null | 예 | - | - |
| `materials[].createdAt` | string(date-time) | 예 | - | - |
| `materials[].confirmedAt` | string 또는 null(date-time) | 예 | - | - |
| `readyToStart` | boolean | 예 | - | - |
| `startedAt` | string 또는 null(date-time) | 예 | - | - |
| `workingDays` | integer | 예 | - | - |
| `dueDate` | string 또는 null(date) | 예 | - | - |
| `deadlineChanges` | object[] | 예 | - | - |
| `deadlineChanges[].id` | string | 예 | - | - |
| `deadlineChanges[].requestedBy` | string | 예 | - | - |
| `deadlineChanges[].previousDueDate` | string(date) | 예 | - | - |
| `deadlineChanges[].newDueDate` | string(date) | 예 | - | - |
| `deadlineChanges[].reason` | string | 예 | - | - |
| `deadlineChanges[].status` | `PENDING`, `APPROVED`, `REJECTED` | 예 | - | - |
| `deadlineChanges[].respondedBy` | string 또는 null | 예 | - | - |
| `deadlineChanges[].respondedAt` | string 또는 null(date-time) | 예 | - | - |
| `deadlineChanges[].createdAt` | string(date-time) | 예 | - | - |

<a id="schema-paymentorder"></a>

### PaymentOrder

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `orderId` | string(uuid) | 예 | - | - |
| `contractId` | string | 예 | - | - |
| `amountKrw` | integer | 예 | - | - |
| `orderName` | string | 예 | - | - |
| `status` | `READY`, `UNKNOWN`, `SUCCEEDED`, `FAILED`, `CANCELED` | 예 | - | - |
| `method` | string 또는 null | 예 | - | - |
| `approvedAt` | string 또는 null(date-time) | 예 | - | - |
| `failureCode` | string 또는 null | 예 | - | - |
| `failureMessage` | string 또는 null | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `updatedAt` | string(date-time) | 예 | - | - |

<a id="schema-paymentlistresponse"></a>

### PaymentListResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `contract` | object | 예 | - | - |
| `contract.id` | string | 예 | - | - |
| `contract.amountKrw` | integer | 예 | - | - |
| `contract.clientId` | string | 예 | - | - |
| `contract.creatorId` | string | 예 | - | - |
| `items` | [PaymentOrder](#schema-paymentorder)[] | 예 | - | - |

<a id="schema-termsvalues"></a>

### TermsValues

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `amountKrw` | integer 또는 null | 예 | 최소 1, 최대 1000000000 | - |
| `specification` | string 또는 null | 예 | - | - |
| `scope` | string 또는 null | 예 | - | - |
| `materials` | string 또는 null | 예 | - | - |
| `deadline` | string 또는 null | 예 | - | - |
| `revisions` | string 또는 null | 예 | - | - |
| `usageRights` | string 또는 null | 예 | - | - |
| `cancellation` | string 또는 null | 예 | - | - |

<a id="schema-termsversion"></a>

### TermsVersion

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `versionNo` | integer | 예 | 최소 1 | - |
| `status` | `DRAFT`, `SIGNING`, `SIGNED`, `SUPERSEDED`, `EXPIRED`, `VOID` | 예 | - | - |
| `values` | [TermsValues](#schema-termsvalues) | 예 | - | - |
| `termsHash` | string | 예 | 형식 `^[0-9a-f]{64}$` | - |
| `authorId` | string | 예 | - | - |
| `createdAt` | string(date-time) | 예 | - | - |
| `signing` | object 또는 null | 예 | - | - |
| `signing.requestedBy` | string | 예 | - | - |
| `signing.requestedAt` | string(date-time) | 예 | - | - |
| `signing.expiresAt` | string(date-time) | 예 | - | - |
| `signatures` | object[] | 예 | - | - |
| `signatures[].userId` | string | 예 | - | - |
| `signatures[].signerName` | string | 예 | - | - |
| `signatures[].signedAt` | string(date-time) | 예 | - | - |

<a id="schema-contract"></a>

### Contract

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `id` | string | 예 | - | - |
| `workRequestId` | string | 예 | - | - |
| `projectId` | string 또는 null | 예 | - | - |
| `termsVersionNo` | integer | 예 | - | - |
| `clientId` | string | 예 | - | - |
| `creatorId` | string | 예 | - | - |
| `amountKrw` | integer | 예 | - | - |
| `termsHash` | string | 예 | - | - |
| `status` | `SIGNED`, `CANCELED` | 예 | - | - |
| `signedAt` | string(date-time) | 예 | - | - |

<a id="schema-termsdocument"></a>

### TermsDocument

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `workRequestId` | string | 예 | - | - |
| `workRequestStatus` | `PENDING`, `DISCUSSING`, `CONTRACTED`, `DECLINED`, `WITHDRAWN`, `EXPIRED`, `NOT_SELECTED` | 예 | - | - |
| `projectStatus` | `OPEN`, `MATCHED`, `CLOSED`, `CONTRACTED`, `null` | 예 | - | - |
| `reference` | object 또는 null | 예 | - | 첫 저장 때 고정한 참조 사본 (프로젝트 공개 필드, 지원 내용) |
| `reference.project` | object 또는 null | 예 | - | - |
| `reference.project.id` | string | 예 | - | - |
| `reference.project.title` | string | 예 | - | - |
| `reference.project.description` | string | 예 | - | - |
| `reference.project.purpose` | string | 예 | - | - |
| `reference.project.styles` | string[] | 예 | - | - |
| `reference.project.budget` | integer | 예 | - | - |
| `reference.request` | object | 예 | - | - |
| `reference.request.message` | string | 예 | - | - |
| `reference.request.proposedAmount` | integer | 예 | - | - |
| `reference.request.expectedDays` | integer | 예 | - | - |
| `versions` | [TermsVersion](#schema-termsversion)[] | 예 | - | - |
| `contract` | [Contract](#schema-contract) 또는 null | 예 | - | - |

<a id="schema-signatureresponse"></a>

### SignatureResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `version` | [TermsVersion](#schema-termsversion) | 예 | - | - |
| `contract` | [Contract](#schema-contract) 또는 null | 예 | - | - |

<a id="schema-healthresponse"></a>

### HealthResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `status` | `"ok"` | 예 | - | - |
| `uptimeSeconds` | integer | 예 | - | - |
| `timestamp` | string(date-time) | 예 | - | - |

<a id="schema-readinessresponse"></a>

### ReadinessResponse

| 필드 | 타입 | 필수 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `status` | `ok`, `unavailable` | 예 | - | - |
| `checks` | object | 예 | - | - |
| `checks.database` | `ok`, `error` | 예 | - | - |
| `checks.storage` | `ok`, `not_configured`, `missing_bucket`, `unauthorized`, `error` |  | - | - |
