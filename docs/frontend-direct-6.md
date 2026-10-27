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
- 실패 대비: 조회 후 비공개/삭제·상품 변경은 발송 시 재검사; 타인 상품/비당사자/위조Bearer는 처리기 거부; 지연 로그아웃은 epoch 재검사; 중복은 같은 명령ID와 내용 검사; 유실은 재조회/같은ID 재시도;48시간 정각은 처리기 시계에서 차단; 캠페인 null은 조건서와 선정의 독립 분기로 검증한다.
- 실제 API/DB/스토리지/외부 영상/알림·실시간·영구복원·다중 탭은 미연결이다. 단일 탭 메모리, 새로고침 초기화는 기존 Mock 구조를 유지한다.

## 진행

- 시작: HEAD `7268ce6`, branch `feat/frontend-5c-public-verification`. 기존 `outputs/`, `tools/` 미추적은 변경/포함하지 않는다. main은5단계가 없어 현재5-C 위에 쌓는다. 원격 최신 main을 임의 병합하지 않는다.
