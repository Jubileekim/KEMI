# KEMI 2팀 프로젝트

의뢰인(자영업자, 브랜드, 스타트업)과 UGC 영상 제작·납품 크리에이터를 연결하는 플랫폼의 팀 개발 저장소입니다.

## 협업 규칙

## 개발 준비

- 프론트엔드(`apps/web`) 실행·설정 방법: [apps/web/README.md](apps/web/README.md)
- 백엔드(`apps/api`) 실행 방법: [apps/api/README.md](apps/api/README.md)
- 백엔드 초기 결정 기록: [docs/decisions/2026-10-19-backend-setup.md](docs/decisions/2026-10-19-backend-setup.md)
- 제품 요구사항 기준: [docs/product/prd-v2.0.md](docs/product/prd-v2.0.md)
- PRD v2.0 백엔드 구현 기준: [docs/product/prd-v2.0-implementation.md](docs/product/prd-v2.0-implementation.md)
- 인증 배포·검증 절차: [docs/runbooks/auth-deploy-verification.md](docs/runbooks/auth-deploy-verification.md)

Node.js 24 / npm 11 환경에서 저장소 루트에서 실행한다.

```powershell
npm ci
npm run dev:web
```

웹은 `http://localhost:5173`에서 실행된다. 백엔드 실행은 별도 터미널에서 `npm run dev:api`를 사용한다(API 환경 변수 필요).

## 프론트엔드 0-A~0-C

[실행·Mock 안내](docs/frontend-setup.md), [진행 기록](docs/frontend-progress.md)를 참고하세요. 기존 API·shared·검사 명령은 유지합니다.
