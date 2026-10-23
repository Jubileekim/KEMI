# KEMI 프론트엔드 개발 계획안

작성일: 2026-10-23 · 개정: 기술 스택 문서 반영 · 상태: 계획 작성 완료, 앱 구현 미착수

## 1. 목표와 기준

의뢰인과 크리에이터가 공개 모집 또는 직접 의뢰로 만나, 같은 의뢰의 채팅·작업 공간에서 조건 합의, 서명, 테스트 결제, 제작, 검토, 최종 수령, 모의 정산을 진행하는 반응형 웹을 만든다.

- **기능 기준:** `../케미 기능명세서.xlsx`. 사용자가 엑셀 기준의 계약·테스트 결제·납품·모의 정산 포함 범위를 선택했다.
- **기술 기준:** `기술 스택.pdf`. 사용자가 이 문서 기준으로 수정을 요청했으며, 아래 도구 선택은 이번 계획의 구현 기준으로 적용한다. 설치·호환성 검증 완료를 뜻하지 않는다.
- **API 참고:** `api문서.txt`. 기능별로 명세 일치·수정 필요·API 정의 없음으로 구분한다. 완전한 API 계약이나 서버 구현 증거로 취급하지 않는다.
- **시각 기준:** `../KEMI-Design-System/KEMI-Design-System/README.md`, `GUIDE.md`, `tokens/tokens.json`, `source/typography.json`, `src/components/`, `brand/`.
- 자료별 역할: 이번 사용자 결정과 엑셀은 기능·정책 기준, 기술 스택 PDF는 구현 도구 기준, 디자인 시스템은 시각 기준이다. API 문서는 연결 참고이며 엑셀과 충돌하면 조율한다. 기술 도구의 기본 스타일이 KEMI 시각 규칙을 대체하지 않는다.
- 엑셀의 근거 문서인 PRD v1.4와 ERD v0.5 원본은 현재 폴더에 없다. 엑셀의 DB 연결은 참고 매핑이며 API 계약 또는 실제 DB 검증 증거가 아니다.
- 다른 폴더의 과거 KEMI 구현·브랜드 색상·정책을 현재 프로젝트의 확정 사항으로 가져오지 않는다.

현재 파일 확인 결과: 엑셀은 6개 시트, 기능 69개(확정 정책 기반 50개·제안 포함 19개)다. 검토 상태는 전부 미검토, 개발 상태는 전부 미착수이며 화면 ID·API ID·담당은 비어 있다. P01~P25와 D01~D23을 구분한다. '확정 정책 기반' 행에도 미결정 세부가 포함될 수 있다. 디자인 시스템은 React/Vite 가이드 앱과 UI 소스이며 완성된 서비스 앱이 아니다. 이번에는 설치·빌드·브라우저 동작을 검증하지 않았다.

**이번 계획의 완료 기준:** 69개 기능이 단계·화면·검증 항목에 대응하고, 두 의뢰 경로와 예외 흐름, 자료 충돌, 미결정 사항, 실제 API 검증 경계를 기록한다. 앱 개발 완료와 구분한다.

## 2. 핵심 설계

- 작업 분류는 Structural: 신규 앱의 화면 관계와 상태 경계를 설계하는 작업이다.
- 홈은 작품 피드 중심(P23)으로 설계한다. 공개 모집도 항상 접근 가능하게 둔다.
- 구현은 공통 구조 → 공개 모집 전체 흐름 검증 → 직접 의뢰 연결(P21) 순서다. 직접 의뢰는 MVP에서 제외하지 않는다.
- 공개 모집과 직접 의뢰는 공통 요청 상세·조건서·계약·채팅·작업 영역을 사용한다. 요청 출처만 구분하고 캠페인이 없는 직접 의뢰를 허용한다.
- 캠페인, 요청, 조건 버전, 계약, 제작, 결제, 환불, 정산, 보류, 채팅 전송 가능 여부를 한 개의 `status`에 합치지 않는다.
- 브라우저는 서버 상태와 허용 행동을 표시한다. 선정, 결제 성공, 제작 시작, 만료, 정산의 최종 판정은 서버 책임이다.

### 기술 스택 문서 기준 구현 구성

기존 React/Vite 후보 비교와 별도 `kemi-web/` 제안을 대체한다. **TypeScript + React + Vite**, npm Workspaces의 **`apps/web`**을 프론트엔드 기준으로 사용한다. 기능 범위와 0~8단계 순서는 이번 개정에서 유지한다. Next.js 등 다른 프레임워크로의 전환은 이번 계획에 포함하지 않는다.

