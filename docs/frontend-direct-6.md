# 6단계 작품 탐색·직접 의뢰 작업 기록

## 범위와 설계 (2026-10-27)

- 기준: frontend-progress → frontend-plan §6 → 기능표 DIRECT-01~03, FEED-01~03 및 엑셀 해당 행29~31/71~73, P08/P23/P24를 대조했다. 기술 PDF의 기존 React/Vite/Router/Query/Axios/RHF/Zod와 KEMI 토큰을 유지한다.
- 6-A: `features/portfolio/{FeedPage,WorkDetailPage,PortfolioCard}.tsx`와 DEV catalog 모델/처리기. 공개 서비스·권한·동의·미삭제·공개 작업물만 조회, 필터/페이지 URL, 재생 실패/비공개 재조회. 신규 샘플과 가격 없는 작품 카드.
- 6-B: `profiles/CreatorDetailPage.tsx`, `requests/DirectRequestForm.tsx`와 DEV 직접 의뢰 모델/처리기. 공개 대표 우선/모든 공개 패키지, 안전한 로그인 복귀, 소유·공개 재검사, 발송 시점 사본, 개인 의뢰인 허용. 검토 후 발송, 중복/응답 유실 방어.
- 6-C: 기존 제안 상태에 캠페인 없는 직접 의뢰를 구분해 넣고 같은 목록/작업방/조건서/서명/결제/제작/수령/취소/분쟁/정산을 재사용한다. 최초 응답48시간 정각 만료, 수신자만 수락/거절, 수락은 협의만 생성. 두 직접 의뢰를 같은 캠페인 후보로 묶지 않는다.
- 단계마다 단위/브라우저/기존 린트·타입·빌드 검증 후 별도 브랜치·Draft PR. 마지막에는 직접 의뢰 정상 거래와 취소/분쟁·공개 모집 회귀를 통합 검증한다.

## API 대조와 미결정

