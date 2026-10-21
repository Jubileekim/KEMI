# 소셜 로그인 연동 (프론트엔드용)

- 대상: Google·카카오 로그인 버튼, 소셜 가입(역할·표시 이름 확인) 화면
- 근거: [결정 기록](../decisions/2026-10-19-backend-setup.md) 11장. 요청·응답 형식은 Swagger(`/api/docs`)에서 확인할 수 있다.
- 상태: 백엔드 구현과 가짜 제공자 테스트까지 끝났다. **[미검증] 실제 Google·카카오 로그인은 아직 확인하지 않았다.** 아래 "팀원 준비 목록"이 끝나야 확인할 수 있다.

## 화면이 할 일

1. **로그인 버튼**: `window.location.href = "/api/auth/google/start"` (카카오는 `/api/auth/kakao/start`)
   - fetch로 부르지 않는다. 제공자 동의 화면으로 브라우저가 이동해야 한다.
2. **`/auth/social/callback` 경로 만들기**: 서버가 결과를 이 주소의 쿼리로 알려준다.

| 쿼리                        | 뜻                                                                        | 화면이 할 일                                                            |
| --------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `result=login`              | 기존 회원 로그인 성공                                                     | `POST /api/auth/refresh`로 Access 토큰을 받는다 (기존 갱신 흐름 그대로) |
| `result=signup`             | 처음 온 소셜 계정                                                         | 가입 화면으로 이동 (아래 3번)                                           |
| `error=SOCIAL_CANCELLED`    | 사용자가 동의 화면에서 취소                                               | 로그인 화면으로. 오류로 강조하지 않아도 된다                            |
| `error=SOCIAL_FAILED`       | 검증 실패·제공자 통신 실패·제공자 응답 10초 초과·로그인 시작 후 10분 초과 | "다시 시도해주세요" 안내 후 로그인 화면                                 |
| `error=SOCIAL_UNAVAILABLE`  | 서버에 해당 제공자 설정이 없음                                            | "지금은 사용할 수 없는 로그인 방식" 안내                                |
| `error=SOCIAL_RATE_LIMITED` | 짧은 시간에 시작·콜백 요청이 너무 많음(IP당 15분 20회)                    | "잠시 후 다시 시도해주세요" 안내 후 로그인 화면                         |
| `error=FORBIDDEN`           | 이용 제한·탈퇴 회원                                                       | 이메일 로그인의 403과 같은 안내                                         |

3. **소셜 가입 화면**
   - `GET /api/auth/social/signup` → `{ provider, suggestedName, providerEmail }`
     - `suggestedName`은 기본값으로만 쓴다. 2~20자가 아닐 수 있으므로 사용자가 고치게 한다.
     - `providerEmail`은 표시용이다. 로그인 이메일로 쓰이지 않는다.
     - `401`이면 10분이 지났거나 흐름 밖에서 들어온 것이다. 로그인 화면으로 보낸다.
   - 사용자가 역할(`CLIENT`·`CREATOR`)과 표시 이름을 정하면 `POST /api/auth/social/signup` `{ role, name }`
     - 응답은 이메일 회원가입과 같다(`201` + `{ accessToken, accessTokenExpiresIn, user }` + Refresh 쿠키).
     - `400`: 입력값 오류 (`error.details` 참고)
     - `409 CONFLICT`: 다른 탭에서 이미 가입했다. 소셜 로그인을 다시 시작하면 로그인된다.

- 쿠키(`kemi_oauth_state`, `kemi_social_signup`, `kemi_refresh`)는 모두 HttpOnly라 화면 코드가 읽거나 지울 필요가 없다.
- 상수는 `@kemi/shared`에서 가져온다: `SOCIAL_PROVIDER_PATHS`, `SOCIAL_CALLBACK_ERRORS`, `socialSignupRequestSchema`, `SocialSignupPendingResponse`

## 지켜지는 규칙

- 같은 이메일의 이메일 회원이 있어도 소셜 계정은 자동으로 합쳐지지 않는다(별도 회원).
- 소셜로 가입한 회원에게는 비밀번호를 묻지 않는다. 이메일·비밀번호 로그인은 할 수 없다.
- 로그아웃·보호 API는 이메일 회원과 같다.

## 로컬 개발