| 영역           | 적용 기술                   | 계획상 책임·적용 시점                                                                          |
| -------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| 언어·앱        | TypeScript, React, Vite     | 0단계 앱 구성·타입 검사·개발 서버·빌드                                                         |
| 경로           | React Router                | 0단계 공개/보호 경로, 기능별 화면 연결                                                         |
| 스타일·공통 UI | Tailwind CSS + shadcn/ui    | 0단계 KEMI 토큰을 연결한 공통 UI·반응형 기반                                                   |
| 서버 데이터    | TanStack Query              | 조회·로딩·오류·캐시·변경 후 재조회. 서버가 최종 상태 판정                                      |
| 전역 UI 상태   | Zustand                     | 화면 간 필요한 UI 상태만 관리. 서버 데이터·폼 전체·비밀 토큰 영속 저장소로 사용하지 않음       |
| 입력·검증      | React Hook Form + Zod       | 1단계 인증/프로필부터 폼 상태·필드 오류·입력 검증. 공유 계약과 정책 조율                       |
| API 통신       | Axios                       | 0단계 공통 클라이언트·오류 변환, 1단계 인증 갱신 연결                                          |
| 서버 협업      | Node.js 24 LTS + Express 5  | API팀의 실행·HTTP 서버 기준. web 개발 환경도 Node 24에서 도구 호환성 확인                      |
| DB 협업        | Prisma 7 + PostgreSQL       | API팀의 DB 처리. 프론트에서 Prisma·DB에 직접 접근하지 않음                                     |
| 인증 협업      | JWT + bcrypt                | 프론트는 로그인·쿠키/토큰 계약을 처리하고 해시·권한 판정은 서버가 담당                         |
| 계약 문서      | Swagger/OpenAPI             | 합의한 요청·응답·오류·권한을 타입/Mock/연동에 반영                                             |
| 파일           | Supabase Storage            | 업로드 준비·전송·완료 확인·접근 권한 API 계약을 받아 연결. 관리자 비밀키를 web에 포함하지 않음 |
| 외부 계정      | Google OAuth·카카오 로그인  | 1단계 화면/콜백, 실제 동의·취소·실패 검증을 별도 기록                                          |
| AI             | OpenAI API                  | 기존 2단계 선택 분석·명시 예산 반영. 서버 경유 호출, 키는 web에 포함하지 않음                  |
| 결제           | Toss Payments Sandbox       | 3단계 테스트 결제, 5단계 환불. 승인·금액 판정은 서버                                           |
| 테스트         | Vitest·Supertest·Playwright | web 규칙/폼/상태는 Vitest, API HTTP 검증은 Supertest, 사용자 흐름은 Playwright                 |
| 협업           | GitHub·npm Workspaces       | 루트에서 web/api/shared 명령 통합. 실제 저장소 상태 확인 후 구성                               |
| 품질           | ESLint + Prettier           | 0단계 검사 설정, 각 작업에서 관련 코드 검사·형식 확인                                          |
| 자동 검사      | GitHub Actions              | PR에서 lint·format·typecheck·test·build, 두 거래 경로 E2E. 설정과 원격 실행 결과를 구분        |

**상태·통신 경계:** 폼은 React Hook Form, 화면 안의 일시 상태는 React 지역 상태, 검색·정렬·페이지는 URL, 필요한 전역 UI 상태는 Zustand, 서버 데이터는 TanStack Query로 관리한다. Axios는 HTTP 요청과 공통 오류를 담당한다. 갱신 동시 요청은 한 흐름으로 조정하고 무한 재요청을 막으며, 결제·서명 등 변경 요청을 임의로 자동 재전송하지 않는다. 구체적인 저장·갱신 방식은 D05와 API 계약을 따른다.

**공유 검증:** `packages/shared`에는 합의한 순수 타입·Zod 스키마만 두고 브라우저에 서버 코드·비밀 설정이 묶이지 않게 한다. 현재 `@kemi/shared` 원본은 제공되지 않았으므로 임의 복원한 스키마를 서버와 동일하다고 표시하지 않는다. 폼 전용 확인값은 UI 스키마로 구분하고 서버 검증을 대체하지 않는다.

MSW는 API 미정의/충돌 구간의 **추가 개발 보조 도구**로 유지한다. 기술 스택 PDF에 기재된 제품 기술과 구분하고 운영 빌드에서는 Mock을 활성화하지 않는다. 정확한 패키지 버전은 착수 시 Node 24·React·Vite·shadcn/ui 등의 호환성과 공식 설치 지침을 확인해 lockfile로 고정한다. 키트의 package.json을 그대로 서비스 앱에 복사하지 않는다.