- 현재 `docs/api문서.txt`와 로컬 API/shared에는 DIRECT/FEED 계약이 없다. 원격 기존 [백엔드 Draft #62](https://github.com/Jubileekim/KEMI/pull/62), head `a244e34`의 `packages/shared/src/direct.ts`, direct/feed 구현을 읽었다. 프론트 기존 브랜치/PR은 없었다. #62는 별도 백엔드 연쇄 Draft이므로 덮어쓰거나 병합하지 않는다.
- #62는 DIRECT create의 message10~2000, purpose/eventDate, package snapshot 일부, 대표 시작가격·고정 분류/페이지 기본24·부분UNIQUE를 제안한다. 현재 엑셀은 브리프/희망 조건·전체 패키지 참조·작품 가격 오인 방지·D02/D21 미결정을 요구한다. 원격 구현 존재만으로 현 브랜치의 실연동을 주장하지 않는다. `/__mock__/catalog`, `/__mock__/direct`로 격리한다.
- D01 공개 프로필 항목, D02 파일/외부URL·보존, D08 조건/서명, D21 분류/노출·페이지 크기는 확정하지 않는다. Mock의 텍스트 제한/페이지 크기/예시 순서는 QA 후보이며 성과·제품 정책이 아니다. 기존 D12/D13/D18 취소/분쟁 경계 유지.
- 의뢰 제목·브리프·희망 조건의 필수 텍스트/4000자 제한, 거절 사유 선택 여부도 DEV 입력 검토 후보다. 실제 API의 필수/선택·길이·동시 진행 수/재발송·수락 이후 종료 정책은 조율한다. 공개 제작자 소개는 이미 저장한 제작자 소개 중 명시적으로 서비스를 공개한 경우의 텍스트만 투영하며 이메일·개인 추가 정보 전체를 반환하지 않는다. 소개를 새로운 공개 필수 요건으로 만들지 않는다.
- 실패 대비: 조회 후 비공개/삭제·상품 변경은 발송 시 재검사; 타인 상품/비당사자/위조Bearer는 처리기 거부; 지연 로그아웃은 epoch 재검사; 중복은 같은 명령ID와 내용 검사; 유실은 재조회/같은ID 재시도;48시간 정각은 처리기 시계에서 차단; 캠페인 null은 조건서와 선정의 독립 분기로 검증한다.
- 실제 API/DB/스토리지/외부 영상/알림·실시간·영구복원·다중 탭은 미연결이다. 단일 탭 메모리, 새로고침 초기화는 기존 Mock 구조를 유지한다.

## 진행

- 시작: HEAD `7268ce6`, branch `feat/frontend-5c-public-verification`. 기존 `outputs/`, `tools/` 미추적은 변경/포함하지 않는다. main은5단계가 없어 현재5-C 위에 쌓는다. 원격 최신 main을 임의 병합하지 않는다.

## 구현 경계와 API 조율 표

| 기능         | 현 체크아웃 / 원격 #62                                                                                      | 이번 구현과 남은 조율                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FEED-01      | 현 계약 없음 / `GET /api/feed`, purpose/styles/roles·최근 공개순·pageSize24·startingPriceKrw                | DEV catalog의 스타일/유형 자유텍스트·3개 페이지는 QA 후보. 작품 가격 표시는 하지 않으며 D21 노출/분류/페이지 정책은 미결정 유지                                                                                      |
| FEED-02/03   | 현 계약 없음 / 별도 catalog와 direct-feed 계약의 조합 필요                                                  | 작품별 공개/동의 재검사·제작자 출처 쿼리로 로컬 중복ID 혼용 방지. 합성 미디어는 명시적 seed에만 연결, 사용자 작업물 파일명만으로 합성 영상을 제공하지 않음. 외부URL 재생과 실제 저장소 권한은 D02 조율               |
| DIRECT-01    | 현 계약 없음 / `POST /api/packages/:packageId/direct-requests`, message/purpose/eventDate, 부분 패키지 사본 | 브리프·희망 조건과 모든 패키지 조건 발송 사본을 별도 DEV 모델로 검토. API 입력/전체 사본·가격 변경 확인·명령ID 조율 필요. 동일ID/내용 복구는 구현; 패키지별 동시 진행 수/재발송 정책은 확정하지 않음                 |
| DIRECT-02/03 | 현 계약 없음 / `GET /api/direct-requests[/:id]`, accept/decline/withdraw, 조회/동작 시 만료                 | 본인 수신자만 최초48시간 응답/정각 만료. 수락은 방만 생성, 일반 제안 명령으로 우회 불가. 거절 사유 선택·시계 제어는 DEV 후보. 자동 알림/스케줄러/accepted 이후 종료 및 withdraw 정책은 실제 API 조율에 남김          |
| 공통 거래    | 기존 프론트 공통 Mock / 별도 백엔드 계약들                                                                  | `campaignId:null`, 조건서의 `sources.campaign:null`과 발송 패키지 사본 사용. 캠페인 선정 비교는 실제 campaignId가 있을 때만 적용. 서명/전액결제/제작/영상/수령/취소·환불·분쟁/정산 UI와 권한 검사는 기존 흐름 재사용 |

## 검증 재현

- `npm run test:web`, `npm run build:web`, `npm run check:tokens`; 전달 파일 Prettier/diff. API/shared와 의존성은 변경하지 않는다.
- 기본 러너는 `npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-6/playwright.edge.config.ts ...`이다. 이 Windows 세션에서는 npm 자식 서버 종료 대기를 피하려고 전용5196 Vite를 직접 시작하고 `KEMI_QA_EXTERNAL_SERVER=true`로 명시한 서버만 검사했다. 기존 다른 서버는 재사용/종료하지 않았다. shared 빌드와 브라우저 검사는 겹치지 않는다.
- 기본/두flag 운영 빌드 뒤 `node qa/frontend-6/production-check.mjs` 및 `--auth-fixtures`. 독립 HTTP 인증 fixture이며 실제 서버/권한 검증이 아니다. DEV 코드/worker/합성 미디어 제외와 공개3경로·직접발송/목록/방의 운영 안내/역할 가드를 검사한다.
- `direct-request.spec.ts`의 정상 전거래/응답/기한/권한과 `refunds-disputes.spec.ts`의 직접 의뢰 분기는 기존 거래 helper/동일 처리기를 사용한다. 공개 모집 회귀도 함께 검증한다. 최종 수·실패 이력/소스 해시/Git/CI는 진행 기록과 QA JSON을 따른다.
