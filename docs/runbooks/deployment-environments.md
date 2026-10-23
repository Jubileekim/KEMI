# KEMI 배포 환경 및 운영 기록

> 기준일: 2026-10-23 (KST)  
> 관리 원칙: 이 문서는 배포 대상·운영 주소·연동 절차의 기준 문서이다. 배포마다 변경되는 정보는 날짜와 출처를 표시하고, 현재 상태를 재검증한다.  
> 관련 문서: [프론트엔드 실행 가이드](../../apps/web/README.md) · [백엔드 실행 가이드](../../apps/api/README.md) · [인증 배포·검증 절차](./auth-deploy-verification.md)

## 1. 환경 현황

| 구성       | 플랫폼   | 식별자                                 | 2026-10-23 확인 상태                                                          |
| ---------- | -------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| 프론트엔드 | Vercel   | 팀 `KEMI`, 프로젝트 `kemi-web`         | 최초 Production 배포 `Ready` (사용자 대시보드)                                |
| API        | Render   | 워크스페이스 `KEMI`, 서비스 `kemi-api` | 최초 배포 성공, 서버·DB 헬스 체크 HTTP 200 (2026-10-23)                       |     |
| DB         | Supabase | `KEMI sprint mission`, PostgreSQL      | 프로젝트 `ACTIVE_HEALTHY`; DB 실제 접근 및 마이그레이션 상태는 별도 확인 필요 |

- 정식 프론트엔드 주소: **https://kemi-web-sigma.vercel.app/**
- 이 주소를 배포 환경의 **기준 운영 도메인**으로 사용한다. Vercel 개별 배포 URL은 재배포 시 변경될 수 있으므로 `APP_ORIGIN`에 사용하지 않는다.
- **2026-10-23 사용자 보고:** KEMI 팀 Pro Trial에서 **Downgrade**를 실행했다. 공식 안내상 Trial 중 Downgrade는 즉시 Hobby 플랜으로 전환되며 Pro 구독료 자동 청구는 발생하지 않는다. 다만 최종 팀 플랜, 결제 이력, 운영 URL 응답과 팀 병합 여부는 아직 대시보드에서 재검증되지 않았다. Hobby 플랜은 비상업적 용도 및 무료 리소스 한도의 적용을 받는다.
- Supabase 프로젝트 리전: `ap-northeast-1` (Tokyo). Render 리전은 실제 배포 시 선택한 값을 기록한다.

## 2. Vercel 프론트엔드

| 항목                | 값                                                                       |
| ------------------- | ------------------------------------------------------------------------ |
| 운영 URL            | https://kemi-web-sigma.vercel.app/                                       |
| Vercel 팀           | `KEMI`                                                                   |
| Vercel 프로젝트     | `kemi-web`                                                               |
| 프로젝트 관리       | https://vercel.com/kemi-7f0cb6ad/kemi-web                                |
| GitHub 저장소       | https://github.com/Jubileekim/KEMI                                       |
| Production Branch   | `main`                                                                   |
| Framework           | `Vite` (React + TypeScript)                                              |
| Root Directory      | `apps/web`                                                               |
| Install Command     | `cd ../.. && npm ci --include=dev`                                       |
| Build Command       | `cd ../.. && npm run build:web`                                          |
| Output Directory    | `dist`                                                                   |
| Node.js             | 24.x (저장소 `.nvmrc` 기준; 실제 Vercel 프로젝트 설정값 확인 필요)       |
| Root 외부 소스 접근 | `packages/shared` 의존성 때문에 활성화 필요; 프로젝트 설정에서 실측 확인 |
| 환경 변수           | 현재 웹 빌드에 필수인 클라이언트 환경 변수 없음                          |

### 최초 Production 배포 기록 (2026-10-23)