적용 근거: `기술 스택.pdf` 1쪽. 토큰 연결 방식은 [shadcn/ui 테마](https://ui.shadcn.com/docs/theming), [Tailwind 테마 변수](https://tailwindcss.com/docs/theme), 폼 구성은 [React Hook Form 안내](https://react-hook-form.com/get-started)를 참고한다. 아래 구조는 이 기술 선택을 KEMI에 적용한 설계이며 원본 PDF의 파일 경로 지시가 아니다.

## 3. 디자인 시스템 적용

| 항목        | 적용 원칙                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 브랜드      | Leaf Green #539863, 일반 주요 버튼 #367345 + 흰색 글자, 기존 SVG 로고 유지                                                                               |
| 레이아웃    | 600px 미만 모바일, 600~1023px 태블릿, 1024px 이상 데스크톱. 최대 너비 1280px, 좌우 여백 16/24/32px                                                       |
| 글꼴·형태   | Pretendard 및 대체 글꼴, 11개 타이포 역할. 카드 24px, 모달 28px, 버튼·필터 999px 등 실제 토큰 사용                                                       |
| 효과        | 그라데이션은 홈·홍보 강조에 제한. 작업·조건서·금액·입력은 단색. 유리 효과는 영상 위 작은 컨트롤 등에 제한                                                |
| 원본 관리   | `tokens/tokens.json`이 수정 원본. `src/tokens`는 생성본. 원본 키트는 보존하고 앱에 복사한 버전·출처를 기록                                               |
| 테마        | 라이트 우선. 다크 모드는 확장안이며 기본 MVP 확정 범위로 넣지 않음                                                                                       |
| 스타일 연결 | KEMI 토큰을 `src/styles/kemi-theme.css`에서 Tailwind·shadcn/ui 의미 토큰에 연결. 기본 reset·변수·반응형 값 충돌 확인. 가이드 앱 전용 CSS는 가져오지 않음 |

**공통 UI 구현 기준:** Button, Input, Select, Textarea, Checkbox, Badge, Tabs, Dialog, Toast 등은 `src/components/ui/`의 shadcn/ui 기반으로 통일한다. KEMI 토큰·형태·상태와 접근성 이름을 적용한다. EmptyState, 도메인 카드, 영상·거래 조합은 서비스 컴포넌트로 만든다. 원본 키트의 같은 이름 UI를 별도로 병행하지 않는다.

기존 React UI는 시각·인터랙션 참고로 보존하고 필요한 도메인 로직만 검토해 옮긴다. 기존 CSS 전체 복사 방식을 대체한다. 키트 토큰 원본은 보존하고 앱용 복사본에서 shadcn/ui의 배경·본문·primary·border·ring 및 Tailwind 글꼴·간격·반응형 값을 연결한다. KEMI의 600/1024px 구간과 역할별 라운드는 도구 기본값에 맡기지 않는다. 토큰 값의 불필요한 이중 관리와 일반 CSS 클래스 충돌을 검사한다.

**서비스에 맞게 바꿀 부분:**

1. `VideoAssetCard`의 기본값은 즉시 구매·가격·라이선스·비교 선택을 포함한다. 작품 피드에는 별도 `PortfolioCard`를 만들어 역할·샘플 구분·제작자 이동을 표현한다. 작품 저장·비교·장바구니는 명세에 없으므로 추가하지 않는다. BOOK-01은 크리에이터의 캠페인 저장이다.
2. `DeliveryReview`의 '승인하고 정산하기'를 복사하지 않는다. `ReviewActions`, `RevisionRequestForm`, `FinalReceiptPanel`로 나누어 승인·최종 전달·수령을 구분한다. 남은 일반 수정 횟수가 0이어도 계약 오류 신고까지 막지 않는다.
3. `VideoPreviewPlayer`는 시각적 워터마크 오버레이와 재생 예시다. 명세의 검토본은 제작자가 영상 자체에 워터마크를 준비한다. 검토본 다운로드 버튼은 제공하지 않으며 복제 완전 차단을 보장하지 않는다. 수정 위치 입력을 위한 키보드 탐색 가능한 시킹·현재 시간 선택은 별도 구현한다.
4. LicenseSelector, PaymentSummary, DealTimeline은 표현만 참고한다. 옵션 구매·즉시 구매·자동 정산 의미를 가져오지 않는다. 권리·금액·수수료는 계약과 서버 응답에 연결한다.
5. 디자인 가이드의 '문의→상담→종료'는 이번 기능 기준을 대체하지 않는다. 앱 문구는 '의뢰인/크리에이터'와 엑셀 용어를 따른다.

## 4. 화면과 경로 초안

다음 경로와 화면 ID는 **계획 제안**이며 원본 엑셀에 있는 값이 아니다. 기능별 대응은 `frontend-feature-matrix.md`를 본다.

| 화면 ID | 경로 제안                                                           | 주요 내용·접근                                             |
| ------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| S01     | `/`                                                                 | 공개 작품 피드, 스타일·유형 필터, 캠페인 진입. 비회원 허용 |
| S02     | `/works/:workId`                                                    | 작품 재생·담당 역할·샘플/고객 작업 구분·제작자 이동        |
| S03     | `/creators/:creatorId`                                              | 공개 프로필·대표 및 추가 패키지·직접 의뢰                  |
| S04     | `/login`, `/signup`, `/auth/social/callback`, `/onboarding`         | 이메일·Google·카카오, 역할·이름, 로그인 후 안전한 복귀     |
| S05     | `/me/profile`, `/studio/portfolio`, `/studio/packages`              | 본인 프로필·작품·패키지·서비스 공개 관리                   |
| S06     | `/campaigns`, `/campaigns/:campaignId`                              | 공개 모집 탐색·상세·크리에이터 캠페인 저장                 |
| S07     | `/campaigns/new`, `/campaigns/:campaignId/edit`                     | 임시 저장·조건 입력·선택 AI 분석·예산·공개                 |
| S08     | `/campaigns/:campaignId/proposals`, `/campaigns/:campaignId/apply`  | 본인 공고 후보 조회·비교, 제작자 제안 제출·철회            |
| S09     | `/requests`, `/requests/:requestId`, `/creators/:creatorId/request` | 공개 제안/직접 의뢰 현황, 발송·수신·48시간 응답            |
| S10     | `/workspace/:requestId`                                             | 같은 의뢰의 채팅과 조건서/계약/작업. 당사자만 접근         |
| S11     | `/contracts/:contractId/payment`, `/payments/result`                | 테스트 결제·서버 결과 확인·재조회                          |
| S12     | `/contracts/:contractId/cancellation`, `/disputes/:disputeId`       | 취소 합의·파일/권리·환불·보류·증빙                         |
| S13     | `/me/activity`, `/bookmarks`, `/recommendations`                    | 역할별 진행 목록, 제작자 저장·규칙 기반 추천 캠페인        |
| S14     | `/notifications`, `/contracts/:contractId/review`                   | 본인 알림, 정상 완료 후 상호 리뷰                          |
| S15     | `/reports/new`, `/ops/reports`, `/ops/disputes`                     | 신고 접수·운영 검토·보류 근거. 운영 권한 D18 확정 필요     |

S10은 계약 전 조건서·서명, 계약 후 결제·준비·영상 버전·수정·최종 수령·정산으로 바뀐다. PC 병행 패널, 모바일 작업/대화 탭은 D20에 따른 제안이다. 영상·수정 요청 바로가기는 URL로 정확한 버전을 가리키고 새로고침 후에도 복원한다.

### 공통 상태와 권한

- 모든 데이터 화면: 로딩, 결과, 최초 빈 상태, 필터 결과 없음, 오류, 재시도, 권한 없음, 대상 삭제/비공개를 구분한다.
- 폼: 필드 오류·서버 오류·처리 중·중복 클릭 방지·실패 시 입력 유지. 임시 저장은 서버 저장 확인 후 표시한다.
- 인증 확인 중에는 보호 데이터를 먼저 표시하지 않는다. 로그아웃·만료 시 개인 캐시 제거. 복귀 URL은 허용된 내부 경로만 사용한다.
- 개인 의뢰인의 브랜드명·로고·자사몰 미입력을 모집 공개·직접 의뢰 제한 사유로 쓰지 않는다.
- 캠페인 마감, 직접 의뢰 최초 응답 48시간, 조건서 서명 48시간을 각각 표시한다. 일반 채팅에는 48시간 강제 만료를 적용하지 않는다.
- 공개 모집 마감·조건서 만료와 채팅 종료를 구분한다. 미선정·철회 등 협의 종료 방은 읽기 전용, 진행 중 분쟁의 대화·증빙 경로는 유지한다.
- 경로 가드와 버튼 숨김은 UX 처리다. 서버의 역할·소유자·거래 당사자·파일 권한 검증을 대체하지 않는다.

## 5. Workspaces 기반 파일 구조

신규 저장소 구조의 기준은 `C:/Users/Cho/Desktop/teamproject 3-5/`이며, web 앱은 **`apps/web/`**이다. 기존 저장소가 있다면 먼저 확인하고 이 구조와 맞춘다. 아래 API·shared 경로는 프론트와 연결할 협업 경계이며 이번 문서 개정에서 생성하거나 백엔드를 구현하지 않는다. 원본 디자인 키트는 보존한다.

```text
teamproject 3-5/
  package.json                    # npm Workspaces·루트 검사 명령
  package-lock.json               # 팀 공통 의존성 고정
  .github/workflows/ci.yml         # PR 품질 검사·빌드·테스트 계획
  apps/api/                       # Express 5·Prisma 7·DB·외부 서비스, 백엔드 담당
  packages/shared/                # 합의한 브라우저 안전 타입·Zod 스키마
  apps/web/
    public/brand/                 # 제공 로고·아이콘 복사본
    src/app/router.tsx            # React Router·역할별 접근·오류 경계
    src/app/providers.tsx         # QueryClient·폼/UI 제공자
    src/app/layouts/              # 공개/회원/작업/운영 레이아웃
    src/components/ui/            # shadcn/ui 기반 공통 컴포넌트
    src/components/kemi/          # EmptyState·브랜드·서비스 공통 조합
    src/styles/index.css          # Tailwind 진입·로딩 순서
    src/styles/kemi-theme.css     # KEMI와 Tailwind/shadcn 의미 토큰 연결
    src/design-tokens/            # 출처를 기록한 KEMI 토큰 앱용 복사본
    src/features/auth/            # 이메일·소셜·만료·관련 Zod 폼
    src/features/profiles/        # 역할별 프로필·공개 조건
    src/features/portfolio/       # 작품 등록·피드·PortfolioCard
    src/features/packages/        # 패키지·대표 지정
    src/features/campaigns/       # 모집·제안·AI 예산 폼
    src/features/requests/        # 두 경로 요청·응답·목록
    src/features/workspace/       # 채팅과 작업 화면 조합
    src/features/terms/           # 조건 버전·서명
    src/features/payments/        # 테스트 결제·결과 조회
    src/features/production/      # 준비·납기·영상·수정·수령
    src/features/resolution/      # 취소·분쟁·환불·정산
    src/features/activity/        # 저장·추천·알림·리뷰
    src/features/operations/      # 신고·운영 검토
    src/shared/api/client.ts      # Axios·공통 오류·갱신 조정
    src/shared/contracts/         # API 타입 연결, shared 원본 미제공 상태 구분
    src/shared/stores/ui-store.ts # 필요한 전역 UI만, Zustand
    src/shared/files/FileUpload.tsx # Storage 연동·진행·재시도
    src/shared/analytics/events.ts # 테스트 구분·민감정보 제외
    src/mocks/{handlers,fixtures}/ # MSW·성공/실패/경계 샘플
    tests/e2e/                    # Playwright·두 경로·금지 행동
    vitest.config.ts              # Vitest 테스트 환경
    components.json               # shadcn/ui 소스·스타일 경로 설정
```

작은 화면 요소·React Hook Form 폼·Zod 스키마·Query 조회/변경 코드는 관련 feature에 둔다. shared 계약과 다른 UI 전용 검증은 구분한다. API 문서만으로 서버 DTO 전체를 추정하지 않는다.

## 6. 단계별 구현·검증 계획

아래 파일명과 명령은 **향후 생성할 계획**이다. 기능 파일 경로는 `apps/web/src/` 기준이며, Playwright 경로는 `apps/web/` 기준이다. 각 단계는 독립적으로 확인한 뒤 다음 단계로 넘어간다. 매번 전체 테스트를 반복하기보다 변경 흐름을 검증하고 경로 통합 시 E2E를 실행한다. 커밋·배포는 이 계획 작성에 포함하지 않는다.

### 0단계 — 화면·계약 초안과 공통 실행 기반

1. 화면 S01~S15, 역할, 기능별 권한을 검토하고 69개 대응표에 확정/제안 상태를 기록한다.
2. 기술 스택 기준 Node 24·npm Workspaces·React/Vite를 적용하고 백엔드 연결 방식·우선 결정 D01/D04/D05/D08/D17을 확인한다. API 초안의 요청/응답/오류/시간/버전을 정의한다.
3. `apps/web`에 React Router·TanStack Query·Tailwind·shadcn/ui·Zustand·React Hook Form·Zod·Axios 기반을 구성한다. KEMI 토큰·브랜드 자산과 공통 UI 샘플에서 버튼·필드·모달·토스트·반응형을 확인한다.
4. Axios 클라이언트·Query 오류 처리와 MSW에 성공·지연·401·403·409·500 시나리오를 둔다. 이 오류 코드는 API 합의 시 조정한다. ESLint·Prettier·Vitest·Playwright 및 루트 검사 명령을 구성한다. GitHub Actions PR 검사 설정은 생성하되 원격 실행·브랜치 보호 적용은 별도 상태로 기록한다.

완료 기준: 계획상의 세 역할(비회원/의뢰인/크리에이터)과 운영 전용 접근을 구분하고 공통 페이지가 모바일·PC에서 열린다. 향후 루트에서 web의 lint·format:check·typecheck·Vitest·build가 성공하고, KEMI 토큰 연결과 공통 UI를 확인한다. 기존 키트의 토큰 검사도 유지한다. API가 준비됐으면 health 연결을 확인하고, 미준비면 Mock 검증과 구분한다. Mock은 개발 환경에서만 켜지고 운영 빌드에 역할 전환 도구가 없다.

### 1단계 — 인증·크리에이터 서비스 준비

1. `features/auth/`에 React Hook Form·Zod 기반 이메일 폼과 Axios·Query 기반 로그인·확인 없는 로그아웃·만료를 연결한다. Google/카카오 콜백 상태와 신규 역할/이름 화면을 만든다.
2. `features/profiles/`, `packages/`에 두 역할 프로필, 대표 패키지, 공개/비공개를 연결한다.
3. `features/portfolio/PortfolioEditor.tsx`, `shared/files/FileUpload.tsx`에 역할·출처·공개 동의와 초안 저장, 업로드/제출 분리를 구현한다.

완료 기준: 개인 의뢰인이 브랜드 정보 없이 진행한다. 프로필 저장만으로 제작 서비스가 공개되지 않는다. 비공개 서비스의 신규 활동 제한과 기존 거래 접근을 구분한다. 소셜 취소·카카오 이메일 미제공·동일 이메일 자동 병합 금지를 확인한다. Mock 콜백 검증과 실제 제공자 인증 검증을 별도 기록한다.

### 2단계 — 공개 모집·제안·협의 진입

1. `features/campaigns/CampaignEditor.tsx`에 초안→조건 입력→선택 AI 리포트→명시 예산 반영→공개를 구현한다. AI 실패에도 수동 등록 가능하게 한다.
2. `CampaignListPage.tsx`, `CampaignDetailPage.tsx`에 검색·정렬·페이지·3/7/14일 및 한국 시간 마감을 연결한다.
3. `ProposalEditor.tsx`, `ProposalListPage.tsx`와 `requests/RequestDetailPage.tsx`에 제출·비교·협의·거절·철회·무선정 종료를 만든다.
4. `workspace/WorkspacePage.tsx`, `ChatPanel.tsx`에 요청별 당사자 방과 전송 중/실패/재시도를 연결한다. 알림과 메시지 읽음 카운트를 분리한다.

완료 기준: 마감 후 신규 제안이 거절되지만 기존 협의는 유지된다. 협의 요청만으로 선정하지 않고 후보별 대화·견적이 섞이지 않는다. URL 필터는 새로고침·뒤로 가기 후 유지된다. AI 분석만으로 예산이 바뀌지 않는다.

### 3단계 — 조건 버전·양측 서명·테스트 결제

1. `features/terms/TermsEditor.tsx`, `TermsVersionView.tsx`, `SignaturePanel.tsx`에서 작성·고정 버전·한쪽 서명·양측 서명·48시간 만료·새 버전 재확인을 구분한다.
2. `features/payments/PaymentPage.tsx`, `PaymentResultPage.tsx`에서 서버 계약 금액, Toss Sandbox 진입, 처리 중/성공/실패/결과 확인 중을 표시한다.
3. 두 번째 서명 때 서버가 반환한 선정 결과를 반영하고 다른 후보의 미선정·읽기 전용 상태를 갱신한다.

완료 기준: 한쪽 서명으로 선정·결제 가능 상태가 되지 않는다. 변경된 버전에 과거 서명을 재사용하지 않는다. 후보 동시 확정 실패는 최신 상태를 조회해 안내한다. 결제 복귀 쿼리만으로 성공 처리하지 않으며 결과 불명확 상태에서는 새 주문보다 기존 결제 조회를 우선한다. 실제 동시성·PG 승인은 API 연동 검증 항목이다.

### 4단계 — 준비·제작·검토·최종 수령·모의 정산

1. `production/ReadinessPanel.tsx`, `DeadlineChangePanel.tsx`에 발송/정상 수령/파일 준비·문제 보류·양측 납기 변경을 만든다.
2. `DeliveryVersions.tsx`, `ReviewPlayer.tsx`, `RevisionRequestForm.tsx`에서 초안/완성 검토본/수정본, 시간 위치·문제·희망 변경, 요청 연결·회차를 구현한다.
3. `ReviewActions.tsx`, `FinalReceiptPanel.tsx`, `resolution/SettlementSummary.tsx`에서 승인→최종 전달→전용 수령 확인→모의 정산 결과를 구분한다.
4. 확정된 사건의 시스템 안내를 정확한 영상·수정 요청 버전으로 연결한다. 전송 실패에 성공 안내를 생성하지 않는다.

완료 기준: 미서명·미결제·필수 준비 미완료 시 제작 시작 불가. 초안·오류 시정은 일반 수정 회차를 소모하지 않는다. 검토 승인·단순 다운로드·채팅 답변으로 정산하지 않는다. 보류 또는 결과 확인 중에는 완료 표시를 하지 않는다. 공개 모집 경로의 정상 완료 E2E가 여기서 처음 완성된다.

### 5단계 — 취소·환불·분쟁과 공개 모집 경로 검증

1. `resolution/CancellationForm.tsx`, `CancellationAgreement.tsx`에 완료 대가·환불·인도 파일·사용권과 동일 합의 버전 양측 확인을 구현한다.
2. `RefundStatusPanel.tsx`, `DisputePanel.tsx`, `operations/ReviewPage.tsx`에서 전액/부분 테스트 환불·결과 확인 중·정산 보류·근거 있는 해제를 표시한다.
3. `tests/e2e/public-recruitment.spec.ts`와 `cancellation.spec.ts`에서 정상·오류·권한·만료 시나리오를 검증한다.

완료 기준: 취소 요청만으로 환불·지급하지 않는다. 20만원 중 완료 대가 8만원 사례에서 환불 12만원·수수료 8천원·모의 정산 7.2만원을 표시한다. 세금·절사 규칙은 D12 결정 전 확정하지 않는다. 부분 환불 성공 외에 합의 파일 인도·보류 해제도 확인한다. 운영자가 대신 서명·승인하지 않으며 분쟁 중 대화·증빙 접근을 유지한다.

### 6단계 — 작품 피드·직접 의뢰 경로 연결

1. `portfolio/FeedPage.tsx`, `WorkDetailPage.tsx`, `PortfolioCard.tsx`에 공개 작업물·역할·샘플 구분·비공개 전환·재생 실패를 구현한다.
2. `profiles/CreatorDetailPage.tsx`와 `requests/DirectRequestForm.tsx`, `RequestInbox.tsx`에 공개 패키지→의뢰 발송→48시간 응답·만료를 연결한다.
3. 수락 뒤 2~5단계의 공통 협의·서명·결제·제작·수령·분쟁 UI를 재사용한다. `tests/e2e/direct-request.spec.ts`로 캠페인 없는 거래를 검증한다.

완료 기준: 피드→영상→제작자→그 제작자의 패키지→로그인 복귀→직접 의뢰가 이어진다. 48시간 만료 후 수락할 수 없다. 수락이 계약 확정은 아니다. 거래물 자동 공개, 허용 없는 고객 작업물 노출, 작품에 즉시 구매 가격 표시를 하지 않는다. 신규 샘플이 후기·거래 실적 없이 노출될 수 있다.

### 7단계 — 활동·알림·리뷰·추천·분석 통합

1. `activity/`에 역할별 진행 목록·캠페인 저장·추천 이유·인앱 알림 읽음·정상 완료 후 양측 1회 리뷰를 연결한다. 알림 기본 UI는 2단계부터 사용한다.
2. `shared/analytics/events.ts`에서 피드·재생·제작자 이동·의뢰·계약·완료의 이벤트 계약을 만든다. D22 결정 후 실제 저장소를 연결한다.
3. 신고·제재 화면에서 제한된 이용자도 기존 거래·납품·이의 경로에 접근하는지 확인한다.

완료 기준: 읽음 수와 메시지 미확인 수를 혼동하지 않는다. 테스트와 실제 분석 데이터를 구분하고 개인정보·브리프 전문을 보내지 않는다. 거래 확정 이벤트 중복을 방지하고 분석 실패가 거래를 막지 않는다. 추천 정보 부족을 적합 보장으로 표현하지 않는다.

### 8단계 — 실제 API 연결과 최종 QA

Mock 모드에서도 단계별 API 연동은 가능하면 함께 진행한다. 이 단계는 남은 Mock을 대체하고 서버·외부 서비스 증거를 마무리하는 통합 관문이다.

1. 합의된 API 명세로 타입·오류·페이지·시간·버전을 맞추고, 프론트엔드에서 추정한 필드를 제거한다.
2. 실제 개발 서버에서 두 계정으로 공개 모집과 직접 의뢰를 각각 완료한다. 타인 URL·파일 접근, 로그아웃 캐시·만료·중복 요청·동시 후보·구버전 서명을 검사한다.
3. 실제 Google/카카오 동의·취소·콜백·계정 상태와 Toss Sandbox 승인·결과 재조회·환불을 별도 검증한다. 외부 서비스가 없으면 해당 기능은 연동 미검증으로 남긴다.
4. 375/768/1440px, 599/600·1023/1024px 경계, 키보드·모달 포커스 복귀·200% 확대·긴 한국어·동작 줄이기를 확인한다.
5. 영상 재생·파일 실패·재시도·부분 실패와 서버 오류를 점검하고 `docs/qa-report.md`에 구현/Mock/실제 API/실제 제공자 결과를 구분한다.

계획상 web 패키지 이름은 `@kemi/web`으로 두고 저장소 **루트**에서 다음 명령을 제공한다. 실제 package.json과 명령은 아직 생성되지 않았다.

- `npm run lint -w @kemi/web` · ESLint
- `npm run format:check -w @kemi/web` · Prettier 검사
- `npm run typecheck -w @kemi/web` · TypeScript
- `npm run test -w @kemi/web -- --run` · Vitest 단발 실행
- `npm run build -w @kemi/web` · Vite 빌드
- `npm run test:e2e -w @kemi/web` · Playwright

GitHub Actions에서 위 품질 검사를 PR에 연결하고 E2E 실행 환경·테스트 계정을 구분한다. Supertest는 API팀의 HTTP 검증이며 web 테스트를 대신하지 않는다. 백엔드 작업이 아직 없다면 검사 미구성을 통과로 표시하지 않는다. 로컬 검사·CI 설정·실제 원격 실행 결과를 각각 기록하고, 기존 키트의 `check:tokens` 검증도 유지한다.

완료 기준: 69개 대응표의 모든 기능이 구현 및 검증 상태를 갖고, 필수 미결정 사항이 해결되거나 명시적으로 범위 합의되어 있다. 핵심 경로에 Mock이 남아 있으면 실서비스 연동 완료라고 하지 않는다. 로컬 빌드 성공과 배포·운영 검증은 별개다.

## 7. 미결정 사항의 처리 순서

| 관문           | 결정 ID          | 결정할 내용                                                                                           |
| -------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| 구조·입력      | D01~D06          | 제작자 공개 필수값, 작품 파일/외부 URL, 대표 패키지 관리, 공고 입력/변경, 세션/소셜 후속 정보, 재지원 |
| 협의·계약      | D07~D08, D19~D20 | 채팅 갱신·읽음, 서명 입력/편집 충돌/만료 경계, 종료·보관, PC/모바일 작업 배치                         |
| 제작·금액·분쟁 | D09~D13, D17~D18 | 납기 시각, 계약 후 변경, 혼합 수정, VAT/절사/환불, 운영 보류 권한, 파일 제한·ZIP검사·보존             |
| 활동·분석      | D14~D16, D21~D22 | 리뷰 공개·취소 거래 리뷰, 북마크/추천, AI 입출력, 피드 분류·페이지·노출, 분석 동의·저장               |
| 선택 확장      | D23              | 모의 원장 확장. 핵심 결제·환불·정산을 먼저 구현하며 기본 MVP 필수로 추가하지 않음                     |

미결정 정책은 가짜 확정 규칙으로 구현하지 않는다. 화면 탐색용 임시값은 fixture와 문서에 '제안'으로 표시하고 해당 기능의 실제 연동 전에 확정한다. 세션 저장 방식·파일 제한·서명 만료 등 서버와 맞물리는 항목은 UI 단독 결정으로 고정하지 않는다.

## 8. 개발 범위와 완료 증거

- 프론트엔드 책임: 화면, 접근 안내, URL 상태, 입력 UX, 업로드 진행, 서버 응답 반영, 허용 행동 표시, 결과 재조회, 접근성.
- API 협업 필수: 세션 검증·무효화, 소유자 권한, 서명 버전/동시 선정, PG 승인·환불·멱등성, 정산·보류, 비공개 파일 접근·검사, 서버 시간과 납기, 알림 저장·분석 중복 방지.
- MVP 제외: SNS 대행·개인계정 게시·광고 집행·별도 옵션 구매·자동 제재·구독, 웹푸시·메일·문자·카카오 알림, 실금전 송금. 카카오 **로그인**은 포함이다.
- 완료 단계: UI 시연 완료 → Mock 흐름 검증 → 실제 API 검증 → 외부 제공자 검증 → 배포 후 검증을 따로 기록한다.

일정은 팀 인원·백엔드 준비·미결정 확정 시점이 없어 날짜로 확약하지 않는다. 먼저 0~1단계를 구현해 실제 처리 속도와 API 준비 수준을 확인한 뒤 나머지를 산정한다. 최초 개발 묶음은 0~1단계의 공통 UI·인증·프로필·패키지이며, 다음 묶음은 공개 모집의 한 거래를 끝까지 진행하는 2~5단계다.

이번 작업은 계획과 대응표 작성까지만 완료했다. 패키지 설치·앱 생성·Git 작업·API 변경·배포는 수행하지 않았다.

## 9. API 문서 반영과 작업 단위

- `frontend-feature-matrix.md`에 69개 기능의 API 대조·근거 위치·보완 이유를 추가했다. 실제 서버 동작은 미검증이다.
- `/api/applications/{applicationId}/accept`의 조기 선정·다른 후보 종료는 P07과 충돌한다. 협의 요청 UI에 연결하지 않고 양측 서명 시 선정되도록 API 계약을 조율한다.
- 비밀번호, 초안/공개, 마감, 재지원, 일부 프로필 필드·추천 이유를 먼저 정합화한다. 생성된 OpenAPI JSON 또는 `@kemi/shared` 원본을 확보해 요청 필드·enum을 확인한다.
- 소셜 UI 경로 초안 `/auth/callback/:provider`는 API가 안내하는 `/auth/social/callback`과 맞춘다. 제공자 콜백 `/api/auth/{provider}/callback`과 프론트 복귀 경로는 서로 다른 용도다.
- 정확한 쿠키·Origin·토큰 갱신 규칙은 API 참고로 구체화하되 D05 승인과 실제 개발 환경 설정을 확인한다.

**0~8단계는 총 9단계이며 대화 9턴을 뜻하지 않는다.** 단계는 결과물 묶음이고, 한 턴의 작업은 검증 가능한 작은 묶음으로 정한다. 예를 들어 1단계를 이메일 인증, 소셜 인증, 프로필, 패키지로 나눌 수 있다. 전체 소요 턴수는 API 준비·정책 결정·검증 결과에 따라 달라진다.

이어가기 기준 파일은 `frontend-progress.md`다. 각 작업 종료 때 현재 범위, 바뀐 파일, 실행한 검증과 결과, 미완료/차단 요인, 다음 작업 하나만 갱신한다. 새 채팅에서도 이 파일과 관련 계획 절·해당 기능 행을 먼저 읽고, 원본 전체는 정책 확인이 필요할 때만 읽는다. 관련 없는 변경과 다음 단계 자동 착수는 피한다.

요청 예시: "docs/frontend-progress.md를 읽고 다음 작업 하나만 진행해줘. 필요한 계획 절과 기능 행만 확인하고, 검증 결과와 다음 작업을 진행 기록에 남겨줘. 설명은 짧게 해줘."

## 10. 기술 스택 개정 이력

2026-10-23 사용자 요청으로 `기술 스택.pdf`를 도구 선택 기준에 반영했다. 이전 계획의 React/Vite 후보 비교, 별도 kemi-web 경로, 키트 CSS/공통 UI 통째 복사, 폼 도구 미정 방식을 위 기준으로 대체했다. 기능·정책·단계 번호·69개 API 대조 결과는 유지한다. 앞서 비교한 단계별 개발 계획 PDF의 순서로 재편하는 작업은 이번 요청에 포함하지 않았다. 패키지 설치·앱 생성·백엔드 구현·CI 원격 실행·Git·배포는 수행하지 않았다.
