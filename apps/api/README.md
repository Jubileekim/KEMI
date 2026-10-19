# KEMI API (`@kemi/api`)

Express 5 · TypeScript · Prisma 7 · Supabase PostgreSQL 백엔드.

## 요구 사항

- Node.js 24 LTS (`.nvmrc`)
- npm 11 이상 (npm Workspaces)

## 처음 실행하기

저장소 루트에서 실행한다.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # 값 채우기 (아래 "DB 연결 주소" 참고)
npm run dev:api
```

- 서버 주소: `http://localhost:4000`
- `GET /health` → `200 {"status":"ok", ...}`
- `GET /health/ready` → DB 연결 시 `200`, 연결 실패 시 `503`

`.env`가 없거나 값이 잘못되면 서버는 시작하지 않고 어떤 변수가 문제인지 출력한 뒤 종료한다. 변수 값(비밀번호 등)은 출력하지 않는다.

## 명령어

| 위치 | 명령 | 하는 일 |
|---|---|---|
| 루트 | `npm run dev:api` | 공통 패키지 빌드 후 개발 서버 실행 (파일 변경 시 재시작) |
| 루트 | `npm run test:api` | Vitest + Supertest 테스트 |
| 루트 | `npm run build:api` | 공통 패키지 → Prisma Client 생성 → `apps/api/dist` 빌드 |
| 루트 | `npm run typecheck` | 전체 워크스페이스 타입 검사 |
| `apps/api` | `npm start` | 빌드 결과 실행 (`node dist/server.js`) |
| `apps/api` | `npm run prisma:validate` | Prisma 스키마 검사 |
| `apps/api` | `npm run db:migrate` | 개발 DB에 마이그레이션 생성·적용 |
| `apps/api` | `npm run db:deploy` | 배포 DB에 기존 마이그레이션만 적용 |

## 환경 변수

| 이름 | 필수 | 기본값 | 설명 |
|---|---|---|---|
| `NODE_ENV` | | `development` | `development` / `test` / `production` |
| `PORT` | | `4000` | Render는 자동으로 지정한다 |
| `DATABASE_URL` | ✅ | | 실행용 PostgreSQL 주소 |
| `DATABASE_POOL_MAX` | | `5` | 서버 한 대의 최대 DB 연결 수 |
| `MIGRATION_DATABASE_URL` | | `DATABASE_URL` | 마이그레이션 전용 주소가 따로 필요할 때만 |

실제 값은 `.env`(커밋 금지)나 Render 대시보드의 Environment에만 넣는다. 저장소에는 `.env.example`만 둔다.

## DB 연결 주소 고르기

Supabase 대시보드 **Connect** 화면에서 실제 배포 환경에 맞는 주소를 고른다. 포트 번호를 외워서 쓰지 않는다.

| 주소 종류 | 특징 | KEMI에서 |
|---|---|---|
| Direct connection (`db.<ref>.supabase.co:5432`) | 기본은 IPv6 전용 | Render에서 IPv6로 접속할 수 없으면 사용 불가. 로컬에서 IPv6가 되면 사용 가능 |
| Session pooler (`*.pooler.supabase.com:5432`) | IPv4 지원, 연결을 세션 동안 유지 | **Render 같은 상시 실행 서버에 권장.** 마이그레이션도 이 주소로 가능 |
| Transaction pooler (`*.pooler.supabase.com:6543`) | 요청마다 연결을 나눠 씀 | 서버리스용. 상시 서버인 이 API에는 필요하지 않음 |

- 기본 구성: `DATABASE_URL` 하나에 Session pooler 주소를 넣고 실행과 마이그레이션에 함께 쓴다.
- 마이그레이션을 다른 주소로 돌려야 할 때만 `MIGRATION_DATABASE_URL`을 추가한다.
- Session pooler는 동시 연결 수 한도가 있으므로 `DATABASE_POOL_MAX`를 작게 유지한다.

## Render 배포 설정 (예정)

| 항목 | 값 |
|---|---|
| Root Directory | (비움, 저장소 루트) |
| Build Command | `npm ci && npm run build:api` |
| Start Command | `npm start -w @kemi/api` |
| Health Check Path | `/health` |
| Environment | `NODE_ENV=production`, `DATABASE_URL` 등 |

헬스 체크는 DB를 보지 않는 `/health`를 쓴다. DB 장애 때문에 Render가 서버를 계속 재시작하지 않게 하기 위해서다. DB까지 확인하려면 `/health/ready`를 사용한다.

무료 플랜은 15분 동안 요청이 없으면 잠들고, 다음 첫 요청에서 약 1분 동안 깨어난다. 시연 전에는 `/health`를 미리 호출해 깨워둔다.

## 오류 응답 형식 (프론트엔드와 합의 전 초안)

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "입력값을 확인해주세요.", "details": [] } }
```

- `code`: `@kemi/shared`의 `ERROR_CODES` 중 하나. 화면은 `message` 문구가 아니라 `code`로 분기한다.
- 알 수 없는 서버 오류는 내부 내용을 숨기고 `500 INTERNAL_ERROR`로 응답한다.

## 폴더 구조

```text
apps/api/
├─ prisma/schema.prisma    # DB 모델 (기능별 PR에서 추가)
├─ prisma.config.ts        # Prisma 7 설정 (DB 주소·마이그레이션 위치)
├─ src/
│  ├─ app.ts               # Express 앱 조립 (테스트에서 의존성 주입)
│  ├─ server.ts            # 환경 변수 검증 → DB 연결 → 서버 시작·종료 처리
│  ├─ config/env.ts        # Zod 환경 변수 검증
│  ├─ http/                # AppError·공통 오류 처리
│  ├─ lib/prisma.ts        # Prisma Client (pg 어댑터)
│  ├─ routes/              # API 라우터
│  └─ generated/           # Prisma 생성 코드 (커밋하지 않음)
└─ test/                   # Vitest + Supertest
```