- 상태: `Ready` (사용자 제공 Vercel Overview 화면, 확인 시점의 스냅샷)
- 소스 브랜치: `main`
- 소스 커밋: [`73057fe`](https://github.com/Jubileekim/KEMI/commit/73057fe69916631b553723c8e14869629c17de53)
- 배포별 URL: `https://kemi-5iafv22wd-kemi-7f0cb6ad.vercel.app` (운영 도메인이 아님)
- 배포 상세: https://vercel.com/kemi-7f0cb6ad/kemi-web/5BeR5cxBzZceFAvy8ggyMiCP1gmS
- 최초 화면: KEMI 초기 안내 화면. 실제 사용자 기능과 API 연결 검증을 의미하지 않는다.

### URL 및 라우팅 규칙

1. 외부 공유·Render `APP_ORIGIN`·OAuth 등록에는 운영 주소 `https://kemi-web-sigma.vercel.app`를 사용한다(마지막 `/` 제외).
2. API 요청은 `/api/*` 상대 경로를 사용하며, Render 배포 URL 확정 후 Vercel rewrite로 연결한다.
3. `/api/:path*` rewrite는 React Router SPA fallback `/(.*) -> /index.html`보다 **앞**에 배치한다.
4. SPA fallback 설정은 [Vercel 배포 설정 PR #32](https://github.com/Jubileekim/KEMI/pull/32)에 작업 중이다. `main` 병합 및 실제 새로고침 검증 전에는 적용 완료로 표시하지 않는다.
5. Pull Request는 Preview에서 검증하고, 리뷰·CI 확인 후 `main`에 병합하여 Production에 반영한다. 보호 규칙과 실제 자동 배포는 Vercel/GitHub 설정에서 확인한다.

## 3. Render 백엔드 (배포 완료)

| 항목            | 설정 기준                                                                    |
| --------------- | ---------------------------------------------------------------------------- |
| GitHub          | `Jubileekim/KEMI` · `main`                                                   |
| 서비스 유형     | Web Service (Node / Express)                                                 |
| 서비스명        | `kemi-api`                                                                   |
| Root Directory  | **비움** (모노레포 루트)                                                     |
| Build           | `npm ci --include=dev && npm run build:api`                                  |
| Start           | `npm start -w @kemi/api`                                                     |
| Health Check    | 실제 `/health` HTTP 200 확인; Render 설정의 healthCheckPath는 아직 비어 있음 |
| 리전            | `Singapore` (실제 서비스 설정 확인)                                          |
| 공개 서비스 URL | **https://kemi-api.onrender.com**                                            |

Render에 필요한 환경 변수 이름(값은 저장소·문서에 절대 기록하지 않음):

| Key                 | 값의 출처·관리 기준                                                           |
| ------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                                  |
| `DATABASE_URL`      | Supabase Connect > Session pooler, 비밀번호 포함; Render Environment에만 보관 |
| `DATABASE_POOL_MAX` | `5`                                                                           |
| `JWT_ACCESS_SECRET` | 충분히 긴 신규 난수, Render Environment에만 보관                              |
| `APP_ORIGIN`        | **`https://kemi-web-sigma.vercel.app`**                                       |
| `TRUST_PROXY_HOPS`  | 최초 `0`; Vercel/Render 실제 요청 경로 확인 후 조정                           |

Render 배포 후에는 해당 주소의 `/health` (서버 생존)와 `/health/ready` (DB 연결)를 구분해 확인한다. 데이터베이스 마이그레이션은 팀 승인과 이력 점검을 거친 별도 절차로 수행한다. 사회관계망 로그인 콜백 및 쿠키·Origin 검증은 API rewrite 반영 이후 확인한다.

### 최초 Render 배포 검증 (2026-10-23 KST)

- Render 서비스 ID: `srv-dbdj8ha9lscs73bv4hc0`
- 관리 화면: https://dashboard.render.com/web/srv-dbdj8ha9lscs73bv4hc0
- Production URL: **https://kemi-api.onrender.com**
- Git 소스: `Jubileekim/KEMI`, `main`, 커밋 [`73057fe`](https://github.com/Jubileekim/KEMI/commit/73057fe69916631b553723c8e14869629c17de53)
- Render 빌드: 성공; 첫 배포 상태: `live`; 자동 배포: `main` 커밋 기준 활성화; Free 인스턴스
- 서버 점검: **GET `/health` → HTTP 200**, `status: ok` (실제 외부 HTTP 요청)
- DB 점검: **GET `/health/ready` → HTTP 200**, `checks.database: ok` (실제 외부 HTTP 요청)
- 연결 대상: Supabase Tokyo DB; Render Singapore 리전
- 주의: Render 설정상 `healthCheckPath`가 비어 있어 별도 `/health` 등록은 아직 미완료이며, Free 인스턴스는 유휴 시 절전된다.
- 범위: 위 검증은 Render 서버 및 DB의 실행 상태만 검증한다. **Vercel → Render `/api/*` rewrite는 아직 연결되지 않았다.**

## 4. 남은 작업 및 완료 조건

- [x] Vercel KEMI 팀 및 프론트엔드 프로젝트 생성 (2026-10-23, 사용자 대시보드)
- [x] 프론트엔드 첫 Production 배포 `Ready` 확인 (2026-10-23, 사용자 대시보드)
- [x] Pro Trial에서 Downgrade 실행 (2026-10-23, 사용자 보고)
- [ ] KEMI 팀 Billing에서 Hobby 최종 적용·유료 결제 내역 없음 확인
- [ ] 다운그레이드 후 운영 URL 정상 응답 및 팀 병합/권한 상태 확인
- [ ] Vercel의 Root Directory 외부 소스 접근 설정과 Node.js 24.x 확인
- [ ] Vercel SPA fallback 설정 PR #32 검토·병합 후 직접 진입·새로고침 검증
- [x] Render 서비스 생성 및 실제 URL 문서 반영 (2026-10-23)
- [x] Render 환경 변수 적용 및 `/health`, `/health/ready` HTTP 200 확인 (2026-10-23)
- [ ] Vercel `/api/*` → Render rewrite 추가, 실서비스 API 통신 확인 (별도 후속)
- [ ] 로그인/로그아웃/토큰 갱신 시 Origin·HttpOnly 쿠키 동작 검증
- [ ] Github PR Preview / `main` Production 자동배포 실제 확인
- [ ] 발표 전 무료 서버 콜드 스타트 여부 및 시연 환경 검증

## 5. 운영 문서 변경 규칙

- **변하지 않는 값**(프로젝트명, 공식 운영 도메인, 저장소 위치)은 표에 보관한다.
- **바뀌는 값**(배포 URL, 커밋, 상태, 리전, 플랜)은 날짜를 붙인 기록 또는 갱신 이력에 남긴다.
- **비밀값**(DB 비밀번호, 연결 문자열 원문, JWT 비밀키, OAuth Client Secret)은 GitHub/Notion/메신저에 저장하지 않는다.
- 도메인·프로젝트 소유권·환경 변수가 변경되면 프론트엔드와 백엔드 담당자가 함께 검증하고 이 문서를 갱신한다.
