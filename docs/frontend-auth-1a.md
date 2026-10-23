# 1-A 이메일 인증 구현·검증 경계

기준 저장소: `C:/Users/Cho/Desktop/teamproject 3-5/KEMI`. 2026-10-23.
범위는 AUTH-01·02·03·05의 이메일 인증 부분이다. 소셜 인증·프로필 편집·다음 단계는 포함하지 않는다.

## 구현

- `/signup`, `/login`: React Hook Form/Zod, 기존 KEMI 공통 UI·토큰. 역할·이름·이메일·비밀번호/확인값, 필드 오류 연결·첫 오류 포커스·중복 제출 방지·실패 입력 보존·비밀번호 표시 전환.
- P01 가입 폼은 8~64자·영문/숫자 조합을 검증한다. 이메일 정규화·표시 이름 2~20자·가입 역할은 실제 shared에서 가져온다. 확인값은 서버에 보내지 않는다.
- 현재 API의 로그인·refresh·me·logout 요청/응답을 Axios에 연결했다. 응답은 unknown/Zod 검증. Access 토큰은 컨트롤러 메모리에만 두며 브라우저 저장소·URL·Query 데이터/변수·Zustand에 저장하지 않는다. Query mutation은 자격 정보를 변수로 보관하지 않는다.
- 초기 refresh→me 검증 중에는 보호 화면을 열지 않는다. GET의 TOKEN_EXPIRED는 갱신 뒤 한 번만 재전송한다. 변경 요청은 갱신하더라도 자동 재전송하지 않는다. 다른 401 또는 두 번째 401은 비회원으로 전환한다.
- 한 탭의 갱신을 하나로 모으고, 쿠키를 바꾸는 refresh/login/logout은 탭 내 큐 및 지원 환경의 `kemi-auth-refresh` Web Lock으로 순서를 맞춘다. 409는 최대 두 번, 네트워크 실패는 한 번 재시도하며 잠금 획득 뒤 전체 요청/대기는 3초 이내로 제한한다. 그 이후는 재로그인한다. 실제 여러 탭·쿠키 응답 순서는 미검증이다.
- 로그아웃은 확인창 없이 화면/토큰/진행 중 조회/개인 캐시를 먼저 제거한다. 204 확인 전에는 성공을 표시하지 않는다. 서버 실패 시 별도 안내와 재시도를 제공한다. 이전 계정의 늦은 응답을 epoch로 차단하고, 갱신에서 계정/역할 변경을 발견하면 캐시를 제거하고 재로그인시킨다. 포커스 복귀 시 me로 재검증한다.
- 복귀는 기존 화면 경로의 실제 Router 우선순위와 역할을 검사한다. 외부 주소·역슬래시·인코딩 우회·인증 순환 경로는 차단한다. 기본 이동은 의뢰인 `/me/activity`, 크리에이터 `/studio/portfolio`. Mock 가입 후 `/me/profile`로 이동한다. 해당 후속 화면은 기존 미연결 안내 화면이다.

## 실행 모드

모든 명령은 저장소 루트에서 실행한다. 패키지 추가·API/shared·DB 변경은 없다.

| 설정                                     | 동작                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------- |
| 기본값                                   | 실제 인증 요청 비활성, 연결 준비 안내                                 |
| 개발 환경 `VITE_ENABLE_MOCKS=true`       | 명시적 MSW 인증. 실제 계정·서버 저장 아님                             |
| `VITE_ENABLE_AUTH_API=true`, Mock 비활성 | 기존 API의 로그인·갱신·me·로그아웃 사용. 실제 가입은 충돌 때문에 차단 |

```powershell
$env:VITE_ENABLE_MOCKS='true'
npm run dev:web
# 종료 후 Remove-Item Env:VITE_ENABLE_MOCKS
```

Mock의 예시 계정은 `client@example.test`, `creator@example.test` / `Kemi1234`다. 개발 도구에서 지연·자격 오류·제한 계정·429·500·네트워크·세션 폐기·로그아웃 실패를 고른다. 새 가입의 계정 정보와 비밀번호 다이제스트는 탭 메모리에서만 비교하며, 새로고침하면 사라진다. `kemi_mock_session` 쿠키는 비밀이 없는 fixture 식별자이며 실제 HttpOnly/Secure 쿠키 검증을 대신하지 않는다. SHA-256 비교는 Mock 전용으로 서버의 bcrypt 정책과 구분한다.

실제 환경은 `apps/web/.env.example` 및 기존 인증 배포 runbook을 따른다. 서버 `APP_ORIGIN`과 브라우저 Origin을 일치시키고 `/api` 프록시/rewrite를 사용한다. Secure·HttpOnly·SameSite=Lax 쿠키를 임의로 완화하지 않았다. VITE 값에 비밀값을 넣지 않는다.

## 미결정·미검증

| 항목                       | 현재 경계                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 비밀번호 충돌      | shared/API는 8자 이상·72바이트 이하이며 영문/숫자 조합·64자 상한 없음. P01을 덮어쓰거나 서버 규칙을 수정하지 않고 가입을 Mock으로 분리. API팀 정합화 필요            |
| AUTH-02 프로필 완료별 이동 | AuthUser/MeResponse에 완료 판정 필드가 없고 D01도 미정. 브랜드 필드·서비스 공개 상태로 완료를 추정하지 않음. 역할별 기본 경로만 제공. 미완성 계정 자동 이동은 미완료 |
| D05                        | 기존 저장소 계약을 구현했으며 팀 정책 승인을 대신하지 않음. 로그인 유지·재설정·이메일 확인·전체 기기 로그아웃을 추가하지 않음                                        |
| 실제 API/DB                | 이 체크아웃에 `apps/api/.env`와 실행 API 서버가 없어 미검증. 실제 계정 생성·세션 폐기·토큰 회전·Origin/쿠키는 별도 통합 검증 필요                                    |
| 외부 제공자                | Google·카카오 UI/실연동 모두 이번 범위 아님                                                                                                                          |

1-A는 Mock 및 클라이언트 구현 범위의 검증이며 **실제 인증 전체 완료가 아니다**. 0단계 또는 1단계 전체 완료로 표시하지 않는다.

## 검사 재현

```powershell
npm run test:web
npm run build:web
npm run format:check
npm run check:tokens
npm run test:web:e2e
```

Playwright 기본 config는 자체 개발 서버에서 명시적 Mock을 켜고 데스크톱/모바일 Chromium을 검사한다. 로컬 Edge 대체 실행은 QA README를 참조한다. 기존 health 검사는 MSW Service Worker가 보내는 요청도 가로채도록 `browserContext.route`를 사용한다. 근거: [Playwright Service Workers](https://playwright.dev/docs/service-workers#network-events-and-routing).

운영 빌드 smoke도 HTTP 응답을 Playwright로 가로채며 실제 API 검증이 아니다. `qa/frontend-1a/production-smoke.cjs`·결과 JSON 참조. Mock 포함 플래그로 빌드해도 개발 도구·worker가 제외되고, 실제 모드의 로그인/로그아웃 및 가입 차단을 확인한다. 결과 집계와 Git 링크는 `frontend-progress.md`에서 관리한다.

구현 시 확인한 공식 자료: [RHF useForm](https://react-hook-form.com/docs/useform), [Zod resolver](https://github.com/react-hook-form/resolvers), [Axios interceptors](https://axios-http.com/docs/interceptors), [Axios request config](https://axios-http.com/docs/req_config).
