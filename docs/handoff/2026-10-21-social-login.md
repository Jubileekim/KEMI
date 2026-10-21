# 소셜 로그인 연동 (프론트엔드용)

- 대상: Google·카카오 로그인 버튼, 소셜 가입(역할·표시 이름 확인) 화면
- 근거: [결정 기록](../decisions/2026-10-19-backend-setup.md) 11장. 요청·응답 형식은 Swagger(`/api/docs`)에서 확인할 수 있다.
- 상태: 백엔드 구현과 가짜 제공자 테스트까지 끝났다. 실제 Google·카카오 키와 콜백 주소 등록은 아직 없다.

## 화면이 할 일

1. **로그인 버튼**: `window.location.href = "/api/auth/google/start"` (카카오는 `/api/auth/kakao/start`)
   - fetch로 부르지 않는다. 제공자 동의 화면으로 브라우저가 이동해야 한다.
2. **`/auth/social/callback` 경로 만들기**: 서버가 결과를 이 주소의 쿼리로 알려준다.

| 쿼리                       | 뜻                                         | 화면이 할 일                                                            |
| -------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `result=login`             | 기존 회원 로그인 성공                      | `POST /api/auth/refresh`로 Access 토큰을 받는다 (기존 갱신 흐름 그대로) |
| `result=signup`            | 처음 온 소셜 계정                          | 가입 화면으로 이동 (아래 3번)                                           |
| `error=SOCIAL_CANCELLED`   | 사용자가 동의 화면에서 취소                | 로그인 화면으로. 오류로 강조하지 않아도 된다                            |
| `error=SOCIAL_FAILED`      | 검증 실패·제공자 통신 실패·시간 초과(10분) | "다시 시도해주세요" 안내 후 로그인 화면                                 |
| `error=SOCIAL_UNAVAILABLE` | 서버에 해당 제공자 설정이 없음             | "지금은 사용할 수 없는 로그인 방식" 안내                                |
| `error=FORBIDDEN`          | 이용 제한·탈퇴 회원                        | 이메일 로그인의 403과 같은 안내                                         |

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
- 키가 없으면 버튼을 눌렀을 때 `error=SOCIAL_UNAVAILABLE`로 돌아온다. 이 상태로 오류 화면을 먼저 만들 수 있다.

## 확인 요청

- `/auth/social/callback` 경로 이름과 가입 화면 흐름이 화면 기획과 맞는지
- Google·카카오 개발자 콘솔 등록 담당과 키 전달 방법 (키는 채팅·저장소에 올리지 않고 `.env`·Render 환경 변수에만 넣는다)
