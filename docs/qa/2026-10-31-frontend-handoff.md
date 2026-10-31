# KEMI 프론트엔드 QA·고도화 인수인계 — 2026-10-31

> 발표/팀원 공유 자료는 [Google Drive — 05_개발_QA_인수인계](https://drive.google.com/drive/folders/1TxklzKgr5cTEUIthrOqsYxaK9O7WWkIm)를 참고한다. 이 문서는 실제 소스코드·테스트·PR 이력의 탐색 기준이며 배포 완료 또는 운영 거래 검증을 보증하지 않는다.

## 현재 검증된 저장소 상태

- 기준 `main`: `4859d8b8e64b9b6d10f7b42abad29bb3189c2e1d` (2026-10-29 10:03 UTC).
- 2026-10-31 GitHub 조회: 미병합 PR **0건**.
- 관련 PR **#100~#101, #103~#109 전부 MERGED**. PR #102는 PR이 아닌 QA 추적 **Issue**이며 **OPEN**.
- PR 리뷰·머지·CI를 실제 서비스에서 사용자 역할별로 끝까지 테스트했다는 의미로 확대 해석하지 않는다. `main`이 갱신되면 이 문서의 기준 SHA도 이후 갱신할 것.

## 완료 코드 변경과 원본 PR

| 영역 | PR | 변경사항 |
| --- | --- | --- |
| 모집 예산 | [#100](https://github.com/Jubileekim/KEMI/pull/100) | 최대 1,000,000,000원 입력 제한 |
| 인증/권한 UX | [#101](https://github.com/Jubileekim/KEMI/pull/101) | 비인가 페이지, 타인 의뢰·계약 접근 오류 안내 |
| 첫 방문 로딩 | [#103](https://github.com/Jubileekim/KEMI/pull/103) | 랜딩 목록 지연 보조 안내 및 회귀 테스트 |
| 서명 파일 | [#104](https://github.com/Jubileekim/KEMI/pull/104) | 팝업 차단·파일 주소 조회 실패 구분 및 안내 |
| 채팅 첨부 | [#105](https://github.com/Jubileekim/KEMI/pull/105) | 업로드 후 전송 실패 재시도 시 같은 첨부/명령 ID 재사용 |
| 작품 영상 | [#106](https://github.com/Jubileekim/KEMI/pull/106) | 영상 미등록·URL 조회 실패·재생 실패 구분과 재시도 |
| 작품 저장 | [#107](https://github.com/Jubileekim/KEMI/pull/107) | 조회 실패를 미저장으로 오표시하지 않음; 해제 오류 표시 |
| 피드 페이지 | [#108](https://github.com/Jubileekim/KEMI/pull/108) | 잘못된 page URL을 1페이지로 정규화; 유닛 테스트 |
| 모집 스타일/이미지 | [#109](https://github.com/Jubileekim/KEMI/pull/109) | 스타일 5개 한도, 프로필 이미지 유형·빈 파일·10MiB 한도 검사 |

이 표는 **GitHub에서 확인한 병합 이력**이며, 실제 Production의 해당 커밋 배포 여부를 따로 확인해야 한다.

## 해결되지 않은 위험과 후속 과제 (Do not close without evidence)

- **P1 / 콜드스타트·지연** — Render Free 유휴 후 기동 지연이 가설. #103은 안내만 추가. 네트워크 타이밍 실측, 재시도 UX, 호스팅 플랜 개선 여부는 미확정.
- **P1 / 릴리스 게이트** — GitHub required checks, Render auto-deploy 정책을 실제 관리자 설정에서 확인하고, CI 완료 전에 Production이 바뀌지 않게 검토할 것.
- **P1 / 역할별 실사용자 격리** — 비회원 401 수동 확인만으로 로그인 계정 A/B간 계약·의뢰·파일 격리를 증명할 수 없음.
- **P1 / 연속 거래 테스트** — 의뢰 → 조건서 → 양측 서명 → Toss *테스트* 결제 → 제작·납품 → 모의 정산. 운영 실결제/실정산·실고객 정보 사용 금지.
- **P2 / 시연 품질** — 시연 작품의 공개 권리 및 실제 타깃 적합성, 모집 제목 오타 여부, 390px 모바일·키보드·스크린리더, 오류 상태 UX.
- **P2 / 데이터베이스 최적화** — FK 인덱스 경고는 실제 쿼리 실행 계획과 트래픽에 근거해 결정. 근거 없는 운영 DDL 금지.

상세 항목과 사용자 테스트 체크리스트: [Issue #102](https://github.com/Jubileekim/KEMI/issues/102).

## 실제 사용자 테스트 프로토콜

1. 비회원 1명 — 랜딩/필터/작품/CTA/로그인 안내.
2. 의뢰인 2명 — 탐색/패키지 비교/가입/직접 의뢰 초안.
3. 크리에이터 1명 — 가입/프로필/작품·패키지 공개/공고 지원/활동.
4. 관측 항목 — 화면 경로, 과제 성공률, 걸린 시간, 포기 지점, 재현 가능한 오류, 익명화한 화면 증거.
5. 수정 프로세스 — 재현 → Issue 또는 재현 기록 → 최소 변경 PR + 회귀 테스트 → 승인 + 필수 CI → 병합 → 운영 재검증. 사람이 수행한 UT와 자동 브라우저 검사는 따로 표기.

## 문서 저장 규칙 및 외부 자료

- **GitHub**: PRD/ERD/기능·API 계약/런북/QA 기술 기록과 실제 실행 테스트 및 코드 변경 기록.
- **Drive**: 최종 발표본, 팀원 원본 산출물, 디자인 시스템, 발표 개정본, PM 회고·QA 인수인계 문서. 원본 발표 파일을 덮어쓰지 않는다.
- Drive 새 문서:
  - [프론트엔드 QA·PR 병합현황](https://docs.google.com/document/d/14myofZ8aM59RDbX_9MYjLV4VHegoodIa1tQ6KTISecg/edit)
  - [실사용자 테스트·운영 체크리스트](https://docs.google.com/document/d/1BOglPB1V7yvT9dDPY-ejDvyqRz2_G1j3FWMWBxBIy38/edit)
- 자격 증명/운영 고객 데이터/실제 계약서 원본은 이 문서와 일반 공유 Drive에 복사하지 않는다.

## 확인 및 책임

기록 정리: 2026-10-31, PM의 GitHub/Drive 정리 요청에 따라 생성.
다음 담당자: GitHub Issue #102와 최신 `main` 및 배포 상태 대조 후 실제 테스트 담당자를 배정한다.
