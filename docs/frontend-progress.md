# KEMI 프론트엔드 진행 기록

갱신: 2026-10-27 · 현재: 사용자 지정6-A~6-C의 클라이언트·명시적 Mock 구현과 직접 의뢰 단계 통합 검증을 완료했다. 실제 API/DB/외부 제공자와 미결정 정책이 남아 실제 서비스6단계 전체 완료가 아니다. 아래 단계별 초기 기록은 당시 이력이며 최종 결과/Git 상태는 이 절과 후속 전달 기록을 따른다.

## 6단계 최종 검증·종료 준비

- 실제 동선: 기존 작품 메뉴→공개 피드/영상→공개 제작자 소개/대표 및 모든 공개 패키지→안전한 로그인 복귀→개인 직접 의뢰 발송/사본→수신자 최초48시간 응답→같은 작업방/최종 조건·양측 서명→Mock 전액 결제→준비·제작·검토→최종ZIP 다운로드/전용 수령→모의 정산. 취소·분쟁 분기도 같은 계약에서 합의/환불/합의 파일/운영 근거 해제/잔여 정산으로 확인했다. 수락은 계약이 아니며 공고를 생성하지 않고, 별도 직접 의뢰가 서로 후보 종료를 일으키지 않는다.
- 로컬 웹 단위 **222/222**, 기본 및 두flag(`VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`) **build:web exit0**(타입·기존ESLint 포함). 토큰과 전달 파일 Prettier/diff PASS. API/shared·의존성/lockfile·원본 엑셀/PDF/디자인은 변경0. API 단위의 기존 timeout은 재실행/해결하지 않았다.
- 브라우저는 전체336개 중 관련 **150개 고유 케이스의 최신 결과150통과**이며 **단일 실행150/150이 아니다**. 최초150개 **149통과/1실패·22.1분**(기존 제작 권한검사의 로그아웃→가입 경합), 대기 조건/카드 유형·스타일/공개 소개 보완 후 영향30개 **29통과/1실패·4.9분**(기존 긴 모바일 제작 통합의30초 전체 제한), 동일30초 단독2개 **1통과/1실패**, 해당 긴 통합 한 건만 전체 예산60초로 조정한 최종 단독 **2/2·exit0**. `qa/frontend-6/final-e2e.json`에 네 실행의 원래 통계·실패·명령과 고유 케이스별 마지막 결과/소스 해시를 보존했다. 중복 재검증 수를 더해180/184개 통과로 표시하지 않는다.
- 시간 예산 변경 근거: trace에서 마지막 상태 assertion도 성공했지만 전체 테스트/정리30초 경계와 겹쳤고 단독 실행에서도 반복됐다. 기존 긴 통합 검사처럼 이4-A 전체 거래 한 건만60초를 사용한다. 전역/개별 action·expect 제한, assertion, 자동retry0·48시간 정책/서버 제한과 운영 인증/권한은 유지한다. 앞선 ‘timeout 유지’ 기록은 당시 실행 이력이며 이 예외를 숨기지 않는다.
- 신규7화면(피드/영상/제작자/발송폼/의뢰인 상세/수신 응답/공통 작업방)×320/390/600/768/1024/1280px×두 프로젝트에서 가로 넘침 없음.390/1280px 본문 캡처와 같은 실행의 정산 후 작업방/취소 정산 캡처를 보존했다. 공개 소개에 입력한 script는 텍스트로 표시되고 실행되지 않으며, 공개 응답에 개인 이메일이 노출되지 않음을 확인했다. 실제 스크린리더/브라우저 확대·다른 브라우저는 이번 검증에 포함하지 않는다.
- 운영 빌드: 기본 인증 미설정6경로 **6/6**, 두flag+독립HTTP GUEST/CLIENT/CREATOR/ADMIN×6경로 **24/24 exit0**, 합계30개 보호/준비 안내 검사. 공개3경로는 준비 안내, 직접 발송/목록/방은 기존 인증·역할 가드를 유지한다. Mock 코드/합성 미디어/worker·Mock 요청 제외, 페이지 예외0. **실제 운영 인증·서버/API 검증이 아니다.** 전용5196 서버를 종료했고4206 preview는 검사 스크립트가 종료한다. 다른 기존 프로세스는 건드리지 않았다.
- 변경 파일(6-C): `features/requests/RequestInbox.tsx`, `features/portfolio/{PortfolioCard,WorkDetailPage}.tsx`, `features/terms/TermsVersionView.tsx`; `mocks/{CatalogMock,CreatorMock,ProposalCard,ProposalMock}.tsx`, `catalog-{model,handlers}`, `direct-{api,clock,contract,handlers,model}`, `profile-handlers`, `proposal-{model,handlers}`, `signature-model`, `terms-{model,handlers}`; 직접 의뢰/공개 피드/시각 E2E·기존 제작 검사와 거래 helper/환불 분기, catalog/direct/terms 단위; CI base필터·관련3문서/진행 기록·`qa/frontend-6/`.6-A/B 변경과 커밋은 아래 당시 기록을 따른다.
- 검토: 명세와 코드 품질을 분리해 라우트/역할·선택 제작자/패키지·발송 시점 사본/최종 값·수락/계약 분리·48시간 정각·독립 후보·React/키보드·오류/중복/유실/세션 변경을 점검했다. 주입/인증/객체 접근·비밀/개인정보·의존성 변경도 별도 검토하고 경계 테스트를 실행했다. 실제 서버 보안/권한 감사를 대체하지 않는다. 새로운 소개는 공개 서비스의 소개 텍스트만 투영하며 공개 필수 정책 D01을 새로 만들지 않는다.
- 남은 일: 원격 백엔드 [Draft #62](https://github.com/Jubileekim/KEMI/pull/62)와 입력/전체 패키지 사본·공통 의뢰 계약 조율, 실제 API/DB/PG/송금/스토리지·외부영상·인앱/외부 알림·스케줄러·다중탭/영구복원, D01/D02/D08/D21 및 기존 취소/정산 정책. 실제 파일 검사/전자서명·세금/회계·accepted 이후 종료/동시 진행/재발송 정책도 확정하지 않는다. 기존 미추적 outputs/tools6개 때문에 전체 format:check는 exit1이며 이 파일들은 변경/포함하지 않는다.
- **다음 작업 하나:** 6단계 실제 API 계약과 D01/D02/D21 조율. 별도 요청 후 착수하며7단계 구현·PR 병합/자동병합·명시적 배포는 진행하지 않는다.
- 원격 CI(로컬과 별도):6-A [Web CI40432246524](https://github.com/Jubileekim/KEMI/actions/runs/40432246524)와6-B [Web CI40433054937](https://github.com/Jubileekim/KEMI/actions/runs/40433054937)는 **전체 success**를 확인했다.6-C 커밋·Draft PR/최신 원격CI는 아래 Git 전달 기록에 이어서 남긴다.

## 6-C 수신·응답·만료·공통 거래 연결 (2026-10-27 · 최종 검사 진행 기록)

- 직접 의뢰를 기존 본인 목록/상세·공통 작업방/조건서/서명/결제/제작/영상/수령/취소·환불·분쟁/정산으로 연결했다. `campaignId:null`, `sources.campaign:null`과 발송 당시 선택 패키지 사본을 사용하며 공고를 만들지 않는다. 독립 직접 의뢰들이 같은 모집 후보로 처리되지 않도록 선정 비교를 실제 campaignId가 있을 때만 적용한다.
- `RequestInbox.tsx`, 직접 응답/시계/만료 모델·처리기/API, 기존 제안 상태·목록/상세의 객체 권한 필터·카드, 조건서 참조/표시·서명 선택을 변경했다. 수신 제작자만48시간 내 수락/거절, 정각부터 만료·수락/방/계약 차단, 중복 응답 무해·같은 방 재사용·수락 후 일반 대화 기한 미적용. 기존 제안 명령으로 직접 의뢰를 우회할 수 없다. public feed의 제작자 출처 쿼리/합성 미디어 구분과 작품별 재생 오류 상태 초기화도 보완했다.
- 검사: 직접 의뢰 정상 전거래와 취소·분쟁 전거래를 기존 helper/처리기로 재사용한다. 새 수신/기한/추가 패키지·발송 후 비공개/타회원·운영/새로고침·유실/지연 로그아웃과 화면320~1280px 검사, 공개 모집·협의/조건·서명·결제·제작/납품·수정/수령·정산·취소/분쟁 회귀를 포함한다. 전체 웹336개 중 관련150개 단일 실행의 최종 결과는 아래에 별도 기록한다.
- 초기20개는16통과/4실패였다. 실패는 테스트 파서의 unread/lastMessage 누락2건과 새로고침 직후 ops 세션 복원 전 로그인 helper 호출2건이다. 파서/명시적 세션 복원 대기를 수정하고 수락 응답 유실/지연 로그아웃을 추가한 집중6/6을 확인했다. 제품 인증/권한/timeout/retry는 완화하지 않았다. 초기 빌드의 React 렌더 중 Date.now 사용도 effect의 만료 타이머로 수정해 기존 purity 규칙을 유지했다.
- 확대 검사 중 별도 시각 검사를 같은 Playwright outputDir로 병행하여 trace ENOENT가 발생했다. 이는 실행 구성 실수로 기록하고 해당 확대 실행을 중단했다. report/outputDir를 모두 분리할 수 있도록 QA 설정을 보완하고, 최종에는 시각 검사를 포함한150개를 **한 실행**으로 새 전용 폴더에서 재시작했다. 중단/초기/최종 결과는 합산하지 않는다. shared 재빌드와 최종 브라우저 검사는 겹치지 않는다.
- 현재 로컬 단위222/222, build:web(타입/기존ESLint/운영빌드) exit0, 기본 운영 안내/보호6개·Mock 코드/worker/요청 제외 검사 exit0. 토큰·전달 파일 형식/diff PASS. 전체 format:check는 작업 전부터 미추적 outputs/tools6개만 실패하며 이 파일들은 변경/포함하지 않는다. 실제 API/shared·의존성/lockfile·원본 엑셀/PDF/디자인은 변경0이다. API 단위의 기존 timeout은 이번에 수정/재실행하지 않았다.
- 6-B [8fecb83](https://github.com/Jubileekim/KEMI/commit/8fecb83) 푸시/[Draft #72](https://github.com/Jubileekim/KEMI/pull/72) 생성·채팅 연결 완료.6-C base는 이 브랜치다. 실제 API/DB/외부 제공자·알림/영구/다중탭 복원, D01/D02/D08/D21과 취소/정산의 기존 정책 경계는 남으며 실제 서비스6단계 전체 완료로 표시하지 않는다. 최종 Git/원격CI·다음 작업은 아래 종료 기록에서 확정한다.

## 6-B 제작자·패키지·직접 의뢰 발송 (2026-10-27)

- 공개 제작자 `/creators/:creatorId`와 의뢰인 전용 `/creators/:creatorId/request?packageId=...`를 실제 라우트에 연결했다. 공개 대표 우선·모든 공개 패키지·전체 조건·협의 시작 가격/계약 별도 안내·작품 역방향 동선, 비회원 선택→기존 안전한 로그인 복귀→검토/직접 발송→기존 본인 의뢰 상세를 연결했다. 개인 의뢰인의 브랜드 입력은 요구하지 않는다.
- 변경: `features/profiles/CreatorDetailPage.tsx`, `features/requests/DirectRequestForm.tsx`, `mocks/{CreatorMock,DirectMock,direct-api,direct-contract,direct-model,direct-handlers}`, `ProposalCard`, 기존 제안의 선택적 direct 사본/nullable campaignId·같은 저장소 삽입·공통 명령 우회 차단, App/browser·CI base 추가, 직접 발송 단위/E2E·기존 서명 fixture의 nullable 타입 검증. API/shared·운영 인증/권한·의존성/lockfile은 변경하지 않았다.
- 발송 처리기에서 활성 의뢰인/Bearer/epoch·선택 제작자의 공개 패키지와 화면 검토 사본의 동일성을 재검사한다. 사본을 정규화해 키 순서에 따른 오탐을 수정했다. 동일ID/내용 재시도는 같은 의뢰를 반환하고 충돌은 거부한다. 유실 시 입력 보존·목록 확인/같은ID 재시도, 알려진 충돌은 최신 공개 상태 확인 후 재검토한다. 발송/수락으로 자동 결제·계약 생성하지 않는다.
- 로컬 웹 단위 **218/218**, build:web(타입·기존 ESLint·운영 빌드) exit0. 새5196 프로세스의 Edge 데스크톱2+모바일2 **4/4·실패0·건너뜀0·retry0·exit0·32.8초**. 비회원 전체 클릭/안전한 packageId 복귀·브랜드 없는 발송·캠페인 없는 상세/사본/미계약, 유실 같은ID 복구1건·타 패키지/크리에이터 발송 가드·위조Bearer·지연 로그아웃401을 확인했다. 최초 검사 중 공유 모듈 재빌드/HMR이 겹친 실행은 세션 불일치/timeout으로2/4였고 최종 결과와 합산하지 않는다. 시간/권한 제한은 완화하지 않았다.
- 검토: 명세, 값 주입/React 이스케이프·선택 소유/공개·개인정보 미노출·세션 변경·중복·오류 후 modal 종료/수동 복구·경로 변경 시 폼 초기화를 점검하고 경계 테스트를 실행했다. 실제 서버 보안 검증은 아니다. 남은 일은6-C 수신자 응답/48시간 만료·공통 거래 통합 검증이며6단계 전체 완료로 표시하지 않는다. 실제 API/DB/스토리지/알림·영구/다중탭 복원, D01/D02/D08/D21과 원격 #62 계약 조율은 남는다.
- 다음 작업 하나는 사용자 지정6-C. 6-A [aa2558f](https://github.com/Jubileekim/KEMI/commit/aa2558f) 푸시/[Draft #71](https://github.com/Jubileekim/KEMI/pull/71) 생성·채팅 연결. 원격 [Web CI40432246524](https://github.com/Jubileekim/KEMI/actions/runs/40432246524)는 조회 시 in_progress이며 로컬24/24와 구분한다.6-B 전달 링크는 후속 기록에 추가한다. 요청 범위 밖 자동 착수·병합·자동병합·명시적 배포 없음.

## 6-A 공개 작품 피드·영상 상세 (2026-10-27)

- 사용자 지정6-A~6-C 중6-A 명시적 DEV/MSW 구현. `/`와 `/works/:workId`를 실제 화면으로 연결하고 기존 작품 메뉴·공개 모집/로그인/제작 관리 동선을 유지했다. 가격 없는 썸네일 카드·샘플/고객물·담당역할·출처·스타일/유형 필터·URL 페이지/뒤로가기·빈/오류/재시도·네이티브 합성 영상 재생/실패를 구현했다. 후기 없는 신규 샘플을 허용하며 공개 권한/고객 동의/공개 서비스와 작업물 상태를 처리기에서 재검사한다.
- 변경: `features/portfolio/{FeedPage,WorkDetailPage,PortfolioCard}.tsx`, `mocks/{CatalogMock,catalog-model,catalog-handlers,catalog-api}`, DEV 전용 합성 영상/첫 프레임, `App.tsx`, studio 공개 상태 조회 연결, `browser.ts`, 웹 단위/피드 E2E·기존 홈/메뉴 검사, `docs/frontend-direct-6.md`, `qa/frontend-6/`. 기존 CI에5-C base를 추가했으며 검사 명령/보호 정책/API/shared·의존성은 변경하지 않았다.
- 로컬: 웹 단위216/216·build:web(타입/기존 ESLint/운영 빌드) exit0, 썸네일 후 변경 파일 ESLint·최종 관련 Edge 데스크톱12+모바일12 **24/24·실패0·건너뜀0·retry0·exit0·2.0분**, 토큰/전달 파일 형식/diff PASS. `qa/frontend-6/6a-e2e.json`에 개별 결과/소스해시. 합성 영상 첫 장면·피드390/1280px 시각 확인과 가로 넘침 없음. 최초 메뉴검사2건은 지연 화면 전환 전의 이전 작품카드를 모집카드로 선택해 실패했고 목적지 URL/제목 확인을 추가한 최종 전체24개로 재검증했다. 최초 캡처의 반응형 렌더 대기/URL 공백경로 문제도 수정 후 재실행했다.
- 검토: FEED-01/02 명세와 공개 상태·고객 동의·비공개 즉시 제외·텍스트 출력·외부URL 미실행·취소신호·캐시/재조회·지연/오류 표시를 검토했다. 자체 검토와 실제 테스트를 구분하며 운영 보안 증명으로 확대하지 않는다. 운영 산출물에서 DEV 영상/Mock 처리가 제외되는 구조를 유지했고 단계 종료 때 두flag·보호/미연결 검사를 추가한다.
- 남은 일:6-B 제작자/패키지·직접 발송,6-C 최초 응답48시간/공통 거래 통합 검증. 현재 제작자 상세는 기존 안내 화면이며6-A만으로6단계 전체 완료가 아니다. D02/D21 분류/페이지/노출 정책 및 실제 공개 작품 API/스토리지/외부영상은 미결정·미연동이다. 다음 작업 하나는 사용자 지정6-B다. Git/원격CI 링크는 아래 전달 기록에 추가한다.

5단계 종료 당시 요약: 앞선0-A~4-E의 클라이언트·명시적 Mock 구현 이력을 유지한다. 5-A 취소 요청·동일 버전 양측 합의, 5-B 전액/부분 테스트 환불·합의 파일 인도/수령·분쟁·운영 검토/근거 해제를 구현했고, 5-C 공개 모집 정상/취소·분쟁 통합과 연관 회귀76/76(데스크톱38+모바일38)을 확인했다. 웹 단위214/214, 기본/두flag 운영 빌드와 보호/Mock 제외 검사 통과. 실제 API/DB/PG/송금/스토리지·D12/D13/D17/D18과 미결제/완료 후 취소·작업 재개 조율은 남아 실제 서비스의5단계 전체 완료가 아니다. Git/최신 원격 CI는 하단 전달 기록을 따른다.

## 기준과 결정

- 기능: `../케미 기능명세서.xlsx`. 두 의뢰 경로·계약·테스트 결제·납품·모의 정산 포함.
- 디자인: `../KEMI-Design-System/KEMI-Design-System/`. Leaf Green, 일반 주요 행동 #367345. 문의·상담 예시로 엑셀 범위를 축소하지 않음.
- API: `api문서.txt`는 참고. `frontend-feature-matrix.md`의 API 대조를 확인. 명세와 충돌하면 엑셀 유지, API 조율.
- 기술: `기술 스택.pdf` 기준 TypeScript·React/Vite·React Router·Tailwind/shadcn/ui·TanStack Query·Zustand·React Hook Form/Zod·Axios. npm Workspaces의 `../apps/web/`에 React/TypeScript/Vite·Tailwind/shadcn UI·Router·Query·Axios 적용 완료. Zustand·폼 도구는 해당 사용처의 후속 범위.
- 계획: `frontend-plan.md` 0~8단계 및 기존 기능 순서 유지. KEMI 토큰으로 shadcn/ui를 맞추고 기존 공통 UI를 중복 운영하지 않음.
- 테스트/협업: Vitest·Playwright·ESLint·Prettier·GitHub Actions 계획. Supertest·Express/Prisma/DB는 API팀 협업 경계.

## 0-A 완료 기록 (이전 범위)

- **0-A만 완료:** Node 24.19.0 / npm 11.17.0 확인, 루트 npm Workspaces와 `@kemi/web` React·TypeScript·Vite 실행 기반, ESLint·Prettier 및 루트 검사 명령 구성.
- React 19.3.1 / Vite 8.3.5 / TypeScript 6.0.3 사용. 공식 안내와 npm engines/peerDependencies 확인 후 정확한 버전을 manifest·루트 lockfile에 고정. TypeScript 7.0.2는 typescript-eslint 8.72.0의 지원 범위(`>=4.8.4 <6.1.0`) 밖이므로 사용하지 않음.
- KEMI 로고·토큰을 출처 기록과 함께 복사. 기존 CSS 변수를 사용하는 실행 확인용 안내 화면만 구현. 600/1024px 구간·카드 24px·제공 글꼴 스택 유지. Tailwind/shadcn 의미 토큰 매핑과 공통 UI는 아직 구현하지 않음.
- 기능표의 69개 기능은 모두 미착수 유지. 0-A에 대응하는 제품 기능/API 행은 없음. API 호출·서버 계약·미결정 정책을 추가하거나 변경하지 않음.

### 변경 파일과 실행 방법

- 루트: `package.json`, `package-lock.json`, `.nvmrc`, `.gitignore`, `README.md`.
- 앱 설정: `apps/web/package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`.
- 앱 소스: `apps/web/src/main.tsx`, `src/app/App.tsx`, `src/styles/index.css`.
- 제공 자산 복사: `apps/web/src/design-tokens/{tokens.json,tokens.css,README.md}`, `apps/web/public/brand/{logo-primary.svg,symbol-primary.svg}`.
- 진행 기록: 이 파일. 원본 엑셀·계획·기능표·디자인 키트는 수정하지 않음. `apps/api`, `packages/shared`는 원본/계약 미제공 경계를 유지하며 생성하지 않음.
- **루트에서** `npm ci` → `npm run dev` (http://127.0.0.1:5173). 빌드 `npm run build`, 빌드 미리보기 `npm run preview` (4173). 상세는 루트 README.

### 검증 결과

- `npm install` 완료, 최종 설치 출력 audit 164개 패키지·취약점 0개. `npm ls --workspace @kemi/web --depth=0` 정상. `npm ci` 재설치는 별도 실행하지 않음.
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`: 모두 종료 코드 0. 빌드 산출물 `apps/web/dist` 생성.
- `npm run check:tokens`: PASS (11개 타이포 역할, 16개 대비 조합, 6개 재생성 결과 등 키트 기존 검사). 별도 바이트 비교로 앱에 복사한 토큰/CSS/SVG 총 4개 원본 일치 확인.
- `npm run dev`: Vite 준비 완료. `/`, `/src/main.tsx`, 로고·심볼 SVG 요청 HTTP 200. 실제 브라우저에서 KEMI 로고·제목·안내 문구 렌더링 확인. 모바일별 시각 QA·HMR 편집 동작·빌드 preview 서버는 별도 미검증.
- **실제 API 연동:** 없음/미검증. **Mock 검증:** 없음(이번 범위에 Mock 구현 없음). 브라우저 로컬 앱 확인은 백엔드 연동 증거가 아님.
- Vitest·Playwright·GitHub Actions는 아직 구성/실행하지 않음. 0단계 전체 완료로 표시하지 않음. Git 커밋·푸시·배포 미실행.

### 남은 일과 결정 경계

- 0-B 공통 UI·의미 토큰, 0-C Router·Query·Axios·MSW, 이후 테스트/CI 기반이 남음. 이번 작업에서 자동 착수하지 않음.
- Pretendard 웹폰트 파일은 제공 키트에 없어 시스템 대체 글꼴로 표시. 웹폰트 공급 방식은 후속 확인.
- 기존 API 충돌(조기 선정·비밀번호·모집 상태 등)과 D01~D23은 유지. 관련 기능 착수 시 원본 기능표에 따라 Mock 분리/계약 조율. 이번 범위를 막는 정책 결정은 없음.

## 0-B 완료 기록 (이전 범위)

- **0-B만 완료:** Tailwind CSS 4.3.3 + Vite 플러그인, 공식 shadcn/ui new-york-v4 기반 Button·Input·Textarea·Select·Checkbox·Badge·Tabs·Dialog·Label·Sonner 적용. 패키지 버전은 manifest·lockfile에 고정. 공식 지침과 Vite 8/React 19 peerDependencies 확인. Next.js 전용 next-themes는 설치하지 않음.
- `kemi-theme.css`에서 KEMI 원본 → shadcn 의미 색상·Tailwind 글꼴/간격·sm=600px/lg=1024px 연결. 주요 행동 #367345/흰색, hover #2C623A, pressed #245331. 11개 타이포 역할과 모바일 축소·16/24/32px 여백·1280px 최대 너비·카드 24px·모달 28px·버튼 999px 유지. 라이트 우선, 동작 줄이기 대응.
- 원본 로고·심볼·아이콘·파비콘·매니페스트 연결. 토큰과 브랜드 자산 19개 원본 바이트 일치 확인. 0-A의 두 로고 경로는 호환용으로 유지. 키트 원본은 수정하지 않음.
- 앱 `/`는 공통 UI 확인 화면. 라벨·오류 연결·비활성/읽기 전용·처리 중·성공/오류/빈 결과/재시도 표현, 키보드 선택·탭·모달·토스트 확인. 이름 필수 검사는 화면 오류 연결 시연이며 제품 정책이 아님. 69개 제품 기능은 미착수 유지.

### 변경 파일

- 의존성: `apps/web/package.json`, 루트 `package-lock.json`.
- 설정: `apps/web/{vite.config.ts,tsconfig.app.json,components.json,index.html}`.
- 화면·스타일: `apps/web/src/app/{App,UiShowcase}.tsx`, `src/styles/{index,kemi-theme}.css`, `src/lib/utils.ts`.
- 공통 UI: `apps/web/src/components/ui/{button,input,textarea,select,checkbox,badge,tabs,dialog,label,sonner}.tsx`, `README.md`, `LICENSE.md`.
- 서비스 공통: `apps/web/src/components/kemi/{brand,empty-state}.tsx`.
- 자산·출처: `apps/web/public/brand/{svg,icons}/`, `src/design-tokens/README.md`.
- 검증 증거: 루트 `tmp/0-b/verify-ui.cjs`, `qa-results.json`, `ui-{390,768,1280}.png`, `dialog-{desktop,mobile}.png`. 임시 레지스트리 원본도 같은 폴더에 보관. 이 진행 기록 갱신.

### 검증 결과

- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `npm run check:tokens`: **최종 모두 종료 코드 0**. 키트 검사 11개 타이포 역할·16개 대비 조합·6개 재생성 결과 PASS. 설치 audit 256개 패키지·취약점 0개.
- Edge/Chromium 기반 실제 브라우저에서 **17개 검사 통과**: 320/390/599/600/768/1023/1024/1280px 가로 넘침 없음·구간별 여백/열 수, 주요 버튼 기본/hover/pressed, 건너뛰기·키보드 포커스, 오류 설명 연결·재시도 입력 보존·readonly/disabled, 체크박스 Space, Select 방향키, Tabs 방향키/비활성 건너뛰기, Dialog 포커스 가두기·Escape·닫기/포커스 복귀, 모바일 모달, 큰 글꼴·동작 줄이기·OS 다크에서도 라이트 유지, 브랜드 경로 HTTP 200·콘솔 오류 0건·API 요청 0건.
- 390/768/1280px와 모바일·데스크톱 모달 스크린샷 확인. 640px 뷰포트+루트 글꼴 200%에서 넘침 검사. 브라우저 메뉴의 실제 200% 확대·스크린리더 낭독·다른 브라우저는 미검증.
- 기존 5173 포트가 사용 중이어서 이번 QA는 **루트 기준** `npm exec -w @kemi/web vite -- --host 127.0.0.1 --port 5174 --strictPort`로 별도 실행. 5173 기존 프로세스는 종료하지 않음. 일반 개발 명령은 기존 `npm run dev` 유지.
- QA 재현: Playwright를 제공하는 환경에서 루트의 `node tmp/0-b/verify-ui.cjs` 실행. 이 세션은 번들 Playwright를 `NODE_PATH`로 지정하고 설치된 Edge를 사용. 앱에 Playwright 패키지/정식 테스트 러너·CI를 구성한 것은 아님. 기본 QA URL은 5174이며 `KEMI_QA_URL`로 변경 가능.
- **실제 API 연동:** 없음/미검증. **Mock 검증:** 없음(API Mock 구현 없음). 성공/오류/재시도는 명시된 로컬 UI 예시이며 백엔드 저장·정책·계약 검증 증거가 아님.

### 남은 일과 결정 경계

- 0-B 범위의 미완료 항목 없음. Pretendard 웹폰트 공급은 기존 미결정으로 유지하며 현재 시스템 대체 글꼴 사용. 다크 모드는 확장안 유지.
- 0-C Router·Query·Axios·MSW, 이후 Vitest·Playwright 정식 구성·CI와 기능 개발은 미착수. 0단계 전체 완료로 표시하지 않음.
- D01~D23 및 기존 API 충돌 유지. 이번 범위에 제품 API를 만들거나 기능표·계획·미결정 정책을 변경하지 않음.
- Git 커밋·푸시·배포와 다음 범위 자동 착수 없음.

## 0-C 완료 기록 (이번 범위)

- **0-C만 완료:** React Router DOM 7.18.4·TanStack Query 5.104.5·Axios 1.20.0·개발 의존성 MSW 3.0.3을 정확한 버전으로 설치. 공식 문서·npm engines/peerDependencies·설치된 MSW 3 타입/README 확인. Node 24/React 19/Vite 8/TypeScript 6과 호환. 설치 audit 331개 패키지·취약점 0개.
- 계획 §4의 S01~S15에 해당하는 **32개 경로**를 연결. 공개/회원/작업/운영 구분을 공통 Shell의 레이아웃 모드로 구성. 브랜드 헤더·내비게이션·본문·푸터·404·문서 제목·화면 이동 시 본문 포커스·건너뛰기 제공. KEMI 원본 토큰·로고·타이포 역할·600/1024px 구간·최대 1280px·16/24/32px 여백·카드 24px 유지.
- 제품 화면은 모두 **기능 미연결 안내 화면**. 기능표의 69개 기능은 미착수 유지. 기존 공통 UI 예시는 개발 전용 `/__dev/ui`로 이동. 작업 화면의 채팅/작업 패널은 후속 기능/D20 경계이며 이번에는 공간 구분만 구성.
- Mock 비회원/의뢰인/크리에이터/운영 역할로 접근 가드 검증. 비회원은 로그인 경로로 이동하고 허용된 내부 경로로만 복귀. 역할 변경 시 진행 중 조회 취소·캐시 제거. 새로고침은 비회원 초기화. 서버 인증 미연결 상태에서는 보호 데이터를 렌더링하지 않고 준비 상태를 표시. 가드는 서버의 소유자/당사자/파일 권한 검증을 대체하지 않음.
- Axios에 서버 Origin 설정·10초 타임아웃·취소 보존·HTTP/네트워크 오류 변환을 구성. API 문서의 `error.code/message` 외피만 참고하고 화면에는 로컬 오류 안내 사용. Query 조회·변경 모두 자동 재시도 비활성; 명시적인 수동 재요청 제공. 실제 인증 갱신·401 세션 만료 연결은 1단계 범위.
- MSW 성공·빈 결과·1.5초 지연·401·403·409·500·네트워크 오류를 **`/__mock__/probe` 전용 가상 계약**으로 분리. 실제 제품 엔드포인트/DTO를 추정하지 않음. Mock 준비를 기다린 뒤 앱 시작, 준비 실패 시 오류 안내. 개발 환경과 명시적 플래그가 모두 켜져야 시작하며 운영 산출물에서 도구·UI 예시·MSW 코드·worker 파일을 제외.

### 변경 파일과 실행 방법

- 의존성: `apps/web/package.json`, 루트 `package-lock.json`.
- 설정: `apps/web/{.env.example,.prettierignore,eslint.config.js,vite.config.ts}`. 생성 worker는 포맷/lint 대상에서 제외하고 MSW 원본 유지.
- 앱 진입·경로·세션·레이아웃: `apps/web/src/main.tsx`, `src/app/{App,providers,route-pages}.tsx`, `src/app/{routes,session,query-client}.ts`, `src/app/layouts/Shell.tsx`.
- 통신·Mock: `apps/web/src/shared/api/client.ts`, `src/mocks/{browser,handlers}.ts`, `src/mocks/DevTools.tsx`, `apps/web/public/mockServiceWorker.js`.
- 스타일: `apps/web/src/styles/index.css`. 원본 키트·복사 토큰·공통 UI 소스는 변경하지 않음.
- 안내·증거: 루트 `README.md`, 이 진행 기록, `tmp/0-c/{verify.cjs,results.json,layout-390.png,layout-768.png,layout-1280.png}`.
- **루트 PowerShell:** `$env:VITE_ENABLE_MOCKS='true'` → `npm run dev`. 기본은 비활성. 종료 후 `Remove-Item Env:VITE_ENABLE_MOCKS`. 서버 Origin은 `apps/web/.env.example` 참조; VITE 값에 비밀키 금지.
- 이번 QA만 Mock 개발 서버 5175와 운영 preview 4175 사용. 기존 5173/5174 프로세스는 변경하지 않음. 재현은 Playwright+Edge 환경에서 `node tmp/0-c/verify.cjs`; URL은 `KEMI_QA_URL`, `KEMI_PREVIEW_URL`로 변경. 이 세션은 번들 Playwright를 NODE_PATH로 지정했으며 정식 러너 설치와 구분.

### 검증 결과

- 최종 `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, `npm run check:tokens` **모두 종료 코드 0**. 키트 11개 타이포 역할·16개 대비 조합·6개 재생성 결과 PASS.
- Edge/Chromium 브라우저 QA **19개 검사 그룹 통과**, 실패 0. 32개 경로 직접 진입·정적/동적 경로 우선순위·역할별 화면·운영 거부·크리에이터 전용 제한·비회원 리다이렉트·외부 복귀 차단·역할 변경 시 개인 캐시 제거·로그아웃 후 뒤로 가기·404·새로고침·본문 포커스 확인.
- 실제 브라우저의 Axios→MSW→Query 흐름에서 성공/빈 결과/지연/401/403/409/500/네트워크 오류·수동 재요청·처리 중 재요청 버튼 비활성 확인. 페이지 런타임 오류 0, 제품 `/api/` 요청 0. 예상된 HTTP/네트워크 실패 로그는 오류 시나리오의 일부이며 콘솔 전체 오류 0이라고 주장하지 않음.
- 320/390/599/600/768/1023/1024/1280px **실제 렌더링 완료 후** 가로 넘침 없음 확인. 390/768/1280px 캡처 저장, 모바일 캡처 시각 확인. 초기 QA의 요청 집계가 소스 경로 `src/shared/api/client.ts`를 제품 호출로 오인한 문제와 렌더링 대기 누락을 스크립트에서 수정 후 재검증.
- `VITE_ENABLE_MOCKS=true`인 셸에서 운영 빌드해도 Mock 코드/역할 도구/UI 예시/worker 파일이 제외됨을 산출물 검색과 preview 브라우저로 확인. 운영 보호 화면 차단, 개발 UI 경로 404, worker 등록·Mock 요청 없음 확인. 배포 서버 SPA rewrite는 미검증.
- **실제 API 연동:** 없음/미검증. 서버 주소·서버 실행 환경 미제공으로 health도 호출하지 않음. **Mock 검증:** 위 통신/경로 기반만 검증. 인증/상품/결제/계약 등 제품 기능이나 실제 권한·DB 저장을 검증한 것이 아님.

### 남은 일과 결정 경계

- 0-C 범위의 미완료 항목 없음. Vitest·Playwright 정식 러너·CI는 후속 0단계 범위. 0단계 전체 완료로 표시하지 않음.
- D01~D23과 기능표의 API 충돌은 유지. D05 토큰 저장/갱신·D18 운영 권한·신규 소셜 사용자의 onboarding 세션 모델은 실제 계약 확인 전 확정하지 않음. Mock의 역할 enum/접근 구분은 경로 검증용 내부 값이며 shared enum이나 최종 권한표를 대신하지 않음.
- 실제 API 계약이 없는 기능은 이번에 구현하지 않음. 기능 착수 시 엑셀·기능별 API 대조 결과에 맞춰 명시적 Mock 또는 실제 연결을 구분한다.
- Git 커밋·푸시·배포·다음 범위 자동 착수 없음.

## 다음 작업 하나

**5단계 취소·환불·분쟁 API 및 D12/D13/D18 정책 조율:** 원결제/환불/합의 파일·증빙/보류 해제·운영 권한과 미결제/완료 후 취소·작업 재개 계약을 합의한다. 별도 요청 후 착수하며 다음 단계 구현·병합·배포는 자동 진행하지 않는다.

## GitHub 통합 PR 준비 (2026-10-23 추가 요청)

- 지속 작업 경로는 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`이다. 상위 폴더의 독립 앱은 보존한 이전 원본이므로 이후 커밋/PR 작업은 이 Git 복제본에서 진행한다. 이동 후 workspace 링크를 오프라인 재설치로 갱신하고 shared 모듈 경로를 확인했다.
- 구현 커밋 `76fd896e431551b7e54f9af7cd3f22dab7d2bdd2` 푸시 완료. [Draft PR #34](https://github.com/Jubileekim/KEMI/pull/34) 생성·이 채팅에 연결 완료. API 단위 검사 실패를 PR 본문에 명시했다. 원격 CI의 최종 결과는 미확인이고 자동 병합·배포는 실행하지 않았다.

- 사용자가 단계 종료 후 커밋·푸시·PR을 요청함에 따라 위 0-C 종료 당시의 Git 미실행 상태에서 별도 진행. 기준은 `Jubileekim/KEMI` main `73057fe69916631b553723c8e14869629c17de53`이며 작업 브랜치는 `feat/frontend-0abc-foundation`이다. 이 첫 PR에는 원격에 없던 0-A·0-B 기반과 0-C를 함께 포함한다.
- 위 0-A~0-C 기록은 독립 로컬 앱에서 검증한 당시 이력이다. 원격에는 API/shared와 웹 테스트·CI가 이미 있어 보존했다. `apps/api`, `packages/shared`, 기존 workflow 파일은 변경하지 않았다. 실제 프론트 제품 기능·API 연동을 새로 완료한 것은 아니다.
- 통합본은 원격의 React Router 8.4.0·TypeScript 5.9.3·Vite 8.3.4를 유지한다. Router DOM 7/TypeScript 6 별도 설치와 ESLint 10 덮어쓰기를 피하고, 기존 Airbnb/TypeScript 규칙·Prettier 기본 형식에 새 소스를 맞췄다. MSW는 devDependency, 서버 오류는 unknown+Zod로 검증, 타입 단언 없이 CSS 변수와 역할 입력을 처리한다.
- 원격의 기존 health 진단과 API 클라이언트·단위 검사는 보존하고 화면만 개발 전용 `/__dev/health`로 옮겼다. 기존 E2E는 새 홈/404와 진단 경로를 반영하고, `/health`만 정확히 가로채도록 수정했다. health E2E의 가상 응답은 실제 서버 검증과 구분한다.
- 루트의 기존 `dev:web`, `build:web`, `test:web` 등 명령을 유지하며 `dev`·`build`·`preview` 별칭과 `check:tokens`를 추가했다. 원본 키트·기능 엑셀·기술 PDF·당시 API 문서 스냅샷·프론트 계획을 함께 버전 관리해 근거와 토큰 검사를 재현한다. 원본 키트·복사한 브랜드/토큰·MSW 생성 worker는 포맷/린트에서 제외한다.
- 통합본의 근거/재현 스크립트는 `qa/frontend-0c/`로 옮겼다. Mock 서버 5176·preview 4176에서 19개 검사 그룹 통과, 페이지 오류 0·제품 API 요청 0. 실제 API는 미연결. 최신 API/shared가 원격에 존재한다는 사실과 현재 프론트에 연결했다는 것은 구분한다.
- 기존 Playwright E2E는 데스크톱·모바일 12/12 통과, 종료 코드 0. 로컬 검증에만 임시 config로 Edge와 별도 포트 5179를 지정했으며 저장소의 Chromium 프로젝트·CI 파일은 유지했다. 제한된 환경에서 발생한 서버 종료 대기는 권한이 허용된 동일 검사 실행으로 분리 확인했다.
- `npm run build:web`(타입·린트 포함), `npm run format:check`, `npm run test:web`(4/4), `npm run check:tokens`, `npm ci --ignore-scripts --dry-run` 통과. 전체 workspace 타입·린트도 Prisma 생성 후 통과했다. Prisma 생성은 코드 생성만 수행했으며 DB 연결/마이그레이션은 실행하지 않았다.
- 추가로 실행한 **기존 API 단위 검사**는 Windows에서 timeout/ECONNRESET이 발생: 최종 74/85 통과·11개 실패. 샌드박스 밖 동일 명령에서도 재현되어 통과라고 표시하지 않는다. API 소스·검사·shared는 diff 없음. 원인 확정이나 백엔드 수정은 이 PR 범위에 넣지 않고 원격 Linux CI 결과와 별도로 기록한다. 실제 DB 검사·외부 제공자 검증은 미실행.
- `npm audit`는 high 9건을 보고했다. 전부 main의 기존 개발 도구(braces/micromatch/fast-glob, Airbnb ESLint, shadcn CLI 등)와 설치 경로·버전이 동일함을 lockfile로 확인했다. 일괄 audit fix/주요 버전 변경은 수행하지 않음. 신규 파일의 대표 비밀키/개인키 패턴 검사 결과 의심 경로 0.
- PR은 검토용으로 생성하며 자동 병합·배포·다음 기능 개발은 하지 않는다. 원격 CI 성공 여부는 로컬 검사와 별도 확인한다.

## 실제 API 연결 전 필요한 것

- 생성된 OpenAPI JSON 또는 @kemi/shared 입력 스키마·enum. 실제 서버 주소/개발 환경·Origin 설정.
- P07과 accept API 동작의 정합화. API 문서 없는 기능은 계약 추가 필요.
- D01~D23 중 해당 기능을 막는 항목만 순서대로 결정. 미정값은 확정 정책으로 표시하지 않음.

## 작업 종료 시 갱신할 항목

1. 이번 범위와 완료/미완료
2. 변경 파일과 실행 방법
3. 검증 명령·결과·미검증 경계
4. 결정 사항·차단 원인
5. 다음 작업 하나

전체 원본·전체 계획을 매 턴 다시 요약하지 않는다. 필요한 기능 행과 관련 절을 우선 확인한다. 사용자 요청 범위까지만 진행한다.

## 1-A 이메일 회원가입·로그인·로그아웃·만료 (2026-10-23)

### 완료 범위와 변경 파일

- 지정 Git 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`, npm workspace `apps/web`만 기준으로 구현. 상위 독립 앱은 수정하지 않았다. 중단 후 미커밋 변경이 보존된 것을 확인하고 검사를 재실행했다.
- AUTH-01·02·03·05의 이메일 클라이언트 범위: RHF/Zod 가입·로그인 폼, Mock 가입 후 자동 로그인→프로필, 역할별 기본 경로/안전한 복귀, refresh→me 초기 확인, TOKEN_EXPIRED 갱신, 실패·폐기·로그아웃·서버 로그아웃 재시도.
- `apps/web/src/features/auth/{AuthForm.tsx,config.ts,contracts.ts,redirect.ts,session-controller.ts}` 신규. 세션/라우터/레이아웃은 `src/app/{App.tsx,providers.tsx,session.ts,route-pages.tsx,layouts/Shell.tsx}`, 통신은 `src/shared/api/client.ts`, 스타일은 `src/styles/index.css` 수정.
- 개발용 `src/mocks/{auth-handlers.ts,browser.ts,DevTools.tsx}`, `.env.example`, `src/vite-env.d.ts` 갱신. 토큰은 메모리만 사용하고 Query 변수에 비밀번호를 보관하지 않는다. Mock 계정은 탭 메모리 한정이며 실제 가입 저장이 아니다.
- 검사: `apps/web/test/auth{,-transport}.test.ts`, `e2e/auth.spec.ts` 신규. 기존 `e2e/app.spec.ts`는 MSW와 함께 health 요청을 가로채도록 context.route 적용. `playwright.config.ts`는 검사 서버에서 Mock을 명시적으로 활성화한다.
- `.github/workflows/web-ci.yml`의 기존 검사 절차를 유지하고, 아직 열린 기반 PR #34 위의 별도 1-A PR도 실행하도록 기반 브랜치를 허용 목록에 추가했다. API CI·API/shared 소스·lockfile·브랜드 원본/토큰은 변경하지 않았다.
- 상세 경계/실행: `docs/frontend-auth-1a.md`, 관련 기능 상태 `docs/frontend-feature-matrix.md`, 증거·재현 `qa/frontend-1a/{README.md,production-smoke.cjs,production-results.json,signup-390.png,signup-1280.png}`.

### 로컬 검증 결과

- 최종 `npm run test:web`: **32/32 통과**. 비밀번호 경계·이메일 정규화·위험한 복귀 경로·초기 확인·동시 갱신·409 횟수/3초 예산·네트워크 재시도 제한·서버 로그아웃 실패·늦은 응답·계정 변경 캐시 제거·변경 요청 재전송 금지 확인.
- 최종 `npm run build:web`(타입·ESLint 포함), `npm run format:check`, `npm run check:tokens`, `git diff --check`: **통과**. 토큰 검사 11개 타입 역할·16개 대비·6개 재생성 PASS. 신규 의존성 설치 없음.
- 최신 전체 Playwright **36/36 통과, 종료 코드 0**. 기존 health 12개와 인증 24개를 데스크톱·모바일 Edge/Chromium으로 검사했다. 가입→프로필→로그아웃→동일 계정 로그인 통합 흐름을 두 역할에서 추가 확인했다. 지연/오류/제한/429/500/네트워크·안전한 복귀·새로고침·로그아웃 캐시 제거·실패 후 재시도·뒤로 가기·세션 폐기·320/390/768/1280px 넘침을 포함한다. 390/1280px 캡처 시각 확인.
- 로컬은 무시되는 `tmp/playwright.local.config.ts`에서 Edge와 포트 5179를 사용. 일반 명령·CI는 기존 Chromium 프로젝트와 별도 개발 서버를 유지한다. 전체 trace/report·tmp 로그는 커밋에서 제외했다.
- 중간 실패 기록: 초기 로컬 config에서 Mock env 누락, 기존 page.route가 MSW 요청을 놓치는 문제를 수정했다. shared 재빌드/소스 갱신과 E2E를 겹쳐 실행했을 때 초기 checking 상태 대기가 실패했다. 빌드 종료 후 개발 서버를 새로 띄운 단독 전체 실행은 **36/36**. 이 정황과 최종 결과를 구분하며 타임아웃 완화·자동 재시도 추가로 숨기지 않았다.
- 운영 모드 build/preview(4181): Mock 플래그가 있어도 worker·Mock 계정/도구가 산출물에서 제외되는지 검색했고, Playwright가 HTTP를 모의 응답한 브라우저 smoke **7개 검사 통과**, 페이지 오류 0. 이메일 정규화·보호 화면 복귀·로그아웃·실제 모드 가입 차단·개발 도구/worker 미등록 확인. `production-results.json` 참조. 이 결과도 실제 서버 검증이 아니다.
- 독립 보안/명세 검토의 계정 전환 캐시와 정적/동적 경로 우선순위 지적을 수정·회귀 검사했다. 추가로 쿠키를 쓰는 login/logout/refresh를 같은 큐/지원 환경 Web Lock으로 묶었다. 실제 다중 탭/쿠키 응답 순서는 미검증이다.

### 남은 일과 정책 경계

- **AUTH-01 실제 가입 미연결:** 엑셀 P01(8~64자·영문/숫자)과 현재 shared/API(8자 이상·72바이트) 충돌. 엑셀을 따르는 Mock으로 분리했고 실제 가입 버튼/호출을 차단했다. API/shared 정책을 임의 수정하지 않았다.
- **AUTH-02 미완성 프로필 자동 이동 미완료:** AuthUser/MeResponse에 완료 판정 계약이 없고 D01 미정. 브랜드/공개 여부로 추정하지 않고 역할별 기본 이동만 제공한다. 프로필 화면 편집은 이번 범위 아님.
- **실제 API·DB·Origin/HttpOnly/Secure/SameSite·세션 폐기·외부 제공자 미검증:** 이 체크아웃에는 API 환경 파일/실행 서버가 없다. Mock과 모의 HTTP 응답의 성공을 실제 연결로 표시하지 않는다. 실제 모드는 `VITE_ENABLE_AUTH_API=true`로 명시하며 D05 팀 승인은 별도다.
- 기존 API Windows 단위 실패 이력은 앞선 기반 PR 기록을 유지하며 이번에 재실행하거나 백엔드를 변경하지 않았다. API CI와 원격 웹 CI 결과는 아래 Git 전달 기록에서 별도 관리한다.
- 1-A의 클라이언트/Mock 검증까지 완료. **1-A 실제 인증 전체·0단계 전체·1단계 전체는 완료가 아니다.** 소셜·프로필·패키지·다음 작업, PR 병합·자동 병합·배포는 실행하지 않았다.

### Git 전달 상태

- 기존 인증 1-A 브랜치/PR 없음 확인. 기반 Draft PR #34의 `314c831`에서 `feat/frontend-1a-email-auth`를 만들었다. 별도 PR은 기반 브랜치를 대상으로 하여 0-A~0-C diff를 중복하지 않는다.
- 세션/계약·검사 커밋: [4320db7](https://github.com/Jubileekim/KEMI/commit/4320db7). 화면/Mock·통합검사·문서 커밋: [130219e](https://github.com/Jubileekim/KEMI/commit/130219e). 두 커밋 모두 원격 브랜치에 푸시했고 로컬/원격 SHA 일치를 확인했다.
- [Draft PR #35](https://github.com/Jubileekim/KEMI/pull/35) 생성·이 채팅 연결 완료. base는 아직 열린 기반 PR #34의 `feat/frontend-0abc-foundation`. 기반 병합 뒤 main 대상 재지정 검토가 필요하다. Draft는 실제 가입 정책 충돌·프로필 완료 판정 부재·실서버 검증 경계 때문에 유지한다.
- **원격 Web CI:** 기능 커밋 `130219e`의 [run 81](https://github.com/Jubileekim/KEMI/actions/runs/39943799612) **success** 확인. Ubuntu/Node 24에서 npm ci·형식·단위·타입/린트/빌드·Chromium 설치·데스크톱/모바일 **36/36**·report 업로드가 모두 성공했다. 로컬 Edge 결과와 별도 증거다. 기존 API CI는 이 base에서 실행 대상이 아니며 API/DB 성공을 주장하지 않는다.
- 이 결과/PR 링크를 추가한 최종 전달 커밋은 문서만 변경한다. 해당 커밋의 최신 CI는 PR Checks에서 SHA와 함께 확인할 수 있다. 문서 변경 후 형식/공백 검사를 수행하고 푸시한다. 소스·테스트는 검증한 `130219e`와 같다.
- 다음 작업 하나는 위의 **1-A API 정합화·실서버 검증**이며 자동 착수하지 않는다.

## 1-B Google 로그인 화면과 콜백 처리 (2026-10-23)

### 완료 범위·변경 파일

- 기준 저장소는 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`, 앱은 npm workspace `apps/web`이다. 상위 독립 앱은 수정하지 않았다. AUTH-04/P03만 구현했고 **AUTH-06 카카오 로그인은 미착수**로 남긴다.
- Google 시작은 실제 모드에서 `/api/auth/google/start`로 브라우저 이동. 기존 회원 콜백은 개인 캐시 제거→refresh→me 확인→역할별 안전한 복귀. 신규 회원은 서버 티켓 조회 후 공개 콜백에서 역할/이름을 받고 shared 계약으로 가입→프로필 이동한다. 이메일/비밀번호를 요구하거나 제공자 이메일로 기존 계정을 합치지 않는다.
- `apps/web/src/features/auth/{google.ts,GoogleButton.tsx,GoogleCallback.tsx,SocialSignupForm.tsx}` 신규. 같은 폴더의 `AuthForm.tsx`, `session-controller.ts`, `src/app/{App,providers}.tsx`와 `.env.example` 연결. OAuth state·PKCE·토큰 교환은 기존 서버 책임이며 프론트에서 대체하지 않는다.
- 개발 전용 `src/mocks/GoogleProvider.tsx` 신규, `auth-handlers.ts`에 명시적 Google fixture/티켓/오류 추가. 기존 이메일 회원과 같은 제공자 이메일을 가진 별도 Google fixture로 자동 병합 없는 UI를 검사한다. 비밀이 아닌 Mock 역할 표식으로 새로고침 역할을 보존하며 이름 편집은 탭 메모리 한정이다. 실제 DB 저장/계정 유일성 증거가 아니다.
- 검사 `apps/web/test/google.test.ts`, `e2e/google.spec.ts`와 증거 `qa/frontend-1b/` 신규. 계약/판단은 `docs/frontend-auth-1b.md`, 해당 기능 상태는 `frontend-feature-matrix.md`에 기록했다. `.github/workflows/web-ci.yml`은 아직 열린 1-A 브랜치를 PR base 허용 목록에 추가했고 기존 검사 절차를 유지한다.
- API/shared·DB·의존성/lockfile·원본 엑셀·디자인 토큰/로고 변경 없음. 다음 기능·병합·자동 병합·배포는 실행하지 않았다.

### 로컬 검증·검토

- 최종 `npm run test:web`: **59/59**. Google 신규 단위 27개와 기존 32개. 콜백 단일 분기/중복 키·위조 값 거절, 복귀 경로/만료, 캐시 초기화, 제한 계정, 로그아웃 이후 늦은 가입 응답을 확인했다.
- 최종 `npm run build:web`의 타입/ESLint/운영 빌드, `npm run format:check`, `npm run check:tokens`, `git diff --check`: **통과**. 키트 11개 타이포 역할·16개 대비·6개 재생성 PASS. 대표 비밀키/개인키 패턴 의심 경로 없음.
- 최종 전체 Playwright: **64/64, 종료 코드 0**. 기존 이메일/health 36개와 Google 28개를 데스크톱·모바일 Edge/Chromium으로 검사. 두 역할 신규 가입→프로필→로그아웃→동일 ID/역할 재로그인→새로고침, 기존 회원 복귀, 취소/실패/설정 없음/요청 제한/이용 제한, 티켓 없음/만료/409/500/429, 이름 수정·역할 필수·중복 제출, 320/390/599/600/768/1023/1024/1280px 넘침·키보드·오류 연결·주요 색상을 확인했다.
- 로컬 명령은 `npm exec -- playwright test --config tmp/playwright.local.config.ts` (Edge·5179). 정식 CI의 Chromium 설정을 변경하지 않았다. 로그/trace/report/tmp는 제외한다. 기존 MSW의 정적 파일/health 통과 요청 경고는 남으며 실제 서버 성공으로 해석하지 않는다.
- 운영 빌드(인증/Mock 플래그를 모두 켬)+preview 4182에서 **모의 HTTP 7개 검사 통과·페이지 오류 0**. 시작 API가 fetch가 아닌 주소 이동인지, refresh/me 후 인증, 크리에이터 전용 복귀, 신규 역할/이름 POST 1회, 카카오 티켓 거절, worker/Google Mock/개발 도구/카카오 버튼 제외 확인. 390/1280px 캡처 시각 검토. `qa/frontend-1b/README.md`, `production-results.json`으로 재현한다.
- 중간 실패와 수정: 재로그인 검사의 복귀 기대값을 기존 로그아웃의 프로필 복귀 규칙에 맞췄고, 개발 도구 label 대신 응답의 사용자 ID/역할로 확인하도록 바꿨다. 빠른 운영 모의 응답에서 세션 캐시 초기화가 가입 폼을 다시 만들어 완료 이동이 누락되는 문제를 재현·수정한 뒤 운영 smoke와 전체 E2E를 다시 통과했다. 기존 ESLint 규칙 위반을 수정했으며 검사 완화/자동 재시도는 추가하지 않았다. 중단/재개 뒤 종료된 preview는 다시 실행했다.
- 명세·코드 품질·보안 축의 최종 자체 검토 완료. 토큰/티켓 URL 수락 금지, provider 검증, 외부 복귀 차단, 쿠키 요청 순서·개인 캐시·늦은 응답·운영 Mock 제외를 실행 증거와 대조했다. 실제 보안/제공자 검증을 대체하지 않으므로 Draft로 전달한다.

### 남은 일·다음 작업 하나

- **실제 API/Google/DB 미검증:** 이 체크아웃에는 API `.env`와 실행 서버가 없고 실제 Google 설정·동의 세션도 없다. APP_ORIGIN·같은 Origin proxy/rewrite·Google 콘솔 콜백, 실제 HttpOnly/Secure/SameSite 쿠키·동의 취소·계정 재로그인·동일 이메일 분리는 실환경에서 확인해야 한다. Mock/모의 HTTP 결과를 실제 연결 완료로 표시하지 않는다.
- D01 프로필 완료 판정·D05 팀 결정과 기존 1-A 이메일 가입 정책 충돌은 유지한다. **1-B 클라이언트/Mock 범위까지 완료이며 실제 Google 연동 전체·1단계 전체 완료가 아니다.** 프로필·패키지와 단계 통합 완료 조건은 남아 있어 1단계 전체 통합 검증을 완료로 표시하지 않는다. 이번 Google 기능 묶음의 연속 흐름은 위 E2E로 확인했다.
- 카카오 AUTH-06: **미착수**. 백엔드/shared의 기존 정의만 보존하며 프론트 버튼·카카오 신규 가입은 연결하지 않았다.
- 다음 작업 하나: **1-B 실제 Google 동의·콜백·계정 상태 검증**. 서버/Google 콘솔/팀 승인 준비 후 별도 요청으로 진행한다. 이번에는 자동 착수하지 않는다.

### Git 전달 상태

- 기존 Google 백엔드 PR #14는 참고 계약이며 이번 프론트 PR이 아니다. 기존 1-B 브랜치/PR 없음 확인 후 1-A Draft PR #35의 `c9a78e0`에서 `feat/frontend-1b-google-auth`를 만들었다. 1-A가 아직 열려 있어 새 PR의 base도 해당 브랜치로 두어 이번 Google 변경만 검토한다.
- 계약·세션/단위 검사 [377eacc](https://github.com/Jubileekim/KEMI/commit/377eacc), 화면·Mock·E2E·문서 [a408d94](https://github.com/Jubileekim/KEMI/commit/a408d94)를 푸시했다. 로컬과 원격 SHA 일치, 작업 트리 clean 확인. 기존 제한 fetch 설정에는 이번 브랜치 추적 항목만 추가했다.
- [Draft PR #36](https://github.com/Jubileekim/KEMI/pull/36) 생성·이 채팅 연결 완료. base `feat/frontend-1a-email-auth`, 선행 PR #35 병합 후 재지정 검토 필요. 실제 API/Google·D01/D05 검증 경계 때문에 Draft 유지. 병합/자동 병합/배포 없음.
- **원격 Web CI:** 기능 커밋 `a408d94fd9787cc51aedbbb3d4ade789094c209c`의 [run 83](https://github.com/Jubileekim/KEMI/actions/runs/39968996079) **success**. Ubuntu/Node 24에서 npm ci·형식·단위 59개·타입/린트/빌드·Chromium 데스크톱/모바일 **64/64**·report 업로드 성공을 확인했다. 로컬 Edge 64/64와 구분하는 별도 증거다. API CI/DB/Google 실연동 성공을 뜻하지 않는다.
- 위 링크와 원격 결과를 기록하는 최종 전달 커밋은 이 문서만 변경하며 소스·테스트는 검증한 `a408d94`와 같다. 문서 형식/공백 검사 후 푸시한다. 이 문서 커밋의 새 CI는 PR Checks에서 최신 SHA별로 확인하며, 기능 커밋의 성공으로 최신 실행을 통과 처리하지 않는다.

## 1-C 의뢰인·크리에이터 프로필 편집 (2026-10-23~24)

### 완료 범위·변경 파일

- 지정 Git 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`의 npm workspace `apps/web` 기준. **PROFILE-01·02 클라이언트/Mock 범위**다. 기능 엑셀 해당 행·P02/D01, 기술 PDF·수정 계획 1단계·기능별 API 대조·현재 shared와 API 구현을 확인했다. 상위 독립 앱은 수정하지 않았다.
- `/me/profile`에 두 역할의 조회·선택 입력·변경 취소·부분 저장·로딩/오류/명시적 재시도를 연결했다. 의뢰인은 표시 이름만 변경해도 저장 가능하며 브랜드 정보는 모두 선택이다. 이메일·배송지 편집/표시·타인 ID 입력은 없다. 캠페인 공개/직접 의뢰 기능 자체는 이번에 구현하거나 검증하지 않았다.
- 크리에이터는 소개·분야·복수 스타일/제작 역할·작업 방식·현재 shared의 작업 가능 여부/날짜를 미완성 저장한다. 서버 응답의 초안/공개/비공개만 표시하고 공개 제어를 추가하지 않았다. `serviceStatus`·다른 역할 필드·Mock 추가 정보는 PATCH에서 제외한다.
- shared 검증으로 공백·삭제/null·빈 배열·선택지/날짜를 처리한다. 서버가 반환한 정규화 값으로 폼과 계정별 Query 캐시를 갱신한다. 편집 중 자동 재조회는 끄고, 저장 실패 입력 보존·중복 제출 차단·불명확한 저장 결과의 명시적 최신 값 조회를 제공한다. 기존 세션 epoch·취소·로그아웃 캐시 제거·쓰기 자동 재전송 금지를 유지한다.
- 신규: `apps/web/src/features/profiles/{api,contracts}.ts`, `{ProfilePage,ProfileForm}.tsx`; `src/mocks/{profile-handlers.ts,ProfileExtrasMock.tsx}`; `test/profiles.test.ts`, `e2e/profiles.spec.ts`; `docs/frontend-profile-1c.md`; `qa/frontend-1c/{README.md,production-smoke.cjs,production-results.json,profile-{client,creator}-{390,1280}.png}`.
- 연결 수정: `apps/web/src/app/{App.tsx,layouts/Shell.tsx}`, `src/mocks/{browser.ts,auth-handlers.ts,DevTools.tsx}`. `.github/workflows/web-ci.yml`은 기존 검사 절차를 유지하고 stacked PR의 base 브랜치만 추가했다. API/shared·DB·의존성/lockfile·브랜드 원본/복사 토큰은 변경하지 않았다.
- 계약 없는 로고·이미지·경력·크리에이터 링크는 **개발 전용 Mock 미리보기**로 분리했다. 기본 프로필 저장과 별개이며 프로필 화면 이동/새로고침/로그아웃 시 폐기한다. 이미지 bytes는 업로드하지 않고 blob URL을 해제한다. PNG/JPEG/WebP는 이 미리보기의 지원 형식이며 실제 파일 정책으로 확정하지 않는다.

### 로컬 검증

- `npm run test:web`: **70/70** 통과(기존 59개 + 프로필 11개). shared 정책·부분 PATCH·선택값 삭제·URL/이름/길이/날짜/중복·역할/응답 검증·취소 signal·재전송 금지를 확인했다. 기존 인증 HTTP 검사는 `/api/profiles/me`의 만료·늦은 개인 응답 경계도 검사한다.
- `npm run build:web`(타입·ESLint 포함), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 토큰 검사 11개 타입 역할·16개 대비·6개 재생성 PASS. 신규 의존성 설치 없음.
- 최종 전체 Playwright **92/92 통과, 종료 코드 0**. 기존 64개 + 프로필 28개이며 로그인→역할별 저장→재조회, 선택값 삭제·만료 쓰기 재전송 금지·로그아웃 뒤 늦은 저장 응답·오류/재시도·개인 캐시·Mock 분리·반응형을 검사했다. 프로필 전용 초기 실행은 데스크톱/모바일 24개 테스트가 모두 통과했으나 Windows 개발 서버 종료 대기가 이어졌다. 같은 작업 소유 서버에 무시되는 `tmp/playwright.profile.config.ts`의 `webServer: undefined`로 전체를 별도 실행했다. 정식 CI의 Chromium/프로젝트/자동 재시도/타임아웃은 유지했다.
- 운영 빌드+**Playwright 모의 HTTP smoke 9개 통과, 페이지 오류 0**. 두 역할 Bearer/부분 PATCH·응답 반영·키보드·재조회/새로고침·오류 입력 보존·최신 값 확인, PUBLIC 유지·운영 Mock/worker/추가 정보/개인 이메일 비노출 확인. `production-results.json` 및 QA README 참조. HTTP fixture가 메모리로 보관한 저장값이며 실제 DB 지속성 증거가 아니다.
- 390/1280px의 두 역할 캡처를 시각 검토했다. 프로필 E2E에서 320/390/600/768/1024/1280px 가로 넘침을 확인한다. 스크린리더 낭독·브라우저 메뉴 200% 확대·다른 브라우저는 미검증이다.
- 중간 실패: 신규 코드/검사의 기존 ESLint(라벨 연결·중첩 조건·순차 반복·effect 상태 갱신) 위반을 수정했다. 테스트 반복을 바꾸는 과정의 문법 오류를 수정한 뒤 타입/린트/빌드/단위를 다시 통과했다. 검사 규칙 완화/자동 재시도는 추가하지 않았다.
- 최종 자체 검토는 명세·코드·보안 축으로 분리했다. 본인 경로·역할별 allowlist·서버 응답 검증·개인 캐시/지연 응답·오류 메시지·URL/이미지·운영 Mock 제외를 코드와 실행 증거로 대조했다. 사용자 입력을 HTML로 삽입하지 않고, 선택 링크를 자동 열지 않는다. 실제 서버 권한 검증을 대체하지 않는다.

### 남은 일·다음 작업 하나

- **실제 API/DB 미검증:** 이 체크아웃에 API `.env`/실행 서버가 없다. 기존 `VITE_ENABLE_AUTH_API=true`에서 실제 프로필 어댑터를 켤 수 있으나 Origin/쿠키·실계정·DB 저장·권한 검증은 별도 환경에서 필요하다. 개발 MSW와 운영 모의 HTTP는 실연동 증거가 아니다. 외부 제공자 검증도 이번에 실행하지 않았다.
- **로고·이미지·경력·크리에이터 링크 실제 저장 미연결:** 현재 API/shared에 해당 계약이 없어 Mock으로만 제공했다. 파일 업로드/프로필 연결·삭제·공개 범위와 경력/링크 계약이 필요하다. 실제 모드는 준비 중 안내를 표시한다.
- D01 완료/공개 필수 조건·D21 분야/스타일 확정은 보류. 개인 의뢰인의 브랜드 선택은 P02 확정대로 유지한다. D01을 추정해 가입 후 자동 완료 판정/이동을 만들지 않았다. 기존 D05·이메일 가입 정책 충돌도 유지한다.
- 1-C 클라이언트/Mock 검증이며 **실제 프로필 기능 전체·1단계 전체 완료가 아니다**. 카카오·패키지·포트폴리오·공개 제어가 남아 1단계 전체 통합 완료로 표시하지 않는다. 이번 기능 묶음의 로그인→역할별 저장→재조회만 통합 확인한다.
- 다음 작업 하나: **1-C 프로필 API 실환경 검증 및 누락 선택정보 계약 조율**. 준비된 API/DB에서 두 역할 저장·재조회·권한을 확인하고 추가 정보의 저장 계약을 합의한다. 자동 착수하지 않는다. PR 병합·자동 병합·배포 없음.

### Git 전달 상태

- 기존 1-C 프론트 브랜치/PR 없음 확인. 백엔드 프로필 PR #13은 참고 계약이며 이번 프론트 PR이 아니다. 열린 1-B Draft PR #36의 `9734384`에서 `feat/frontend-1c-profiles` 생성. PR base는 `feat/frontend-1b-google-auth`로 두어 1-C만 검토하며 선행 PR 병합 뒤 재지정 검토가 필요하다.
- 계약·단위 검사 [b0c0367](https://github.com/Jubileekim/KEMI/commit/b0c0367), 화면·Mock·E2E·QA·진행 기록 [39c00d4](https://github.com/Jubileekim/KEMI/commit/39c00d4)를 푸시했다. 제한된 기존 fetch 목록에 이번 브랜치만 추가하고 원격/로컬 SHA 일치를 확인했다.
- [Draft PR #37](https://github.com/Jubileekim/KEMI/pull/37) 생성·이 채팅 연결 완료. base `feat/frontend-1b-google-auth`. 실제 API/DB와 누락 선택정보 계약·미결정 경계 때문에 Draft로 전달한다. 병합/자동 병합/배포 없음.
- 초기 24개 프로필 테스트의 서버 종료 대기는 작업 소유 프로세스만 경로·포트·PID로 확인 후 수동 정리했다(초기 러너 종료 코드 1). 이후 완료한 최종 전체 **92/92·종료 코드 0**과 구분한다. 사용한 5179 테스트/4183 preview 서버도 종료했다.
- **별도 Vercel 상태:** 기존 GitHub 연동이 커밋 작성자의 Vercel 프로젝트 접근 권한 부족으로 `failure`를 보고했다. Web CI 결과와 별도이며 코드 빌드/테스트 실패나 배포 성공으로 해석하지 않는다. 배포/권한 변경은 실행하지 않았다.
- **원격 Web CI:** 기능 커밋 `39c00d45155c5f57cb5fe24bb6dcb0c42f26c149`의 [run 85](https://github.com/Jubileekim/KEMI/actions/runs/39973660712) **success**. Ubuntu/Node 24에서 npm ci·형식·단위 **70/70**·타입/ESLint/빌드·Chromium 설치·데스크톱/모바일 **92/92**·report 업로드 성공과 실제 job 로그를 확인했다. 로컬 Edge 92/92와 구분하는 별도 증거다. API CI/실서버·DB·외부 제공자 검증 결과가 아니다.
- 위 원격 결과·커밋/PR 링크를 기록하는 최종 전달 커밋은 이 문서만 변경한다. 소스·검사는 검증한 `39c00d4`와 동일하다. 문서 형식/공백 검사를 수행한 뒤 푸시하며 해당 SHA의 새 CI는 PR Checks에서 별도로 확인한다. 기능 SHA의 성공으로 새 실행을 통과 처리하지 않는다.

## 1-D-A 패키지·대표 지정·서비스 공개 (2026-10-24)

### 완료 범위·변경 파일

- 지정 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`의 `apps/web`에서 PACK-01~03·PROFILE-03/04의 **명시적 클라이언트/Mock** 구현. 기능 엑셀 해당 행과 P04/P05·D01/D03, 기술 PDF·계획 1단계·API 대조·현재 API/shared·KEMI 디자인을 확인했다. 상위 독립 앱은 수정하지 않았다.
- 여러 독립 상품의 초안/공개 저장·조건 조회·수정·비공개와 명시적 대표 단일 지정, 별도 서비스 공개/비공개를 구현했다. 공개 후보는 조건 누락·숫자·상업 광고 활용을 검사한다. 미완성 저장을 허용하고 상품 저장으로 대표/서비스를 자동 지정하지 않는다. 패키지는 협의 출발점이며 옵션 구매를 추가하지 않았다.
- D01은 UNKNOWN/READY/MISSING 모의 결과만 사용한다. 실제 필수 프로필을 임의로 정하지 않는다. P04 공개 대표가 필요하고 작업물은 필수가 아니다. 공개 서비스의 대표 비공개는 다른 대표 지정 또는 서비스 명시적 비공개를 먼저 안내한다. 마지막 상품과 서비스 자동 연동 D03은 미확정으로 유지한다.
- 계정별 Query·모듈 메모리·revision 명령으로 저장/충돌/지연 응답을 처리한다. 오류 입력 보존·명시적 최신 조회·중복 제출 차단·쓰기 자동 재시도 없음·epoch 확인을 유지한다. 최신 조회 실패도 기존 폼을 보존한다. 기존 프로필의 Mock 상태 표시와 일치시켰다.
- 신규: `apps/web/src/features/packages/PackagesPage.tsx`, `src/mocks/{studio-model,studio-api,studio-handlers}.ts`, `src/mocks/{StudioMock,PackageEditorMock}.tsx`, `test/studio-packages.test.ts`, `e2e/studio-packages.spec.ts`, `docs/frontend-studio-1d.md`, `qa/frontend-1d/{README.md,capture.cjs,production-smoke.cjs,production-results.json,package-{editor,list}-{390,1280}.png}`.
- 연결 수정: `src/app/{App.tsx,layouts/Shell.tsx}`, `src/mocks/{browser,profile-handlers}.ts`; Web CI의 기존 절차를 유지하고 stacked base `feat/frontend-1c-profiles`만 허용했다. API/shared·DB·의존성/lockfile·브랜드 원본/토큰 변경 없음.

### 로컬 검증과 검토

- `npm run test:web`: **82/82** (기존 70 + 후보 모델 12). 여러 상품·빈 초안·숫자/상업 조건·대표 단일성·미공개 차단·D01·수동 비공개·모의 계약 참조 불변을 확인했다.
- `npm run build:web` (타입·기존 ESLint 포함), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 11개 타입 역할·16개 대비·6개 재생성 유지.
- 패키지 전용 Edge 데스크톱/모바일 E2E **18/18, 종료 코드 0**. 로그인→초안/다중 상품→대표→모의 공개→가격 변경→비공개→프로필 상태 일치, 오류 401/403/409/500/network/malformed 입력 보존·재시도, revision 충돌·권한·지연/중복/로그아웃·320/390/600/768/1024/1280px 넘침 확인.
- 운영 빌드에 AUTH_API/MOCK 플래그를 켜도 Mock 코드/엔드포인트/worker 제외. 독립 모의 HTTP 인증 smoke **3개 통과, 페이지 오류 0**: 산출물 제외·CREATOR 준비 안내·CLIENT 차단·미정의 기능 쓰기/Mock 요청 없음. 실제 API 검증이 아니다.
- 390/1280px 편집/목록 캡처 4개 생성, 모바일 편집·데스크톱 목록을 시각 확인했다. 큰 화면/작은 화면 가로 넘침은 브라우저로 확인했다. 스크린리더·브라우저 메뉴 200% 확대·다른 브라우저는 미검증.
- 명세·코드 품질·보안 축의 자체 검토와 대표 비밀값 패턴 검사를 수행했다. UI 가드와 별개로 Mock 계정/역할·버전·늦은 응답을 실행 검증했다. 실제 서버 권한/원자성·다중 탭 경쟁 검증을 대체하지 않는다.
- 중간 실패: 기존 lint 라벨/선언 규칙·unknown JSX 타입을 수정하고 빌드 재통과. D01 오류가 공통 문구로 숨겨져 화면 사전 검사를 추가했다. 의뢰인 로그인 완료 전 이동하는 신규 E2E 경쟁을 수정했다. 초기 겹친 별도 러너의 trace ENOENT와 1회 초기 탐색 타임아웃 뒤 전용 검사를 단독 실행해 18/18을 확인했다. 검사 완화/자동 재시도 추가 없음.
- 기존 전체 110개 회귀 검사는 공용 shared 빌드와 실행이 겹쳤고 프로필 성공 문구 검사 실패가 발생했다. trace에서 중간 페이지 재로드·refresh/me/프로필 재조회가 확인됐다. 이후 아래 1-D-B에서 소스/빌드 변경 없이 단독 전체 **124/124**를 통과해 해소했다. 최초 실패와 최종 통과를 구분한다.

### 남은 일·Git 전달

- 실제 API·DB·권한·서비스 공개/탐색/신규 활동·계약 보존 미검증. 7개 기능의 API 정의가 없어서 가상 `/__mock__/studio`로만 동작한다. 모의 계약 참조는 별도 테스트 복사본이며 실제 계약/제안 보존 구현이 아니다. 기존 API `.env`/실행 서버도 없다. D01/D03·기존 인증/외부 제공자 경계는 유지한다.
- 이 묶음 전달 시 작업물 PORT-01/02와 최종 통합은 미완료였으며, 이후 결과는 아래 1-D-B에 기록한다. **1단계 전체 완료는 아니다.** 다음 외부 작업·병합/자동 병합/배포는 실행하지 않는다.
- 기존 1-D 브랜치/PR 없음 확인 후 열린 1-C Draft #37의 `ff71bab`에서 `feat/frontend-1d-packages`를 생성했다. 기능 커밋·푸시·Draft PR 링크와 원격 CI는 생성 후 기록한다. 로컬 결과를 원격 CI 통과로 표시하지 않는다.

## 1-D-B 작업물 관리 및 1-D 통합 (2026-10-24)

### 완료 범위·변경 파일

- **1-D의 7개 기능 클라이언트/명시적 Mock 범위 완료:** PACK-01~03·PROFILE-03/04에 더해 PORT-01/02 작업물 등록·초안/공개 후보 저장·수정·비공개·삭제를 연결했다. 실제 API/shared에 동작 계약이 없어 전체를 개발 전용으로 유지하며 운영은 계약 준비 안내를 보여 준다.
- 작업물의 제목·영상·설명·본인 역할·스타일/유형·자작 샘플/외부 고객/플랫폼 작업·출처·권한·고객 동의를 편집한다. 자작 샘플에 거래 이력/후기를 요구하지 않는다. 고객/플랫폼 작업은 동의 없이 공개 후보로 저장되지 않으며 거래물을 자동 가져오지 않는다. 서비스와 작업물이 모두 공개일 때만 모의 노출 목록에 표시한다.
- **파일 선택→로컬 재생 미리보기→명시적 Mock 업로드 완료→작업물 저장**을 분리했다. MIME/0바이트/50MiB 임시 보호·재생 준비 실패를 검사하고 blob URL을 변경/취소/화면 종료 때 해제한다. 파일 bytes는 전송하지 않으며 메타데이터만 탭 메모리에 저장한다. 편집 재진입은 메타데이터만 표시하고 재생하려면 파일 재선택을 안내한다. 실제 업로드·재생 제공자·파일 저장 완료가 아니다.
- 외부 URL은 자격 정보 없는 https 형식의 초안만 허용한다. D02 허용 제공자·공개/재생 정책을 임의 확정하지 않아 URL 공개·임베드·외부 요청은 미연결이다. D21 스타일/유형은 임시 자유 입력으로 표시하고 본인 역할은 기존 shared 선택지를 쓴다.
- 삭제 대상·영향 모달, 취소/Escape·처리 중·실패/명시적 재시도·포커스 복귀를 제공한다. 성공 시 내 목록과 모의 공개 후보에서 제외한다. 별도 복사한 **모의 제출 메타데이터 참조**는 수정·비공개·삭제 뒤에도 유지한다. 실제 제출 파일 bytes·계약 증빙 보존 방식은 D02 미결정이다.
- 신규 소스: `apps/web/src/features/portfolio/PortfolioPage.tsx`, `src/mocks/{portfolio-model.ts,WorkEditorMock.tsx,PortfolioManagerMock.tsx}`, `src/shared/files/{FileUpload.tsx,local-preview.ts}`.
- 신규 검사·QA: `apps/web/test/studio-portfolio.test.ts`, `e2e/{studio-helpers.ts,studio-portfolio.spec.ts,fixtures/README.md,fixtures/local-preview.webm}`, `qa/frontend-1d/{capture-portfolio.cjs,create-video-fixture.cjs,portfolio-{editor,delete}-{390,1280}.png}`. 1,349바이트 무음 녹색 영상은 자체 생성 테스트 fixture이며 출처·SHA·재생성 방법을 기록했다. 외부/사용자 영상과 불필요한 대형 산출물을 포함하지 않는다.
- 연결 수정: `src/app/{App.tsx,layouts/Shell.tsx}`, `src/mocks/{StudioMock.tsx,studio-model.ts}`, `.github/workflows/web-ci.yml`의 이번 stacked base 허용, `docs/frontend-studio-1d.md`, 이 진행 기록, `qa/frontend-1d/{README.md,production-smoke.cjs,production-results.json}`. API/shared·DB·의존성/lockfile·브랜드 원본·토큰·기존 검사 규칙/명령은 변경하지 않았다.

### 최종 로컬 검증·통합 결과

- `npm run test:web`: **94/94** (기존 70 + 패키지 12 + 작업물 12). 공개/초안·역할/권한/동의·URL/파일 보호·대표/서비스 조건·상품/작업물 변경 후 별도 모의 참조 보존을 검사했다.
- `npm run build:web`의 타입·ESLint·운영 빌드, `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 11개 타입 역할·16개 대비·6개 재생성 결과 유지. 운영 검사 빌드는 AUTH_API/MOCK 플래그를 모두 켜서 생성했다.
- 작업물 전용 Edge 데스크톱/모바일 **14/14, 종료 코드 0** 이후 최종 전체 **124/124, 종료 코드 0**. 최종은 기존 인증/프로필 92 + 패키지 18 + 작업물/통합 14개이며 검사 중 소스 편집·shared 빌드·중복 러너 없이 단독 실행했다. 이전 shared 재빌드 중 페이지 재로드로 실패한 프로필 두 항목도 최종 통과했다. 정식 CI의 Chromium·재시도 0·타임아웃·검사 명령을 바꾸지 않았다.
- **1-D 통합 Mock 흐름:** 로그인→프로필 저장(자동 공개 안 됨)→패키지 공개 저장→명시적 대표 지정→D01 모의 충족→서비스 공개→개인 샘플 파일 선택/실제 로컬 재생/모의 완료→공개 후보 저장→서비스 비공개→노출 제외·패키지 상태 재조회. 포트폴리오 없이 서비스 공개가 가능함도 패키지 흐름에서 확인했다. 실제 탐색·직접 의뢰/제안·기존 거래 API 흐름을 검증한 것은 아니다.
- 파일 형식/재생 실패·URL 외부 요청 없음·blob 해제·삭제 실패/재시도·취소/Escape/포커스 복귀·공개 목록 제외·제출 참조 보존, 조회 실패에도 입력 유지, 320/390/600/768/1024/1280px 가로 넘침을 확인했다.
- 운영 빌드+독립 모의 HTTP smoke **5개 통과, 페이지 오류 0**. 산출물의 Mock/worker/전용 경로 제외, CREATOR의 두 준비 화면·CLIENT의 두 권한 차단, 미정의 기능 쓰기/Mock 요청/worker 없음. HTTP 인증 fixture이며 실제 API 검증이 아니다.
- 작업물 편집/삭제 모달 390/1280px 캡처 4개를 생성했고 데스크톱 편집·모바일 모달을 시각 검토했다. 모달 캡처는 애니메이션 완료 뒤 촬영했다. 패키지 캡처/반응형과 KEMI 색상·카드·여백을 유지한다. 스크린리더·브라우저 메뉴 200% 확대·다른 브라우저는 미검증.
- 명세·코드 품질·보안·React 축의 최종 자체 검토: 개발 import 제외·본인 역할/계정·revision·epoch/캐시·로컬 파일 수명·원격 URL 요청 금지·오류·별도 참조를 코드와 실행 결과로 대조했다. 새 외부 의존성·비밀값·HTML 직접 삽입 없음. 실제 권한/DB·다중 탭 원자성·제공자 검증은 남는다.
- 중간 실패를 숨기지 않는다: RHF watch의 기존 React lint 경고를 useWatch로 수정했다. 위험 URL 테스트 표현·전역 참조 lint와 복수 오류 선택자를 수정했다. 브라우저 즉석 합성 영상의 빈 프레임/부정확한 MIME으로 초기 전용 검사 실패가 있어 native canplay로 확인한 유효 fixture로 바꿨다(재생성 시 디코딩 실패면 교체 금지). 두 번째 수정 중 러너는 중단했고, 이후 전용 14/14·최종 124/124를 통과했다. 공개/파일 검사를 완화하거나 자동 재시도를 추가하지 않았다.

### 남은 일·다음 작업 하나

- **실제 API·DB·파일 저장·외부 제공자 연동은 미검증/미연결.** 7개 동작의 API/버전/권한·서비스/대표 원자성·실제 공개 노출/신규 활동 차단·기존 거래/제출 당시 파일 보존 계약이 필요하다. Mock 단일 탭·로컬 영상·복사 메타데이터 결과를 실서버 보장으로 표시하지 않는다.
- D01 필수 프로필, D02 파일/외부 URL 및 삭제 후 보존, D03 대표/마지막 상품 자동 연동, D21 분류는 미결정으로 남는다. 현재 파일/문자/숫자 보호 한도는 Mock 후보 기준이며 팀 정책이 아니다. 기존 카카오 미착수·이메일 가입 충돌/D05·Google 실동의·프로필 누락 선택정보 저장 경계도 유지한다.
- **1-D 클라이언트/Mock 묶음의 통합 검증까지 완료이며 1단계 전체 완료는 아니다.** 다음 작업 하나: **1-D 누락 API와 공개·파일 정책 계약 조율**. 자동 착수하지 않는다. 병합·자동 병합 설정·배포 없음.

### Git 전달 상태

- 패키지·서비스: 모델/검사 [91c9620](https://github.com/Jubileekim/KEMI/commit/91c9620), UI/Mock/E2E/QA [566447a](https://github.com/Jubileekim/KEMI/commit/566447a)를 `feat/frontend-1d-packages`로 푸시. [Draft PR #38](https://github.com/Jubileekim/KEMI/pull/38), base `feat/frontend-1c-profiles`, 이 채팅 연결·원격/로컬 SHA 일치 확인. PR #37이 선행이다.
- 작업물: 기존 대응 원격 브랜치/PR 없음 확인 후 `566447a`에서 `feat/frontend-1d-portfolio` 생성. 모델·화면/검사/문서 커밋을 나눠 푸시하고 base를 `feat/frontend-1d-packages`로 둔 Draft PR로 전달한다. 링크와 최신 원격 상태는 생성 후 아래에 기록한다. 선행 PR 병합 후 base 재지정 검토가 필요하다.
- **원격 Web CI #38:** 기능 SHA `566447af0d543e2c05ef5b9394af5462b967979e`의 [run 87](https://github.com/Jubileekim/KEMI/actions/runs/39978492856) 첫 시도는 **브라우저 의존성 다운로드 중 10분 제한으로 cancelled**, E2E/report는 skipped. job 로그에서 Ubuntu azure 미러의 font/xserver 다운로드 지연을 확인했다. npm ci·형식·단위·타입/린트/빌드는 success다. 동일 검사를 한 번 재실행했으나 두 번째 시도도 의존성 다운로드/Chromium 설치가 10분 제한에 도달해 cancelled·E2E/report skipped로 끝났다. 두 job의 실제 로그를 확인했으며 추가 자동 재시도는 하지 않는다. 로컬 124/124와 별개이며 원격 통과로 기록하지 않는다. CI 명령·러너/타임아웃을 완화하지 않았다.
- 기존 GitHub 연결의 Vercel 상태는 별도 **failure**로 확인했다(작성자 프로젝트 초대/접근 화면). Web CI와 별개이며 빌드 실패/배포 성공 증거가 아니다. 권한/배포 설정을 변경하지 않았다.

- 작업물 모델/단위 [b8fd618](https://github.com/Jubileekim/KEMI/commit/b8fd618), 화면·Mock·검사·QA·기록 [01e7213](https://github.com/Jubileekim/KEMI/commit/01e7213)를 푸시했다. [Draft PR #39](https://github.com/Jubileekim/KEMI/pull/39), base `feat/frontend-1d-packages`, 이 채팅 연결 완료. 원격/로컬 SHA 일치와 미커밋 변경 없음(이 종료 기록 갱신 전)을 확인했다.
- **원격 Web CI #39:** 기능 SHA `01e72134ed500725e4109e8ded09eaf926072254`의 [run 88](https://github.com/Jubileekim/KEMI/actions/runs/39982279331)은 확인 시 npm ci·형식·단위·타입/린트/빌드 **success**, Chromium 설치 **in_progress**, 브라우저 E2E/report **pending**이다. 로컬 94/124/운영5 통과와 구분한다. 원격 E2E 최종 결과는 미검증이므로 Draft를 유지한다. #38의 반복 설치 시간 제한과 같은 환경 구간이다.
- 마지막 링크·CI 경계 갱신은 **이 문서만 바꾸는 별도 전달 커밋**으로 푸시한다. 소스·테스트는 검증한 `01e7213`와 같고 형식/공백을 다시 확인한다. 동일 PR의 `cancel-in-progress` 설정 때문에 새 SHA 푸시 시 기능 SHA의 실행이 교체될 수 있다. 최신 문서 SHA의 Web CI는 [PR #39 Checks](https://github.com/Jubileekim/KEMI/pull/39/checks)에서 별도로 확인하며 기능 SHA의 부분 성공으로 최신 CI를 통과 처리하지 않는다. 실제 API CI·DB·제공자 검증 성공을 뜻하지 않는다.
- 두 PR은 모두 Draft·미병합이며 자동 병합 설정·배포·다음 범위 착수 없음. 작업 소유 5180 개발/4184 preview 서버를 종료했고 해당 포트의 listener 없음도 확인했다.

- **Vercel 추가 경계:** 최종 문서 SHA의 GitHub Vercel 상태도 failure이며 대상은 기존 프로젝트의 실행 링크다. #38의 초대 화면과 같은 실패 원인이라고 단정하지 않는다. 연결된 Vercel 도구로 해당 팀/프로젝트·SHA를 읽기 전용 조회했으나 팀 범위 권한 없음 **403**으로 원인 로그를 확인하지 못했다. 이 결과는 배포 원인 미검증이며 Web CI/로컬 빌드 실패를 뜻하지 않는다. 팀 접근 승인·권한/자동 배포 설정 변경·새 배포·재배포는 이번 범위에서 실행하지 않았다.

## 2-A 캠페인 작성·임시 저장·공개 (2026-10-24)

### 구현과 변경 파일

- **CAMP-01/02의 클라이언트·명시적 Mock 범위.** `/campaigns/new`, `/campaigns/:campaignId/edit`에 제목·제품/서비스·목적·작업 범위·예산·선택 참고 텍스트, 불완전 비공개 초안 저장·본인 목록·재편집·명시적 공개 확인을 연결했다. 개인 의뢰인에게 브랜드 프로필을 요구하지 않는다. 공개 후 편집/삭제·AI·탐색/상세·제안·마감 상태 전이는 이번 범위 밖이다.
- P06의 3/7/14일·기본7일을 적용한다. 저장 시각 대신 모의 공개 처리 시각을 사용하고 같은 시각에 마감, 한국 시간으로 표시한다. 동일 ID의 중복 공개는 내용·최초 공개/마감 시각을 유지한다. 응답 유실은 성공으로 표시하지 않고 최신 값 확인→공개 결과 확인으로 조회한다.
- 엑셀 CAMP-01/02·P06·D04, 기술 PDF, 계획 2단계, 기능표 해당 행과 로컬 API/shared를 대조했다. 기존 POST는 즉시 OPEN이며 초안/별도 공개/제품·작업 범위·참고 자료/공개 기준 일수 계약이 없다. `/__mock__/campaigns`로 분리하고 운영은 계약 준비 안내만 표시한다. D04 필수값·4,000자·양의 안전한 정수 예산은 **Mock 후보/입력 보호 기준**으로 표시하며 팀 정책을 확정하지 않는다.
- 폼·진입: `apps/web/src/features/campaigns/CampaignEditor.tsx`, `src/app/{App.tsx,layouts/Shell.tsx}`. 개발 전용 모델/통신/handler/화면: `src/mocks/{campaign-model.ts,campaign-api.ts,campaign-handlers.ts,CampaignMock.tsx,CampaignFormMock.tsx,browser.ts}`.
- 검사·근거: `apps/web/test/campaigns.test.ts`, `apps/web/e2e/campaigns.spec.ts`, `docs/frontend-campaigns-2a.md`, 이 진행 기록, `qa/frontend-2a/{README.md,capture.cjs,production-smoke.cjs,production-results.json,editor-390.png,editor-1280.png,confirm-390.png,confirm-1280.png}`. `.github/workflows/web-ci.yml`에는 stacked base `feat/frontend-1d-portfolio`만 추가했다. 기존 검사 명령·재시도·시간 제한을 유지한다.
- API/shared·DB·의존성/lockfile·원본 엑셀/PDF·계획/기능표·브랜드/디자인 토큰은 변경하지 않았다. 탭 내 메모리 저장이며 전체 새로고침하면 초기화된다. 파일/외부 URL 요청·영구 저장은 미연결이다.

### 로컬 검증과 검토

- `npm run test:web`: **104/104** (기존94 + 캠페인10). 빈 초안/재편집·노출 제외·브랜드 없이 공개·D04 후보 오류·3/7/14일/연말/월말/KST·공개 처리 시각·멱등 공개·역할/소유권/비활성·revision·입력 한도를 확인했다.
- `npm run build:web`(타입·기존 ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 토큰 검사 11개 타입 역할·16개 대비·6개 재생성 결과 유지. 운영 빌드는 AUTH_API/MOCK 플래그를 모두 켠 조건으로 생성했다.
- 전체 Edge 데스크톱/모바일 **146/146, 종료 코드0**. 기존124 + 캠페인22이며 6.0분 실행했다. 2-A 통합은 로그인→불완전 비공개 저장→본인 목록→재편집→누락 검사→공개 확인/취소/Escape/포커스 복귀→브랜드 없이 공개→한국 시간 마감→재조회다. 실패 입력 보존·응답 유실 후 결과 조회·중복 공개 시 내용/마감 유지·revision·비회원/크리에이터 차단·지연 로그아웃 쓰기/캐시 차단·임의 초안ID·외부 참고 URL 요청 없음·320/390/600/768/1024/1280px 넘침 없음도 확인했다. 정식 CI Chromium과 구분하며 로컬 임시 config로 Edge/5182만 지정, 소스·shared 빌드 변경 없이 단일 러너로 실행했다.
- 독립 운영 모의 HTTP smoke **5개 통과·페이지 오류0**: 운영 산출물의 캠페인 Mock/worker 제외, CLIENT의 작성/재편집 준비 안내와 CREATOR 권한 차단, 제품 API 요청·Mock 요청·worker 없음. 실제 서버/제공자 검증이 아니다.
- 390/1280px 편집·공개 확인창 캡처4개를 생성하고 모두 시각 확인했다. KEMI 로고·색상·버튼·카드·여백을 유지한다. 스크린리더/브라우저 메뉴 200% 확대/다른 브라우저는 미검증이다.
- 명세·코드·보안·React 자체 검토: DEV 지연 import·운영 제외, Bearer/본인/역할/ACTIVE와 요청 전후 epoch·지연 계정 변경, 캐시 키/취소·자동 재시도 없음·입력 보존, 외부 URL은 텍스트만, React 이스케이프, 의존성/비밀값 추가 없음 확인. 실제 보안/DB 원자성은 검증하지 않았다.
- 중간 실패: 중첩 삼항·E2E 반복문의 기존 lint 규칙 위반을 규칙 변경 없이 수정했다. 첫 캠페인 전용 실행은20/22로, 크리에이터 로그인 시 안전한 기본 복귀 동작을 잘못 예상한 두 검사가 실패했다. 기본 이동 후 캠페인 직접 진입 차단을 검사하도록 수정했으며 최종146/146에서 통과했다. 실패를 숨기거나 권한 가드·검사·재시도 기준을 완화하지 않았다.

### 남은 일·다음 작업 하나·Git 전달

- **실제 API·DB·공개 목록·외부 제공자 연동은 미연결/미검증.** 초안/재편집·멱등 공개·P06·필드/권한/버전 계약이 필요하다. 단일 탭 MSW 결과를 영구 저장·다중 탭·실서버 원자성 보장으로 표시하지 않는다. D04·파일/참고 자료 저장 정책은 미결정이다.
- 이번 2-A 통합 Mock 흐름만 검증하며 **2단계 전체 완료가 아니다.** 다음 작업 하나는 **2-A 초안·공개 API와 D04 입력 정책 계약 조율**이다. 다음 범위 자동 착수·병합·자동 병합 설정·명시적 배포/재배포는 하지 않는다.
- 기존 대응 브랜치/PR 없음·작업 트리 깨끗함을 확인하고 #39 최신 `ae65867`에서 `feat/frontend-2a-campaigns`를 만들었다. 모델/단위/계약 경계 [6a382b1](https://github.com/Jubileekim/KEMI/commit/6a382b1), 화면/Mock/검사/기록 [4566c1a](https://github.com/Jubileekim/KEMI/commit/4566c1a) 푸시 완료. [Draft PR #40](https://github.com/Jubileekim/KEMI/pull/40)을 이 채팅에 연결했다. base는 `feat/frontend-1d-portfolio`이며 #39가 선행이다. PR의 원격 head와 로컬 기능 SHA가 일치함을 확인했다. 선행 PR 병합 후 base 조정 검토가 필요하다.
- **원격 Web CI:** 기능 SHA `4566c1a25325f30a44c3dda117d8abe2928d4b79`의 [run91](https://github.com/Jubileekim/KEMI/actions/runs/40039317360)은 확인 시 checkout·Node 설정 success, npm ci in_progress, 형식/단위/빌드/Chromium/E2E pending이었다. 로컬104/146/운영5 결과와 별개이며 원격 최종 통과로 기록하지 않는다. 최종 링크·결과 기록은 문서만 바꾸는 별도 전달 커밋으로 푸시하므로 cancel-in-progress에 의해 실행이 교체될 수 있다. **최신 문서 SHA의 원격 CI 최종 결과는 미검증**이며 [PR #40 Checks](https://github.com/Jubileekim/KEMI/pull/40/checks)에서 확인한다. Draft를 유지하고 CI 설정/검사/시간 제한을 완화하거나 재실행하지 않는다.
- **기존 Vercel 연결 상태:** 기능 SHA의 상태가 failure이며 GitHub status 설명은 `Git author Dev-Yuncheol must have access to the project on Vercel to create deployments.`다. Web CI/로컬 빌드와 다른 접근 권한 문제이며 배포 성공 증거가 아니다. 초대·권한/배포 설정 변경·배포/재배포 명령은 실행하지 않았다. 푸시/PR로 발생한 연결 서비스 검사는 직접 실행한 배포와 구분한다.

## 2-B 선택 AI 분석·명시적 예산 반영 (2026-10-24)

### 구현·변경 파일

- **AI-01/02·P20의 클라이언트/명시적 Mock 범위.** 2-A 작성·초안 재편집 안에서 예산 없이도 제작 조건을 선택 분석하고, 항목·소계/합계·산정 이유·가정·누락 안내를 확인한다. 분석 생성은 예산을 바꾸지 않는다. 반영액을 확인·조정하고 명시 적용해야 예산 입력이 바뀌며 저장·공개는 별도다. 이후 수동 수정도 가능하다.
- 제작 조건/설명 변경·지연 응답은 이전 리포트 반영을 차단한다. 구조·항목 계산·합계·입력 일치 검사를 통과한 결과만 반영한다. 취소·권한·429·503·네트워크·형식 오류에도 수동 예산/공개가 가능하다. 화면 이탈/로그아웃 시 취소·epoch로 늦은 결과를 차단한다. 자동 재시도 없음.
- 마지막 명시 적용액·리포트 ID/입력/결과·고정 Mock 모델/프롬프트 버전을 모의 초안에 보존한다. 수동 변경 후에는 과거 기록임을 표시한다. 실제 계약 금액과 연결하지 않는다. 공고의 다른 필드·파일·참고 자료는 분석에 자동 전송하지 않으며 명시 입력한 설명만 보낸다.
- **API 재대조:** `api문서.txt`와 기존 기능표는 경로가 없지만 현재 코드에는 `POST /api/pricing/analyze`와 shared pricing 스키마가 있다. shared 입력/구조·단가/수량 제약을 재사용한다. 비용 범위·누락 전용 필드·실제 버전/근거·리포트 저장/공고 적용 계약은 부족하여 `/__mock__/pricing/analyze` 고정 예시로 분리했다. 실제 API 호출/제공자 연결 완료로 표시하지 않는다. D16 정책과 현재 서버의 사용자별 10회/시간 구현은 별개다.
- 모델·통신·handler·화면: `apps/web/src/mocks/{pricing-model.ts,pricing-api.ts,pricing-handlers.ts,PricingMock.tsx}`, 연결 `CampaignFormMock.tsx`, `campaign-model.ts`, `browser.ts`. 검사 `apps/web/test/pricing.test.ts`, `apps/web/e2e/pricing.spec.ts`. 근거/기록 `docs/frontend-pricing-2b.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-2b/{README.md,capture.cjs,production-smoke.cjs,production-results.json,editor-390.png,editor-1280.png}`.
- `.github/workflows/web-ci.yml`에는 선행 `feat/frontend-2a-campaigns` base만 추가했다. 검사 명령·재시도0·timeout 유지. API/shared·원본 엑셀/PDF·계획·의존성/lockfile·브랜드/토큰 변경 없음. 상위 독립 앱은 수정하지 않았다.

### 검증·검토

- `npm run test:web`: **109/109**(기존104+신규5). 요청 길이/허용 필드·구조·계산·범위/통화/출처/근거 오류·Mock 버전 구분·명시 적용액/초안/수동 수정 기록 검증.
- `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 운영 빌드는 AUTH_API/MOCK 플래그를 모두 켠 조건도 통과했다. 키트11개 타입·16개 대비·6개 재생성 검사 유지.
- 첫 전체 Edge 실행은 **169/170·exit1**, 이번 2-B는 **24/24** 통과. 기존 프로필 만료 후 재저장1건은 성공 문구 대기 실패였고 단독 재현은 데스크톱/모바일 **2/2** 통과했다. 실패 trace에서 두 번째 PATCH200 뒤 앱 재로딩/초기 인증·조회가 확인됐고 Vite 로그는 trace HTML 생성 시 page reload를 기록했다. 산출물을 저장소 밖 OS 임시 폴더로만 바꿔 직렬 재검증한 최종 전체는 **170/170·실패0·exit0·7.0분**이다. 동일 검사·두 프로젝트·workers2·timeout·재시도0을 유지했고 앱/API/shared 코드를 바꾸지 않았다. 2-B 통합 흐름은 선택 분석→예산 불변→반영액 조정/명시 적용→초안 저장/재편집→공개이며, 2단계 전체 통합 완료를 뜻하지 않는다.
- 독립 모의 HTTP 운영 smoke **5개 통과·페이지 오류0**. pricing/campaign Mock 엔드포인트·버전/시나리오·worker 운영 제외, CLIENT/CREATOR의 두 작성 경로·제품 API/Mock 호출/worker 없음을 확인했다. 실제 서버/DB 검증이 아니다.
- 390/1280px 분석·명시 적용 화면 캡처2개 생성·시각 확인. KEMI 로고/주요 색/버튼/카드/600·1024px 구간 유지. 스크린리더·실제 브라우저 메뉴200% 확대·다른 브라우저는 미검증.
- 명세/코드·React·보안 자체 검토: DEV lazy import 경계/운영 제외, Bearer·활성 의뢰인·epoch·요청 취소, 입력 최소화/외부 요청 없음·React 이스케이프·로컬 오류 문구·비밀값/의존성 추가 없음 확인. 실제 인증/권한/DB 보안의 증거가 아니다. Hook 구독은 공식 React Hook Form useWatch 안내를 확인했다.
- 중간 실패: 초기 form.watch React Compiler 경고·이름 shadow·리스트 index key·E2E 반복문 lint 위반은 기존 규칙을 바꾸지 않고 수정했다. 초기 분석 전용 실행17/18은 전체 실행을 겹쳐 시작해 trace 파일 ENOENT/timeout이 발생했다. 실행 중첩은 작업 실수로 기록하며 통과로 계산하지 않는다. 전체 실행의 기존 프로필 만료 재저장 실패도 따로 재현/기록한다.

### 남은 일·다음 작업 하나

- **실제 API·OpenAI·DB·영구 리포트/적용 기록은 미연결/미검증.** D16 입력/출력·비용 범위·한도·저장·재분석·버전/근거 계약과 실제 공고 연결이 남는다. UI의 금액·문자 제한은 Mock 보호 후보이며 정책 확정이 아니다. 단일 탭 메모리/고정150,000원 예시를 실제 분석·시장 평균으로 표시하지 않는다.
- 다음 작업 하나: **2-B D16 리포트·버전·저장/예산 적용 API 계약 조율**. 자동 착수하지 않는다. 공개 후 수정/삭제·탐색/상세·제안/협의와 2단계 전체는 미완료다.

### Git 전달 상태

- 2-B 기존 원격 브랜치·PR 없음 확인. 선행 #40의 원격/로컬 일치 SHA `35c9357`에서 `feat/frontend-2b-ai-budget` 생성. 모델·응답/적용 기록·단위 검사 커밋 [747a2b8](https://github.com/Jubileekim/KEMI/commit/747a2b8). 화면/통신/검사/QA/기록 [260d44f](https://github.com/Jubileekim/KEMI/commit/260d44f)와 함께 푸시했다. [Draft PR #41](https://github.com/Jubileekim/KEMI/pull/41)을 생성·이 채팅에 연결했다. 기능 SHA `260d44f94deab4e2c6bccc2c0bcc0820dbfd0b11`과 PR head 일치를 확인했다.
- base는 `feat/frontend-2a-campaigns`(#40 선행). 선행 PR 병합 후 base 조정 검토 필요. PR 병합·자동 병합 설정·명시적 배포/재배포·다음 범위 착수 없음. 푸시/PR로 생기는 기존 연결 서비스 검사는 명시적 배포 실행과 구분한다.

- **원격 Web CI 기능 SHA:** [run93](https://github.com/Jubileekim/KEMI/actions/runs/40041952608)에서 npm ci·형식·단위·타입/린트/빌드·Chromium 설치는 success, 확인 시 브라우저 E2E는 in_progress·report pending이다. 로컬170/170과 원격 결과는 별개다. 최신 결과 기록은 문서/QA 안내만 바꾸는 전달 커밋으로 푸시하며 cancel-in-progress에 따라 기존 실행이 교체될 수 있다. **최신 문서 SHA의 최종 CI는 미검증**이고 [PR #41 Checks](https://github.com/Jubileekim/KEMI/pull/41/checks)에서 별도 확인한다. 검사/재시도/timeout을 완화하거나 원격 재실행하지 않았다.
- **Vercel 연결 상태:** 기능 SHA의 GitHub status는 failure이고 target은 기존 팀 초대 링크다. 이번에는 status 결과만 확인했으며 새 원인 로그는 미검증이다. Web CI·로컬 빌드 실패 또는 배포 성공으로 해석하지 않는다. 초대/권한/배포 설정 변경·배포/재배포 명령은 실행하지 않았다.
- **종료 경계:** 2-B 클라이언트·명시적 Mock의 통합 검증까지이며 2단계 전체 완료가 아니다. 최종 기록과 QA 안내는 별도 전달 커밋으로 푸시한다. 다음 작업 자동 착수·병합·자동 병합·배포 없음.

## 2-C 모집 목록·검색·상세·마감 (2026-10-24)

### 구현·변경 파일

- **CAMP-03/05·P06/P07의 클라이언트·명시적 Mock 범위.** 공개 목록의 검색어·제품 문자열·예산·모집 상태·최신/마감임박/예산 정렬·페이지를 URL로 보관한다. 조건 적용 시 페이지1, 상세 왕복·뒤로 가기·새로고침 유지, 오류 URL·빈 결과·페이지 범위 밖 복귀를 제공한다. 기존 작성→공개 Mock 저장소와 목록/상세를 연결한다.
- 공개 응답은 제목·제품·목적·범위·예산·기간·시각·모집 상태의 허용 필드만 투영한다. 비공개 초안·참고 자료·AI 리포트/입력·비공개 첨부·주소는 공개하지 않는다. 제품 분야는 목적 enum으로 치환하지 않는다.
- 본인 활성 의뢰인만 확인창을 거쳐 모의 수동 마감한다. Bearer/소유자/활성 역할·revision·epoch 재검사, 처리 중 중복 행동 차단, 자동 재시도 없음. 응답 유실/409는 명시 재조회, 중복 마감·재공개로 내용/마감 재설정 없음. 마감은 공고 상태만 바꾸며 기존 협의·서명·계약을 취소하는 동작을 추가하지 않았다.
- 3/7/14일·공개 기준 한국 시간은 기존 모델을 유지한다. 화면은 기한 도달을 유효 마감으로 판정한다. 페이지/필터 밖 공고도 포함한 다음 기한을 받아 목록 수를 재조회한다. 작성/본인 목록에도 유효 마감을 표시한다. 실제 제출은 아직 연결 준비 중이고 마감 시 신규 제안 종료로 표시한다.
- **계약 가정:** 실서버 목록은 OPEN·마감 전만, 마감 상세는 작성자/지원자만 접근한다. 제품 분야·상태 필터·자동 상태 전이 계약이 부족하다. Mock은 제품 문자열 부분 검색·페이지6개·예시9개, 마감 상태 필터 확인을 위한 마감 공고 공개 투영을 사용한다. 분류 체계·마감 공개 범위를 제품 정책으로 확정하지 않았다. 실제 `/api/projects`는 호출하지 않는다. D04는 유지한다.
- 화면/경로: `apps/web/src/features/campaigns/CampaignBrowsePage.tsx`, `src/app/App.tsx`. Mock: `src/mocks/{discovery-model.ts,discovery-api.ts,discovery-ui.ts,DiscoveryMock.tsx,DiscoveryListMock.tsx,DiscoveryDetailMock.tsx}`, `campaign-{model,handlers}.ts`, `Campaign{Mock,FormMock}.tsx`.
- 검사/근거: `apps/web/test/discovery.test.ts`, `apps/web/e2e/discovery.spec.ts`, `docs/frontend-discovery-2c.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-2c/{README.md,playwright.edge.config.ts,capture.cjs,production-smoke.cjs,production-results.json,list-390.png,list-1280.png,detail-390.png,detail-1280.png}`. `.github/workflows/web-ci.yml`은 선행 `feat/frontend-2b-ai-budget` base만 추가한다.
- 기존 Workspaces·API/shared·CI 명령/검사/재시도/timeout·의존성/lockfile·브랜드/토큰·원본 엑셀/PDF·계획은 유지했다. 상위 독립 앱은 수정하지 않았다.

### 검증·검토

- `npm run test:web`: **117/117**(기존109+신규8). 투영·비공개 제외·잘못된 공개 응답·필터/안정 정렬/페이지·검색 입력·기한 정각·활성 본인/revision·멱등/재공개 차단 검증.
- `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true` 조건의 `npm run build:web`(타입·ESLint·운영 빌드): 통과. `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 최종 문서 반영 후 형식/diff도 재확인한다.
- **전체 회귀: 198/198·실패0·exit0·6.9분.** 예시 모집일 보정 전 실행이며 보정 후 영향받는 **2-C 28/28·exit0·1.2분**도 재검증 통과했다. 전체198개는 보정 후 다시 실행하지 않았으며 다른 기능이 예시 목록 데이터를 사용하지 않음을 확인했다. 로컬 Edge 두 프로젝트·workers2·재시도0·기존 timeout, 별도5184 서버·OS 임시 출력으로 실행한다. 원격 CI와 구분한다.
- 운영 산출물+독립 HTTP 인증 fixture **7개 통과·페이지 오류0**: Mock 코드/endpoint/scenario/worker 제외, 비회원/의뢰인/크리에이터의 목록/상세 준비 안내, 제품 API/Mock 요청·worker 없음. 실서버 인증/API 검증이 아니다.
- 390/1280px 목록/상세 캡처4개 생성·시각 확인. KEMI 로고·주요 색·11개 타이포 역할·카드24px·600/1024px 구간 유지. 실제 브라우저 메뉴200% 확대·스크린리더·다른 브라우저는 미검증이다.
- 커밋 전 `fresh-context-review`·`security-review` 관점 자체 검토: 원본 CAMP-03/05와 계약 경계, DEV lazy/운영 제외, 허용 필드 투영·React 이스케이프, Bearer/활성 본인·epoch/캐시, 무단/지연 요청 검사를 확인했다. 실제 서버 보안 검토/인증·권한/DB 보장으로 표시하지 않는다. 새 의존성·비밀값·외부 링크 방문/파일 업로드 없음. 사람 검토가 필요한 계약 가정 때문에 Draft로 전달한다.
- **중간 실패·수정:** 최초 단위112/115의3건은 strictObject.pick이 비공개 필드를 거부하던 투영 실수였다. 투영 단계에서만 제거하고 응답 스키마는 strict 유지 후 수정 검증했다. 초기 lint/형식 문제는 기존 규칙 변경 없이 수정했다. 최초 2-C 브라우저는 개별22개 통과·2개 실패(상세 재조회 중 disabled 버튼에 키보드 focus를 시도한 검사 대기 누락)였다. 활성 대기를 추가한 통합 재검증2/2·exit0. 제한 환경의 종료 대기 때문에 첫 실행은 최종 완료 요약 없이 중단했으며 통과 실행으로 계산하지 않는다. 전용 Vite PID/명령을 확인해 정리했다.
- 첫 전체 실행은 자체 검토에서 목록 밖 공고 마감 시 결과 수 갱신 누락을 발견해 중단했다. 다음 기한 응답/재조회와 목록/마감 필터 검사2개(두 프로젝트4개)를 추가했다. 중단 실행을 최종 통과로 계산하지 않고 완전한 전체 실행을 다시 검증한다. 검사/재시도/timeout을 완화하지 않았다.
- 추가한 타이머 검사2건은 최초 실행에서 실패했다. trace의 discovery 요청은 최초1회뿐이었고, 설치된 Playwright 타입 문서의 "install the clock before navigating" 안내와 달리 페이지 로드 뒤 Clock을 설치하여 이미 등록된 timeout이 제어되지 않았다. Clock 설치를 탐색 전으로 옮긴 목록/마감 필터 두 프로젝트4/4·exit0 재검증이 통과했다. 이 실패가 나온 전체 실행도 중단/미완료로 남기고 최종 전체 실행을 다시 진행한다.

- 최종 명세 대조에서 예시 공고의 공개일/모집일 간격을 P06의 3/7/14일과 정확히 맞췄다. 모든 예시가 과거/현재 공개이며 기간 차이가 일치하는 단위 검사를 추가해117/117 통과했다. 동작 코드는 바꾸지 않았으며 보정 후 관련 2-C28개·운영7개를 재검증하고 캡처4개를 다시 생성했다. 제한 환경의 지연 로그아웃 검사는 모달이 배경 클릭을 막으므로 실제 session controller의 logout 호출로 계정 변경을 발생시킨다.

### 남은 일·다음 작업 하나·Git 전달

- **실제 API·DB·자동 마감 스케줄러·신규 제출 서버 거절·기존 거래/서명 유지·관련자 알림은 미연결/미검증.** 단일 탭 메모리/클라이언트 시각을 실서버 원자성·영구 저장·다중 탭·알림 증거로 표시하지 않는다. CAMP-04/06·제안/협의·2단계 전체 통합은 범위 밖이다.
- 다음 작업 하나: **2-C 제품 분야·상태 필터·마감 후 공개 권한·자동 마감/알림 API 계약 조율**. 자동 착수하지 않는다. PR 병합·자동 병합 설정·명시적 배포/재배포 없음.
- 기존 2-C 브랜치/PR 없음과 깨끗한 작업 트리, 선행 #41의 원격/로컬 일치 `0b76df2`를 확인한 뒤 `feat/frontend-2c-discovery`에서 작업했다. 모델/단위/근거 커밋은 푸시 완료한 [8811f16](https://github.com/Jubileekim/KEMI/commit/8811f16). 화면·통신·검사·QA/기록 [204e86e](https://github.com/Jubileekim/KEMI/commit/204e86e)도 푸시 완료했다. [Draft PR #42](https://github.com/Jubileekim/KEMI/pull/42)를 생성하고 이 채팅에 연결했다. 기능 SHA `204e86e25f7e89dfafd020902d818b597b8c1cdd`와 PR head 일치, Draft/open·미병합·충돌 없음(mergeable=true)을 확인했다. base는 `feat/frontend-2b-ai-budget`이며 선행 #41 병합 뒤 base 조정 검토가 필요하다.
- **원격 Web CI:** 기능 SHA의 [run40062812220](https://github.com/Jubileekim/KEMI/actions/runs/40062812220) / web job120779748327은 확인 시 `in_progress`, 최종 결론 없음이었다. 로컬117/28/198/운영7과 별개다. 이 최종 Git/CI 기록은 문서 전용 전달 커밋으로 푸시하므로 cancel-in-progress에 따라 실행이 교체될 수 있다. **최신 문서 SHA의 최종 CI는 미검증**이며 [PR #42 Checks](https://github.com/Jubileekim/KEMI/pull/42/checks)에서 확인한다. 검사/재시도/timeout 완화나 수동 CI 재실행은 하지 않았다.
- **기존 Vercel 연결 검사:** 기능 SHA의 status는 failure이며 설명은 `Git author Dev-Yuncheol must have access to the project on Vercel to create deployments.`다. Web CI/로컬 검사 실패와 다른 접근 권한 문제다. 초대·권한·배포 설정 변경·배포/재배포 명령은 실행하지 않았다. Git 푸시/PR에 따라 생긴 기존 연결 서비스 검사와 명시적 배포는 구분한다.
- **종료 경계:** 2-C 클라이언트·명시적 Mock 통합/관련 재검증 완료. 2단계 전체 완료가 아니다. 다음 작업 자동 착수·병합·자동 병합 설정·배포 없음. 사용한 전용 QA 개발 서버/preview는 정리했다. 문서 전달 커밋까지 푸시 후 PR head/작업 트리를 최종 확인한다.

## 2-D 제안 제출·후보 조회·협의 진입·기본 채팅 (2026-10-24)

### 완료 범위·변경 파일

- **APPLY-01~03·CAMP-06·CHAT-02/03/05의 공개 제안 경로와 CHAT-01 텍스트 기본 채팅을 명시적 Mock으로 연결.** 공개 서비스/본인 공개 작업물의 제안, 제출 확인·견적/기간/작업물 제목 사본, 본인 후보 비교, 협의 요청, 당사자별 방 생성·재사용, 거절/철회/무선정 종료·사유/기록 보존을 구현했다. 협의만으로 선정/계약하거나 타후보를 종료하지 않는다.
- 일반 채팅에48시간 만료를 적용하지 않고 모집 마감 뒤에도 기존 협의를 유지한다. 협의 자체가 종료되면 기존 방을 읽기 전용으로 표시한다. 텍스트 전송 중/실패/같은 ID 수동 재시도·중복 차단, 최근 대화·방별 미확인 수·명시적 읽음을 제공한다. 채팅 읽음과 인앱 알림을 혼합하지 않고 대화의 동의로 계약·승인·납품·정산을 처리하지 않는다.
- 실제 API의 accept는 조기 MATCHED/타후보 종료로 P07과 충돌한다. 철회·무선정·채팅 API도 없으므로 `/__mock__/proposals`로 분리했다. Bearer·활성 역할·소유자/당사자·지연 후 epoch를 재검사한다. 운영 경로는 연결 준비 안내이며 실제 제품 API를 추정해 호출하지 않는다.
- **D06/D07/D19/D20 유지:** 종료 후 재지원은 결정 대기 안내와 임시 차단, 글자수4,000/작업물20개·양의 정수 견적/기간·수동 갱신/읽음은 Mock 보호 후보다. 미디어 snapshot/재생·첨부 업로드·자동 갱신/다중 기기·계약 완료/분쟁/보관/재개 정책은 구현 완료로 표시하지 않는다. 상세는 `frontend-proposals-2d.md`.
- 모델/통신: `apps/web/src/mocks/{proposal-model,proposal-api,proposal-handlers}.ts`, 기존 `campaign-handlers.ts`·`studio-handlers.ts`의 상태 읽기/무선정 마감 연결과 `auth-handlers.ts`의 Mock 상대 표시 이름 조회, `browser.ts` 등록.
- 화면/경로: `apps/web/src/features/campaigns/ProposalPage.tsx`, `src/mocks/{ProposalMock,ProposalCard,ProposalConfirm,ProposalEditorMock,ChatPanelMock}.tsx`, `src/app/{App.tsx,layouts/Shell.tsx}`, `DiscoveryDetailMock.tsx`. 기존 Guard·Shell·KEMI 로고/색/타이포·카드24px·600/1024px 구간을 유지한다.
- 검사/근거: `apps/web/test/proposals.test.ts`, `apps/web/e2e/{proposal-helpers.ts,proposals.spec.ts}`, `docs/frontend-proposals-2d.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-2d/{README.md,playwright.edge.config.ts,production-smoke.cjs,production-results.json,candidates-390.png,candidates-1280.png,workspace-390.png,workspace-1280.png}`. CI는 선행 base `feat/frontend-2c-discovery`만 추가하며 검사·재시도·timeout은 유지한다.
- API/shared·Workspaces/의존성/lockfile·원본 엑셀/PDF/디자인 토큰·수정된 계획과 상위 독립 앱은 수정하지 않았다. Senior Engineer Mindset는 사용하지 않았다.

### 검증·검토

- 로컬 `npm run test:web`: **130/130**(기존117+신규13). 공개/마감 정각/권한·중복/D06·작업물 제목 사본·후보/의뢰 분리·마감 후 대화·거절/철회/무선정·계약 합성 경계·읽음 전진·메시지 멱등을 확인했다.
- `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true` 조건의 `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check`: 통과. 최종 문서/검토 보정 후 관련 검사를 다시 확인한다.
- 2-D Edge 전용 **10/10·exit0·51.2초**: 두 후보 유지/타후보 조회·전송 차단, 공개→제안→협의→마감 후 양방향 대화·읽음→거절, 무선정 종료, 응답 유실 후 동일 ID 재전송1회 저장, 빈 상태/실패/Bearer 거절을 확인했다. 기존 검사/timeout/재시도는 완화하지 않았다.
- 운영 산출물+독립 HTTP 인증 fixture **16개 통과·페이지 오류0**: 비회원/의뢰인/제작자×5경로의 인증·역할·연결 준비 안내, 제품 API/Mock 호출·worker 없음, Mock 코드/endpoint/scenario/worker 제외. 실제 서버 인증/API/외부 제공자 검증이 아니다.
- 최초 전체 회귀는 **204/208·4실패·exit1·8.0분**이었다. 새 목록의 H1을 바꾸면서 기존 인증/Google 복귀가 기대하는 `의뢰 현황` 제목을 깨뜨렸다. 기존 제목을 복원하고 해당 기존 검사4개와 2-D10개를 합친 **14/14·exit0·1.1분** 재검증이 통과했다. 확인창을 Radix DialogTrigger에 연결하여 Escape 취소 후 초점 복귀·Enter 재진입도 검증했다. 390/1280px 후보·대화 캡처4개는 재조회 완료 대기 후 재생성·시각 확인했다. 수정 후 기능 SHA `37e79e1`의 **최종 전체 회귀208/208·실패0·exit0·7.8분**이 통과했다. 포트5185·로컬 Edge 두 프로젝트/workers2·retry0·기존 timeout을 사용했다. 로컬과 원격 CI를 구분한다.
- 커밋 전 fresh-context-review·security-review·React 품질 관점 자체 검토: 원본 기능/정책과 API 대조, DEV lazy/운영 제외, 당사자 권한·지연 epoch·React 텍스트 이스케이프·입력/출력 스키마·단방향 읽음·중복 ID·상태별 전송 차단을 확인했다. 무단 조회/전송과 script 문자열을 브라우저로 실행 검증했다. 새 의존성/비밀값/파일 bytes/외부 링크 방문 없음. 실제 서버 보안/인증/DB 검증으로 표시하지 않고 남은 계약/정책/미디어 연동 때문에 Draft로 전달한다.
- 초기 실패: ChatPanel의 마지막 배열 원소 타입·테스트의 잘못된 SUSPENDED enum·브라우저 동적 import의 TS 경로 및 기존 ESLint의 assertion/중첩 조건/label/순차 처리 규칙 위반을 규칙 변경 없이 수정했다. 첫 브라우저 실행 중 소스 편집으로 모바일1건의 실행 context가 사라져 중단했으며 최종 통과로 계산하지 않는다. 전용 프로세스를 확인해 종료하고 고정된 소스로 다시 실행했다. 운영 smoke의 최초 로그인 제목 assertion을 실제 제목으로 수정하고16개를 재검증했다.

### 남은 일·다음 작업 하나·Git 전달

- **실제 API·DB·원자적 마감/계약·알림·파일 저장·외부 제공자는 미연결/미검증.** 제목 사본은 실제 미디어 snapshot/열람 권한 검증이 아니다. CHAT-01 첨부·CHAT-04 계약 후 전환·CAMP-04 공개 후 수정/삭제 등이 남아 **2단계 전체 완료가 아니다**. 이번 범위의 클라이언트/텍스트 Mock 통합과 구분한다.
- 다음 작업 하나: **2-D 협의/선정 분리·철회/무선정·채팅/읽음 API 계약 조율**. 자동 착수하지 않는다. PR 병합·자동 병합 설정·배포/재배포 명령은 실행하지 않는다.
- 기존 2-D 브랜치/PR 없음과 깨끗한 작업 트리, 선행 #42의 로컬/원격 일치 `5e6fa5e`를 확인하고 `feat/frontend-2d-proposals-chat`을 만들었다. 모델/단위/근거 커밋 [1c1b072](https://github.com/Jubileekim/KEMI/commit/1c1b072)은 푸시 완료했다. 화면·통신·통합검사·Git/PR/원격 CI 최종 상태는 아래에 추가한다.

- 화면·통신·통합검사·QA/기록 커밋 [37e79e1](https://github.com/Jubileekim/KEMI/commit/37e79e1)을 푸시했고 [Draft PR #43](https://github.com/Jubileekim/KEMI/pull/43)을 생성·이 채팅에 연결했다. 기능 SHA `37e79e1d4ae506bf633829cbd5d5ad3b420c6c2d`와 PR head 일치, Draft/open·미병합·mergeable=true를 확인했다. base는 선행 `feat/frontend-2c-discovery`(#42)이며 선행 병합 뒤 base 조정 검토가 필요하다. 제안→협의→채팅은 같은 독립 검증 흐름으로 한 PR에 묶고 모델/상태와 화면/통신을 기능 커밋 두 개로 나눴다.
- **원격 Web CI 기능 SHA:** [run40065071852](https://github.com/Jubileekim/KEMI/actions/runs/40065071852) / job120786476906에서 npm ci·형식·단위·타입/린트/빌드·Chromium 설치는 success, 확인 시 브라우저 E2E는 in_progress·report pending이었다. 로컬 결과와 별개다. 최종 기록은 문서 전용 전달 커밋으로 푸시하여 실행이 교체될 수 있다. **최신 문서 SHA의 최종 CI는 미검증**이며 [PR #43 Checks](https://github.com/Jubileekim/KEMI/pull/43/checks)에서 별도 확인한다. 수동 CI 재실행·timeout/재시도 완화 없음.
- **기존 Vercel 연결 검사:** 기능 SHA의 status는 failure이며 target은 기존 팀 초대 링크다. 이번 상세 원인 로그는 미검증이다. 이를 Web CI/로컬 검사 실패 또는 배포 성공으로 표시하지 않는다. 초대·권한·배포 설정 변경·배포/재배포 명령은 실행하지 않았다.

- **최종 검증/종료 경계:** 최종 전체208/208, 관련14/14, 단위130/130, 운영16개(최종 flag 빌드 후 반복도 통과), 타입·린트·빌드·형식·토큰·diff 검사 통과. 기존4개 실패는 제목 복원으로 해결했고 중단/실패 실행을 통과로 합산하지 않았다. 실제 API/DB·미디어·첨부·알림·미결정 정책과 2단계 전체는 미완료다. 다음 범위·병합·자동 병합·명시적 배포 없음. 전용 QA 서버는 실행 종료로 정리했고 preview도 종료했다. 이 최종 기록을 문서 전달 커밋으로 푸시한 뒤 head/PR/작업 트리를 확인한다.

## 3-A 최종 조건서 작성·버전 관리 (2026-10-24)

### 구현·변경 파일

- **TERMS-01 및 TERMS-03의 작성/버전 부분만 클라이언트·명시적 Mock으로 구현.** 유효 협의의 당사자가 금액·규격/수량·범위·자료·납기·수정·사용권·취소 조건을 작성한다. 불완전 작성본 저장·누락 표시, 제안/공개 패키지 값의 명시적 불러오기, 저장본별 값/작성자/한국 시간·이전 값 비교·과거 값에서 새 작성본 생성을 제공한다.
- 공고 공개 필드·제안·현재 대표 공개 패키지의 참조 사본을 첫 저장 시 고정하고 최종 값과 별도 보존한다. 비공개 공고 참고 자료/패키지는 제외한다. 원본 변경·가격 변경·새 저장이 기존 사본/값을 덮어쓰지 않는다. 작성본 저장으로 서명/계약/선정/결제·48시간 만료를 생성하지 않는다.
- `/workspace/:requestId`의 기존 채팅과 조건서를 연결했다. 종료하면 즉시 편집을 잠그고 기존 이력을 열람한다. 당사자/Bearer/활성 역할·지연 후 epoch/협의 상태 재검사, revision 충돌 시 입력 보존·최신 비교/명시적 기준 갱신, 같은 저장 ID 재전송/결과 조회를 제공한다. 저장 후 더 최신 버전이 발견되면 편집 기준을 자동 갱신하지 않는다.
- 실제 조건서 API가 없으므로 **DEV/MSW `/__mock__/terms/:requestId`**로 분리한다. 운영은 기존 연결 준비 안내를 유지하며 실제 제품 API를 추정해 호출하지 않는다. **D08 작성 권한/동시 편집·서명 입력·만료 경계 유지.** 양 당사자 편집/revision·첫 저장 시 대표 공개 패키지 참조·4,000자/금액 제한은 Mock 검토 후보다.
- 모델/통신: `apps/web/src/mocks/{terms-model,terms-api,terms-handlers}.ts`, 기존 `proposal-handlers.ts`의 본인 협의 상태 참조, `browser.ts` 등록.
- 화면: `apps/web/src/features/terms/{TermsEditor,TermsVersionView}.tsx`, `src/mocks/TermsMock.tsx`, 기존 `ProposalMock.tsx`의 계약 전 안내를 조건서로 연결.
- 검사/근거: `apps/web/test/terms.test.ts`, `apps/web/e2e/terms.spec.ts`, `docs/frontend-terms-3a.md`, `docs/frontend-feature-matrix.md`, 이 문서, `qa/frontend-3a/{README.md,playwright.edge.config.ts,production-smoke.cjs,production-results.json,terms-390.png,terms-1280.png}`. CI는 선행 `feat/frontend-2d-proposals-chat` base만 허용 목록에 추가했다.
- API/shared·Workspaces/의존성/lockfile·검사/timeout/retry·원본 엑셀/PDF/디자인·수정 계획·상위 독립 앱은 변경하지 않았다.

### 로컬 검증·검토

- 최종 모델/소스의 `npm run test:web`: **145/145**(기존130+신규15). 불완전 저장·불변 이력/참조·원본 변경·양측 편집·revision/멱등·비당사자/역할/종료/계약 상태·입력 스키마를 확인했다.
- `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`로 `npm run build:web`(타입·기존 ESLint·운영 빌드) 통과. `npm run format:check`, `npm run check:tokens`, `git diff --check` 통과. 종료 문서 반영 후 형식/diff를 다시 확인한다.
- 운영 산출물+독립 HTTP 인증 fixture **16개 통과·페이지 오류0**: 조건서/제안 Mock 코드·문구·endpoint·worker 제외, 비회원/의뢰인/제작자×기존5경로의 가드/준비 안내, 제품 API/Mock 요청·worker 없음. 실제 서버 인증/API/DB 검증이 아니다.
- 보완 전 3-A 관련 Edge 데스크톱/모바일 **10/10·exit0·2.8분**. 첫 제한 환경에서 검사 출력 뒤 Vite 종료가 대기하여 정확한 KEMI/5186 프로세스만 정리하고 최종 완료/exit0을 확인했다. 이후 저장 응답 최신 버전 경계/종료 즉시 잠금을 보완하고 관련 검사2개를 추가했다. **보완 후 최종 전체 회귀220/220·실패0·exit0·8.9분 통과. 기존208+3-A12개이며 3-A의 작성/버전 통합도 포함한다.** 포트5186·로컬 Edge 두 프로젝트/workers2·retry0·기존 timeout으로 실행했고 원격 CI와 구분한다.
- 최종 캡처390/1280px2개 시각 확인. 320/390/600/768/1024/1280px 넘침·필드 오류 초점/설명 연결·텍스트 이스케이프를 관련 검사에 포함한다. 실제 브라우저 메뉴200% 확대·스크린리더·다른 브라우저·실제 다중 탭은 미검증이다.
- 커밋 전 surgical-change·verify-before-claiming·fresh-context-review·security-review·React 품질 관점 검토: DEV lazy/운영 제외, 허용 공개 필드와 고정 사본·최종 값 분리, Bearer/당사자/역할·지연 epoch/현재 상태, unknown/Zod·React 텍스트 출력·오류의 로컬 문구를 대조했다. 실제 권한 서버/DB 보안 검토를 대체하지 않으며 사람 검토가 필요해 Draft로 전달한다.
- 중간 실패: 초기 타입 단언과 `innerWidth` ESLint 위반을 기존 규칙 변경 없이 수정했다. 첫 전체 실행은 저장 응답 이후 더 최신 작성본의 기준이 자동 갱신될 수 있는 경계를 자체 검토에서 발견해 중단·보완했다. 다음 전체 실행은 회귀 시작 직후 단위 검사를 겹쳐 실행한 작업 실수로 shared가 재빌드됐다. 3-A fixture의 동적 session import가 UI와 다른 모듈 인스턴스를 읽는 것으로 추정되는 `다시 로그인해 주세요` 오류6개를 확인하고 중단했다. 소스·검사 변경 없이 새 Vite 서버에서 빌드/단위 검사와 겹치지 않게 전체220개 재실행이 통과했다. 따라서 해당 중간 세션 오류는 실행 중 shared 재빌드 영향으로 판단하며 두 중단 실행은 통과에 합산하지 않는다.

### 남은 일·다음 작업 하나

- **실제 API·DB·알림·영구 저장/다중 탭·외부 제공자는 미연결/미검증.** 단일 탭 메모리와 로컬 충돌 제어를 서버 원자성 증거로 표시하지 않는다. 새로고침하면 초기화된다.
- TERMS-02 서명 요청/동일 버전 고정·48시간 시작/만료, CONTRACT-01 양측 서명/선정, TERMS-03의 구버전 서명 보존/재확인·결제·직접 의뢰 경로 통합은 후속 범위다. **3-A 클라이언트·명시적 Mock 통합까지만 완료이며 3단계 전체 완료가 아니다.**
- 다음 작업 하나: **3-A D08 및 조건서 작성/버전 API 계약 조율**. 자동 착수·PR 병합·자동 병합 설정·명시적 배포/재배포 없음.

### Git 전달 상태

- 기존3-A 브랜치/PR 없음, 선행 #43의 open/Draft와 원격/로컬 일치 `722ba68`을 확인해 `feat/frontend-3a-terms`에서 작업했다. base는 선행 `feat/frontend-2d-proposals-chat`이며 #43 병합 후 base 조정 검토가 필요하다.
- 모델/단위/근거 [f9305b6](https://github.com/Jubileekim/KEMI/commit/f9305b6), 화면/통신 [3837831](https://github.com/Jubileekim/KEMI/commit/3837831), 브라우저 검증/QA/기록 [172c1be](https://github.com/Jubileekim/KEMI/commit/172c1be) 모두 푸시했다. [Draft PR #44](https://github.com/Jubileekim/KEMI/pull/44)을 생성·이 채팅에 연결했다. 기능 SHA `172c1be80f5767619d57bd0f94c6a817821aaa22`와 PR head 일치, open/Draft·미병합·mergeable=true를 확인했다. 최종 Git 전달 기록은 문서 전용 커밋으로 추가 푸시한다.

- **원격 Web CI 기능 SHA:** [run99/40067765470](https://github.com/Jubileekim/KEMI/actions/runs/40067765470), job120794501995에서 npm ci·형식·단위는 success, 확인 시 build:web은 in_progress·Chromium 설치와 E2E는 pending이었다. 로컬145/220/운영16과 별개다. 전달 문서 커밋 푸시로 cancel-in-progress에 따라 실행이 교체될 수 있으며 **최신 문서 SHA의 최종 CI는 미검증**이다. [PR #44 Checks](https://github.com/Jubileekim/KEMI/pull/44/checks)에서 확인한다. 수동 CI 재실행·timeout/재시도 완화 없음.
- **기존 Vercel 연결 검사:** 기능 SHA status는 failure다. [봇 설명](https://github.com/Jubileekim/KEMI/pull/44#issuecomment-6380561857)은 작성자 Dev-Yuncheol이 KEMI Vercel 팀 멤버가 아니라는 내용이다. Web CI/로컬 빌드 실패와 별개의 접근 권한 문제이며 배포 성공으로 표시하지 않는다. 초대·권한·배포 설정 변경·배포/재배포는 실행하지 않았다. Git 푸시/PR로 생긴 기존 서비스 연결 검사는 명시적 배포와 구분한다.
- **종료 경계:** 최종 전체220/220(3-A12개 포함)·단위145/145·운영16개·타입/린트/빌드·형식·토큰·diff 검사 통과. 이번 3-A 클라이언트·명시적 Mock 통합까지만 완료다. 실제 API/DB·D08·서명/만료/선정/결제·3단계 전체는 미완료다. 다음 작업 자동 착수·PR 병합·자동 병합 설정·명시적 배포 없음. 전용5186 개발 서버는 정상 종료했고4190 preview도 명령행/소유 프로세스를 확인해 정리했다. 다른 기능의 캡처 생성물4개는 제외하고3-A 캡처2개만 전달한다. 문서 전달 커밋 푸시 후 원격 SHA/PR head/깨끗한 작업 트리를 최종 대조한다.

## 3-B 양측 서명·만료·최종 선정 (2026-10-24)

### 구현·변경 파일

- **TERMS-02·CONTRACT-01·TERMS-03의 공개 제안 협의방 경로를 클라이언트·명시적 Mock으로 구현.** 최신 저장본 전체 최종 값을 확인하고 별도 확인창에서 버전을 고정한다. 요청자·한국 시간 요청/48시간 만료, 한쪽/양측 서명, 대체·만료·종료 상태를 구분한다. 요청/첫 서명으로 선정하지 않으며 같은 버전의 두 번째 유효 서명 때 한 후보만 모의 계약 확정·모집 종료·타후보 미선정을 반영한다.
- 변경 시 구버전 값·서명·시각을 보존하고 구버전 서명을 차단한다. 만료 후 같은 버전 재요청 대신 같은 값의 새 확인 버전을 만든다. 서명은 복사하지 않는다. 버전이 바뀌면 이름·동의를 새로 입력한다. 계약 전후 같은 방·메시지를 유지하고 미선정 방은 읽기 전용이다. 계약 후 조건 편집·거절/철회·무선정 종료와 신규 제안은 차단한다. 결제/제작 시작은 발생하지 않는다.
- 실제 조건서/서명/계약 API가 없고 accept는 P07과 충돌하므로 DEV/MSW `/__mock__/signatures/:requestId`로 분리했다. Bearer·ACTIVE·역할/당사자·방·버전/revision·지연 후 epoch/현재 상태를 검사한다. 중복 요청은 기한을 연장하지 않고 결과 불명확 시 같은 명령/ID 재시도·저장 결과 조회로 확인한다. 운영은 기존 준비 안내를 유지한다.
- **D08 유지:** 이름100자/동의·동시 편집/revision·만료 정각 차단은 Mock 검토 예시다. 법적 서명 형식·정확한 서버 시간/만료 경계·실제 인증 강도를 확정하지 않았다. 상세는 `frontend-signatures-3b.md`.
- 모델/통신: `apps/web/src/mocks/{signature-model,signature-api,signature-handlers}.ts`, 기존 `{proposal-model,proposal-handlers,terms-handlers,browser}.ts`.
- 화면: `apps/web/src/features/terms/{SignaturePanel,TermsEditor,TermsVersionView}.tsx`, `src/mocks/{TermsMock,ProposalMock,ProposalCard,ChatPanelMock}.tsx`. 실제 서명 이후에도 저장본 제목이 '서명 요청 전'이라고 표시되던 문구를 일반 작성본 제목으로 변경했다. 기존 KEMI 토큰·로고·주요 색·카드·600/1024px 구간을 유지한다.
- 검사/근거: `apps/web/test/signatures.test.ts`, `apps/web/e2e/signatures.spec.ts`, 기존 `e2e/terms.spec.ts`의 버튼/제목 기대값, `docs/{frontend-signatures-3b,frontend-feature-matrix,frontend-progress}.md`, `qa/frontend-3b/{README.md,playwright.edge.config.ts,production-smoke.cjs,production-results.json,signatures-390.png,signatures-1280.png}`. `.github/workflows/web-ci.yml`에는 선행3-A base만 허용한다. API/shared·의존성/lockfile·검사 규칙/timeout/retry·원본 엑셀/PDF/디자인·상위 독립 앱은 변경하지 않았다.

### 검증·검토

- 최종 보완본 로컬 단위 **153/153**(기존145+신규8), `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check` 통과. Mock/인증 flag를 켜고 빌드해도 개발 코드/worker는 운영에서 제외한다.
- 3-B 관련 Edge 데스크톱/모바일 **12/12·exit0·1.4분**: 공개→제안→협의→조건 작성→요청→첫 서명→양측 서명/선정→기존 대화, 타후보 미선정/읽기 전용과 무단 조회/서명404, 버전 변경/구서명 보존, 만료 정각/새 버전, 유실 응답 재전송/조회, malformed 조회·Bearer/지연 로그아웃을 확인했다. 이후 최종 검토에서 요청자 기록·이름 trim·확인 버전 ID 재사용 충돌을 보완하고 최종 전체 회귀에 포함한다.
- 운영 산출물+독립 HTTP 인증 fixture **16개·페이지 오류0**: 비회원/의뢰인/크리에이터의5개 경로, 서명/조건서/제안 Mock 코드·endpoint·worker 제외, 제품/Mock 호출 없음. 실서버 인증/API 검증이 아니다. 최종 보완본 빌드 후 반복 결과는 아래 최종 검증에 기록한다.
- 390/1280px 서명 화면 시각 확인. 최종 전체 통합에320/390/600/768/1024/1280px 넘침·React 텍스트 이스케이프·제품 계약/서명/결제 API 호출0 검사를 포함한다. 실제 브라우저 메뉴200% 확대·스크린리더·다른 브라우저·실제 다중 탭은 미검증이다.
- 커밋 전 surgical-change·verify-before-claiming·fresh-context-review·security-review·react-best-practices 관점 자체 검토: 원본/P07/P09/D08과 API 경계, DEV lazy/운영 제외·unknown/Zod·본인/역할/지연 epoch·불변 저장본·버전별 동의·중복/유실·단일 후보 선정/종료 후 전송 차단을 대조했다. 무단 endpoint/서명 입력 script 문자열을 브라우저로 실행 검증했다. 실제 서버 보안/DB 원자성을 검증한 것은 아니며 사람 검토가 필요해 Draft로 전달한다.
- 중간 실패: 초기 타입 좁히기·fixture enum/공고 status·non-null/배열 반복과 render 중 Date.now의 기존 ESLint 위반을 규칙 변경 없이 수정했다. 최초 관련 실행에서 선정 이후 마감 문구 assertion이 실제 전체 문구와 달랐고, 타후보 시나리오가 이미 서명한 의뢰인으로 재서명하려 해 대기했다. 실제 문구와 계정 전환을 수정한12/12 재검증이 통과했다. 최초 실행은 테스트 추가 편집/프로세스 종료 대기로 최종 종료 요약을 확보하지 못했으므로 통과로 합산하지 않는다. Stop-Process 오류 뒤 QA 서버 종료 재시도는 자동 승인 검토의 워크스페이스 크레딧 부족으로 실행되지 않았다. 재개 후 해당 PID/포트가 없음을 확인했고, 새 전용 서버/승인된 검사 실행은 정상 종료했다. 비밀값·불필요 생성물은 포함하지 않는다.

### 남은 일·다음 작업 하나

- **실제 API·DB 트랜잭션/공고당 unique·서버 시각·전자서명 제공자·영구 저장/다중 탭·알림/outbox는 미연결/미검증.** 단일 탭 메모리의 동기 처리/후보 차단을 서버 잠금/원자성 증거로 표시하지 않는다. 새로고침하면 초기화된다.
- 공개 제안 경로의3-B 클라이언트/Mock과 구분해 직접 의뢰 경로 통합·3-C 테스트 결제·3단계 전체 통합은 남는다. **3단계 전체 완료가 아니다.** 다음 작업 하나는 **3-B D08 및 서명·원자적 선정 API 계약 조율**이다. 자동 착수·PR 병합·자동 병합 설정·명시적 배포/재배포는 하지 않는다.

### Git 전달·최종 검증

- 기존3-B PR/브랜치 없음, 선행 #44의 open/Draft와 로컬/원격 일치 `9df00cc`를 확인해 `feat/frontend-3b-signatures`에서 작업했다. base는 선행 `feat/frontend-3a-terms`(#44)이며 선행 병합 후 base 조정 검토가 필요하다.
- 모델/단위/근거 커밋 [19c1e9f](https://github.com/Jubileekim/KEMI/commit/19c1e9f)을 푸시했다. 화면/통신·통합 검사/기록·PR과 최종 전체 회귀/원격 CI 상태는 검증 종료 후 이 절에 추가한다.

- **최종 전체 회귀:** 최종 기능/검사 SHA `60faffa071d38342c510403058585e883c0270d1`에서 **232/232·실패0·exit0·10.2분** 통과. 기존220+3-B12개이며3-A12개와3-B12개 통합도 포함한다. 로컬 Edge 두 프로젝트/workers2·retry0·기존 timeout·전용5187이다. 최종153/153 단위·타입/린트/운영 빌드·형식·토큰·diff와 별개로 확인했다. 최종 보완본 운영 산출물/HTTP fixture도 **16개·페이지 오류0·exit0** 재검증했다. 실서버/DB/외부 제공자 증거가 아니다. MSW의 기존 favicon 미일치 warning이 있어 콘솔 전체 오류/경고0으로 표시하지 않는다.
- 화면/통신 커밋 [caf782f](https://github.com/Jubileekim/KEMI/commit/caf782f), 통합/회귀·CI 허용 커밋 [60faffa](https://github.com/Jubileekim/KEMI/commit/60faffa)을 푸시했고 [Draft PR #45](https://github.com/Jubileekim/KEMI/pull/45)를 생성·이 채팅에 연결했다. 확인 시 PR head가 `60faffa`와 일치하고 open/Draft·미병합·mergeable=true였다. 서명/만료에서 선정까지 같은 검증 흐름을 한 PR에 묶고 모델·화면/통신·검사 커밋은 분리했다. QA/최종 전달 기록도 같은 브랜치에 포함하며 [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/45/commits)에서 최종 head를 확인한다.
- **원격 Web CI 기능 SHA:** [run101/40087355656](https://github.com/Jubileekim/KEMI/actions/runs/40087355656), job120852897686에서 npm ci·형식·단위·build:web은 success, 확인 시 Chromium 설치는 in_progress·브라우저 E2E/report는 pending이었다. 로컬232/153/운영16과 별개다. QA/전달 기록 푸시로 cancel-in-progress에 따라 실행이 교체될 수 있으며 **최신 전달 SHA의 최종 CI는 미검증**이다. [PR #45 Checks](https://github.com/Jubileekim/KEMI/pull/45/checks)에서 별도로 확인한다. 수동 CI 재실행·timeout/retry 완화 없음.
- **기존 Vercel 연결 검사:** 기능 SHA status는 failure/Blocked다. [봇 설명](https://github.com/Jubileekim/KEMI/pull/45#issuecomment-6383287399)은 Dev-Yuncheol이 KEMI Vercel 팀 멤버가 아니라는 내용이다. Web CI/로컬 빌드 실패와 별개의 접근 권한 문제이며 배포 성공으로 표시하지 않는다. 초대·권한/공개 범위·배포 설정 변경·명시적 배포/재배포는 실행하지 않았다. Git 푸시/PR로 생긴 기존 서비스 연결 검사와 구분한다.
- **종료 경계:** 공개 제안 경로의3-B 클라이언트/명시적 Mock 통합까지만 완료다. 실제 API·DB·알림·D08·직접 의뢰 통합·결제와3단계 전체는 미완료다. 다음 작업 자동 착수·PR 병합·자동 병합 설정·명시적 배포 없음. 전용 전체 QA 서버는 exit0으로 종료했고4191 preview도 세션을 통해 정상 정리했다. 최종 QA/기록 커밋 푸시 후 원격/PR head와 작업 트리를 대조한다.
- 최종 소스에서 서명 통합2개 프로젝트를 별도 **2/2·exit0·17.2초** 재검증하며390/1280px 캡처2개를 재생성·시각 확인했다. 전체232개 결과와 합산하지 않는다. `--reporter=list --output ../../tmp/3b-capture-results`로 전체 회귀 HTML 보고서는 보존했다. 검사/소스 추가 변경은 없다.

## 3-C 테스트 결제·결과 확인·재조회 (2026-10-24)

### 구현·변경 파일

- **PAY-01/02의 공개 제안 계약 경로를 클라이언트·명시적 PG Mock으로 구현.** 동일 버전 양측 서명으로 확정된 계약의 전액·당사자를 표시하고 의뢰인이 주문 생성/Mock 결제, 양 당사자가 결과/이력을 조회한다. 준비/결과 불명확/성공 시 새 주문을 차단하고 확정 실패/취소 이후에만 별도 확인으로 새 주문을 만든다. 주문 생성만으로 결제/제작을 시작하지 않는다.
- 복귀 URL의 success·amount·paymentKey로 승인하지 않는다. 기존 주문 식별·고정 금액/KRW를 모의 서버에서 대조하고 응답 유실/결과 불명확은 실패와 구분한다. 같은 명령/ID 재전송과 기존 주문 조회를 제공하며 중복/과거 이벤트·늦은 실패가 성공을 되돌리지 않는다. 지연 요청 후 epoch·당사자·계약을 재검사한다.
- 실제 API/shared에 주문·결제/승인·조회 계약이 없어 **DEV/MSW `/__mock__/payments/:contractId`**로 분리했다. **Toss SDK·실제 Sandbox·API·DB·알림은 미연결/미검증**이다. 단일 탭 메모리이며 새로고침 후 없는 계약을 성공으로 복원하지 않는다. D08·D10~D12, 만료/취소와 늦은 승인 충돌·실제 PG 상태/멱등 키/webhook 계약은 확정하지 않았다. 상세는 `frontend-payments-3c.md`.
- 모델/통신: `apps/web/src/mocks/{payment-model,payment-api,payment-handlers}.ts`, 기존 `signature-handlers.ts`의 서명 저장본 조회와 `browser.ts` 등록.
- 화면: `apps/web/src/features/payments/{PaymentPage,PaymentResultPage}.tsx`, `src/mocks/PaymentMock.tsx`, 기존 `src/app/App.tsx`와 `src/features/terms/SignaturePanel.tsx`의 양측 계약/결제 조회 링크. KEMI 토큰·브랜드·공통 Dialog/Button·600/1024px 구간을 유지한다.
- 검사/근거: `apps/web/test/payments.test.ts`, `apps/web/e2e/{payments.spec,payments-helpers}.ts`, `docs/{frontend-payments-3c,frontend-feature-matrix,frontend-progress}.md`, `qa/frontend-3c/{README.md,playwright.edge.config.ts,production-smoke.cjs,production-results.json,payments-390.png,payments-1280.png}`. `.github/workflows/web-ci.yml`에는 선행3-B base만 허용했다. API/shared·의존성/lockfile·검사 규칙/timeout/retry·원본 엑셀/PDF/디자인·상위 독립 앱은 변경하지 않았다.

### 검증·검토

- 최종 보강본 `npm run test:web`: **162/162**(기존153+신규9), 두 Mock/auth flag를 켠 `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check` 통과. 종료 문서 반영 뒤 형식/diff를 다시 확인한다.
- 보강 전 3-C Edge 데스크톱/모바일 **12/12·exit0·4.3분**. 조건→첫 서명 결제 불가→양측 서명/계약→전액 주문→검증→양측 재조회·기존 방, 금액 불일치/결과 불명확/지연 결과 재조회, 실패·취소·유실·동일 ID/새 주문 차단, URL 위조·형식/HTTP/네트워크 오류·타인/Bearer·지연 로그아웃·새로고침을 확인했다. 이후 저장된 명령 결과 확인·유실 중 결과 확인 표시·제작자 최신 주문 링크를 보강했고 최종 전체 회귀에 포함한다.
- 최종 보강본 운영 산출물+독립 HTTP 인증 fixture **7개·페이지 오류0·exit0**. 두 flag를 켜도 결제/서명/조건서 Mock 코드·endpoint·worker 제외, 비회원/의뢰인/크리에이터×결제/결과2경로의 가드/준비 안내, 제품·Mock 호출/worker 없음. 실서버 인증/PG 검증이 아니다.
- surgical-change·verify-before-claiming·fresh-context-review·security-review·React 품질 관점 자체 검토로 명세/P10/API 부재, DEV lazy·unknown/Zod·객체별 권한·지연 epoch·고정 금액/버전·멱등/조회 우선·React 텍스트 출력을 대조했다. 브라우저에서 금액/URL/body 변조와 무단 조회·전송을 실행했다. 실제 서버 보안/DB 원자성 검증을 대체하지 않으며 사람 검토가 필요해 Draft로 전달한다.
- 중간 오류: 중첩 삼항식 ESLint2건을 기존 규칙 변경 없이 수정했다. 형식 검사에서 테스트1파일을 발견해 재포맷했다. 기본 제한 환경의 Playwright 서버 종료 대기에서 명령행으로 이번 KEMI/5188 PID만 확인했다. Stop-Process 내부 오류 뒤 같은 확인된 PID를 .NET API로 종료해 최종12/12·exit0을 확보했다. 최종 전체 회귀는 승인된 실행으로 정상 종료를 확인한다. `preview:web` 별칭의 인수 전달 실패는 workspace Vite 명령으로 수정했고7검사가 통과했다. 중간 실패/종료 대기를 통과로 합산하지 않는다. 기존 favicon/MSW·DevTools 경고가 있어 전체 콘솔 경고0으로 표시하지 않는다.

### 남은 일·다음 작업 하나

- **3-C 클라이언트/PG Mock 범위만 구현했다.** 실제 API·DB 트랜잭션·Toss Sandbox 결제창/승인/조회·영구 저장/다중 탭·알림·미결정 정책은 남는다. 공개 제안 경로 통합과 실제 PG/직접 의뢰 경로를 구분하며 **3단계 전체 완료가 아니다.** 제작·다음 단계는 착수하지 않는다.
- 다음 작업 하나: **3-C 주문·결제 승인/조회 API 및 Toss Sandbox 계약 조율**. 자동 착수·PR 병합·자동 병합 설정·명시적 배포/재배포는 하지 않는다.

### Git 전달·최종 통합 검증

- 기존3-C 브랜치/PR 없음, 선행 #45 open/Draft와 로컬/원격 `d72d308` 일치를 확인해 `feat/frontend-3c-payments`에서 작업했다. base는 선행 `feat/frontend-3b-signatures`(#45)이며 선행 병합 후 base 조정 검토가 필요하다.
- 모델·단위·근거 [039e772](https://github.com/Jubileekim/KEMI/commit/039e772)을 푸시했다. 화면·통신/검사/기록 커밋, Draft PR, 최종 전체244개 회귀와 원격 CI 결과는 아래에 추가한다. 초기12개와 최종 전체 결과는 합산하지 않는다.

- **최종 전체 회귀:** 기능/검사 SHA `7616b9217b91ebf0e47cabe335b58f59e2b3ccf2`에서 **244/244·실패0·exit0·12.0분** 통과(기존232+3-C12). 3-A12개·3-B12개와 공개 제안 조건→양측 서명/선정→전액 Mock 결제→양측 재조회/기존 방 통합을 포함한다. 최종 단위162/162·운영7개·타입/린트/빌드·형식·토큰 검사와 별개다. Edge 두 프로젝트/workers2·retry0·기존 timeout·전용5188로 실행했으며 원격 CI와 구분한다.
- 최종390/1280px 캡처2개를 시각 확인했다. 320/390/600/768/1024/1280px 넘침·페이지 오류0·실제 계약/서명/결제 API 요청0을 통합 검사에서 확인했다. 실제 브라우저 메뉴200% 확대·스크린리더·Edge 이외 브라우저·실제 다중 탭은 미검증이다. 공용 캡처 flag로 생성된 타기능 캡처8개는 제거하고3-C2개만 포함한다.
- 화면/통신 [7213d51](https://github.com/Jubileekim/KEMI/commit/7213d51), 검사/CI/기록 [7616b92](https://github.com/Jubileekim/KEMI/commit/7616b92)을 푸시했고 [Draft PR #46](https://github.com/Jubileekim/KEMI/pull/46)을 생성·이 채팅에 연결했다. 확인 시 PR head=`7616b92`, open/Draft·미병합·mergeable=true였다. 결제→결과→재조회는 독립 검증 가능한 한 흐름이므로 한 PR에 묶고 모델·화면/통신·검사 커밋은 분리했다. 최종 캡처/전달 기록도 같은 브랜치로 푸시한다. [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/46/commits)에서 최종 head를 확인한다.
- **원격 Web CI 기능/검사 SHA:** [run103/40088945822](https://github.com/Jubileekim/KEMI/actions/runs/40088945822), job120857469805에서 npm ci·형식·단위·build:web·Chromium 설치는 success, 확인 시 브라우저 E2E는 in_progress·report는 pending이었다. 로컬244/162/운영7과 별개다. 최종 QA/문서 전달 푸시로 cancel-in-progress에 따라 실행이 교체될 수 있으며 **최신 전달 SHA의 최종 CI는 미검증**이다. [PR #46 Checks](https://github.com/Jubileekim/KEMI/pull/46/checks)에서 별도로 확인한다. 수동 CI 재실행·timeout/retry 완화 없음.
- **기존 Vercel 연결 검사:** 기능/검사 SHA status는 failure/Blocked다. [봇 설명](https://github.com/Jubileekim/KEMI/pull/46#issuecomment-6383505769)은 Dev-Yuncheol이 KEMI Vercel 팀 멤버가 아니라는 내용이다. Web CI/로컬 빌드 실패와 별개의 접근 권한 문제다. 초대·권한/공개 범위·배포 설정 변경·명시적 배포/재배포는 실행하지 않았다. 푸시/PR로 생긴 기존 서비스 연결 검사와 구분한다.
- **종료 경계:** 이번3-C 클라이언트/명시적 PG Mock과 공개 제안 경로 통합까지만 완료다. 실제 Toss Sandbox·API·DB·알림·미결정 계약/정책은 남고3단계 전체 완료가 아니다. 다음 작업 자동 착수·병합·자동 병합 설정·명시적 배포 없음. 전체 QA 서버는 exit0으로 정상 종료했고4192 preview도 q로 exit0 종료했다. 최종 문서/QA 커밋 푸시 후 원격 SHA·PR head·깨끗한 작업 트리를 대조한다.

## 4-A 제품·자료 준비 확인·제작 시작·납기 (2026-10-24)

### 구현·변경 파일

- READY-01/02·WORK-01 및 WORK-02 납기 날짜 합의를 **클라이언트/명시적 Mock**으로 구현했다. 선행 공개 제안 조건서→양측 서명 계약→전액 Mock 결제 저장본을 이어 받는다. 미서명 계약 조회/미결제 변경 차단, 구조화 Mock 준비 조건 양측 확인, 제품 발송·자료명 제공·정상 확인·문제/정정 이력, 마지막 필수 준비 충족 시 1회 시작, 시작 후 문제 보류와 기존 납기 보존, 상대 승인 후 납기 반영/거절을 제공한다.
- API 문서·현재 API/shared에 준비/납기 계약이 없어 DEV/MSW `/__mock__/production/:contractId`로 분리했다. 서버 역할/당사자·Bearer·지연 epoch·revision·ID/내용/행위자 대조, 유실 조회/동일 명령 재시도와 신규 명령 차단을 적용한다. 단일 탭 메모리의 모의 처리이며 실제 서버 보안/DB 원자성 증거가 아니다.
- D09 시작일 포함/마감 시각은 미결정이다. 시작일 미포함·동일 시각+달력일 수/한국 시간·조회 기준 카운트다운을 **모의 계산 예시**로 표시한다. 자유 텍스트 계약의 기간/자료를 자동 해석하지 않고 별도 구조화 예시를 양측 확인한다. 실제 계약 변경이 아니다.
- WORK-02 날짜 변경만 구현했다. 금액·범위·추가금·차감/작업 중단은 D10 조율 전 미완료로 유지한다. 파일은 자료명만 기록하며 실제 업로드/저장/검사는 미연결이다. 실제 API/DB/배송사/알림·영구 저장/다중 탭·서버 시각·직접 의뢰 통합은 미검증이다.
- 모델/통신: `apps/web/src/mocks/{production-model,production-handlers,production-api}.ts`, `ProductionMock.tsx`, 기존 `payment-handlers.ts`의 결제 성공 읽기와 `browser.ts` 등록.
- 화면/진입: `apps/web/src/features/production/{ReadinessPanel,DeadlineChangePanel}.tsx`, `time.ts`, `app/{App.tsx,routes.ts}`, 기존 `SignaturePanel.tsx`, `PaymentMock.tsx`. KEMI 토큰/공통 UI·600/1024px 구간을 유지했다.
- 검사/근거: `apps/web/test/production.test.ts`, `e2e/production.spec.ts`, `qa/frontend-4a/`, `docs/{frontend-production-4a,frontend-feature-matrix,frontend-progress}.md`, 선행3-C base의 Web CI 허용1행. 의존성/lockfile·API/shared·원본 엑셀/PDF/디자인·검사 규칙/timeout/retry·상위 독립 앱은 변경하지 않았다.

### 로컬 검증·검토

- 최종 단위 **172/172**(기존162+신규10), 두 개발 flag를 켠 `npm run build:web`(타입·ESLint·운영 빌드), `npm run format:check`, `npm run check:tokens`, `git diff --check` 통과. 운영 산출물+독립 HTTP 인증 fixture **4개·exit0**: Mock endpoint/코드/worker 제외 및 비회원/의뢰인/크리에이터 준비 화면 경계. 실 API/인증 검증이 아니다.
- 추가 납기 거절 검사 전 관련 Edge 데스크톱/모바일 **8/8·exit0·1.5분**. 공개 제안→서명→결제→발송/자료→정상 준비→1회 시작→문제 정정→양측 납기 승인/같은 방, 미결제·위조 필드/타인/Bearer·유실/동일 ID·형식/HTTP/네트워크 오류·지연 로그아웃·새로고침을 포함한다. 320~1280px 넘침/페이지 오류0/관련 제품 API 호출0은 정상 통합 검사에서 확인했다. 최종 추가 검사와 전체 회귀/캡처 결과는 종료 후 추가한다.
- senior-engineer-mindset·premortem·surgical-change·verify-before-claiming 적용 후 fresh-context-review·security-review·React 품질 관점으로 원본/P11/P12/D09/D10·DEV 경계·입력/Zod·객체 권한·epoch/중복/정정·React 텍스트 출력을 자체 검토했다. 금액/범위 변경을 날짜 변경의 완료로 확대하지 않는다. 실제 서버 보안 검증과 사람 검토는 남아 Draft로 전달한다.
- 중간 실패: 엑셀 일반 로드의 원본 조건부 서식 오류는 read_only로 원본 변경 없이 읽었다. 기본 Python launcher 권한 오류는 번들 Python 실행으로 해결했다. 타입은 통과했으나 초기 린트의 export/삼항/단언·테스트 규칙을 수정했고 최종 build:web이 통과했다. 첫 브라우저8개는 타인 계정 fixture 부재와 실행 중 소스 변경에 따른 세션 오류 등으로4개 실패해 합산하지 않는다. 타인 Mock 가입/새로고침 기대를 수정하고 고정 소스의8/8 재검증이 통과했다. 최초 운영 검사는 auth flag 없이 빌드해 로그인 기대가 달랐고 두 flag 명시 빌드에서4검사가 통과했다. 기존 favicon MSW/DevTools 경고가 있어 전체 콘솔 경고0으로 주장하지 않는다.

### 남은 일·다음 작업 하나

- 4-A의 위 클라이언트/Mock 흐름만 구현했다. 실제 계약/API/파일·알림·서버 시각 및 D09/D10 조율, WORK-02 금액/범위 변경이 남는다. **4-B 납품·검토·수정·최종 수령·정산 및 4단계 전체 통합은 미완료**이며 자동 착수하지 않는다.
- 다음 작업 하나: **4-A 준비·시작·납기 API 및 D09/D10 계약 조율**. PR 병합·자동 병합 설정·명시적 배포/재배포 없음.

### Git 전달·최종 통합 검증

- 기존4-A 브랜치/PR 없음, 선행 #46 open/Draft 및 로컬/원격 `decaa15` 일치를 확인해 `feat/frontend-4a-production` 생성. base는 `feat/frontend-3c-payments`(#46)이며 선행 병합 후 base 조정 검토가 필요하다.
- 모델/단위/근거 커밋 [05ec101](https://github.com/Jubileekim/KEMI/commit/05ec101) 푸시 완료. 화면/통신·최종 검사/기록 커밋과 Draft PR·원격 CI·전체 회귀 결과는 아래에 추가한다.

- **추가 로컬 확인:** 최종 소스의 정상 통합을 별도 격리 브라우저에서 **2/2·exit0·48.5초** 실행하고 `qa/frontend-4a/production-{390,1280}.png`를 생성·시각 확인했다. 전체 회귀 수에 합산하지 않는다. 실제 브라우저 메뉴200% 확대·스크린리더·Edge 외 브라우저·실제 다중 탭은 미검증이다.
- **전체 회귀 중간 중단:** 첫 전체 실행과 `test:web`의 shared 재빌드가 겹쳐 Vite 모듈 갱신 뒤 helper의 plain import 세션과 앱 세션이 달라지는 인증 실패가 발생했다. 해당 실행을 통과로 합산하지 않고 명령행으로 확인한 이번 QA runner/5189 Vite만 종료했다. shared 빌드 완료 후 소스를 고정한 새 전체 실행에서 기존 결제 검사와4-A 데스크톱5개가 통과했으며 최종 결과를 기다린다. 검사/timeout/retry를 변경하지 않는다.
- **구현 경계 보충:** WORK-02는 **제작 시작 후 날짜 변경**만 시연한다. 시작 전 기간 변경·금액/범위/추가금·차감·자동 중단/연장과 원계약 변경은 D09/D10/API 계약 조율 전 미완료다. 구조화 준비 조건 확인은 개발용 예시이며 실계약 서명을 대체하지 않는다.
- 화면/통신 [e3c108b](https://github.com/Jubileekim/KEMI/commit/e3c108b), 검사/CI/진행 [d693167](https://github.com/Jubileekim/KEMI/commit/d693167)을 푸시하고 [Draft PR #47](https://github.com/Jubileekim/KEMI/pull/47)을 생성·이 채팅에 연결했다. 확인 시 head=`d693167`, open/Draft·미병합·mergeable=true였다. 준비→시작→날짜 변경은 같은 계약의 한 검증 흐름으로 PR1개에 묶고 모델/화면/검사 커밋을 분리했다.
- **원격 Web CI 기능/검사 SHA:** [run105/40090984674](https://github.com/Jubileekim/KEMI/actions/runs/40090984674), job120863420078에서 설치·형식·단위·build:web·Chromium 설치는 success, 확인 시 E2E는 in_progress/report는 pending이었다. 로컬 검사와 구분한다. 최종 결과/전달 SHA 상태는 아래에 추가한다.
- **기존 Vercel 연결 검사:** `d693167` status는 failure/Blocked. [봇 설명](https://github.com/Jubileekim/KEMI/pull/47#issuecomment-6383781378)은 Dev-Yuncheol이 KEMI Vercel 팀 멤버가 아니라는 내용이다. 로컬 빌드/Web CI와 별개이며 초대·권한/공개 범위·배포 설정 변경·명시적 배포/재배포는 실행하지 않았다.

- **최종 전체 회귀:** 기능/검사 SHA `d693167cf35371f9b49f9658b725b555d77760b9`의 고정 소스로 **254/254·실패0·exit0·13.6분** 통과(기존244+4-A10). 3-A 조건·3-B 양측 서명·3-C 전액 Mock 결제와 공개 제안→발송/자료→정상 확인→1회 시작→문제 정정/납기 보존→상대 승인·거절→같은 작업 방 통합을 포함한다. 데스크톱/모바일·Edge·workers2·retry0·기존 timeout·전용5189로 실행했다. 단위172/172와 운영4개·별도 캡처2/2 결과를 합산하지 않는다.
- **원격 CI 최종 기능 SHA:** run105는 `completed/cancelled`, job120863420078도 cancelled다. 설치·형식·172개 단위·build:web·Chromium 설치 success. 브라우저는 데스크톱90번까지 통과 후 약10분12초 시점에 `The operation was canceled`로 종료됐다. 4-A 데스크톱5개 통과도 로그에 있지만 **원격 전체 통과가 아니다**. workflow job 제한10분과 CI workers1은 유지했으며 취소의 명시적 원인은 로그만으로 확정하지 않는다. report 업로드는 skipped다. 수동 재실행·timeout/retry 완화 없음.
- **종료 경계:** 4-A 클라이언트/Mock 및 날짜 합의 통합까지만 검증했다. 실제 API/DB/파일/배송사/알림·D09/D10·WORK-02 나머지와4단계 전체는 미완료다. 다음 작업은 위4-A 계약 조율1개이며 자동 착수하지 않는다. 전용 전체 QA 서버는 exit0으로 정상 종료했다. 운영 preview도 정리한다. 최종 문서/캡처 전달 푸시는 CI의 새 실행을 만들 수 있으므로 최신 전달 SHA의 최종 CI는 미검증으로 구분하고 [PR #47 Checks](https://github.com/Jubileekim/KEMI/pull/47/checks)에서 확인한다. 병합·자동 병합·명시적 배포 없음.
- 최종 문서/캡처도 같은 브랜치에 커밋·푸시한다. [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/47/commits)에서 모델05ec101·화면e3c108b·검사d693167 및 최종 전달 커밋을 확인한다. 푸시 후 원격/PR head와 작업 트리를 대조한다.

## 4-B 초안·완성 검토본 제출·영상 버전 (2026-10-25)

### 구현·변경 파일

- DEL-01/02와 WORK-03/04의 영상 조회·확정 제출 안내 부분을 **클라이언트/명시적 Mock**으로 구현했다. 양측 서명→전액 Mock 결제→제작 시작·필수 정상 준비를 선행 조건으로 사용한다. 파일 선택/준비와 정식 제출을 분리하고 초안/완성 검토본·설명·작성자·시각·이전 파일/버전을 보존한다. 초안·조회·대화로 수정 회차·승인·완료·수령·정산을 바꾸지 않는다.
- 완성 검토본은 P13대로 제작자가 **영상 자체에 KEMI 워터마크를 수동 준비했다는 확인**을 받는다. 자동 검사/합성·트랜스코딩은 하지 않는다. 초안과 검토본 모두 당사자 전용 플레이어와 재생 오류/재시도를 제공하며 다운로드 버튼은 없다. 녹화/복제 완전 차단을 보장하지 않는다.
- 버전 URL·미존재 버전 안내, 같은 방의 일반 메시지와 구분된 제출 시스템 안내/정확한 바로가기를 연결했다. 안내는 확정된 버전 사건에서 파생하므로 실패/업로드만으로 생성하지 않고 동일 명령 재시도로 중복되지 않는다. 인앱 알림/외부 알림은 별도 미연결이다.
- API 문서·현재 API/shared에 대응 계약이 없어 DEV/MSW `/__mock__/deliveries/:contractId`, `/assets`, `/media/:versionId`, `/__mock__/delivery-events/:requestId`로 분리한다. 서명·결제·준비 저장본과 본인 계약/역할/Bearer를 확인하고 본문 처리 후 epoch/상태·최신 revision을 재검사한다. 결과 미확인은 새 제출을 잠그고 재조회/동일 ID 재시도로 복구한다.
- 모델/통신: `apps/web/src/mocks/delivery-{model,handlers,api}.ts`, 기존 `production-handlers.ts` 읽기 함수와 `browser.ts` 등록.
- 화면/연결: `features/production/{DeliveryVersions,ReviewPlayer}.tsx`, `mocks/{DeliveryMock,DeliveryNoticesMock}.tsx`, 기존 `app/{App.tsx,routes.ts}`, `features/terms/SignaturePanel.tsx`, `mocks/{ProductionMock,ChatPanelMock}.tsx`. KEMI 토큰/공통 UI·600/1024px 구간을 유지했다.
- 검사/근거: `test/delivery.test.ts`, `e2e/delivery{.spec,-helpers}.ts`, 자체 제작 `e2e/fixtures/kemi-review.webm`, `qa/frontend-4b/`, `docs/{frontend-delivery-4b,frontend-feature-matrix,frontend-progress}.md`. CI는 선행4-A base 허용1행만 추가한다. 의존성/lockfile·API/shared·원본 엑셀/PDF/디자인·검사 규칙/기존 timeout/retry와 상위 독립 앱은 변경하지 않았다.

### 로컬 검증·변경 검토

- 단위 **180/180**(기존172+신규8), 두 개발 flag를 켠 `npm run build:web`(타입·ESLint·운영 빌드), 토큰 검사 PASS. 최종 형식/diff 검사와 연관 회귀 결과는 아래 전달 기록에 추가한다.
- 4-B 데스크톱/모바일 Edge **12/12·실패0·exit0·2.2분**. 공개 제안→조건/서명→전액 Mock 결제→준비/제작 시작→초안→완성 검토본→이전 버전 재생→같은 방 안내를 포함한다. 업로드만으로 버전/안내 없음, 워터마크 수동 확인, 입력 텍스트 이스케이프, 유실/동일 ID/충돌·오래된 revision/동일 파일 재제출 차단, HTTP/형식/네트워크/재생 오류, 미결제/미시작·의뢰인 쓰기/위조 Bearer/타인·지연 로그아웃·새로고침과 준비 문제 보류를 확인했다. 보류 중 새 제출 차단·기존 영상 접근/납기 보존도 검증했다.
- 정상 통합 검사에서 320/390/600/768/1024/1280px 가로 넘침 없음·페이지 오류0·관련 실제 제품 API 호출0. `qa/frontend-4b/delivery-{390,1280}.png`를 생성·시각 확인했다. 실제 브라우저 메뉴200% 확대·스크린리더·Edge 외 브라우저·다중 탭은 미검증이다.
- 운영 산출물+독립 HTTP 인증 fixture **4개·exit0**: 개발 Mock endpoint/코드/worker 제외, 비회원/의뢰인/크리에이터 제출 경로 경계·제품 API/Mock 요청 없음. 실제 API/인증/파일 서버 검증과 구분한다.
- surgical-change·verify-before-claiming 후 fresh-context-review·security-review·React 품질 관점으로 명세/코드 자체 검토를 수행했다. 입력 실행/비밀 노출 경로 없음, 계약/미디어/안내 객체 권한·epoch·업로드/제출 분리·ID/내용/작성자/revision·Blob URL 해제와 운영 DEV 제외를 확인했다. 사람 검토와 실제 서버 보안 검증은 남아 Draft로 전달한다.
- 중간 실패: 초기 React effect의 동기 setState와 함수 정의 순서·테스트 lint를 기존 규칙에 맞게 수정했다. 첫 브라우저는 테스트 영상이 프레임 없이110바이트 헤더만 출력하고 오류 locator가 두 alert를 선택해4개 실패(6개 통과)했다. 두 번째는 인코더가 끝나기 전 고정300ms 종료와 잘못 한정한 locator로4개 실패(8개 통과)했다. 두 실행은 완료 결과에 합산하지 않는다. Canvas/VP8 인코더의 실제 데이터 사건을 기다려 자체 제작한11,810바이트 고정 WebM을 저장하고 브라우저 metadata/재생을 확인한 뒤 최종12/12를 통과했다. 재현 생성기와 SHA256은 QA README에 기록했다. 테스트 timeout/retry는 늘리지 않았다.
- 첫 QA의 Windows sandbox 서버 종료 대기는 명령행으로 식별한 이번5190 Vite만 정리했다(Stop-Process 내부 오류 후 .NET Process.Kill 사용). 최종 검사는 로컬 프로세스 정리가 가능한 실행에서 정상 exit0이었다. 기존 favicon MSW/React DevTools 경고는 있어 전체 콘솔 경고0으로 주장하지 않는다. Python PDF 추출의 없는 pymupdf는 설치하지 않고 제공 pypdf로 기술 스택을 읽었다.

### 남은 일·다음 작업 하나

- 이번 초안/완성 검토본 제출·버전 조회의 클라이언트/Mock만 완료다. 단일 탭 메모리로 새로고침 시 계약/파일/안내가 초기화된다. URL의 특정 버전 지정은 제공하지만 영구 저장 후 복원은 미완료다. 실제 API/DB/비공개 파일 저장/검사/접근·워터마크 검증·코덱 변환·인앱/외부 알림은 미연결/미검증이다.
- D17의 단위/개수/형식/검사/미사용 파일/보존 정책·D20 작업 패널 전체 구성은 결정하지 않았다. MP4/WebM1개·300MiB·설명2000자는 개발 입력 보호 예시다. D11 수정 예외도 유지한다. 수정 요청·수정본·승인·최종 전달/수령·정산과 WORK-03/04 전체·**4단계 전체는 미완료**다. 따라서 최종 수령→정산의 단계 전체 완료 검증은 하지 않았다.
- 다음 작업 하나: **4-B 제출·영상 접근 API 및 D17 파일 정책 조율**. 별도 요청 후 착수한다. 다음 작업 자동 착수·PR 병합·자동 병합 설정·명시적 배포/재배포 없음.

### Git 전달·연관 회귀·원격 CI

- 기존4-B 브랜치/PR 없음, 선행 [Draft PR #47](https://github.com/Jubileekim/KEMI/pull/47)의 open/Draft·미병합과 head/로컬/원격 `a9d99d0` 일치를 확인했다. `feat/frontend-4b-delivery`를 생성했고 base는 `feat/frontend-4a-production`이다. 선행 병합 후 base 조정 검토가 필요하다.
- 모델/단위/근거 [60f1579](https://github.com/Jubileekim/KEMI/commit/60f1579)를 푸시했다. 화면/통신 [9b48c64](https://github.com/Jubileekim/KEMI/commit/9b48c64), 검사/기록의 푸시·Draft PR 링크·연관 회귀/원격 CI는 최종 확인 후 아래에 기록한다.

- **Git 전달:** 화면/통신9b48c64와 검사/CI/기록 [37e45f9](https://github.com/Jubileekim/KEMI/commit/37e45f9)를 푸시하고 [Draft PR #48](https://github.com/Jubileekim/KEMI/pull/48)을 생성·이 채팅에 연결했다. 확인 시 head=37e45f9, open/Draft·미병합·mergeable=true였다. 파일 준비→초안/검토본→버전/같은 방 안내는 하나의 검증 가능한 흐름이므로 PR1개에 묶고 모델/화면/검사를 커밋으로 나눴다. [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/48/commits)에서 최종 전달 커밋까지 확인한다.
- **연관 회귀:** 기능/검사 SHA37e45f9의 고정 소스에서 `app.spec.ts production.spec.ts signatures.spec.ts proposals.spec.ts payments.spec.ts` **56/56·실패0·exit0·5.8분** 통과. 기존 공통 화면·4-A 준비/납기·3-B 서명·3-C 결제·2-D 채팅을 포함한다. 4-B12개 및 운영4개와 별도 실행이며 전체 회귀/4단계 전체 통과로 표시하지 않는다. 단위180/180도 다시 통과했다.
- **최종 입력 정리/검증:** 마지막 검토에서 성공/유실 재조회 확인 후에도 남는 파일 입력 표시를 비워 동일 파일을 다시 선택할 수 있도록 수정했다. 선택 해제·다음 영상 준비를 포함한 4-B 데스크톱/모바일 **12/12·실패0·exit0·2.1분**을 재검증했다. 이전12개 실행과 합산하지 않는다. 두 flag build:web(타입·ESLint·운영 빌드)과 format:check·diff 검사도 통과했다. 변경은 DEV 파일 입력 참조/선택 해제와 검사·캡처·이 기록뿐이며 API/shared·선행 로직은 변경하지 않았다. 최종 캡처는 영상 로딩 후 재생/일시정지까지 확인해 갱신했다.
- **원격 Web CI 기능/검사 SHA:** [run107/40175634211](https://github.com/Jubileekim/KEMI/actions/runs/40175634211), job121115568588에서 설치·형식·단위·build:web·Chromium 설치는 success, 확인 시 브라우저 E2E는 in_progress·report는 pending이었다. 원격 전체 통과가 아니다. 마지막 입력 정리/전달 푸시는 기존 cancel-in-progress에 따라 새 실행을 만들 수 있어 **최신 전달 SHA의 최종 CI는 미검증**으로 구분하고 [PR #48 Checks](https://github.com/Jubileekim/KEMI/pull/48/checks)에서 확인한다. 기존 CI job10분·workers1/timeout/retry 유지, 수동 재실행/설정 완화 없음.
- **기존 Vercel 연결 검사:** 37e45f9 status는 failure/Blocked다. [봇 설명](https://github.com/Jubileekim/KEMI/pull/48#issuecomment-6395251756)은 Dev-Yuncheol이 KEMI Vercel 팀 멤버가 아니라는 내용이다. Web CI/로컬 빌드와 별개다. 초대·권한/공개 범위·배포 설정 변경·명시적 배포/재배포를 하지 않았다.
- **종료 경계:** 클라이언트/명시적 Mock의4-B만 완료다. 실제 API/DB/파일·워터마크 검사·영구 저장/복원·알림과 D17/D20/D11·수정/승인/최종 수령/정산·4단계 전체는 남는다. 다음 작업은 위4-B API/D17 조율1개이며 자동 착수하지 않는다. 전용5190 QA 서버는 최종 검사 exit0으로 정상 정리했고4194 preview도 q로 exit0 종료했다. 최종 변경을 같은 브랜치에 커밋·푸시한 후 로컬/원격/PR head와 깨끗한 작업 트리를 대조한다. 병합·자동 병합·명시적 배포 없음.

## 4-C 시간 위치별 수정 요청·수정본·회차 (2026-10-26)

### 구현 범위·근거

- REV-01/02와 WORK-03/04의 요청·수정본 이력/같은 방 안내 부분만 구현했다. 원본 엑셀 기능45/46행, P14/D11, 계획4단계2·4항, 기술 PDF, 디자인 토큰, API 문서와 실제 API/shared 소스를 대조했다. 대응 API/DTO가 없어 DEV/MSW로 분리했다. 원본/API/shared·의존성/lockfile·검사 규칙은 변경하지 않았다.
- 시간 위치·문제·희망 변경·참고 체크리스트를 대상 영상에 묶고, 요청/수정본·처리 설명·이전 영상·일반 완료 회차를 보존한다. 현재 재생 위치 사용과 정확한 버전/요청/시간 URL을 제공한다. 일반 수정은 요청/파일 준비가 아니라 연결된 새 수정본 제출 시 한 번만 완료된다. 초안 수정본도 초안으로 유지하고 합의한 계약 오류는 회차 제외다.
- P14 횟수/범위는 서명 조건 원문을 함께 표시하고 양측이 같은 구조화 Mock 예시를 확인해야 일반 요청할 수 있다. 기본 한도를 임의 부여하거나 서명 문구를 자동 해석하지 않는다. 실제 계약 수정/전자서명이 아니다. 한도 초과 일반 요청은 협의 안내, 오류는 횟수만으로 차단하지 않으며 제작자 시정 동의 전 보류한다.
- D11 혼합/이견/수정본 납기/요청 중 변경·승인은 미결정 유지. 혼합·추가 작업 보류, 진행 중 요청1개, 입력20항목/1000자/0~86400초/한도0~20은 개발 예시다. 실제 서비스 정책으로 확정하지 않았다. 설명/참고는 이스케이프 텍스트이며 외부 URL을 자동 열지 않는다.
- 요청·영상·회차를 같은 Mock 기록에서 갱신한다. 최신 revision/대상 버전/준비 상태·당사자/Bearer·본문 처리 후 epoch를 확인하고 ID/작성자/내용을 재검사한다. 유실 시 새 명령을 잠그고 재조회/같은 ID 재시도로 복구한다. 성공한 저장본에서만 시스템 안내를 만든다. 조회 오류는 기존 입력을 메모리에 보존하지만 영상·작업 정보는 숨기고 쓰기를 차단한다.

### 변경 파일

- 모델/통신: `apps/web/src/mocks/revision-model.ts`, `delivery-{model,api,handlers}.ts`.
- 화면: `apps/web/src/features/production/{RevisionRequestForm,ReviewPlayer}.tsx`, `apps/web/src/mocks/{RevisionPanelMock,RevisionNoticesMock,DeliveryMock,DeliveryNoticesMock,ChatPanelMock}.tsx`.
- 검사/근거: `apps/web/test/revisions.test.ts`, `apps/web/e2e/revisions.spec.ts`, `qa/frontend-4c/`, `docs/{frontend-revisions-4c,frontend-feature-matrix,frontend-progress}.md`. CI에는 stacked base `feat/frontend-4b-delivery` 허용1행만 추가했다. 기존 timeout/retry/workers/검사 명령 유지.

### 로컬 검증·검토

- 단위 **186/186·실패0·exit0**(기존180+신규6). 두 개발 flag를 켠 `npm run build:web` **exit0**(타입·기존 ESLint·운영 빌드 포함). `check:tokens` PASS, 추적 파일 전체 Prettier 검사·diff 검사 PASS. 전체 `npm run format:check`는 시작부터 있던 미추적 `outputs/share/KEMI-interactive.html`, `tools/share-html/{build.mjs,main.tsx,serve.mjs,share.css,ShareGuide.tsx}` 6개 형식으로 실패했다. 이 파일들은 수정·스테이징하지 않았다. `git -c core.quotepath=false ls-files`로 전달 파일 전체를 별도 검사해 통과했다.
- 두 flag 운영 빌드의 4-C Mock/endpoint 제외 검사와 기존 독립 HTTP 인증 fixture **4개·exit0**. 비회원/의뢰인/크리에이터 경로, worker/제품 API/Mock 요청 없음. 실제 API·인증 서버 검증이 아니다.
- 정상 4-C 통합 **데스크톱/모바일2/2·exit0**에서 공개 제안→서명→전액 Mock 결제→준비/시작→검토본→양측 Mock 조건 확인→2항목 요청→시간 바로가기/실제 재생 시각→수정본→1회 완료→같은 방 안내→원영상/수정본 연결을 검증했다. 320/390/600/768/1024/1280px 넘침 없음·페이지 오류0·관련 실제 제품 API/외부 참고 URL 요청0. 최종 통합/연관 회귀는 아래 기록을 따른다.
- 초기 WebM duration=Infinity로 시간 선택이 잠겼고, 실제 끝까지 재생한 뒤 길이를 확인하도록 보완했다. 잘못 고정한0:00 locator로 첫 완주10/12(2실패) 후 실제 저장 시간/재생 시각 검사로 수정했다. 이어320px 중첩 카드/긴 버튼 넘침을 수정해 통합2/2 통과했다. 회귀 중 오류 응답에 이전 선택 영상이 남는 것을 발견해 영상/정보 숨김과 입력 보존을 함께 복구했다. 중간 실패/중단 실행을 최종 통과 수에 합산하지 않는다. timeout/retry나 기존4-B 검사는 완화하지 않았다.
- fresh-context-review·security-review·React 품질 관점으로 명세/코드 자체 검토했다. 입력 실행/외부 URL 호출/비밀 노출, 객체 권한, 세션 변경, 원자적 회차·중복, Blob URL 정리, 운영 DEV 제외를 확인했다. 실제 서버 보안·사람 검토는 남아 Draft로 전달한다.

### 남은 일·다음 작업 하나

- 실제 API/DB/파일 저장·미디어 길이 서버 검증·워터마크 검사·알림/외부 제공자·영구 저장/새로고침 복원·다중 탭은 미연결/미검증이다. 단일 탭 메모리이며 새로고침 시 계약/영상/요청 기록이 초기화된다. 실제 브라우저 메뉴200% 확대·스크린리더·Edge 외 브라우저도 미검증이다.
- D11과 선행 D17/D20 등 정책/API 조율은 남는다. 승인·최종 전달·수령·정산 및 WORK-03/04 전체·**4단계 전체는 미완료**다. 최종 수령→정산의 단계 전체 완료 검증은 하지 않았다.
- 다음 작업 하나: **4-C 수정 API 및 D11 예외 정책 조율**. 다음 작업 자동 착수·PR 병합·자동 병합·명시적 배포/재배포는 하지 않는다.

### Git·최종 통합·원격 CI

- 시작 시4-C 브랜치/PR 없음, 선행 [Draft PR #48](https://github.com/Jubileekim/KEMI/pull/48)의 open/Draft·미병합과 로컬/원격/head `e5becb0` 일치를 확인했다. `feat/frontend-4c-revisions`를 만들었으며 base는 `feat/frontend-4b-delivery`다. 선행 병합 후 base 조정 검토가 필요하다.
- 모델/통신/단위/근거 [48255ae](https://github.com/Jubileekim/KEMI/commit/48255ae)를 커밋·푸시했다. 요청→수정본→회차·안내는 하나의 검증 가능한 흐름으로 PR1개에 묶고 모델/화면/검사·전달 커밋으로 나눈다.
- **최종 통합/연관 회귀:** 기능/검사 SHA `dea8bca`에서 Edge 데스크톱/모바일 **44/44·실패0·exit0·7.0분**. 4-C12개 + 4-B12개 + 준비10개 + 제안/채팅10개다. 정상 통합의 시간 이동/실제 재생 시각·요청2항목1회·원영상/수정본/같은 방 안내, 한도 소진/계약 오류 시정 합의·초안 무차감, 실패 입력 보존·유실/같은 ID·위조/타인/구버전/지연 로그아웃·새로고침·6너비를 포함한다. 기존4-B 오류 응답 시 선택 영상 숨김도 통과했다. 과거 통합2개와 합산하지 않으며 전체 회귀·4단계 전체 완료가 아니다.
- **Git 전달:** 화면 [4130cd7](https://github.com/Jubileekim/KEMI/commit/4130cd7), 검사/기록 [dea8bca](https://github.com/Jubileekim/KEMI/commit/dea8bca)를 푸시했고 [Draft PR #52](https://github.com/Jubileekim/KEMI/pull/52)를 생성·이 채팅에 연결했다. 확인 시 open/Draft·미병합·mergeable=true였다. 마지막은 최종 결과/캡처만 추가하며 [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/52/commits)에서 전달 커밋까지 확인한다.
- **원격 Web CI:** 기능/검사 SHAdea8bca의 [run40252203550](https://github.com/Jubileekim/KEMI/actions/runs/40252203550), job121346354827은 설치·형식·단위·build:web·Chromium 설치 success, 확인 시 브라우저 E2E in_progress·report pending이었다. 원격 전체 통과가 아니다. 최종 문서/캡처 푸시는 새 CI 대상이며 **최신 전달 SHA의 최종 CI는 미검증**이다. [최신 Checks](https://github.com/Jubileekim/KEMI/pull/52/checks)에서 확인한다. CI job10분/CI workers1·timeout/retry 유지, 수동 재실행 없음.
- **기존 Vercel 연결:** dea8bca status는 failure이며 Git 작성자 Dev-Yuncheol의 Vercel 프로젝트 접근 권한이 필요하다는 응답을 확인했다. 별도 Vercel Preview Comments 체크 success는 배포 성공 증거가 아니다. 초대·권한/공개 범위·배포 설정 변경·명시적 배포/재배포 없음.
- **최종 캡처/정리:** `qa/frontend-4c/revisions-{390,1280}.png`를 영상 readyState/실제 재생·일시정지 확인 후 저장·시각 확인했다. 기존 favicon MSW/React DevTools 경고가 있어 전체 콘솔 경고0이라고 주장하지 않는다. 연관 검사로 생긴 중복 캡처는 제거하고4-C 캡처만 전달한다. 전용5191 QA 서버는44개 실행 exit0으로 정리했고4195 preview도 종료했다. 기존 미추적 outputs/tools는 보존·미포함이다. 시스템 Python 실행기는 접근 오류였고 번들 Python으로 문서만 갱신했다.
- **종료 경계:** 4-C 클라이언트/명시적 Mock만 완료다. 실제 API/DB/파일·외부 제공자·영구 복원·D11/D17/D20·승인/최종 수령/정산과4단계 전체는 남는다. 다음 작업은4-C API/D11 조율1개이며 자동 착수하지 않는다. 병합·자동 병합·명시적 배포 없음. 최종 커밋 후 로컬/원격/PR head와 추적 파일 변경 없음(기존 미추적2개 폴더 제외)을 대조한다.

## 4-D 검토 승인·최종 파일 전달·수령 확인 (2026-10-26)

### 범위·변경 파일

- DEL-03/04/05, FILE-01·WORK-03/04의 관련 부분을 클라이언트/명시적 DEV/MSW로 구현했다. 원본 엑셀47~49행·P13/P15/P16/P22·D11/D17, 계획4단계3·4항, 기술 PDF, 디자인 키트와 API 문서/실제 API/shared를 대조했다. 대응 API/DTO가 없어 `/__mock__/deliveries/:contractId/{final,final-assets,final-files}`와 `/__mock__/final-events/:requestId`로 분리했다. 서버/API/shared·의존성/lockfile·원본 디자인 토큰은 변경하지 않았다.
- 최신 완성 검토본/수정본의 특정 버전을 의뢰인이 승인한다. 초안/초안 수정본·구버전·열린 요청은 차단한다. 승인 후 계약 규격/범위/원본 조건 원문을 보면서 깨끗한 최종본·합의한 촬영 원본/프로젝트/작업본·ZIP을 파일별 설명과 함께 별도 전달한다. 파일 준비·단순 다운로드·대화·미응답은 수령/정산을 만들지 않는다.
- 전용 수령 확인 또는 파일 불일치·손상·워터마크·미해결 분쟁 신고를 기록한다. 문제 신고는 수령/덮어쓰기 보류이며 자동 해제하지 않는다. 수령은 정산 선행 기록일 뿐 실제 보류/금액 검사·정산 실행·완료는 미구현이다. 같은 방의 확정 승인/전달/수령/문제 안내는 정확한 영상/전달 URL로 연결한다.
- 모델/통신: `apps/web/src/mocks/{final-model,delivery-model,delivery-handlers,delivery-api,revision-model}.ts`. 화면: `src/features/production/{ReviewActions,FinalReceiptPanel}.tsx`, `src/mocks/{FinalPanelMock,FinalNoticesMock,DeliveryMock,RevisionPanelMock,ChatPanelMock}.tsx`. 검사/근거: `apps/web/{test/final.test.ts,e2e/final.spec.ts,e2e/fixtures/kemi-final.zip}`, `qa/frontend-4d/`, `docs/{frontend-final-4d,frontend-feature-matrix,frontend-progress}.md`. CI는 stacked base4-C 허용1행만 추가했고 원격에서 받은60분 job과 기존 검사/retry/workers는 유지했다.

### 검증·검토

- 단위 **193/193·실패0·exit0**(기존186+신규7). 두 개발 flag를 켠 `npm run build:web` **exit0**(타입·기존 ESLint·운영 빌드 포함), `check:tokens` PASS. 두 flag 운영 산출물에서 승인/최종/수령 Mock·endpoint·worker 제외와 기존 독립 HTTP 인증 fixture **4개·exit0**. 실제 API/인증 서버/스토리지 검증이 아니다.
- `format:check`는 시작부터 있던 미추적 outputs/tools의6개 파일과 작업 중인 문서 형식 때문에 실패했다. 전달 문서는 최종 포맷 후 추적/추가 파일 전체를 따로 검사한다. 기존 미추적 파일은 수정·스테이징하지 않는다. 최종 검사 결과는 아래 Git 전달 기록에 추가한다.
- `fresh-context-review`·`security-review`·React 품질 관점에서 명세/코드 자체 검토했다. 입력 실행/비밀/외부 URL 없음, 파일별 계약 당사자/Bearer/epoch, await 후 최신 state, 승인 버전 고정, 원자적 수령/보류, actor·내용·ID 중복 방지, Blob URL 회수, 조회 오류 시 파일 숨김과 입력 보존을 확인했다. 실제 서버 보안과 독립 사람 검토는 남아 Draft로 전달한다.
- 중간 실패: 메타데이터 JSON 문자열 비교가 속성 순서에 의존해 단위5개 실패→필드별 비교 후193개 통과. 첫 브라우저 실행은 공유 빌드/HMR와 겹쳐 초기화돼 중단했다. 공백 경로의 ZIP fixture URL 변환 오류는 fileURLToPath로 수정했다. 신규 전체 공개 제안→수령 검사 기본30초는 실제 수령 직후 전체 한도에 도달해 이 신규 spec만60초로 설정했다. 기존 테스트30초·assertion5초/retry0는 변경하지 않았다. 중간 실패/중단 수는 최종 통과와 합산하지 않는다.
- 첫4-D 데스크톱/모바일8개는 모두 통과했지만, 캡처에서 승인 뒤 ‘검토 중’ 표기와 불필요한 새 수정 작성 화면을 발견해 수정했다. 캡처는 실제 영상 readyState·재생/일시정지 확인 후 다시 저장한다. 최종 고정 소스의4-D·연관 회귀 결과와 SHA는 아래에 추가한다. Windows QA 서버 종료 대기가 남아 검사 완료 후 전용5192 소유 프로세스만 확인·종료하면 러너가8 passed/exit0을 반환했다. 다른 기존 서버는 종료하지 않았다.

### 남은 일·다음 작업 하나

- 실제 API/DB/스토리지/외부 제공자·워터마크/내용/악성 파일/ZIP 내부 검사·영구 복원/다중 탭·알림은 미연결/미검증이다. 단일 탭 메모리이며 새로고침 시 계약/영상/승인/수령이 초기화된다. 입력 MP4/WebM/ZIP·파일당300MiB·20개·설명2000자는 D17 확정 정책이 아닌 개발 보호 예시다.
- D11 열린 요청 중 승인·승인 후 변경/재승인, D13 문제 해제/보완·운영 분쟁, D17 파일 정책·D20 배치를 임의 확정하지 않았다. 승인 후 쓰기 잠금·문제 신고 후 보류는 조율 전 Mock 보호다. 실제 브라우저 메뉴200% 확대·스크린리더·Edge 외 브라우저도 미검증이다.
- **4-D 클라이언트/명시적 Mock 범위만 구현하며 SETTLE-01·WORK-03/04 전체·4단계 전체는 미완료다.** 따라서 최종 수령→모의 정산까지의4단계 전체 완료 검증은 하지 않았다. 다음 작업 하나는 **4-D 승인·최종 전달·수령 API 및 D11/D13/D17 보류 정책 조율**이며 별도 요청 후 착수한다. 다음 작업 자동 착수·PR 병합/자동 병합·명시적 배포/재배포는 하지 않는다.

### Git 전달·최종 통합·원격 CI

- 시작 시4-D 대응 브랜치/PR이 없었다. 선행 [PR #52](https://github.com/Jubileekim/KEMI/pull/52)는 open·미병합이며 원격 head89222e1·base main·Draft 해제 상태였다. 로컬 a127691 이후 원격의 문서/CI3개 커밋만 fast-forward로 받아 현재 코드를 유지했다. `feat/frontend-4d-final-receipt`를 만들었으며 PR base는 미병합 `feat/frontend-4c-revisions`다. 선행 병합 후 base 조정 검토가 필요하다.
- 모델/핸들러/단위/근거 [83af3bf](https://github.com/Jubileekim/KEMI/commit/83af3bf)를 커밋·푸시했다. 승인→파일→수령/문제·안내는 하나의 독립 검증 흐름이므로 PR1개에 묶고 모델/화면/검사·전달을 의미 있는 커밋으로 나눈다. 화면·최종 검사·Draft PR/원격 CI 결과는 완료 후 아래에 기록한다.

- **최종4-D 통합:** 기능/화면 `ebb6903` 소스와 이번4-D 검사에서 Edge 데스크톱/모바일 **8/8·실패0·exit0·3.1분**. 공개 제안→동일 조건 서명→전액 Mock 결제→준비/제작→완성 검토본→특정 버전 승인→계약 ZIP 준비/정식 전달→다운로드 바이트 SHA 일치→전용 수령→같은 방3개 확정 안내/정확한 URL을 검증했다. 다운로드만으로 수령 없음, 문제 신고/보류, 유실·같은 ID/재조회, malformed 파일 응답 거부, 잘못된 revision/역할·위조 Bearer·다른 계약·실제 다른 Mock 회원 파일/안내 거부, 초안·잘못된 전달 URL·지연 로그아웃·새로고침 초기화를 포함한다. 320/390/600/768/1024/1280px 가로 넘침 없음·정상 통합 페이지 오류0·관련 제품 API/외부 제공자 요청0. 앞선8개 실행과 합산하지 않는다.
- **운영/형식/캡처:** 두 flag 운영 제외+독립 HTTP fixture4개는 exit0. 추적/추가 파일 전체 Prettier·diff 검사 PASS. 전체 format:check의 기존 미추적 outputs/tools6개는 미포함이다. `qa/frontend-4d/final-{390,1280}.png`는 실제 영상 readyState·재생/일시정지 확인 후 저장·시각 확인했다. 기존 favicon MSW/React DevTools 경고는 남아 전체 콘솔 경고0으로 표시하지 않는다. 전용4196 preview는q/exit0 종료했다.4-D 검사는 전체8개 완료 후 전용5192 소유 Node 프로세스만 종료해 러너 exit0을 확인했다.
- **화면 전달:** [ebb6903](https://github.com/Jubileekim/KEMI/commit/ebb6903) 커밋·푸시 완료. 관련44개 첫 회귀는 초안 승인 버튼 노출과 일부 로컬30초 한도 도달을 발견해 중단했다. 초안에는 승인 행동 자체를 숨기는 [c1a3f9d](https://github.com/Jubileekim/KEMI/commit/c1a3f9d)를 커밋·푸시했고4-B 정상 통합에서 확인했다. 기존 한도/검사는 변경하지 않고4-B/4-A22개를 로컬 단일 worker로 재검증 중이다.4-C/제안·채팅 전체 브라우저 회귀를 통과했다고 표시하지 않는다. 최종 결과와 수정본→승인 연결을 추가한4-D10개 검사는 아래에 기록한다.

- **최종 연관 회귀:** 기능 SHA `c1a3f9d`에서 기존4-B/4-A 데스크톱/모바일22개를 `--workers=1`로 실행해 **20/22·2실패·exit1·9.9분**.4-B 모바일 입력/오류 시나리오와 지연 로그아웃/새로고침2개가 전체30초 한도에 도달했다. 같은 소스·같은30초/assertion5초/retry0에서 해당2개만 분리 재검증해 **2/2·실패0·exit0·1.6분** 통과했다. 실행 시간 민감성의 원인 분리는 미완료이며 묶음22/22 또는 전체 회귀 통과로 바꾸어 표시하지 않는다. [실패 지점과 분리 재검증 근거](../qa/frontend-4d/regression-timeouts.json)를 보존했다. 초안 승인 버튼 노출은 수정 후 양쪽4-B 정상 통합에서 통과했다.4-C/제안·채팅 전체 브라우저 회귀는 이번 최종 범위에서 미실행이며 정상 공개 제안·같은 방 흐름과 오류 시정 수정본→승인은4-D 검사에서 확인한다.

- **최종4-D 고정 소스 재검증:** 기능 SHA `c1a3f9d`와 최종 `final.spec.ts`에서 **10/10·실패0·exit0·4.8분**(데스크톱5+모바일5). 위8개 이후 초안 승인 UI 숨김과4-C 오류 요청→시정 동의→수정본→구버전 차단→최신 수정본 승인2개를 포함했다. 회차는 시정 제외/null이며 승인과 최종 전달을 분리함도 확인했다. 이전8개와 합산하지 않는다. 같은 소스의 최종 단위193/193·두 flag build:web(타입/ESLint/운영 빌드)·운영 제외/HTTP fixture4개도 다시 exit0을 확인했다. 최신 캡처를 시각 확인했고 전용5192/4196만 정리했다.

- **Git/PR 전달:** 검사/기록 [33b148e](https://github.com/Jubileekim/KEMI/commit/33b148e)를 푸시하고 [Draft PR #65](https://github.com/Jubileekim/KEMI/pull/65)를 생성·이 채팅에 연결했다. 확인 시open/Draft·미병합, head33b148e·base4-C89222e1이었다. 승인→파일→수령은 하나의 검증 가능한 흐름이므로 PR1개이며 모델/화면/초안 UI보완/검사로 나눠 커밋했다. 마지막 전달은 이 Git/CI 기록만 추가하고 [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/65/commits)에서 최종 전달 SHA까지 확인한다.
- **원격 CI:** 검사 SHA33b148e의 [Web CI run40291883209](https://github.com/Jubileekim/KEMI/actions/runs/40291883209), job121468627364는 확인 시in_progress였다. 원격 전체 통과가 아니다. 마지막 문서 전달은 새 CI 대상이며 **최신 전달 SHA의 최종 원격 CI는 미검증**이다. [최신 Checks](https://github.com/Jubileekim/KEMI/pull/65/checks)에서 확인한다. 수동 재실행·검사 강도/timeout 변경은 없다. 기존 Vercel GitHub 연결 status도 확인 시pending(자동 배포 진행 설명)이었고 별도 Preview Comments success는 배포 완료 증거가 아니다. 명시적 배포/재배포·Vercel 권한/연결 설정 변경은 실행하지 않았다.
- **종료 경계:** 클라이언트/명시적 Mock의4-D만 완료다. 실제 API/DB/스토리지/외부 제공자/파일 검사·D11/D13/D17/D20·정산·4단계 전체는 남는다. 연관 묶음20/22와 분리2/2의 시간 민감성도 기록했다. 다음 작업 하나는 위4-D API/보류 정책 조율이며 자동 착수하지 않는다. 전용 QA 서버만 종료했고 기존 미추적 outputs/tools는 보존·미포함이다. 마지막 커밋·푸시 후 로컬/원격/PR head 일치와 추적 파일 변경 없음을 확인한다. PR 병합·자동 병합·명시적 배포 없음.

## 기존 화면 접근 개선 (2026-10-26)

### 조사·수정 전후

- 기준은 이 Git 저장소 `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`다. 먼저 이 진행 문서를 읽고 `routes.ts`, `App.tsx`, `Shell.tsx`, Guard/session/auth와 기능/Mock의 Link·상태 조건을 추적했다. [전체 34개 경로와 중첩 기능 접근표](frontend-screen-access.md)를 추가했다. **기능 컴포넌트 19개 / Placeholder 15개**이며, 기능 화면 중 완전히 고립된 경로는 없었다. 운영 API 연동/미구현 때문에 사용할 수 없는 화면을 라우팅 누락으로 분류하지 않았다.
- **수정 전:** 홈·의뢰인의 기본 로그인 복귀점 `/me/activity`가 다음 행동 없는 Placeholder였다. 크리에이터 프로필에서 패키지/작업물 관리로 바로 연결되지 않았고, 의뢰인이 타인 모집 상세의 creator 전용 제안 CTA를 눌러 권한 거부로 끝날 수 있었다.
- **수정 후:** 홈·내 활동에서 역할별 기존 화면을 안내한다. 비회원은 공개 모집·로그인·회원가입, 의뢰인은 공개 모집·캠페인 작성/저장한 초안·프로필·제안/협의, 크리에이터는 공개 모집·프로필·패키지/제작 서비스·작업물·제안/협의로 이동한다. ops에는 공개 모집 안내만 표시하며 회원 권한으로 바꾸지 않는다. 크리에이터 프로필에서 제작 관리 두 화면으로 연결하고 의뢰인에게 creator 전용 제안 CTA를 숨긴다.
- 상세는 기존 **목록→상세→협의→조건서/서명→확정 계약→결제/준비/영상→수정/승인/최종 전달/수령** 흐름에 유지한다. 계약 ID나 데이터 없는 임의 상세 링크·전역 메뉴를 추가하지 않았다. 실제 거래 상태에 따른 행동·당사자 검증도 유지한다. 홈/활동의 데이터 기능은 여전히 미구현이며 이를 화면에 명시한다.

### 변경 파일

- `apps/web/src/app/ScreenLinks.tsx`: 기존 화면으로 가는 역할별 안내 카드. KEMI 색상/간격/카드·기존 Link 사용, API 호출 없음.
- `apps/web/src/app/route-pages.tsx`: 홈·내 활동 Placeholder에만 안내 연결. Guard와 다른 Placeholder/404 유지.
- `apps/web/src/features/profiles/ProfilePage.tsx`: 크리에이터 제작 관리 링크.
- `apps/web/src/mocks/DiscoveryDetailMock.tsx`: 기존 역할 정책에 맞춘 제안 CTA 노출.
- `apps/web/e2e/screen-access.spec.ts`: 4개 시나리오 × 데스크톱/모바일, 실제 클릭으로 로그인 복귀·초안 재진입·프로필/제작 관리/협의·역할 거부 검증.
- `docs/frontend-screen-access.md`, 이 진행 문서, `qa/frontend-access/`: 전체 경로표·운영 HTTP fixture 검증 스크립트/결과·캡처·재현용 Edge 설정·검증 기록.
- `routes.ts`/`App.tsx`는 조사 기준으로 사용했으며 경로/렌더링 매핑은 변경하지 않았다. `Shell.tsx`의 메뉴와 인증·session/API/shared/의존성/CI 설정도 변경하지 않았다. 시작부터 있던 미추적 `outputs/`, `tools/`는 보존·커밋 제외한다.

### 검증과 미해결 사항

- 고정 기능 커밋 `4574df1`에서 **웹 단위 193/193**, 수정한 접근 E2E **8/8·실패0·exit0**(Edge 데스크톱/모바일, worker1, retry0), 기본 및 두 flag 운영 `build:web`의 타입 검사·ESLint·빌드 exit0, 토큰 검사 PASS. 전체 회귀 최종 결과는 아래에 별도 추가한다.
- 운영 기본(auth 미설정) 1역할, 두 flag 빌드에서 독립 HTTP fixture 4역할(GUEST/CLIENT/CREATOR/ADMIN) 검증 PASS. 새 안내의 역할별 링크 수와 기존 캠페인/제안/영상 미연결 안내·권한 차단을 확인했다. 320/390/600/768/1024/1280px 가로 넘침 없음. Mock 코드/worker/요청 없음·페이지 오류0. 역할별390/1280px 캡처 보존, 의뢰인 모바일·크리에이터 데스크톱 시각 확인. **실제 인증/API/DB/외부 제공자·운영 배포 검증이 아니다.**
- 전체 `format:check`는 작업 전 미추적 `outputs/share/KEMI-interactive.html`, `tools/share-html/{build.mjs,main.tsx,serve.mjs,share.css,ShareGuide.tsx}` 6개에서 실패했다. 이 작업의 소스/검사/문서는 별도 Prettier·diff 검사로 검증하며 원본 미추적 파일을 포맷하지 않는다.
- 추가 실행한 API 단위는 최초 **74/87 통과·13실패**, 샌드박스 밖 동일 명령도 **75/87 통과·12실패**였다. timeout5000ms/ECONNRESET이며 원인 미해결이다. API/shared 변경은0이다. 이 접근 개선에서 API 검사나 인증 코드를 수정하지 않았으며 전체 저장소 검사 통과로 표시하지 않는다.
- 첫 접근 검사는 Mock 화면 링크 이름을 잘못 지정해6/8이었고, 실제 `내 프로필 확인`으로 검사 locator만 고쳐8/8을 확인했다. 첫 전체 회귀는 shared 빌드를 병행한 후 Vite 모듈 timestamp가 갱신되고 token fixture 오류가 발생해30통과·6실패에서 중단했다. 이후 빌드를 모두 마치고 새 서버에서 같은 소스/검사 조건으로 전체를 재실행한다. 중단 실행은 전체 회귀 통과 근거로 사용하지 않는다.
- 운영의 인증 미설정, 캠페인/협의/결제/제작/파일 API 미연결, 15개 Placeholder와 기존 정책(D05/D08/D09/D10/D11/D13/D17/D18/D20 등)은 남는다. 이를 해결하려고 Mock을 운영에 활성화하거나 권한·당사자·서명/결제/제작 상태를 우회하지 않는다. 별도 백엔드 PR의 미병합 기능을 임의 통합하지 않았다.

### Git 전달 상태

- 기존 관련 [Draft PR #65](https://github.com/Jubileekim/KEMI/pull/65)는 open·미병합·base main, head `a492cf0`였다. 접근 개선을 다루는 열린 PR은 없어 해당 선행 코드 위에 `feat/frontend-screen-access`를 생성했다. 새 PR은 선행4-D와 접근 보완의 diff를 분리하도록 #65 브랜치를 base로 한다. 선행 병합 후 base main 변경 검토가 필요하다.
- 기능/접근 검사 [4574df1](https://github.com/Jubileekim/KEMI/commit/4574df1)을 커밋·푸시했다. 전체 검증·문서/QA 전달과 Draft PR 상태는 아래 최종 기록에 추가한다. 병합·자동 병합·명시적 배포/재배포·다음 작업 자동 착수는 하지 않는다.

### 접근 개선 최종 회귀·전달

- **고정 기능 SHA `4574df1` 전체 회귀:** Edge 데스크톱148+모바일148 = **296/296·실패0·exit0·47.3분**을 단일 실행으로 통과했다. 기존288개와 신규 접근8개를 포함하며 앞선 부분/중단 실행과 합산하지 않았다. 빌드를 모두 끝내고 새 Vite 서버에서 실행해 중단 실행의 세션 fixture 실패 없이 완료했다. 모든 결과를 확인한 후 Windows 종료 대기 중인 이번 전용5192 Vite만 정리해 러너 exit0과 `status: passed / failedTests: []`를 회수했다. 전용4197 preview와5193 접근 검사 서버도 정리했다.
- [최종 전체 회귀 근거](../qa/frontend-access/full-e2e.json), [단위·운영·이전 실패 구분](../qa/frontend-access/verification.json)에 명령·고정 소스·역할·집계·제한을 보존했다. 기본/두 flag build:web·193개 단위·신규8개 집중 검사·운영 auth 미설정1/독립HTTP4역할·변경 파일 형식/diff·토큰 결과는 위와 같다. 기존 MSW favicon/React DevTools 경고는 남아 전체 콘솔 경고0으로 표시하지 않는다. 실제 서버/API/DB/외부 제공자 검증은 아니다.
- 기능 [4574df1](https://github.com/Jubileekim/KEMI/commit/4574df1), 경로표/운영 QA/진행 기록 [cd0dd15](https://github.com/Jubileekim/KEMI/commit/cd0dd15)을 커밋·푸시하고 [Draft PR #66](https://github.com/Jubileekim/KEMI/pull/66)을 생성·이 채팅에 연결했다. open·Draft·미병합이며 base는 선행 `feat/frontend-4d-final-receipt`의 `a492cf0`다. 기능 소스는 추가 변경 없이 최종 회귀 결과만 문서/QA 커밋으로 전달한다. 최신 전달 커밋은 [PR 커밋 목록](https://github.com/Jubileekim/KEMI/pull/66/commits)에서 확인한다.
- 현재 PR base는 기존 Web CI pull_request 필터에 없어 자동 Web CI 대상이 아니다. 로컬 전체 회귀와 원격 CI는 구분하며 최신 원격 실행/상태는 [Checks](https://github.com/Jubileekim/KEMI/pull/66/checks)에서 확인한다. CI 설정·수동 재실행/배포 설정을 바꾸지 않는다. 선행 #65가 병합되면 base main 조정 검토가 남는다. API 단위 timeout/ECONNRESET, 기존 미추적6개 포맷, 운영 API/미구현·정책 경계도 남으며 전체 저장소 검사 통과로 표시하지 않는다.
- 종료 범위는 기존 화면 접근 안내·연결 보완이다. 추적 소스 변경 없이 마지막 결과 기록을 커밋·푸시하고 로컬/원격 추적/PR head 일치를 확인한다. 기존 `outputs/`, `tools/`는 보존·전달 제외하며 병합·자동 병합·명시적 배포/재배포·다음 작업 자동 착수는 하지 않는다.

## 4-E 모의 정산·작업 이벤트 안내 (2026-10-26)

### 구현·정책 경계

- 원본 기능명세서 SETTLE-01(50행)·WORK-04(70행), P16/P19/P22·D12와 계획4단계3·4항, 기술 PDF, KEMI 토큰, API 문서/API/shared를 대조했다. 실제 정산/작업 사건 API가 없어 DEV/MSW로 분리하며 API/shared·의존성·lockfile·운영 인증/권한은 변경하지 않았다.
- Mock 처리기가 고정 계약/성공 전액 결제 금액·통화, 준비·최신 검토 승인→계약 최종 파일 전달→전용 수령 연결과 문제 보류를 검사한다. 정상액10% 공제·의뢰인 별도0%, 합계 일치와 계약당 성공1개를 적용한다. 양측 결과 확인 요청이 처리기를 호출하며 사용자 금액·완료 판정 입력은 받지 않는다. 실제 지급 실행 권한·처리 시점의 최종 API 계약을 확정한 것이 아니다.
- 처리 중·결과 확인 중·실패·보류·응답 미확정은 완료가 아니다. 진행 중에는 기존 ID 조정, 실패 확정 후 새 요청, 응답 유실은 재조회/같은 ID로 확인한다. 조회 오류/처리 중에는 이전 완료 내역을 숨긴다. D12 세금/VAT/절사를 정하지 않고 소수 원 수수료는 보류한다. 취소/분쟁 판정·해제/부분 환불은 실제 계약 미제공이며 이번 Mock 보류 fixture를 운영 검증으로 사용하지 않는다.
- `/contracts/:contractId/settlement`를 양측 보호 라우트에 연결했다. 기존 제작 준비/영상의 링크→정산, 정산→같은 작업방/승인 파일, 같은 방 정산 성공 안내→정확한 정산 ID로 이동한다. 서명/준비 사건도 저장 원기록에서 파생해 기존 영상/요청/승인/최종 전달/수령 안내와 함께 보여준다. 준비 이력은 해당 링크 진입 시 펼친다. 일반 대화로 사건을 만들지 않고, 안내 조회 실패로 거래를 취소하지 않는다. 인앱 알림 생성/읽음은7단계에 남는다.
- 단일 탭 메모리다. 기존 Mock 역할 marker는 새로고침 시 복원될 수 있지만 계약/영상/정산 기록은 초기화된다. 실제 API/DB/PG/송금/스토리지/취소·분쟁 보류 판정·다중 탭/영구 복원은 미연결·미검증이다. WORK-02 나머지·D09/D10/D11/D12/D13/D17/D20이 남아 **4단계 전체 완료는 아니다**.

### 변경 파일

- 모델/통신: `apps/web/src/mocks/settlement-{model,api,handlers}.ts`, `browser.ts`, 기존 `delivery-handlers.ts`/`payment-handlers.ts`/`signature-handlers.ts`의 원기록 조회 함수.
- 화면/접근: `apps/web/src/features/resolution/SettlementSummary.tsx`, `mocks/{SettlementMock,SettlementNoticesMock,WorkNoticesMock}.tsx`, `app/{App.tsx,routes.ts}`, `mocks/{ChatPanelMock,DeliveryMock,ProductionMock,FinalNoticesMock}.tsx`, `features/production/FinalReceiptPanel.tsx`, `features/terms/SignaturePanel.tsx`.
- 검사/문서: `test/settlement.test.ts`, `e2e/settlement-{helpers.ts,spec.ts}`, 기존 `e2e/final.spec.ts`의 수령 안내 locator1개, `docs/{frontend-settlement-4e,frontend-feature-matrix,frontend-screen-access,frontend-progress}.md`, `qa/frontend-4e/`. `.github/workflows/web-ci.yml`에는 이번 stacked base `feat/frontend-screen-access`1개만 허용했다. 기존 검사 명령·timeout/retry는 유지한다.

### 로컬 검증·검토 (최종 회귀 진행 중)

- 웹 단위 **200/200·실패0·exit0**(기존193+정산7), 최종 두 flag 운영 `build:web`의 타입·ESLint·빌드 **exit0**, 토큰 검사PASS. 기본 운영 인증 미설정1역할과 두 flag 운영 독립HTTP4역할에서 가드/연결 준비, Mock 코드/worker/요청 제외를 확인했다. 실제 인증/API 서버 검증이 아니다.
- 전달 대상 추적/신규 파일 Prettier·diff 검사PASS. 전체 `format:check`는 작업 전 미추적 `outputs/share/KEMI-interactive.html`, `tools/share-html/{build.mjs,main.tsx,serve.mjs,share.css,ShareGuide.tsx}`6개에서 실패했다. 해당 파일은 수정/스테이징하지 않는다. API/shared는 미수정이며 API 단위는 이번에 재실행하지 않았다. 이전 기록의 API timeout/ECONNRESET 원인은 이 범위에서 해결하지 않았다.
- 첫4-E8개는4통과/4실패(준비 이력 접힘·오류 해제 후 재조회 누락), 두 번째는6통과/2실패(새로고침 후 비회원이라는 잘못된 검사 가정)였다. 대상 이력 펼침·명시적 재조회·기존 역할 marker 복원/거래 초기화에 맞게 수정했다. 정상 공개 제안→양측 서명→주문/Mock 결제 버튼→준비/시작→검토/승인→최종ZIP 전달/다운로드/수령→정산·양측·정확한 사건 링크는 두 번째 데스크톱/모바일에서 통과했고320~1280px 넘침/정상 페이지 오류/관련 실제 제품 API 요청0을 확인했다.1280/390px 캡처를 시각 확인했다. 중간 실행과 최종 회귀 수를 합산하지 않는다.
- 명세/품질·security-review·React 점검을 별도 관점으로 수행했다. 사용자 결과/금액 주입, 객체/역할/Bearer·epoch, 응답 유실/중복, 조회 오류/DEV 경계를 검토했다. 기존 수령 화면의 ‘정산 미실행’이 성공 후에도 남는 문구는 ‘정산 결과 별도’로 수정했다. 실제 서버 보안 검토를 대신하지 않는다. 최종60개 연관 회귀 결과는 아래에 추가한다.

### Git 전달 (진행 중)

- 시작 시4-E 관련 PR/브랜치가 없었다. [Draft #66](https://github.com/Jubileekim/KEMI/pull/66)은open·미병합·head4b20339였고, 새 `feat/frontend-4e-settlement`를 해당 소스에서 생성했다. PR base는 `feat/frontend-screen-access`이며 선행 병합 후 base 조정 검토가 필요하다.
- 모델/통신/단위/근거 [f91fa24](https://github.com/Jubileekim/KEMI/commit/f91fa24)를 검토·커밋·푸시했다. 정산과 성공 사건 안내는 한 검증 흐름이므로 PR1개에 묶는다. 화면/검사 전달·최종 회귀·Draft PR/원격CI는 완료 후 아래에 기록한다. 병합·자동 병합·명시적 배포·다음 작업 자동 착수는 하지 않는다.

### 4-E 후속 전달 정리 (2026-10-27)

- 사용자 요청으로 미커밋 4-E 화면/라우트/검사를 이어서 사용했다. 변경 내용을 검토하고 웹 단위 200/200 exit0, build:web(타입·ESLint·운영 빌드) exit0, 전달 파일 Prettier/diff PASS를 새로 확인했다.
- 전용5195·Edge·worker1·retry0에서 정산 E2E 데스크톱4+모바일4 **8/8·exit0·5.0분**. 공개 제안→서명·결제·준비·승인·최종 전달·수령→정산, 보류/실패/미확정·유실/중복·권한을 검증했다. 8개 완료 뒤 이번 전용5195 프로세스만 종료해 러너 종료를 확인했다. 근거: `qa/frontend-4e/final-settlement-e2e.json`. 이전 진행 중 60개 회귀의 결과는 이 실행으로 대체하거나 통과로 주장하지 않는다.
- 실제 API/DB/PG/송금/스토리지 미검증, 기존 outputs/tools 포맷 실패 및 API timeout은 기존 경계다. 4단계 전체 완료 아님. 선행 화면 변경을 별도 전달한 뒤 사용자 지정 5단계 범위로 진행한다.

## 5-A 취소 요청·양측 합의 (2026-10-27)

- 선행 4-E 화면/검사를 `e0c4b11`로 커밋·푸시하고 [Draft PR #67](https://github.com/Jubileekim/KEMI/pull/67)을 생성했다. 모델 선행 `f91fa24`를 포함한다. 원격 CI는 이 기록 시 미확인이다.
- 관련 기존 프론트5단계 PR/브랜치 없음 확인 후 `feat/frontend-5a-cancellation` 생성. CANCEL-01/02의 사유·진행 내역·희망 완료 대가·환불 차액·파일·미완성·원본·사용권 원문, 버전별 양측 확인을 구현했다. 새 제안은 이전 확인을 승계하지 않는다. 요청만으로 환불/정산하지 않는다.
- `/contracts/:contractId/cancellation`을 실제 보호 라우트에 연결하고 기존 서명 확정 계약·준비·영상·정산 화면에서 링크로 접근한다. 요청이 있으면 정상 정산과 전용 최종 수령/승인 처리를 보류하며 대화·영상 조회는 유지한다. API/shared에는 해당 계약이 없어 `/__mock__/resolution/:contractId` DEV/MSW로 분리했다.
- 변경: `features/resolution/Cancellation{Page,Form,Agreement}.tsx`, `mocks/CancellationMock.tsx`, `resolution-{model,store,api,handlers}.ts`, `browser.ts`, `settlement-handlers.ts`, `delivery-handlers.ts`, `app/App.tsx`, `features/terms/SignaturePanel.tsx`, `mocks/{ProductionMock,DeliveryMock,SettlementMock}.tsx`, `test/cancellation.test.ts`, `e2e/cancellation{.spec,-helpers}.ts`, `qa/frontend-5/`, `docs/frontend-resolution-5.md`.
- 웹 단위205/205 exit0, build:web(타입·기존ESLint·운영빌드) exit0. Edge 데스크톱2+모바일2 **4/4 exit0**: 기존 링크 진입→요청→역할 전환→같은 최신 버전 양측 확인, 정산 보류, 구버전/미동의/다른 계약 차단, 응답 유실 재조회·조회 오류 때 이전 합의 숨김. 근거 `qa/frontend-5/5a-e2e.json`. 초기 타입 검사는 테스트의 배열/unknown 접근, 초기 lint는 라벨 연결·export 규칙에서 실패해 수정 후 통과했다. 기존 검사 강도/권한 정책은 변경하지 않았다.
- 명세와 코드 품질을 분리 검토했고, 처리기 당사자/Bearer·epoch, 입력 검증, 중복/변조/구버전, 비밀/외부URL 없음, 조회 실패 시 완료 금지를 확인했다. 실제 서버 보안·PG·DB·다중 탭·영구복원 검증 아님. 운영 인증 미설정/미연결 제한은 유지한다.
- D12 절사/세금, D13 완료 후 취소·회신 기한·증빙/해제 권한, D18 운영 권한은 미결정. 기존 정산 처리 중/성공 이후 취소는 Mock 보호 차단한다. 5-A 클라이언트/명시적 Mock만 검증했으며 5-B·5-C와 5단계 전체 완료는 아니다. 다음 작업 하나: 사용자 지정5-B 환불·분쟁·보류·운영 검토. Git/원격CI 링크는 후속 기록에 추가한다.

## 5-B 테스트 환불·분쟁·정산 보류·운영 검토 (2026-10-27 · 최종 검증 중)

- 5-A [3e8c98c](https://github.com/Jubileekim/KEMI/commit/3e8c98c)·[Draft #68](https://github.com/Jubileekim/KEMI/pull/68)를 푸시·생성했고 base는4-E다. 해당 head의 원격 workflow 실행은0건(base 필터 미포함)이므로 CI 통과로 표시하지 않는다. 이번5-B에서 stacked base4-E/5-A/5-B를 기존 Web CI 필터에 추가하며 명령/timeout/retry/workers를 유지한다.
- REFUND-01·DISPUTE-01을 `/__mock__/resolution`, `/__mock__/disputes`, `/__mock__/operations/resolution`과 전용 파일 endpoint로 분리했다. 환불액은 원결제·고정 합의 차액에서 처리기가 계산하며 사용자 금액/성공 결과를 받지 않는다. 미확정/처리 중은 같은 ID 확인, 확정 실패 뒤 새 요청, 성공 환불1개/합계 한도·동일 버전·전액 성공 결제를 검사한다.
- 합의 파일 ZIP 등의 실제 Mock 다운로드와 별도 의뢰인 수령을 구현했다. 파일 없는 인도도 제시 내용과 합의의 일치를 의뢰인이 명시적으로 확인한다. 환불 성공만으로 취소 완료하지 않으며 운영 근거 기록/보류 해제 뒤 잔여 완료 대가10%를 공제해 모의 정산한다. 정상 계약 전액 정산 경로는 취소 요청 뒤 계속 차단해 이중 지급하지 않는다.
- 분쟁 사유·텍스트 증빙·진행 기록·담당/검토 근거·다음 안내, 보류 유지/합의 복귀를 제공한다. `/disputes/:disputeId`를 정확한 분쟁 링크에 연결하고, `/ops/disputes`를 기존 ops 보호 경로·운영 주 메뉴에 연결했다. DEV auth fixture의 ADMIN만 검토할 수 있고 당사자 확인·서명·파일 수령을 대신하지 않는다. 일반 회원의 운영 진입/API·운영자의 확인 대행은 거부한다. 운영 인증/권한 정책/API/shared는 미수정이다.
- 변경: `mocks/resolution-workflow-model.ts`, 기존 resolution 모델/저장/통신/처리기·`CancellationMock.tsx`, `ResolutionWorkflowMock.tsx`, `ReviewMock.tsx`, `DisputeMock.tsx`; `features/resolution/{RefundStatusPanel,DisputePanel,DisputePage}.tsx`, `features/operations/ReviewPage.tsx`; `app/{App.tsx,layouts/Shell.tsx}`, DEV 전용 `auth-handlers.ts`/`DevTools.tsx`, `CancellationAgreement.tsx`의 완료 후 결과 문구; `test/resolution-workflow.test.ts`, `e2e/refunds-disputes.spec.ts`/기존 결제·취소 테스트 helper의 협의 금액 입력, CI base필터, 접근표/기능표/5단계 근거·QA.
- 웹 단위 **214/214 exit0**, 최종 build:web(타입·기존 ESLint·운영빌드) exit0, 토큰/이번 전달 파일 Prettier·diff PASS. 첫5-A/5-B Edge8개는 **8/8 exit0·4.2분**. 20만원 계약→대가8만원→환불12만원→합의ZIP SHA일치 다운로드/별도 수령→근거 해제→수수료8천원/잔여7.2만원과 양측 조회, 전액 환불0정산·UNKNOWN→FAILED→새 요청/유실 복구·역할 거부를 확인했다. 이 실행 이후 재분쟁 해제/동일 요청 상대방 조정/완료 문구를 보완해 최종76개 통합/회귀를 실행 중이며 수를 합산하지 않는다.
- 검토: 명세와 품질·보안을 분리해 입력 주입/비밀/파일/외부URL, 처리기 Bearer·계약 당사자·epoch, 원결제/버전/한도/중복·미확정 금전 잠금, 완료 전 파일/해제 조건과 React 상태/오류/라벨을 확인했다. 실제 서버 보안 검토를 대체하지 않는다. 기존 합의 완료 문구가 환불 후에도 미실행으로 남던 문제를 결과 별도 확인으로 고쳤다.
- 기본 운영 빌드의 새3경로 인증 미설정 안내·Mock 코드/worker/요청 제외 검사 **3/3 exit0**. 두flag/독립HTTP4역할 검증은 브라우저 검사 종료 후 순차 실행한다. 실제 API/DB/PG/송금/스토리지/파일 내용·악성파일·ZIP 내부 검사·증빙 첨부 저장/다중 탭·영구복원은 미연결·미검증이다. D12/D13/D17/D18은 미결정이며 소수 원 수수료·완료 후 취소·미확정 정산을 임의 완료하지 않는다.
- 선행4-E [CI40424222650](https://github.com/Jubileekim/KEMI/actions/runs/40424222650)는 생성 JSON 포맷 때문에 실패(뒤 단계 skipped)했다. 원격의 newline 보완 `fd9b5e2`를 확인하고 전체 포맷 수정 [600ce4d](https://github.com/Jubileekim/KEMI/commit/600ce4d)를 추가했다. [새 CI40426261708](https://github.com/Jubileekim/KEMI/actions/runs/40426261708)는 확인 시 진행 중이며 성공으로 표시하지 않는다.
- 5-B 최종 결과·커밋/PR은 완료 후 이어서 기록한다. 다음 작업 하나는 사용자 지정5-C 공개 모집 통합 검증이며 현재 실행 중이다. 다음 범위 착수·PR 병합/자동 병합·명시적 배포 없음.

### 5-B 최종 통합·운영 검증

- 최종 소스에서 Edge 데스크톱38+모바일38 **76/76·실패0·건너뜀0·retry0·exit0·27.8분**. 5-A4·5-B4·5-C4와 기존 서명12/제작10/영상12/수정12/최종수령10/정산8을 한 실행으로 확인했다. 5-A/5-B 부분집합8개도 같은 실행의 결과이며 앞선8개와 합산하지 않는다. 원본 보고서의 5-A/5-B 부분집합은 `qa/frontend-5/5b-final-e2e.json`에 개별 결과·명령·소스 해시를 보존했다. 전체 `final-e2e.json`과 신규 공개 모집 검사는5-C 전달에 포함한다. 76개 완료를 확인한 후 이번 전용5195 Vite만 종료해 러너 exit0을 회수했다.
- 정상 공개 모집→협의/동일 조건 서명→Mock 전액 결제→준비/시작→검토·수정/승인→최종ZIP 다운로드/전용 수령→모의 정산, 취소/분쟁 분기의 양측 합의→원결제 환불→합의 파일 인도/다운로드/수령→운영 검토/근거 해제→잔여 정산을 확인했다. 신규 두 역할/운영 경로, 미합의·구버전·금액/결과 주입·타회원/위조 Bearer·지연 로그아웃·새로고침·응답 유실·기존 서명 만료 정각도 포함한다. 전체 웹 E2E316개를 실행한 결과로 확대하지 않는다.
- 정상 신규 통합의 페이지 예외/관련 실제 제품 API·외부 제공자 요청0, 취소 완료 화면320/390/600/768/1024/1280px 가로 넘침 없음과1280/390px 캡처를 확인했다. 기존 MSW favicon/React DevTools 경고는 남아 전체 콘솔 경고0으로 표시하지 않는다.
- 전체 format:check는 작업 전 미추적 outputs/tools6개만 실패(exit1)했다. 이번 전달 파일의 별도 Prettier/diff·토큰은 PASS. API/shared·의존성·lockfile 변경0이며 기존 API 단위 timeout 원인 해결/재실행은 이 범위에서 하지 않았다.
- 실제 API·PG·DB·스토리지와 정책/완료 후 취소/미결제 취소 종결·취소 없는 분쟁의 정상 작업 재개는 남는다. 이번 Mock은 성공한 전액 결제와 취소 합의의 합계를 검사하며, 미결제에는 요청 기록까지만 허용한다. 보류 해제 권한/회신 기한/세금·절사를 생산 정책으로 확정한 것이 아니다. 5단계 실제 서비스 전체 완료로 표시하지 않는다.

- **운영 최종:** 두flag(`VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`) 운영 build:web(타입/기존ESLint 포함) exit0. 독립HTTP GUEST/CLIENT/CREATOR/ADMIN×새3경로 **12/12 exit0**, 기본 인증 미설정3/3과 합쳐15개 보호/미연결 안내 검사다. Mock 코드/요청/worker 제외·페이지 예외0. 실제 인증/API/외부 제공자 검증이 아니다. 환경 값은 명령 종료 전 제거했고 전용4205 preview도 exit0으로 종료했다.

### 5-B Git 전달

- [10e4b02](https://github.com/Jubileekim/KEMI/commit/10e4b02) 커밋·푸시, [Draft PR #69](https://github.com/Jubileekim/KEMI/pull/69) 생성·이 채팅 연결 완료. base는 미병합5-A `3e8c98c`이며 선행 병합 후 base 조정 검토가 필요하다. 핵심 모델·파일·화면·운영 보류·검사는 한 취소 종결 흐름이어서 하나의 독립 검증 묶음으로 전달했다.
- source/API/shared·의존성 범위를 재검토하고 전달 파일 형식/diff를 확인했다. 다음5-C는 이미 검증한 공개 모집 검사와 전체76개 결과/정상 캡처 전달만 포함하며 제품 코드를 추가하지 않는다. 원격 CI는 아래 종료 기록에서 별도로 확인한다.

## 5-C 공개 모집 전체 흐름 통합 검증 (2026-10-27)

- `apps/web/e2e/public-recruitment.spec.ts`: 기존 공개 모집 작성/공개·제안·협의·조건서/양측 서명·전액 Mock 결제·준비/제작·검토/승인·최종ZIP 다운로드·전용 수령·정산을 실제 UI와 기존 helper로 잇는다. 정산 후 취소 역행은 D13 보호 차단으로 확인했다. 양측 조회와 같은 작업방의 정확한 정산 링크도 검증했다.
- 두 번째 통합은 새 취소 경로의 지연 확인 중 로그아웃·위조 Bearer·실제 다른 Mock 신규 회원의 객체 접근 거부·운영 가드·새로고침 거래 초기화를 확인한다. 취소/환불/분쟁의 분기 전체는5-A/5-B 검사와 함께 최종76개 실행에 포함했다. 시간 정책을 만들지 않았으며 기존 서명 만료 정각·새 확인 버전·대화 유지는 기존3-B 검사로 확인했다.
- 신규5-C 데스크톱2+모바일2 **4/4**는 최종76/76·exit0의 부분집합이다. 개별 기능만 완료한 뒤 단계 통합을 생략하지 않았다. `qa/frontend-5/final-e2e.json`에 같은 실행의 전체 개별 결과/명령/소스 해시를 추가하고 `normal-*.png`는 같은 실행의4-E 정상 통합에서 별도 보존했다. 앞선 실행과 합산하지 않는다.
- 최종 단위214/214·기본/두flag build:web·운영15개·토큰·전달 파일 형식/diff 결과는 위와 같다. 전체 웹316개는 목록 확인만 했으며 이번에는 연관76개만 실행했다. 실제 제공자·API/DB·운영 인증·배포 검증이 아니다.
- 5-A/5-B의 클라이언트·명시적 Mock 구현과5-C 통합 검증 범위만 완료다. 실제 서비스의5단계 전체 완료는 아니다. API/파일/PG·미결정 정책/미결제·완료 후 취소/취소 없는 분쟁의 정상 작업 재개·영구 복원/다중 탭, 기존 outputs/tools 포맷·API timeout은 남는다.
- **다음 작업 하나:** 5단계 취소·환불·분쟁 API 및 D12/D13/D18 정책 조율. 원결제/같은 합의 버전/파일·증빙/보류 해제·운영 권한과 미결제·완료 후 취소/작업 재개 계약을 합의한다. 별도 요청 후 착수하며6단계·PR 병합/자동 병합·명시적 배포는 진행하지 않는다.

### 5-C Git 전달·종료 상태

- 검사/전체 근거 [ceffc73](https://github.com/Jubileekim/KEMI/commit/ceffc73)를 커밋·푸시하고 [Draft PR #70](https://github.com/Jubileekim/KEMI/pull/70)을 생성·이 채팅에 연결했다. base는5-B `10e4b02`다. 이번 범위의 독립 묶음은 [5-A #68](https://github.com/Jubileekim/KEMI/pull/68), [5-B #69](https://github.com/Jubileekim/KEMI/pull/69), [5-C #70](https://github.com/Jubileekim/KEMI/pull/70)으로 분리했다. 모두 Draft/open·미병합이며 선행 병합 후 base 조정 검토가 필요하다.
- **원격 Web CI(로컬과 별도):** 선행4-E [600ce4d/run40426261708](https://github.com/Jubileekim/KEMI/actions/runs/40426261708)는 포맷·단위·빌드 success, 브라우저 in_progress였다. 따라서 최초 JSON 포맷 실패는 수정됐지만 원격 전체 통과는 아니다. 5-A `3e8c98c`는 base 필터 때문에 실행0건이었다. 5-B [10e4b02/run40430076103](https://github.com/Jubileekim/KEMI/actions/runs/40430076103)는 포맷·단위·빌드 success/브라우저 in_progress, 5-C [ceffc73/run40430191777](https://github.com/Jubileekim/KEMI/actions/runs/40430191777)는 포맷·단위 success/빌드 in_progress였다. 최신 문서 전달은 새 CI 대상이므로 최종 원격 결과는 아직 미검증이며 [#70 최신 Checks](https://github.com/Jubileekim/KEMI/pull/70/checks)를 확인한다. 원격 전체316개 통과를 로컬76개로 대체하지 않는다.
- 로컬 종료 검증: 단위214/214, 연관 E2E76/76, 기본/두flag build:web, 운영 보호/미연결15개·Mock 제외, 토큰·전달 파일 형식/diff PASS. 서버 API/shared·의존성/lockfile·원본 엑셀/PDF/디자인 키트 변경 없음. 기존 outputs/tools는 시작 상태 그대로 미추적·미포함이다. 브라우저/운영 preview 전용5195/4205를 정리했고 다른 기존 프로세스는 종료하지 않았다.
- 푸시 뒤 원격 추적 ref가 로컬에 없던 상태를 발견해 해당 브랜치들만 명시적으로 fetch하고 로컬/원격 추적/PR head를 대조했다. 마지막 종료 기록은 문서만 추가하며 [#70 커밋 목록](https://github.com/Jubileekim/KEMI/pull/70/commits)에서 최종 전달 SHA를 확인할 수 있다. 새 기능/다음 범위·병합·자동 병합·명시적 배포/재배포는 실행하지 않았다.

## 7-A 활동 목록·캠페인 저장·추천 (2026-10-27)

- 기존7단계 브랜치/PR 없음 확인. 원본 KEMI의 스테이징된6-C 변경을 보존하고 확인된6-B `8fecb83`에서 `../KEMI-frontend-7` worktree/`feat/frontend-7a-activity`를 분리했다. 6-C 전체 완료를 전제로 하지 않는다.
- `/me/activity`, `/bookmarks`, `/recommendations`를 기존 역할 가드에 연결했다. 본인 모집·초안·의뢰/계약의 정확한 상세·납품·정산·리뷰 링크, 기존 주 메뉴와 모집 상세 저장 버튼을 연결했다. 크리에이터 저장/해제는 멱등이며 의뢰인·위조Bearer·사용자ID 주입을 처리기에서 차단한다.
- 변경: `features/activity/ActivityPage.tsx`, `mocks/{activity-model,activity-api,activity-handlers,ActivityMock,BookmarkMock,member-request}`, `profile-handlers`의 내부 프로필 조회, App·Shell·DiscoveryDetailMock·browser, activity 단위/E2E, `docs/frontend-activity-7.md`, QA Edge설정, CI의 stacked base 필터. API/shared·의존성·lockfile·운영 인증/권한은 변경하지 않았다.
- 로컬 웹 단위221/221·build:web(타입/기존ESLint/운영빌드) exit0, 토큰·전달 파일 Prettier/diff PASS. 새5197·Edge 데스크톱2+모바일2 4/4·실패0·건너뜀0·retry0·exit0. 메뉴→저장/해제→목록→추천/역할 제한, 중복·위조·ID주입·본인 목록, 실제 프로필 분야 변경 후 추천 이유 일치·조회 오류 때 이전 결과 숨김/복구를 확인했다.
- 초기 lint 규칙 위반·Mock Bearer 누락과 추가 검사의 잘못된 프로필 endpoint를 수정했다. 수정/HMR이 겹친 초기 브라우저 실행2개 및 추가 검사2개 실패는 최종4/4와 합산하지 않는다. 서버 API 보안/실제 API·DB·추천 제공자 검증이 아니다.
- 추천은 현재 프로필 분야와 캠페인 제품 표현만 비교하는 명시적 개발 예시다. 정보 부족/일치 없음·일정/스타일/가격 적합 미보장 표시. D15 숨김 대상/추천 규칙, 실제 Project와 Mock Campaign ID·DTO 조율·다중탭/영구복원은 남는다. 정상 API 북마크/알림은 존재하지만 현재 모집/거래 Mock과 혼용하지 않는다.
- 검토: 원본 명세와 최종 코드 품질을 분리해 확인했고 입력/권한/응답 오류·중복·비밀값/외부URL/데이터 노출을 점검했다. 운영 보안 증명은 아니다. 다음 작업 하나는 이번 사용자 지정7-B 알림·리뷰다. 7단계 전체 완료 아님. Git 링크는 후속 전달 기록에 추가한다.

### 7-A Git 전달

- [c05e16f](https://github.com/Jubileekim/KEMI/commit/c05e16f) 커밋·푸시, [Draft PR #73](https://github.com/Jubileekim/KEMI/pull/73) 생성·채팅 연결. base는 확인된6-B `8fecb83`/PR#72다. 원격 [Web CI40436932279](https://github.com/Jubileekim/KEMI/actions/runs/40436932279)는 조회 시 in_progress로 로컬 통과와 구분한다.

## 7-B 알림·읽음·상호 리뷰 (2026-10-27)

- `/notifications`, `/contracts/:contractId/review`를 기존 역할 가드에 연결하고 상단 알림 링크·미확인수, 활동/정산→리뷰 진입을 추가했다. 제안·협의·서명·계약·성공 결제·준비·영상 제출·수령·성공 정산의 기존 당사자 기록에서 안정된 사건ID로 알림을 유도한다. 본문에 연락처·주소·브리프를 복사하지 않는다. 영상 알림은 정확한 version query를 연결한다.
- 알림 목록은20개씩·미확인 필터/개별/최대200개 읽음·빈/오류/재조회, 상단은10초 간격 DEV 조회다. 실패/미확정 정산에 성공 알림을 만들지 않는다. 읽음 상태는 수신자별이며 채팅 읽음과 분리한다. 동일 사건/중복 읽음도 수가 증가하지 않는다. 결제 원본에 시각 필드가 없어 해당 안내는 최초 확인 시각이며 발생 시각으로 주장하지 않는다.
- 리뷰는 고정 계약 당사자·정상 최종 수령·미해결 문제 없음·취소/분쟁 없음 조건을 처리기에서 재검사한다. 양측 각각1회, 동일 입력 재전송은 같은 결과, 변경된 두번째 리뷰/위조Bearer/평점/대상 주입은 거부한다. 공개 시점·수정·삭제·취소 리뷰/태그 정책 D14는 미결정이며 본인 내용/본인 작성 표본만 표시하고 공개 평점/상대 알림은 보류한다.
- 변경: `features/activity/{EngagementPage,NotificationLink}`, `mocks/{engagement-model,engagement-events,engagement-handlers,engagement-api,EngagementMock,NotificationBadgeMock}`, App·Shell·browser·SettlementMock, engagement 단위/E2E. API/shared·실제 인증/권한·의존성/lockfile은 유지했다.
- 로컬 단위224/224·build:web(타입/기존ESLint/운영빌드) exit0. Edge 데스크톱2+모바일2 **4/4·실패0·건너뜀0·retry0·exit0·4.0분**. 기존 공개 모집 거래→정상 수령→활동 리뷰/응답 유실 후 입력 보존/재조회→중복·양측 작성/상대 내용 비공개→부재중 알림/전체 읽음·타인ID 거부·미완료 리뷰 거부/조회 오류를 검증했다. 초기 Shell import lint1건은 수정 후 build 통과했다.
- 명세와 품질을 별도 검토하고 React 컴포넌트의 훅/경로 key·폼 라벨·취소 신호/epoch·텍스트 출력과 입력·권한·비밀/외부URL 노출을 점검했다. 운영 보안 검증이 아니다. 인앱 영구 저장/사이트 종료·다중기기 재접속, 실제 API/DB·사건 원자성·생성 실패 재처리는 미연결/미검증이다. 같은 SPA 탭에서 다른 화면에 있는 동안의 사건 조회만 검증했다. NOTI-01 전체/실제 서비스7단계 전체 완료 아님.
- 다음 작업 하나는 사용자 지정7-C 신고·이용 제한 안내·분석 이벤트와 단계 통합 검사다. Git/원격CI 링크는 후속 기록에 추가한다. 병합/자동병합/명시적 배포 없음.

### 7-B Git 전달

- [0aa676b](https://github.com/Jubileekim/KEMI/commit/0aa676b) 커밋·푸시, [Draft PR #74](https://github.com/Jubileekim/KEMI/pull/74) 생성·채팅 연결. base는7-A `c05e16f`다. 원격 [Web CI40437880276](https://github.com/Jubileekim/KEMI/actions/runs/40437880276)는 조회 시 format/단위/build success·브라우저 in_progress로 로컬과 구분한다.7-A CI40436932279도 같은 상태였다.

## 7-C 신고·이용 제한 안내·분석과7단계 통합 (2026-10-27)

- `/reports/new`, `/ops/reports`를 기존 회원/운영 가드에 연결했다. 회원/운영 메뉴·모집 상세/본인 의뢰의 신고 링크, 신고 접수/증빙 텍스트·수동 검토/경고/제한/해제·당사자 근거 안내·이의 이력을 제공한다. 신고만으로 제재하지 않으며 자동3아웃도 없다. 대상자 응답에는 신고자/사유/증빙을 제외하고 안내 근거/이의만 제공한다.
- DEV 제한은 계정 인증 상태 ACTIVE를 변경하지 않고 신규 공개 모집·제안·직접 발송만 처리기에서 보류한다. 양 역할의 기존 거래·대화·납품/다운로드·이의는 기존 당사자 검증을 유지한다. 제한 상태를 모사한 인증 fixture가 기존 컨트롤러에서 거부됨을 별도 테스트했고 운영 정책을 바꾸지 않았다. 실제 제한 계정의 기존 거래 접근은 미검증이며 D18/API 조율 대상이다.
- `shared/analytics/events.ts`에 피드/실제 playing/공개 제작자 조회/성공 의뢰·계약/정상 모의 정산 완료의 strict 테스트 payload와 확정 사건 중복 제거·실패 격리를 연결했다. 별도 actor/세션 식별·이메일·연락처·주소·URL·브리프를 기록하지 않는다. 제작자 조회는 공개 제작자 객체 식별만 사용한다. D22 동의/저장/도구/보존 미결정으로 운영 수집은 연결하지 않았다.
- 변경: `features/operations/{SafetyPage,RestrictionNotice}`, `mocks/{SafetyMock,RestrictionNoticeMock,safety-model,safety-store,safety-api,safety-handlers}`, App/Shell/browser, 모집/의뢰 신고 링크, campaign/proposal/direct의 신규 거래 가드, catalog/creator/signature/settlement의 분석 호출, engagement-events의 신고/처리 안내, activity 요약/기존 ScreenLinks 복원. 리뷰/운영/이의 폼은 RHF/Zod로 통일하고 알림 필터·페이지를 URL에 보존했다. 관련 단위/E2E·settlement 준비 helper·3개 대조 문서와 `qa/frontend-7/`에 결과를 보존했다. API/shared·의존성/lockfile·실제 인증/권한은 변경하지 않았다.
- 로컬 웹 단위 **229/229**, 기본 build:web(타입/기존ESLint/운영빌드) exit0·전체 format:check·토큰·diff PASS. 실제 API·DB·외부 제공자/실제 추천·분석·영구/사이트 종료·다중기기 검증이 아니다. 기본 운영 빌드7경로 보호/Mock 제외 **7/7**을 확인했고 두flag 결과는 아래 최종 검증에 추가한다.
- 단계 통합과 회귀24개 실행은 **22통과/2실패·건너뜀0·retry0·7.1분**. 변경 없는20개(7-A4·7-C통합4·기존 화면접근8·직접 발송4)는 모두 통과했다. 정상 공개 모집→동일 계약·결제·제작/납품·수령·정산→활동/리뷰·신고/유실1건 복구→운영 근거 제한→양 역할 신규 거래 거부·기존 파일 다운로드/대화·이의→해제와 개인정보 없는 계약/완료1회 기록을 확인했다. 별도 피드/실제 영상 재생/제작자 이벤트·비회원/운영/위조Bearer/지연 로그아웃·제한 인증도 확인했다.
- 두 실패는 모바일 알림 필터의 URL 전환과 controlled 체크 상태 동기 문제, 기존 검토 승인 준비의 터치 클릭 후 POST 미발생(trace 확인)이었다. URL별 native checkbox 초기값/key로 동기화하고, 준비 helper는 버튼 활성 확인·키보드 기본 활성·실제 POST 응답 대기로 바꿨다. timeout/retry·제품 승인/권한 정책은 유지했다. 수정 후 영향받는 알림/리뷰 **데스크톱2+모바일2 4/4·실패0·건너뜀0·retry0·exit0·3.3분**. 전체24개 한 실행 통과로 합산하지 않는다. `partial-e2e.json`, `final-engagement-e2e.json`에 개별 결과와 후자의 소스 SHA256을 보존한다.
- 초기 shared 재빌드/HMR이 겹친4개 실패, 잘못된 DEV 인증 선택자에 의한2개 timeout, 사용자 마무리 요청으로 중단된24개 실행(완료 보고서 없음)은 최종 근거와 구분한다. 재검증은 빌드/단위를 끝낸 후 소스를 고정하고 실행했다. 1280px/모바일 캡처를 보존하고 가로 넘침 없음·KEMI 공통 토큰/카드/버튼을 확인했다.
- 검토는 명세/품질을 분리했고 strict 입력·당사자/수신자·Bearer/epoch·중복/유실·개인정보/비밀/주입·정상 성공 근거·분석 실패 경계를 확인했다. 자체 검토와 실제 테스트를 구분하며 서버 보안 보증이 아니다.
- 남은 일: D14 리뷰 공개/수정/삭제·취소/태그, D15 추천/저장 숨김, D18 실제 제한 인증·운영 권한/증빙 파일/감사, D22 실제 수집/동의/저장/보존, 실제 API/DB 및 인앱 영구 보관/사이트 종료·다중 기기/전체 사건 생성 원자성·실패 재처리. 이번 구현·Mock/단계 통합 범위만 전달하며 실제 서비스7단계 전체 완료가 아니다. 원본6-C 미커밋 기반은 보존했고6-C 전체/직접 응답 만료의 추가 완료를 주장하지 않는다.
- **다음 작업 하나:** 7단계 API 및 D14/D15/D18/D22 정책 조율. 자동 착수하지 않는다. Git/원격CI 최종 링크는 전달 기록에 추가한다. 병합·자동병합·명시적 배포 없음.

### 7단계 최종 운영 빌드·종료 검증

- 두flag(`VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`) 운영 build:web(타입·기존ESLint 포함) exit0. 독립 HTTP GUEST/CLIENT/CREATOR/ADMIN×7경로 **28/28 exit0**, 기본 인증 미설정7/7과 구분해 총35개 보호·미연결 안내를 검사했다. Mock/분석 코드·worker·요청 제외·페이지 예외0. `production-default.json`, `production-flags.json`은 실제 인증/API/DB 검증이 아니다. 명령 종료 후 환경 값을 제거했다.
- 최종 검증 근거는 단위229/229, 타입/기존lint/운영빌드, 전체 형식/토큰/diff, 수정 후 관련4/4와 앞선 변경 없는20개 통과다. 전체24개 단일 실행 통과나 원격 전체 E2E 통과로 확대하지 않는다. API/shared·의존성/lockfile·원본 엑셀/PDF/디자인 키트 변경0. 초기 설치 캐시·진단 스크립트는 제거했고 tmp 원시 trace/로그·dist·node_modules는 전달하지 않는다.
- 원본 작업 폴더의6-C 변경과 outputs/tools는 건드리지 않았다. 이번 수정과 문서는 별도 `KEMI-frontend-7` worktree에 있으며 Git 브랜치/PR을 통해 전달한다.7-C Git/원격CI는 아래 후속 기록에서 확인한다.

### 7-C Git 전달·선행 리뷰 조건 동기화·종료

- [ea1b834](https://github.com/Jubileekim/KEMI/commit/ea1b834) 커밋·푸시, [Draft PR #76](https://github.com/Jubileekim/KEMI/pull/76) 생성·채팅 연결. base는7-B다. 종료 대조 때 원격7-B가 `0aa676b`에서 `c7ccf7d`로 갱신된 것을 발견했다. 정산 성공 후에만 리뷰를 허용하는 선행 수정/실패·UNKNOWN 검사/포맷3개 커밋을 읽고 [d794a9b](https://github.com/Jubileekim/KEMI/commit/d794a9b)로 충돌 없이 동기화했다. PR 병합이 아니라 이 작업 브랜치에서 선행 소스를 보존한 것이다.
- 현재 리뷰 조건은 정상 최종 수령·미해결 없음·취소/분쟁 없음·**모의 정산 SUCCEEDED**다. 화면/차단 안내도 일치시켰다. 동기화 후 웹 단위229/229·기본 build:web(타입/기존lint/운영빌드) exit0, 최종 관련 Edge 데스크톱3+모바일3 **6/6·실패0·건너뜀0·retry0·exit0·3.8분**. 정산 전/FAILED/UNKNOWN 리뷰 차단과 정산 성공 후 양측 작성·중복/유실/권한·알림 URL 필터를 확인했다. 이6개가 앞선4개 재검증을 대체한다. `final-engagement-e2e.json`은 이 최종6개와 현재 소스 SHA256이며 앞선20개와 단일 실행으로 합산하지 않는다.
- 기본7개·두flag28개 운영 보호/미연결·Mock/분석 제외35개는 위 기록을 따른다. 선행 동기화는 DEV 리뷰 조건/검사와 안내만 변경했고 운영 모드에서 해당 Mock을 제외하는 구조를 유지한다. 실제 API/제공자·정책/영구 보관의 미검증 범위는 그대로다.
- 원격 CI는 별도다. 7-B 최신 `c7ccf7d`의 [run40442026161](https://github.com/Jubileekim/KEMI/actions/runs/40442026161)는 format:check 실패·후속 단위/build/E2E skipped였다. 이번 최종 브랜치는 전체 Prettier 검사로 다시 확인한다. 7-C 최초 `ea1b834`의 [run40442423753](https://github.com/Jubileekim/KEMI/actions/runs/40442423753)는 생성 시 in_progress였다. 마지막 전달 커밋은 새 CI 대상이므로 원격 전체 통과로 표시하지 않으며 [#76 최신 Checks](https://github.com/Jubileekim/KEMI/pull/76/checks)를 확인한다.
- 최종 묶음은 [7-A #73](https://github.com/Jubileekim/KEMI/pull/73), [7-B #74](https://github.com/Jubileekim/KEMI/pull/74), [7-C #76](https://github.com/Jubileekim/KEMI/pull/76)이다. 선행 병합 후 base 조정 검토가 필요하다. 후속 안내/검증 전달 SHA는 [#76 커밋 목록](https://github.com/Jubileekim/KEMI/pull/76/commits)에 보존한다. 이번 전용5197/4207 서버를 정리했다. 원본 작업 폴더/다른 프로세스는 종료하지 않았다. 다음 작업 자동 착수·PR 병합/자동병합·명시적 배포 없음.