- Vite 개발 서버(`http://localhost:5173`)가 `/api`를 API 서버로 넘기므로, 콜백 주소는 `http://localhost:5173/api/auth/{google|kakao}/callback`이다.
- 키가 없으면 버튼을 눌렀을 때 `error=SOCIAL_UNAVAILAB## 팀원 준비 목록 (실제 로그인 확인 전)

**비밀 값(Client Secret 등)은 이 문서·PR·이슈·채팅에 적지 않는다.** 로컬은 `apps/api/.env`, 배포는 Render 대시보드의 Environment에만 넣는다. 콘솔 화면 이름은 2026-10-21 기준이며 바뀔 수 있다.

### 콜백 주소 (두 콘솔에 모두 등록)

| 환경 | Google                                             | 카카오                                            |
| ---- | -------------------------------------------------- | ------------------------------------------------- |
| 로컬 | `http://localhost:5173/api/auth/google/callback`   | `http://localhost:5173/api/auth/kakao/callback`   |
| 배포 | `https://<Vercel 도메인>/api/auth/google/callback` | `https://<Vercel 도메인>/api/auth/kakao/callback` |

- API 서버의 `APP_ORIGIN`과 같은 주소여야 한다. 서버가 `{APP_ORIGIN}/api/auth/{provider}/callback`을 제공자에 보내며, 등록된 주소와 한 글자라도 다르면 제공자가 거부한다.
- 배포 주소는 Vercel 도메인이 정해진 뒤 추가한다(Render 주소가 아님).

### Google (Google Cloud Console)

- [ ] 프로젝트 만들기 (팀 공용 계정으로)
- [ ] OAuth 동의 화면: 앱 이름, 지원 이메일, 범위 `openid`, `email`, `profile`
  - 게시 전(테스트) 상태에서는 등록한 테스트 사용자만 로그인할 수 있다. 팀원 계정을 테스트 사용자로 추가한다.
- [ ] 사용자 인증 정보 → OAuth 클라이언트 ID 만들기, 유형 "웹 애플리케이션"
- [ ] 승인된 리디렉션 URI에 위 콜백 주소 등록
- [ ] 발급된 값을 아래 환경 변수로 전달

### 카카오 (Kakao Developers)

- [ ] 애플리케이션 만들기 (팀 공용 계정으로)
- [ ] 카카오 로그인 활성화
- [ ] Redirect URI에 위 콜백 주소 등록
- [ ] 동의항목: "닉네임"(이름 후보), "카카오계정(이메일)"(선택. 앱 상태에 따라 설정 조건이 있을 수 있으니 콘솔에서 확인)
  - 동의항목을 켜지 않아도 로그인·가입은 된다. 이름은 사용자가 직접 입력한다.
- [ ] 보안 → Client Secret 코드 발급, 사용 상태 확인 (기본 사용. 끄면 `KAKAO_CLIENT_SECRET`을 비운다)
- [ ] 앱 키 중 **REST API 키**를 아래 환경 변수로 전달 (JavaScript 키·Admin 키가 아님)

### 환경 변수 이름 (값은 적지 않는다)

| 이름                   | 어디서                            | 필수                                |
| ---------------------- | --------------------------------- | ----------------------------------- |
| `GOOGLE_CLIENT_ID`     | Google OAuth 클라이언트 ID        | Google을 켤 때 (Secret과 함께)      |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 클라이언트 보안 비밀 | Google을 켤 때 (ID와 함께)          |
| `KAKAO_REST_API_KEY`   | 카카오 앱 키 → REST API 키        | 카카오를 켤 때                      |
| `KAKAO_CLIENT_SECRET`  | 카카오 보안 → Client Secret       | Client Secret을 사용하는 경우(기본) |

- 넣을 곳: 로컬 `apps/api/.env`(커밋 금지), 배포 Render → Environment
- 값을 넣은 뒤 서버를 다시 시작한다. 하나만 넣은 Google 설정은 서버 시작 단계에서 오류로 알려준다(값은 출력하지 않는다).

### 키를 받은 뒤 확인할 것 (백엔드)

- [ ] 로컬: 신규 가입, 같은 계정 재로그인, 동의 취소, 같은 이메일의 이메일 회원과 분리됨
- [ ] 카카오 실제 응답 필드가 문서와 같은지 (`id`, 이메일·닉네임 동의 여부별)
- [ ] 배포: Vercel rewrite를 거친 콜백, 쿠키(`Secure`, `Path=/api/auth`) 동작
- [ ] 결과를 결정 기록 11장의 [미검증] 표시와 함께 갱신

LE`로 돌아온다. 이 상태로 오류 화면을 먼저 만들 수 있다.

## 확인 요청

- `/auth/social/callback` 경로 이름과 가입 화면 흐름이 화면 기획과 맞는지
- 위 준비 목록의 담당자와 키 전달 방법 (키는 채팅·저장소에 올리지 않는다)
