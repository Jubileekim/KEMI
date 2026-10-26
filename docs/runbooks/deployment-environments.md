# KEMI 배포 환경 및 운영 기록

> 기준일: 2026-10-26 (KST)
>
> 이 문서는 실제 배포 상태와 목표 설정을 구분한다. 비밀번호·토큰·DB 접속 문자열을 GitHub에 기록하지 않는다.

## 1. 운영 서비스

- GitHub 저장소: https://github.com/Jubileekim/KEMI (기본 브랜치 `main`)
- Vercel 프론트엔드: https://kemi-web-sigma.vercel.app/ (팀 `KEMI`, 프로젝트 `kemi-web`, Hobby)
- Render 백엔드: https://kemi-api.onrender.com (서비스 `kemi-api`, ID `srv-dbdj8ha9lscs73bv4hc0`)
- Render 대시보드: https://dashboard.render.com/web/srv-dbdj8ha9lscs73bv4hc0
- Supabase 프로젝트: `nibqyycfknurkncdgqps`, Tokyo 리전. `main` 기준 Prisma 마이그레이션 7개 완료. 구형 테이블은 기존 데이터 보존을 위해 별도 유지하며, 향후 기능 마이그레이션은 아직 미적용이다.

## 2. Vercel 프론트엔드

- Production Branch: `main`, Framework: Vite, Root Directory: `apps/web`
- Install Command: `cd ../.. && npm ci --include=dev`
- Build Command: `cd ../.. && npm run build:web`, Output: `dist`
- Node.js: 루트 `.nvmrc`의 24를 기준으로 사용한다.
- `apps/web/vercel.json`: `/api/:path*` → `https://kemi-api.onrender.com/api/:path*`를 먼저 rewrite하고, 그다음 모든 SPA 경로를 `/index.html`로 fallback한다.
- 첫 Production 배포: 2026-10-23, 커밋 `73057fe`.
- FE 통합 배포: 2026-10-26, PR #50 병합 커밋 `4360bdc`. 현재 Production은 이후 `main` 커밋 `b4bc2e2`의 READY 배포가 확인되었다.
- Vercel 팀은 Pro Trial에서 Hobby로 다운그레이드했다. 실제 결제 내역은 Billing에서만 확인 가능하다.
- Hobby는 비상업적 시연 용도로만 사용하며 실제 상업 운영 전 요금제·사용량을 재검토한다.

## 3. Render 백엔드 — 실제 운영 설정

- 현재 서비스는 **2026-10-23 수동 생성**된 서비스이며, 새 Blueprint와 연결되어 있지 않다.
- 리전: Singapore, 플랜: Free, 브랜치: `main`, Root Directory: 비어 있음.
- Build: `npm ci --include=dev && npm run build:api`
- Start: `npm start -w @kemi/api`
- 실제 `autoDeployTrigger`: `commit` (main push에 반응). `checksPass`로 바꾸려면 Render 설정을 별도로 수정해야 한다.
- 실제 Health Check Path: 비어 있음. Render 설정에 `/health`를 등록하는 것은 별도 운영 변경이다.
- 환경 변수 이름: `NODE_ENV`, `DATABASE_URL`, `DATABASE_POOL_MAX`, `JWT_ACCESS_SECRET`, `APP_ORIGIN`, `TRUST_PROXY_HOPS`. 값은 Render에만 저장한다.
- `APP_ORIGIN`: `https://kemi-web-sigma.vercel.app`
- 테스트 경로: `GET /health` (서버), `GET /health/ready` (DB 연결), `GET /api/projects` (실제 API).
- Free 서비스는 유휴 시 절전될 수 있으므로 시연 전에 health endpoint를 확인한다.

## 4. 데이터베이스 주의 사항

- 2026-10-26 재점검: `main`의 Prisma 마이그레이션 7건은 모두 완료(롤백 0건). `public.users`, `public.projects`, `public.work_requests`가 존재하며, `/health/ready`에서 `database: ok`, Render 및 Vercel `/api/projects`에서 정상 목록 JSON(현재 0건)을 확인했다. 종전 `P2021` 장애는 현재 재현되지 않는다.
- 구형 `public."User"`(1행), `public."Skill"`(12행) 등 구 스키마와 백업된 이전 Prisma 이력은 유지되어 있다. 기존 계정은 신규 `users`로 자동 이관되지 않았으며 보존·이관 정책이 남아 있다.
- 미병합 계약·결제·채팅·파일 기능의 `terms_versions`, `payments`, `chat_rooms`, `files` 등은 아직 운영 스키마에 적용하지 않았다. **새 기능 PR만 병합하면 DB 오류가 다시 발생할 수 있다.** [이슈 #24](https://github.com/Jubileekim/KEMI/issues/24)를 따라 격리 `KEMI-dev` 검증과 실제 데이터 백업·승인 후, 변경이 필요한 커밋의 DB 마이그레이션을 **서버 재시작과 독립적으로** 적용하고 배포해야 한다. `migrate reset` 및 레거시 테이블 삭제는 운영 금지.

## 5. 배포 전후 체크리스트

- [ ] PR이 Draft가 아니고 팀원 리뷰와 필수 API/Web CI가 통과했는가?
- [ ] DB 마이그레이션이 필요하다면 격리 DB에서 검증하고 적용 순서가 확정됐는가?
- [ ] Vercel이 `main`의 **기대한 커밋**을 Production READY로 배포했는가?
- [ ] Render가 같은 `main`의 기대 커밋으로 Live인지 확인했는가?
- [ ] `/health`, `/health/ready`, `/api/projects`를 각각 실제 호출했는가?
- [ ] `/api/*` rewrite, 로그인·쿠키·Origin, OAuth 콜백, SPA 새로고침을 실제 운영 도메인에서 테스트했는가?
- [ ] 새 오류가 발생했다면 원인을 기록하고 기존 정상 배포로 되돌릴 준비가 됐는가?

관련 문서: [Vercel 앱 안내](../../apps/web/README.md) · [Render/인증 배포 절차](./auth-deploy-verification.md) · [API 실행 안내](../../apps/api/README.md)
