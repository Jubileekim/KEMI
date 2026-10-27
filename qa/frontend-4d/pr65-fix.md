# PR #65 CI 실패 수정 (2026-10-26)

- 원격 실패: [Web CI 40292058608](https://github.com/Jubileekim/KEMI/actions/runs/40292058608), head `bc2b11d9518b93c234f47aa07ff4e19409422605`. 288개 중 286개 성공, 4-C 통합 테스트가 두 프로젝트에서 `revisions.spec.ts:173`의 승인 버튼 개수 검사로 실패했다.
- 원인: 4-C 시점의 “승인/수령/정산 버튼 없음” 검사가 4-D의 명시적 검토 승인 UI와 충돌했다. 최신 수정본을 의뢰인이 검토할 때 승인 버튼이 표시되는 것은 정상 동작이다.
- 수정: 승인 버튼 표시, 확인 전 비활성·확인 후 활성, 확인만으로 승인/전달/수령/문제 기록이 생성되지 않음, 정산 상태/수령·정산 버튼 없음으로 검사한다. 제품 동작·Mock 경계·timeout·retry는 변경하지 않았다.
- 선행 #52는 병합 완료를 확인했다. `origin/main`의 `0ae1adb`를 충돌 없이 merge하여 선행 커밋을 보존했다. PR을 `main`으로 재지정할 수 있어 추가했던 stacked-base CI 허용 행은 제거했다.
- 재현: `npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-4d/playwright.edge.config.ts revisions.spec.ts --grep '4-C 통합' --workers=1`. 정상 사용자 Edge에서 수정 전 동일한 개수 오류 2건 실패, 수정 후 **2/2 성공·exit 0 (59.8초)**. 최초 sandbox 실행은 선행 서명 단계에서 timeout으로 끝나 원인 재현 근거에서 제외했다.
- 단위: `npm run test:web`, **193/193 성공**. `npm run build:web`의 타입 검사·ESLint·운영 빌드도 exit 0. `git -c core.quotepath=false ls-files`로 전달한 추적 파일 전체 Prettier와 `git diff --check` 성공. 이 기록은 실제 API/DB/스토리지/정산 검증이 아니다.
- 수정 커밋 `335973f`를 기존 PR 브랜치에 push하고 PR base를 `main`으로 변경했다. base 변경은 기본 pull_request workflow 이벤트가 아니므로 이 검증 기록 커밋의 synchronize 이벤트로 최신 main 대상 Web CI를 실행한다. 기존 workflow의 trigger·timeout·retry를 변경하지 않는다.

연결 회귀와 최신 원격 CI 결과는 후속 확인한다. 기존 검사 결과나 분리 재실행을 전체 회귀 성공으로 대체하지 않는다. 사용자 작업인 미추적 `outputs/`, `tools/`는 수정·커밋하지 않는다.
