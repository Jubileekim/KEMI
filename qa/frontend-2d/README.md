# 2-D 로컬 검증

저장소 루트에서 실행한다. 모든 제품 데이터는 MSW 개발용 메모리이며 실제 API/DB·파일·알림/외부 제공자 검증이 아니다.

```powershell
npm run test:web
npm run build:web
npm run format:check
npm run check:tokens
npm exec -w @kemi/web -- playwright test --config ../../qa/frontend-2d/playwright.edge.config.ts proposals.spec.ts
```

- Edge 설치 환경의 데스크톱/모바일 2개 프로젝트, workers2·retry0·기존 timeout. 5185 포트가 필요하다. 보고서/trace는 OS 임시 폴더 `kemi-2d-{results,report}`에 저장한다. 전체 회귀는 마지막 명령의 `proposals.spec.ts`만 생략한다. CI는 기존 Playwright Chromium 설정을 사용한다.
- 캡처 재생성: 절대 경로 `KEMI_CAPTURE_DIR`를 이 폴더로 설정한 뒤 `proposals.spec.ts` 실행. 통합 검사에서 390/1280px 후보/대화 화면을 저장한다. 캡처 전에 재조회 완료를 기다린다. 테스트 fixture의 `<script>` 문자열은 이스케이프 검증용이며 실행 코드가 아니다.
- 기존 공개 서비스/작업물은 검증된 Mock 명령으로 준비한다. 새 파일 업로드·외부 영상 조회 증거가 아니다. 제안·협의·메시지·마감·거절은 실제 UI를 조작한다. 회원 전환과 임의 URL 접근은 단일 탭 데이터 유지를 위해 SPA history 이동을 사용한다.
- 운영 경계: `VITE_ENABLE_MOCKS=true`, `VITE_ENABLE_AUTH_API=true`로 운영 빌드 후 4189 preview를 띄우고 `node qa/frontend-2d/production-smoke.cjs` 실행. 독립 HTTP 인증 fixture의 비회원/의뢰인/제작자×5경로와 bundle/worker 제외를 확인한다. 실제 서버 인증이 아니다.
- 운영 script의 최초 비회원 제목 assertion을 실제 `로그인`으로 수정했다. 제품 코드 오류로 세지 않는다. 최종 실행·실패·통과 경계는 진행 문서에 보존한다.
- 검사/재시도/timeout을 완화하지 않는다. 실제 브라우저 메뉴200%·스크린리더·다른 브라우저/실제 다중 기기는 별도 미검증이다.
