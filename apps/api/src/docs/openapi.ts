import {
  applicationCreateSchema,
  CHAT_MESSAGE_KINDS,
  chatMessageCreateSchema,
  chatReadSchema,
  clientProfileUpdateSchema,
  CONTENT_STYLES,
  CREATOR_SERVICE_STATUSES,
  creatorProfileUpdateSchema,
  ERROR_CODES,
  FILE_MIME_TYPES,
  FILE_PURPOSES,
  FILE_STATUSES,
  fileUploadCreateSchema,
  NOTIFICATION_TYPES,
  PAYMENT_STATUSES,
  paymentConfirmSchema,
  paymentCreateSchema,
  paymentFailSchema,
  loginRequestSchema,
  SOCIAL_CALLBACK_ERRORS,
  SOCIAL_PROVIDER_PATHS,
  PRODUCT_CATEGORIES,
  PRODUCTION_ROLES,
  PROJECT_CLOSE_REASONS,
  PROJECT_SORTS,
  PROJECT_STATUSES,
  projectCreateSchema,
  projectUpdateSchema,
  pricingAnalysisRequestSchema,
  signatureCreateSchema,
  signupRequestSchema,
  socialSignupRequestSchema,
  TERMS_SIGNING_HOURS,
  TERMS_VERSION_STATUSES,
  termsVersionCreateSchema,
  USER_ROLES,
  USER_STATUSES,
  CATALOG_STATUSES,
  CONTRACT_STATUSES,
  packageCreateSchema,
  packageUpdateSchema,
  PORTFOLIO_SOURCES,
  portfolioCreateSchema,
  portfolioUpdateSchema,
  projectDraftValuesSchema,
  DELIVERABLE_KINDS,
  DELIVERABLE_STATUSES,
  deliverableCreateSchema,
  REVISION_STATUSES,
  REVISION_TYPES,
  revisionRequestCreateSchema,
  reviewCreateSchema,
  SETTLEMENT_STATUSES,
  DEADLINE_CHANGE_STATUSES,
  deadlineChangeCreateSchema,
  MATERIAL_KINDS,
  MATERIAL_STATUSES,
  materialCreateSchema,
  materialIssueSchema,
  PRODUCTION_STATUSES,
  WORK_REQUEST_CLOSED_REASONS,
  WORK_REQUEST_STATUSES,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
} from "@kemi/shared";
import { z } from "zod";

// 요청 본문 스키마는 서버가 실제로 검증에 쓰는 @kemi/shared의 Zod 스키마에서 만든다(문서와 검증이 어긋나지 않게).
function requestSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { io: "input" });
}

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Error" } },
  },
});

const authTokenResponse = (description: string) => ({
  description: `${description} Refresh 토큰은 \`kemi_refresh\` 쿠키(HttpOnly; Secure; SameSite=Lax; Path=/api/auth)로 설정된다.`,
  headers: {
    "Set-Cookie": {
      description: "kemi_refresh=<Refresh 토큰>",
      schema: { type: "string" },
    },
  },
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/AuthTokenResponse" },
    },
  },
});

const rateLimited = errorResponse(
  "요청 제한 초과 (`RATE_LIMITED`). `Retry-After`·`RateLimit` 헤더가 함께 온다.",
);

const cookieOnlyRequest = {
  description:
    "Refresh 쿠키(`kemi_refresh`)로만 동작한다. `Origin` 헤더가 프론트엔드 주소(`APP_ORIGIN`)와 같아야 한다.",
};

const providerParam = {
  name: "provider",
  in: "path",
  required: true,
  schema: { type: "string", enum: [...SOCIAL_PROVIDER_PATHS] },
};

const socialRedirect = {
  description: `프론트엔드 \`/auth/social/callback\`으로 이동. 쿼리는 \`result=login\`(Refresh 쿠키 설정됨), \`result=signup\`(가입 티켓 쿠키 설정됨) 또는 \`error=${SOCIAL_CALLBACK_ERRORS.join("|")}\` 중 하나다.`,
  headers: { Location: { schema: { type: "string" } } },
};

const bearerErrors = {
  401: errorResponse(
    "토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`)",
  ),
};

const myProfileResponse = {
  description: "표시 이름과 역할별 프로필. 저장한 적이 없으면 빈 기본값.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/MyProfileResponse" },
    },
  },
};

const projectResponse = {
  description: "공개 맞춤 영상 제작 의뢰",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Project" },
    },
  },
};

const projectIdParam = {
  name: "projectId",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[1-9]\\d*$" },
};

const projectListParameters = [
  {
    name: "q",
    in: "query",
    schema: { type: "string", minLength: 1, maxLength: 100 },
  },
  {
    name: "purpose",
    in: "query",
    schema: { type: "string", enum: [...VIDEO_PURPOSES] },
  },
  {
    name: "styles",
    in: "query",
    description: "쉼표로 구분한 영상 스타일 (예: EMOTIONAL,CINEMATIC)",
    schema: { type: "string" },
  },
  { name: "budgetMin", in: "query", schema: { type: "integer", minimum: 1 } },
  { name: "budgetMax", in: "query", schema: { type: "integer", minimum: 1 } },
  {
    name: "sort",
    in: "query",
    schema: { type: "string", enum: [...PROJECT_SORTS], default: "LATEST" },
  },
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
  },
];

const discoveryListParameters = projectListParameters.filter(
  ({ name }) => name === "page" || name === "pageSize",
);

const idParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[1-9]\\d*$" },
});

const jsonResponse = (description: string, schema: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const pageParameters = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 50 },
  },
];

const nullableEnum = (values: readonly string[]) => ({
  type: ["string", "null"],
  enum: [...values, null],
});

const versionNoParam = {
  name: "versionNo",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[1-9]\\d{0,8}$" },
};

const orderIdParam = {
  name: "orderId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const termsPartyErrors = {
  ...bearerErrors,
  403: errorResponse("이용 제한·탈퇴 회원 (`FORBIDDEN`)"),
  404: errorResponse(
    "요청이 없거나 그 요청의 의뢰인·크리에이터가 아님 (`NOT_FOUND`)",
  ),
};

const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "KEMI API",
    version: "0.1.0",
    description:
      "KEMI 백엔드 API. 오류 응답은 모두 `{ error: { code, message, details? } }` 형식이다. 사용자 ID는 문자열이다.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "health", description: "서버·DB 상태 확인" },
    { name: "auth", description: "이메일 회원가입·로그인·토큰 갱신" },
    { name: "profiles", description: "역할별 본인 프로필" },
    { name: "projects", description: "공개 맞춤 영상 제작 의뢰" },
    { name: "applications", description: "프로젝트 지원·선정·거절" },
    { name: "notifications", description: "인앱 알림" },
    { name: "discovery", description: "프로젝트 북마크·기본 추천" },
    { name: "pricing", description: "AI 제작 단가 분석·예산 입력 보조" },
    {
      name: "files",
      description:
        "파일 업로드(브라우저 → Supabase Storage 직접)·확인·다운로드 (결정 기록 4장)",
    },
    {
      name: "chat",
      description:
        "요청별 대화방 (협의 요청 때 생기고 계약 뒤에도 같은 방, 실시간 전송 없음)",
    },
    {
      name: "catalog",
      description:
        "제작 패키지·작업물·제작 서비스 공개 (PACK-01~03, PORT-01~02). 공개 조회는 서비스가 공개된 크리에이터만",
    },
    {
      name: "project-drafts",
      description:
        "공고 임시 저장·공개 (CAMP-01·02). 마감 = 공개 시각 + 모집 기간(3·7·14일, 기본 7일)",
    },
    {
      name: "delivery",
      description:
        "검토·수정·최종 수령·모의 정산·리뷰 (계약 단위, DEL-01~05, REV-01~02, SETTLE-01, REVIEW-01)",
    },
    {
      name: "production",
      description:
        "제작 준비 자료·제작 시작·납기 변경 (계약 단위, READY-01·02, WORK-01·02)",
    },
    {
      name: "payments",
      description:
        "계약 전액 테스트 결제 (Toss Sandbox, 실제 돈은 움직이지 않음)",
    },
    {
      name: "terms",
      description:
        "최종 조건서·양측 서명·계약 (협의 중인 요청 단위, 결정 기록 13장)",
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        summary: "프로세스 생존 확인 (DB를 보지 않음)",
        responses: {
          200: {
            description: "정상",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/health/ready": {
      get: {
        tags: ["health"],
        summary: "DB 연결까지 확인",
        responses: {
          200: {
            description: "DB 연결 정상",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadinessResponse" },
              },
            },
          },
          503: {
            description: "DB 연결 실패",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReadinessResponse" },
              },
            },
          },
        },
      },
    },
    "/api/pricing/analyze": {
      post: {
        tags: ["pricing"],
        summary: "AI 제작 단가 분석 (AI-01)",
        description:
          "활성 의뢰인만 요청할 수 있다. 입력 설명을 바탕으로 작업 단위·단가를 AI로 추정한다. 서버가 합계를 정수로 다시 계산하며, 실측 시장 단가나 확정 견적이 아니다. 사용자가 검토한 후 신규 프로젝트 생성 또는 본인 모집 중 프로젝트의 PATCH budget에 반영한다(AI-02). 저장/예산 수정은 자동으로 하지 않는다. 로그인 사용자당 1시간 10회(인증 실패는 차감되지 않음).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(pricingAnalysisRequestSchema),
            },
          },
        },
        responses: {
          200: jsonResponse("AI 추정 단가 보고서", "PricingAnalysisResponse"),
          400: errorResponse("입력값 오류 (VALIDATION_FAILED)"),
          ...bearerErrors,
          403: errorResponse("의뢰인 외 요청·비활성 사용자 (FORBIDDEN)"),
          429: rateLimited,
          502: errorResponse("외부 AI 분석 실패 (SERVICE_UNAVAILABLE)"),
          503: errorResponse("AI 서비스 미설정 (SERVICE_UNAVAILABLE)"),
        },
      },
    },
    "/api/auth/signup": {
      post: {
        tags: ["auth"],
        summary: "이메일 회원가입 후 바로 로그인",
        description:
          "이메일은 앞뒤 공백 제거·소문자로 정규화한다. 역할은 `CLIENT`·`CREATOR`만 받는다. 비밀번호는 8자 이상, 72바이트 이하. 요청 제한: IP당 1시간 10회.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(signupRequestSchema) },
          },
        },
        responses: {
          201: authTokenResponse("가입·로그인 성공."),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          409: errorResponse("이미 가입된 이메일 (`EMAIL_ALREADY_EXISTS`)"),
          429: rateLimited,
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["auth"],
        summary: "이메일 로그인",
        description: "요청 제한: IP당 15분 10회.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(loginRequestSchema) },
          },
        },
        responses: {
          200: authTokenResponse("로그인 성공."),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          401: errorResponse(
            "이메일·비밀번호 불일치, 없는 이메일, 소셜 전용 계정 모두 같은 응답 (`INVALID_CREDENTIALS`)",
          ),
          403: errorResponse("이용 제한된 계정 (`FORBIDDEN`)"),
          429: rateLimited,
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["auth"],
        summary: "Refresh 토큰 회전",
        description: `${cookieOnlyRequest.description} 요청 제한: IP당 15분 60회. \`409 REFRESH_RACE\`를 받으면 \`details.retryAfterMs\` 뒤 최대 2번까지 다시 시도하고, 그래도 실패하면 재로그인으로 안내한다.`,
        responses: {
          200: authTokenResponse(
            "회전 성공. 새 Access 토큰과 새 쿠키를 받는다.",
          ),
          401: errorResponse(
            "쿠키 없음, 세션 폐기·만료, 재사용 감지 (`SESSION_REVOKED`). 쿠키를 삭제한다.",
          ),
          403: errorResponse(
            "허용되지 않은 Origin 또는 이용 제한된 계정 (`FORBIDDEN`)",
          ),
          409: errorResponse(
            "다른 요청이 먼저 갱신함 (`REFRESH_RACE`, `details.retryAfterMs`). 새 토큰은 발급하지 않는다.",
          ),
          429: rateLimited,
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["auth"],
        summary: "로그인 세션 폐기",
        description: `${cookieOnlyRequest.description} 이후 이 세션의 Refresh·Access 토큰은 모두 거부된다.`,
        responses: {
          204: { description: "로그아웃 완료. 쿠키를 삭제한다." },
          403: errorResponse("허용되지 않은 Origin (`FORBIDDEN`)"),
        },
      },
    },
    "/api/auth/{provider}/start": {
      get: {
        tags: ["auth"],
        summary: "소셜 로그인 시작 (브라우저 이동)",
        description:
          "fetch가 아니라 브라우저 주소 이동으로 연다. 제공자 동의 화면으로 302 이동하고, state·PKCE 값을 `kemi_oauth_state` 쿠키(10분)에 담는다. 서버에 제공자 설정이 없으면 프론트엔드로 `error=SOCIAL_UNAVAILABLE`과 함께 돌려보낸다. 요청 제한: IP당 15분 20회, 콜백과 따로 센다 [제안]. 넘으면 429 JSON 대신 프론트엔드로 `error=SOCIAL_RATE_LIMITED`와 함께 보낸다.",
        parameters: [providerParam],
        responses: {
          302: {
            description:
              "제공자 동의 화면, 또는 프론트엔드(설정 없음 `SOCIAL_UNAVAILABLE`, 요청 제한 `SOCIAL_RATE_LIMITED`)로 이동",
            headers: { Location: { schema: { type: "string" } } },
          },
          404: errorResponse("지원하지 않는 제공자 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/auth/{provider}/callback": {
      get: {
        tags: ["auth"],
        summary: "소셜 로그인 콜백 (제공자가 호출)",
        description:
          "제공자 콘솔에 `{APP_ORIGIN}/api/auth/{provider}/callback`으로 등록한다. state가 쿠키와 같아야 한다. 같은 이메일의 기존 회원과 자동으로 병합하지 않는다. Access 토큰은 주소에 싣지 않으며, `result=login`이면 프론트엔드가 `POST /api/auth/refresh`로 받는다. 제공자 요청(토큰 교환·회원 정보)은 요청마다 10초 안에 끝나야 하며, 넘으면 요청을 취소하고 `error=SOCIAL_FAILED`로 보낸다 [제안]. 요청 제한: IP당 15분 20회, 시작과 따로 센다. 넘으면 `error=SOCIAL_RATE_LIMITED`로 보낸다.",
        parameters: [
          providerParam,
          { name: "code", in: "query", schema: { type: "string" } },
          { name: "state", in: "query", schema: { type: "string" } },
          { name: "error", in: "query", schema: { type: "string" } },
        ],
        responses: {
          302: socialRedirect,
          404: errorResponse("지원하지 않는 제공자 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/auth/social/signup": {
      get: {
        tags: ["auth"],
        summary: "소셜 가입 대기 정보 조회",
        description:
          "`result=signup`으로 돌아온 뒤 가입 화면에 보여줄 제공자·이름 후보·제공자 이메일. 가입 티켓 쿠키(`kemi_social_signup`, 10분)가 필요하다.",
        responses: {
          200: {
            description: "가입 대기 중인 소셜 계정",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SocialSignupPendingResponse",
                },
              },
            },
          },
          401: errorResponse("가입 티켓 없음·만료 (`UNAUTHENTICATED`)"),
        },
      },
      post: {
        tags: ["auth"],
        summary: "소셜 가입 완료 후 바로 로그인",
        description:
          "가입 티켓 쿠키로 동작하며 `Origin` 헤더가 프론트엔드 주소와 같아야 한다. 로그인 이메일·비밀번호 없이 가입하며, 제공자 이메일은 소셜 계정 정보로만 저장한다. 요청 제한: 가입과 같음.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(socialSignupRequestSchema),
            },
          },
        },
        responses: {
          201: authTokenResponse("가입·로그인 성공."),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          401: errorResponse("가입 티켓 없음·만료·위조 (`UNAUTHENTICATED`)"),
          403: errorResponse("허용되지 않은 Origin (`FORBIDDEN`)"),
          409: errorResponse(
            "이 소셜 계정으로 이미 가입함 (`CONFLICT`). 소셜 로그인을 다시 시작한다.",
          ),
          429: rateLimited,
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["auth"],
        summary: "현재 사용자 조회",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "현재 사용자",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MeResponse" },
              },
            },
          },
          ...bearerErrors,
          403: errorResponse("이용 제한된 계정 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/profiles/me": {
      get: {
        tags: ["profiles"],
        summary: "본인 프로필 조회",
        security: [{ bearerAuth: [] }],
        responses: {
          200: myProfileResponse,
          ...bearerErrors,
          403: errorResponse(
            "관리자 계정, 또는 이용 제한·탈퇴된 계정(상태 변경 전에 받은 토큰 포함) (`FORBIDDEN`)",
          ),
        },
      },
      patch: {
        tags: ["profiles"],
        summary: "본인 프로필 저장 (부분 수정)",
        description:
          "보낸 항목만 바꾼다. 요청 형식은 로그인한 역할의 것만 받으며(두 형식 중 무엇을 쓸지는 토큰의 역할로 정해진다), 모르는 항목(다른 역할 항목·`serviceStatus` 포함)은 400이다. 보내지 않은 항목은 그대로다. 자유 입력 문자열·주소는 빈 문자열·공백만이면 null로 저장하고, null로도 지운다. 선택지(`industry`·`niche`)·날짜는 null로 지우며 빈 문자열은 400이다. 복수 선택은 목록 전체를 보내고 []로 비운다(빈 문자열·null은 400). `isAvailable`·`name`은 빈 문자열·null이 400이다. `name`은 회원 표시 이름을 바꾼다. 저장해도 제작 서비스는 공개되지 않는다.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                // name·introduction 같은 공통 항목만 보내면 두 형식을 모두 만족하므로 oneOf가 아니라 anyOf다.
                // 역할에 맞는 형식인지는 서버가 로그인한 역할로 판단한다(다른 역할 항목은 400).
                anyOf: [
                  {
                    title: "의뢰인 (CLIENT)",
                    ...requestSchema(clientProfileUpdateSchema),
                  },
                  {
                    title: "크리에이터 (CREATOR)",
                    ...requestSchema(creatorProfileUpdateSchema),
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: myProfileResponse,
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: errorResponse(
            "관리자 계정, 또는 이용 제한·탈퇴된 계정(상태 변경 전에 받은 토큰 포함) (`FORBIDDEN`)",
          ),
        },
      },
    },
    "/api/projects": {
      get: {
        tags: ["projects"],
        summary: "모집 중인 공개 프로젝트 탐색",
        description:
          "마감 전이며 삭제되지 않은 OPEN 프로젝트만 반환한다. 이용 제한·탈퇴 회원이 등록한 프로젝트는 제외한다. 제목·설명을 검색하고 목적·스타일·예산으로 필터링한다.",
        parameters: projectListParameters,
        responses: {
          200: {
            description: "프로젝트 목록",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProjectListResponse" },
              },
            },
          },
          400: errorResponse("잘못된 검색 조건 (`VALIDATION_FAILED`)"),
        },
      },
      post: {
        tags: ["projects"],
        summary: "공개 프로젝트 등록",
        description:
          "CLIENT만 등록할 수 있다. 모집 마감은 현재 이후, 희망 납품일은 모집 마감일 이후여야 한다.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(projectCreateSchema) },
          },
        },
        responses: {
          201: projectResponse,
          400: errorResponse(
            "잘못된 입력 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/projects/me": {
      get: {
        tags: ["projects"],
        summary: "내 프로젝트 목록",
        security: [{ bearerAuth: [] }],
        parameters: projectListParameters,
        responses: {
          200: {
            description: "마감된 항목을 포함한 내 프로젝트 목록",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProjectListResponse" },
              },
            },
          },
          400: errorResponse("잘못된 검색 조건 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/projects/{projectId}": {
      get: {
        tags: ["projects"],
        summary: "공개 프로젝트 상세 조회",
        description:
          "모집 중(OPEN)이고 마감 전이며, 이용 제한·탈퇴되지 않은 회원의 프로젝트만 보여준다. 다만 `Authorization`을 보낸 작성자와 이 프로젝트에 지원한 크리에이터는 마감·선정 뒤에도 볼 수 있다(삭제한 프로젝트는 제외). 토큰이 잘못되면 401, 그 밖에는 404다.",
        parameters: [projectIdParam],
        responses: {
          200: projectResponse,
          400: errorResponse("잘못된 프로젝트 ID (`VALIDATION_FAILED`)"),
          404: errorResponse("공개 모집 중인 프로젝트가 없음 (`NOT_FOUND`)"),
        },
      },
      patch: {
        tags: ["projects"],
        summary: "내 프로젝트 부분 수정",
        security: [{ bearerAuth: [] }],
        parameters: [projectIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(projectUpdateSchema) },
          },
        },
        responses: {
          200: projectResponse,
          400: errorResponse(
            "잘못된 입력 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트가 아님 (`NOT_FOUND`)"),
          409: errorResponse(
            "모집 중인 프로젝트가 아니거나, 모집 마감 시각이 지남 (`CONFLICT`). 마감 시각이 지나면 제목만 고치거나 마감을 연장하는 요청도 받지 않는다.",
          ),
        },
      },
      delete: {
        tags: ["projects"],
        summary: "내 프로젝트 삭제 (소프트 삭제)",
        security: [{ bearerAuth: [] }],
        parameters: [projectIdParam],
        responses: {
          204: { description: "삭제 완료" },
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트가 아님 (`NOT_FOUND`)"),
          409: errorResponse("거래가 시작된 프로젝트 (`CONFLICT`)"),
        },
      },
    },
    "/api/projects/{projectId}/end-without-selection": {
      post: {
        tags: ["projects"],
        summary: "무선정 종료 (CAMP-06)",
        description:
          "아무도 선정하지 않고 모집을 끝낸다(직접 마감과 다름). 프로젝트는 `CLOSED` + `NO_SELECTION`, 대기·협의 중인 지원은 `NOT_SELECTED`(`NO_SELECTION`), 미확정 조건서는 `VOID`가 되고 각 크리에이터에게 `PROJECT_ENDED_NO_SELECTION` 알림이 간다. 모집 중이거나 마감(직접·기한)된 프로젝트에서만 할 수 있고, 계약이 있으면 409다.",
        security: [{ bearerAuth: [] }],
        parameters: [projectIdParam],
        responses: {
          200: projectResponse,
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트가 아님 (`NOT_FOUND`)"),
          409: errorResponse("계약됐거나 이미 종료됨 (`CONFLICT`)"),
        },
      },
    },
    "/api/projects/{projectId}/close": {
      post: {
        tags: ["projects"],
        summary: "내 프로젝트 모집 마감",
        description:
          "신규 지원만 막는다. 이미 들어온 지원과는 계속 협의할 수 있고(CAMP-05), 대기 지원자에게 `PROJECT_CLOSED` 알림이 간다. 마감 시각이 지나도 서버가 자동으로 상태를 바꾸지는 않으며(스케줄러 없음), 지원할 때 마감 시각을 검사해 막는다.",
        security: [{ bearerAuth: [] }],
        parameters: [projectIdParam],
        responses: {
          200: projectResponse,
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트가 아님 (`NOT_FOUND`)"),
          409: errorResponse("이미 모집이 종료됨 (`CONFLICT`)"),
        },
      },
    },
    "/api/bookmarks/projects": {
      get: {
        tags: ["discovery"],
        summary: "내 프로젝트 북마크 목록",
        description:
          "CREATOR가 저장한 프로젝트를 최근 북마크 순으로 반환한다. 모집이 끝난 프로젝트도 남기되 삭제된 프로젝트는 제외한다.",
        security: [{ bearerAuth: [] }],
        parameters: discoveryListParameters,
        responses: {
          200: {
            description: "북마크한 프로젝트 목록",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProjectListResponse" },
              },
            },
          },
          400: errorResponse("잘못된 페이지 조건 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/bookmarks/projects/{projectId}": {
      put: {
        tags: ["discovery"],
        summary: "프로젝트 북마크 저장",
        description:
          "CREATOR만 모집 중인 프로젝트를 저장할 수 있다. 같은 요청을 반복해도 북마크는 한 건만 유지된다.",
        security: [{ bearerAuth: [] }],
        parameters: [projectIdParam],
        responses: {
          200: projectResponse,
          400: errorResponse("잘못된 프로젝트 ID (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
          404: errorResponse("모집 중인 프로젝트가 없음 (`NOT_FOUND`)"),
        },
      },
      delete: {
        tags: ["discovery"],
        summary: "프로젝트 북마크 해제",
        description: "북마크가 없어도 성공하는 멱등 요청이다.",
        security: [{ bearerAuth: [] }],
        parameters: [projectIdParam],
        responses: {
          204: { description: "북마크 해제 완료" },
          400: errorResponse("잘못된 프로젝트 ID (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/recommendations/projects": {
      get: {
        tags: ["discovery"],
        summary: "내 추천 프로젝트 목록",
        description:
          "북마크의 목적·스타일과 크리에이터 프로필의 분야·스타일에 맞는 모집 중 프로젝트를 최신순으로 반환한다. 선호 정보나 일치 결과가 없으면 최신 프로젝트를 반환하며 이미 북마크한 항목은 제외한다.",
        security: [{ bearerAuth: [] }],
        parameters: discoveryListParameters,
        responses: {
          200: {
            description: "추천 프로젝트 목록",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ProjectListResponse" },
              },
            },
          },
          400: errorResponse("잘못된 페이지 조건 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/projects/{projectId}/applications": {
      post: {
        tags: ["applications"],
        summary: "프로젝트에 지원 (APPLY-01)",
        description:
          "크리에이터만. 모집 중(`OPEN`)이고 마감 시각 전인 프로젝트에만 지원할 수 있다. 같은 프로젝트에는 상태와 관계없이 한 번만 지원한다(결정 기록 3장). 의뢰인에게 `APPLICATION_SUBMITTED` 알림이 간다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("projectId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(applicationCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("지원 완료", "Application"),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
          404: errorResponse(
            "없거나 삭제된 프로젝트, 또는 이용 제한·탈퇴 의뢰인의 프로젝트 (`NOT_FOUND`)",
          ),
          409: errorResponse(
            "모집 마감 또는 이미 지원한 프로젝트 (`CONFLICT`)",
          ),
        },
      },
      get: {
        tags: ["applications"],
        summary: "내 프로젝트의 지원자 목록",
        description: "프로젝트를 등록한 의뢰인만. 지원 순서대로 준다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("projectId")],
        responses: {
          200: jsonResponse("지원자 목록", "ProjectApplicationListResponse"),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트가 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/applications/me": {
      get: {
        tags: ["applications"],
        summary: "내 지원 내역 (크리에이터)",
        security: [{ bearerAuth: [] }],
        parameters: pageParameters,
        responses: {
          200: jsonResponse("내 지원 내역", "MyApplicationListResponse"),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
        },
      },
    },
    "/api/applications/{applicationId}/discuss": {
      post: {
        tags: ["applications"],
        summary: "협의 요청 (APPLY-02)",
        description:
          "대기 중인 지원을 협의 중(`DISCUSSING`)으로 바꾼다. **선정이 아니다.** 프로젝트 상태와 다른 지원은 그대로이고, 여러 후보와 동시에 협의할 수 있다. 선정은 같은 조건서 버전에 양측이 서명할 때 일어난다(`/api/work-requests/{id}/terms`). 모집 마감(직접·기한) 뒤에도 들어온 지원과 협의할 수 있다. 크리에이터에게 `DISCUSSION_REQUESTED` 알림이 간다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("applicationId")],
        responses: {
          200: jsonResponse("협의 중이 된 지원", "Application"),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트의 지원이 아님 (`NOT_FOUND`)"),
          409: errorResponse(
            "대기 중이 아닌 지원, 또는 계약·무선정 종료된 프로젝트 (`CONFLICT`)",
          ),
        },
      },
    },
    "/api/applications/{applicationId}/decline": {
      post: {
        tags: ["applications"],
        summary: "지원 거절 (APPLY-03)",
        description:
          "대기·협의 중인 지원을 `DECLINED`로 바꾼다. 협의 중이던 미확정 조건서는 `VOID`가 된다. 프로젝트 상태는 그대로다. 지원자에게 `APPLICATION_DECLINED` 알림이 간다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("applicationId")],
        responses: {
          200: jsonResponse("거절된 지원", "Application"),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 프로젝트의 지원이 아님 (`NOT_FOUND`)"),
          409: errorResponse(
            "이미 처리된 지원, 또는 이미 선정했거나 종료된 프로젝트 (`CONFLICT`)",
          ),
        },
      },
    },
    "/api/applications/{applicationId}/withdraw": {
      post: {
        tags: ["applications"],
        summary: "지원 철회 (APPLY-03)",
        description:
          "크리에이터가 계약 전(대기·협의 중) 본인 지원을 `WITHDRAWN`으로 거둔다. 협의 중이던 미확정 조건서는 `VOID`가 된다. 의뢰인에게 `APPLICATION_WITHDRAWN` 알림이 간다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("applicationId")],
        responses: {
          200: jsonResponse("철회된 지원", "Application"),
          ...bearerErrors,
          403: errorResponse("크리에이터가 아님 (`FORBIDDEN`)"),
          404: errorResponse("본인 지원이 아님 (`NOT_FOUND`)"),
          409: errorResponse("이미 끝난 지원·계약된 지원 (`CONFLICT`)"),
        },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["notifications"],
        summary: "내 알림 목록 (NOTI-01)",
        description:
          "최신순. `unread=true`면 미확인 알림만. 응답의 `unreadCount`는 필터와 관계없이 전체 미확인 개수다.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "unread",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
          },
          ...pageParameters,
        ],
        responses: {
          200: jsonResponse("알림 목록", "NotificationListResponse"),
          ...bearerErrors,
        },
      },
    },
    "/api/notifications/unread-count": {
      get: {
        tags: ["notifications"],
        summary: "미확인 알림 개수",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("미확인 개수", "UnreadCountResponse"),
          ...bearerErrors,
        },
      },
    },
    "/api/notifications/read-all": {
      post: {
        tags: ["notifications"],
        summary: "내 알림 모두 읽음",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("남은 미확인 개수(0)", "UnreadCountResponse"),
          ...bearerErrors,
        },
      },
    },
    "/api/notifications/{notificationId}/read": {
      post: {
        tags: ["notifications"],
        summary: "알림 하나 읽음",
        description: "이미 읽은 알림은 처음 읽은 시각을 유지한다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("notificationId")],
        responses: {
          200: jsonResponse("읽음 처리된 알림", "Notification"),
          ...bearerErrors,
          404: errorResponse("본인 알림이 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/files": {
      post: {
        tags: ["files"],
        summary: "업로드 준비 (FILE-01)",
        description:
          "선언한 형식·크기·쓰임을 검사하고 Supabase Storage 서명 업로드 URL을 준다. 브라우저는 그 URL로 파일을 직접 올린 뒤 `/complete`를 부른다. 한도: 영상(MP4·MOV)·ZIP 50MB, 이미지(JPG·PNG·WebP) 10MB. 거래 파일(채팅 첨부·자료·납품물·수정 첨부)은 `workRequestId`가 필요하고, 그 요청의 당사자이며 요청이 협의 중이거나 계약 뒤여야 한다. 작업물은 크리에이터만. 저장소 미설정이면 503.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(fileUploadCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("파일(PENDING)과 업로드 URL", "FileUploadResponse"),
          400: errorResponse("형식·크기·쓰임 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse(
            "작업물을 크리에이터가 아닌 사람이 올림 (`FORBIDDEN`)",
          ),
          404: errorResponse("요청이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("협의 중·계약 상태가 아닌 요청 (`CONFLICT`)"),
          503: errorResponse(
            "파일 저장소 미설정·응답 없음 (`SERVICE_UNAVAILABLE`)",
          ),
        },
      },
    },
    "/api/files/{fileId}/complete": {
      post: {
        tags: ["files"],
        summary: "업로드 확인 (FILE-01)",
        description:
          "올린 사람만. 저장소의 실제 크기와 파일 앞부분(매직 바이트)으로 형식을 확인한다. 맞으면 `READY`, 크기·형식이 다르면 `REJECTED`(사유 포함). 아직 올리지 않았으면 409. 이미 끝난 파일은 그대로 돌려준다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("fileId")],
        responses: {
          200: jsonResponse("확인 결과", "StoredFile"),
          ...bearerErrors,
          404: errorResponse("파일이 없거나 올린 사람이 아님 (`NOT_FOUND`)"),
          409: errorResponse("업로드가 아직 끝나지 않음 (`CONFLICT`)"),
          503: errorResponse(
            "파일 저장소 미설정·응답 없음 (`SERVICE_UNAVAILABLE`)",
          ),
        },
      },
    },
    "/api/files/{fileId}": {
      get: {
        tags: ["files"],
        summary: "파일 정보",
        description:
          "올린 사람, 또는 거래 파일이면 그 요청의 당사자만 볼 수 있다. 나머지는 404.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("fileId")],
        responses: {
          200: jsonResponse("파일", "StoredFile"),
          ...bearerErrors,
          404: errorResponse("파일이 없거나 볼 권한이 없음 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/files/{fileId}/download": {
      get: {
        tags: ["files"],
        summary: "다운로드·재생 URL",
        description:
          "확인이 끝난(`READY`) 파일의 서명 URL(10분)을 준다. 권한은 파일 정보와 같다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("fileId")],
        responses: {
          200: jsonResponse("서명 URL", "FileDownloadResponse"),
          ...bearerErrors,
          404: errorResponse("파일이 없거나 볼 권한이 없음 (`NOT_FOUND`)"),
          409: errorResponse("확인이 끝나지 않은 파일 (`CONFLICT`)"),
          503: errorResponse(
            "파일 저장소 미설정·응답 없음 (`SERVICE_UNAVAILABLE`)",
          ),
        },
      },
    },
    "/api/chat/rooms": {
      get: {
        tags: ["chat"],
        summary: "내 대화방 목록 (CHAT-03)",
        description:
          "내가 의뢰인·크리에이터인 요청의 방. 최근 메시지가 있는 방부터. 협의가 끝난(거절·철회·미선정) 방은 `readOnly`다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("대화방 목록", "ChatRoomListResponse"),
          ...bearerErrors,
        },
      },
    },
    "/api/work-requests/{workRequestId}/chat/messages": {
      get: {
        tags: ["chat"],
        summary: "메시지 조회 (CHAT-01·04)",
        description:
          "기본은 최신 50개를 오래된 순서로 준다. `before`로 이전 페이지, `after`로 새로 온 메시지만 받는다. 시스템 메시지(`SYSTEM`)는 서명 요청·계약 체결·결제 완료 같은 작업 사건 안내다(WORK-04).",
        security: [{ bearerAuth: [] }],
        parameters: [
          idParam("workRequestId"),
          { name: "before", in: "query", schema: { type: "string" } },
          { name: "after", in: "query", schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          200: jsonResponse("메시지", "ChatMessagesResponse"),
          ...bearerErrors,
          404: errorResponse("방이 없거나 당사자가 아님 (`NOT_FOUND`)"),
        },
      },
      post: {
        tags: ["chat"],
        summary: "메시지 보내기 (CHAT-01)",
        description:
          "텍스트 메시지(4,000자까지). 같은 `clientMessageId`의 재전송은 200으로 이전 메시지를 준다. 협의가 끝난 방은 409다. 첨부·대화만으로 납품·수정 회차·계약 상태가 바뀌지 않는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("workRequestId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(chatMessageCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("보낸 메시지", "ChatMessage"),
          200: jsonResponse("같은 메시지의 재전송", "ChatMessage"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          404: errorResponse("방이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse(
            "협의가 끝난 방, 같은 식별자로 다른 내용 (`CONFLICT`)",
          ),
        },
      },
    },
    "/api/work-requests/{workRequestId}/chat/read": {
      post: {
        tags: ["chat"],
        summary: "읽음 처리 (CHAT-03)",
        description:
          "화면에 보인 마지막 메시지까지 읽음으로 한다. 읽음 위치는 뒤로 가지 않는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("workRequestId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(chatReadSchema) },
          },
        },
        responses: {
          200: jsonResponse("갱신된 방 요약", "ChatRoomSummary"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          404: errorResponse("방·메시지가 없거나 당사자가 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/creator/packages": {
      get: {
        tags: ["catalog"],
        summary: "내 패키지 목록",
        description: "크리에이터 본인의 모든 패키지(초안·공개·비공개).",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("내 패키지 목록", "ServicePackageList"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
      post: {
        tags: ["catalog"],
        summary: "패키지 초안 저장 (PACK-01)",
        description:
          "제목만 있어도 저장한다. 가격·납기·수정 횟수·제공 내용 등은 공개할 때 모두 있어야 한다.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(packageCreateSchema) },
          },
        },
        responses: {
          201: jsonResponse("패키지", "ServicePackage"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/creator/packages/{packageId}": {
      patch: {
        tags: ["catalog"],
        summary: "패키지 수정",
        description:
          "보낸 항목만 바꾼다(null은 지움). 공개·비공개 패키지의 필수 항목은 비울 수 없다(400).",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(packageUpdateSchema) },
          },
        },
        responses: {
          200: jsonResponse("패키지", "ServicePackage"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/creator/packages/{packageId}/publish": {
      post: {
        tags: ["catalog"],
        summary: "패키지 공개 (PACK-02)",
        description: "필수 항목이 모두 있어야 한다(빠진 항목은 `details`).",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        responses: {
          200: jsonResponse("패키지", "ServicePackage"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creator/packages/{packageId}/hide": {
      post: {
        tags: ["catalog"],
        summary: "패키지 내리기",
        description:
          "대표 지정도 풀린다. 공개 중인 서비스의 대표 패키지는 다른 대표를 정하기 전에는 내릴 수 없다(409).",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        responses: {
          200: jsonResponse("패키지", "ServicePackage"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creator/packages/{packageId}/representative": {
      post: {
        tags: ["catalog"],
        summary: "대표 패키지 지정 (PACK-03)",
        description:
          "공개된 패키지만. 크리에이터당 하나이며 이전 대표는 해제된다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        responses: {
          200: jsonResponse("패키지", "ServicePackage"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creator/portfolios": {
      get: {
        tags: ["catalog"],
        summary: "내 작업물 목록",
        description: "크리에이터 본인의 모든 작업물.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("내 작업물 목록", "PortfolioList"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
      post: {
        tags: ["catalog"],
        summary: "작업물 초안 저장 (PORT-01)",
        description:
          "영상·대표 이미지는 본인이 올려 확인이 끝난 PORTFOLIO 파일(영상 video/*, 이미지 image/*). 연결 패키지는 본인 것만.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(portfolioCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("작업물", "Portfolio"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/creator/portfolios/{portfolioId}": {
      patch: {
        tags: ["catalog"],
        summary: "작업물 수정",
        description:
          "보낸 항목만 바꾼다. 공개 중인 작업물의 공개 조건(영상·목적·역할·고객 동의)은 깰 수 없다(400).",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("portfolioId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(portfolioUpdateSchema),
            },
          },
        },
        responses: {
          200: jsonResponse("작업물", "Portfolio"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/creator/portfolios/{portfolioId}/publish": {
      post: {
        tags: ["catalog"],
        summary: "작업물 공개 (PORT-02)",
        description:
          "영상·목적·본인 역할(1개 이상)이 있어야 한다. 고객 의뢰 작업(CLIENT_WORK)은 고객 공개 동의가 있어야 한다 [제안, D16]. 고객 납품물은 자동으로 공개되지 않는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("portfolioId")],
        responses: {
          200: jsonResponse("작업물", "Portfolio"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creator/portfolios/{portfolioId}/hide": {
      post: {
        tags: ["catalog"],
        summary: "작업물 내리기",
        description: "공개 조회에서 빠진다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("portfolioId")],
        responses: {
          200: jsonResponse("작업물", "Portfolio"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creator/service/publish": {
      post: {
        tags: ["catalog"],
        summary: "제작 서비스 공개",
        description:
          "공개된 대표 패키지가 있어야 한다(409). 공개해야 제작자 페이지·패키지·작업물이 공개 조회된다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("서비스 상태", "CreatorServiceStatus"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creator/service/hide": {
      post: {
        tags: ["catalog"],
        summary: "제작 서비스 내리기",
        description: "공개 조회가 모두 막힌다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("서비스 상태", "CreatorServiceStatus"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/creators/{userId}": {
      get: {
        tags: ["catalog"],
        summary: "제작자 공개 페이지 (PORT-01, PACK-01)",
        description:
          "대표 패키지·대표 외 공개 패키지·공개 작업물·받은 리뷰 요약.",
        parameters: [idParam("userId")],
        responses: {
          200: jsonResponse("제작자", "CreatorPublicProfile"),
          400: errorResponse("ID 오류 (`VALIDATION_FAILED`)"),
          404: errorResponse("공개되지 않았거나 없음 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/packages/{packageId}": {
      get: {
        tags: ["catalog"],
        summary: "공개 패키지 상세",
        description: "가격·납기·수정 횟수·제공 내용.",
        parameters: [idParam("packageId")],
        responses: {
          200: jsonResponse("패키지", "ServicePackage"),
          400: errorResponse("ID 오류 (`VALIDATION_FAILED`)"),
          404: errorResponse("공개되지 않았거나 없음 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/portfolios/{portfolioId}": {
      get: {
        tags: ["catalog"],
        summary: "공개 작업물 상세",
        description: "본인 역할·출처·제작자·연결 패키지.",
        parameters: [idParam("portfolioId")],
        responses: {
          200: jsonResponse("작업물", "Portfolio"),
          400: errorResponse("ID 오류 (`VALIDATION_FAILED`)"),
          404: errorResponse("공개되지 않았거나 없음 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/portfolios/{portfolioId}/media": {
      get: {
        tags: ["catalog"],
        summary: "공개 작업물 재생 주소",
        description: "영상·대표 이미지의 10분짜리 서명 주소.",
        parameters: [idParam("portfolioId")],
        responses: {
          200: jsonResponse("재생 주소", "PortfolioMedia"),
          400: errorResponse("ID 오류 (`VALIDATION_FAILED`)"),
          404: errorResponse("공개되지 않았거나 없음 (`NOT_FOUND`)"),
          503: errorResponse("파일 저장소 미설정 (`SERVICE_UNAVAILABLE`)"),
        },
      },
    },
    "/api/project-drafts": {
      get: {
        tags: ["project-drafts"],
        summary: "내 임시 저장 공고",
        description: "공개하지 않은 초안만, 최근 수정순.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("초안 목록", "ProjectDraftList"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
      post: {
        tags: ["project-drafts"],
        summary: "공고 임시 저장 (CAMP-01)",
        description:
          "모든 항목이 비어 있어도 저장한다. 모집 기간 `recruitmentDays`는 3·7·14(기본 7).",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(projectDraftValuesSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("임시 저장 공고", "ProjectDraft"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/project-drafts/{draftId}": {
      patch: {
        tags: ["project-drafts"],
        summary: "임시 저장 공고 수정",
        description:
          "보낸 항목만 덮어쓴다(null은 지움). 공개한 초안은 고칠 수 없다(409).",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("draftId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(projectDraftValuesSchema),
            },
          },
        },
        responses: {
          200: jsonResponse("임시 저장 공고", "ProjectDraft"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
      delete: {
        tags: ["project-drafts"],
        summary: "임시 저장 공고 삭제",
        description: "공개하지 않은 초안만.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("draftId")],
        responses: {
          204: { description: "삭제함" },
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("이미 공개함 (`CONFLICT`)"),
        },
      },
    },
    "/api/project-drafts/{draftId}/publish": {
      post: {
        tags: ["project-drafts"],
        summary: "공고 공개 (CAMP-02)",
        description:
          "바로 등록(`POST /api/projects`)과 같은 검사를 한다. 마감 = 공개 시각 + 모집 기간. 같은 초안은 한 번만 공개한다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("draftId")],
        responses: {
          201: jsonResponse("공개 결과", "ProjectDraftPublishResult"),
          400: errorResponse(
            "입력값 오류·공개 필수 항목 누락 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("대상이 없거나 본인 것이 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/delivery": {
      get: {
        tags: ["delivery"],
        summary: "납품·수정·정산·리뷰 현황",
        description:
          "계약 당사자가 본다. 버전 목록(초안·검토본·최종본), 수정 요청(체크리스트·첨부·회차 차감 여부), 일반 수정 회차(계약·사용·남음), 모의 정산, 리뷰, 리뷰 가능 여부.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        responses: {
          200: jsonResponse("납품·수정·정산·리뷰 현황", "Delivery"),
          ...bearerErrors,
          404: errorResponse("계약이 없거나 당사자가 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/contracts/{contractId}/deliverables": {
      post: {
        tags: ["delivery"],
        summary: "버전 제출 (DEL-01·02)",
        description:
          "크리에이터. 확인이 끝난 본인 DELIVERABLE 파일을 묶어 버전으로 정식 제출한다(파일 업로드만으로는 납품이 아니다). 수정 요청이 열려 있으면 이 버전이 수정본이 되고 요청은 RESOLVED(일반 회차는 이때 한 번 차감). 같은 `commandId` 재전송은 새 버전·차감을 만들지 않는다. 최종본(FINAL)은 검토본 승인 뒤에만, 승인 뒤에는 최종본만 낼 수 있다. 제작 중(IN_PROGRESS)에만.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(deliverableCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("납품·수정·정산·리뷰 현황", "Delivery"),
          400: errorResponse("입력값·파일 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/deliverables/{deliverableId}/revision-requests":
      {
        post: {
          tags: ["delivery"],
          summary: "수정 요청 (REV-01·02)",
          description:
            "의뢰인. 최신 버전(검토 대기)에만. 체크리스트(영상 위치·현재 문제·원하는 변경)와 REVISION 첨부. 초안에는 초안 의견(DRAFT_FEEDBACK), 검토본에는 일반 수정(GENERAL)·계약 오류 시정(CONTRACT_FIX), 최종본에는 CONTRACT_FIX만. 일반 수정만 계약 회차에서 차감하며 남은 회차가 없으면 409. 수정본을 기다리는 요청은 하나뿐이다.",
          security: [{ bearerAuth: [] }],
          parameters: [idParam("contractId"), idParam("deliverableId")],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: requestSchema(revisionRequestCreateSchema),
              },
            },
          },
          responses: {
            201: jsonResponse("납품·수정·정산·리뷰 현황", "Delivery"),
            400: errorResponse("입력값·파일 오류 (`VALIDATION_FAILED`)"),
            ...bearerErrors,
            403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
            404: errorResponse(
              "계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`)",
            ),
            409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
          },
        },
      },
    "/api/contracts/{contractId}/deliverables/{deliverableId}/approve": {
      post: {
        tags: ["delivery"],
        summary: "검토본 승인 (DEL-03)",
        description:
          "의뢰인. 최신 검토본만. 승인만으로는 정산되지 않는다. 이후 크리에이터가 깨끗한 최종본을 낸다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId"), idParam("deliverableId")],
        responses: {
          200: jsonResponse("납품·수정·정산·리뷰 현황", "Delivery"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/deliverables/{deliverableId}/receive": {
      post: {
        tags: ["delivery"],
        summary: "최종본 수령 확인 (DEL-04·05, SETTLE-01)",
        description:
          "의뢰인. 최신 최종본만. 채팅의 동의·다운로드로 대신할 수 없다. 결제 완료·보류 없음이면 계약 당시 요율(10%)로 모의 정산(원 단위 내림 [제안, D12])하고 거래를 COMPLETED로 닫는다. 정산할 수 없으면 DELIVERED로 남는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId"), idParam("deliverableId")],
        responses: {
          200: jsonResponse("납품·수정·정산·리뷰 현황", "Delivery"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/reviews": {
      post: {
        tags: ["delivery"],
        summary: "리뷰 작성 (REVIEW-01)",
        description:
          "완료(COMPLETED)된 거래의 당사자가 상대방을 한 번 평가한다. 평점 1~5 정수 [제안, D14].",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(reviewCreateSchema) },
          },
        },
        responses: {
          201: jsonResponse("납품·수정·정산·리뷰 현황", "Delivery"),
          400: errorResponse("입력값·파일 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·버전이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/settlements/me": {
      get: {
        tags: ["delivery"],
        summary: "내 모의 정산 내역",
        description:
          "내가 당사자인 거래의 모의 정산(거래 금액·수수료·지급 예정액). 실제 송금이 아니다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: jsonResponse("정산 내역", "SettlementListResponse"),
          ...bearerErrors,
        },
      },
    },
    "/api/users/{userId}/reviews": {
      get: {
        tags: ["delivery"],
        summary: "받은 리뷰 (공개)",
        description: "프로필 화면용. 평균 평점·개수와 최근 50개.",
        parameters: [idParam("userId")],
        responses: {
          200: jsonResponse("받은 리뷰", "ReviewListResponse"),
          400: errorResponse("ID 오류 (`VALIDATION_FAILED`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production": {
      get: {
        tags: ["production"],
        summary: "제작 정보 (READY·WORK)",
        description:
          "계약 당사자가 본다. 결제 완료 여부, 자료 목록·상태, 시작 가능 여부(`readyToStart`), 시작 시각, 작업 일수·마감일(KST), 납기 변경 이력.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        responses: {
          200: jsonResponse("제작 정보", "Production"),
          ...bearerErrors,
          404: errorResponse("계약이 없거나 당사자가 아님 (`NOT_FOUND`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production/materials": {
      post: {
        tags: ["production"],
        summary: "제작 자료 내기 (READY-01)",
        description:
          "의뢰인. 파일(확인이 끝난 본인 MATERIAL 파일)·실물 발송(택배사·송장번호)·메모. 문제가 신고된 자료는 `replacesMaterialId`로 대체한다(원래 자료는 REPLACED). 제작 준비 단계에서만. `commandId`(화면이 만든 UUID)가 같고 내용도 같은 재전송은 자료를 새로 만들지 않고 현재 상태를 준다. 같은 `commandId`에 다른 내용이면 409.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(materialCreateSchema) },
          },
        },
        responses: {
          201: jsonResponse("제작 정보", "Production"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production/materials/{materialId}/confirm": {
      post: {
        tags: ["production"],
        summary: "자료 정상 확인 (READY-02)",
        description:
          "크리에이터. 제출된 자료로 작업할 수 있음을 확인한다. 발송 등록과 정상 수령은 다르다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId"), idParam("materialId")],
        responses: {
          200: jsonResponse("제작 정보", "Production"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production/materials/{materialId}/issue": {
      post: {
        tags: ["production"],
        summary: "자료 누락·문제 신고 (READY-02)",
        description:
          "크리에이터. 제출·확인된 자료의 문제를 알린다. 의뢰인이 대체 자료를 낼 때까지 제작을 시작할 수 없다. 대화방에 시스템 안내가 남는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId"), idParam("materialId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(materialIssueSchema) },
          },
        },
        responses: {
          200: jsonResponse("제작 정보", "Production"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production/start": {
      post: {
        tags: ["production"],
        summary: "제작 시작 (WORK-01)",
        description:
          "크리에이터. 결제 완료, 확인된 자료 1개 이상, 미확인·문제 자료 없음일 때만. 마감일은 이때 한 번 계산한다: 시작일(KST) + 작업 일수(지원 때 제안한 기간, 달력일) [제안, D09].",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        responses: {
          200: jsonResponse("제작 정보", "Production"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production/deadline-changes": {
      post: {
        tags: ["production"],
        summary: "납기 변경 요청 (WORK-02)",
        description:
          "제작 중에 어느 당사자든 요청한다. 대기 중인 요청은 하나뿐이다. 상대방이 승인해야 마감일이 바뀐다(대화 속 동의로 바뀌지 않음). 이전 마감일·사유가 이력으로 남는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(deadlineChangeCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("제작 정보", "Production"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
          404: errorResponse("계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
        },
      },
    },
    "/api/contracts/{contractId}/production/deadline-changes/{changeId}/approve":
      {
        post: {
          tags: ["production"],
          summary: "납기 변경 승인 (WORK-02)",
          description: "요청하지 않은 당사자만. 승인하면 마감일이 바뀐다.",
          security: [{ bearerAuth: [] }],
          parameters: [idParam("contractId"), idParam("changeId")],
          responses: {
            200: jsonResponse("제작 정보", "Production"),
            ...bearerErrors,
            403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
            404: errorResponse(
              "계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)",
            ),
            409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
          },
        },
      },
    "/api/contracts/{contractId}/production/deadline-changes/{changeId}/reject":
      {
        post: {
          tags: ["production"],
          summary: "납기 변경 거절 (WORK-02)",
          description: "요청하지 않은 당사자만. 기존 마감일을 유지한다.",
          security: [{ bearerAuth: [] }],
          parameters: [idParam("contractId"), idParam("changeId")],
          responses: {
            200: jsonResponse("제작 정보", "Production"),
            ...bearerErrors,
            403: errorResponse("역할이 맞지 않음 (`FORBIDDEN`)"),
            404: errorResponse(
              "계약·대상이 없거나 당사자가 아님 (`NOT_FOUND`)",
            ),
            409: errorResponse("지금 상태에서 할 수 없음 (`CONFLICT`)"),
          },
        },
      },
    "/api/contracts/{contractId}/payments": {
      get: {
        tags: ["payments"],
        summary: "계약의 결제 내역 (PAY-02)",
        description:
          "계약 당사자(의뢰인·크리에이터)가 볼 수 있다. 최근 주문부터. 실패·취소된 주문도 남는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        responses: {
          200: jsonResponse("결제 내역", "PaymentListResponse"),
          ...bearerErrors,
          403: errorResponse("이용 제한·탈퇴 회원 (`FORBIDDEN`)"),
          404: errorResponse("계약이 없거나 당사자가 아님 (`NOT_FOUND`)"),
        },
      },
      post: {
        tags: ["payments"],
        summary: "결제 주문 만들기 (PAY-01)",
        description:
          "계약의 의뢰인만 만들 수 있다. 금액은 서명된 계약 금액이다(요청으로 받지 않는다). `commandId`가 Toss `orderId`가 된다. 진행 중이거나 완료된 주문(`READY`·`UNKNOWN`·`SUCCEEDED`)이 있으면 409다. 같은 `commandId`의 재전송은 200으로 기존 주문을 준다. 테스트 시크릿 키가 없으면 503.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("contractId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(paymentCreateSchema) },
          },
        },
        responses: {
          201: jsonResponse(
            "만든 주문 (Toss 결제창에 orderId·amount를 넘긴다)",
            "PaymentOrder",
          ),
          200: jsonResponse("같은 요청의 재전송 (기존 주문)", "PaymentOrder"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("계약이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse(
            "결제할 수 없는 계약, 진행 중·완료된 주문 있음, 다른 계약에서 쓴 식별자 (`CONFLICT`)",
          ),
          503: errorResponse("테스트 결제 미설정 (`SERVICE_UNAVAILABLE`)"),
        },
      },
    },
    "/api/payments/confirm": {
      post: {
        tags: ["payments"],
        summary: "결제 승인 (PAY-01)",
        description:
          "Toss successUrl로 돌아온 `paymentKey`·`orderId`·`amount`로 승인한다. `amount`가 저장한 주문 금액과 다르면 Toss를 부르지 않고 400이다. 결과는 주문 상태로 돌려준다: 승인되면 `SUCCEEDED`(크리에이터에게 `PAYMENT_SUCCEEDED` 알림), 거절되면 `FAILED`, 응답을 받지 못하면 `UNKNOWN`(sync로 다시 맞춘다). 같은 승인의 재전송은 이전 결과를 준다. Toss는 결제 요청 뒤 10분 안에 승인해야 한다.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(paymentConfirmSchema) },
          },
        },
        responses: {
          200: jsonResponse("승인 결과가 반영된 주문", "PaymentOrder"),
          400: errorResponse(
            "입력값 오류, 주문 금액과 다른 금액 (`VALIDATION_FAILED`)",
          ),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("주문이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("이미 처리된 주문 (`CONFLICT`)"),
          503: errorResponse("테스트 결제 미설정 (`SERVICE_UNAVAILABLE`)"),
        },
      },
    },
    "/api/payments/{orderId}/sync": {
      post: {
        tags: ["payments"],
        summary: "결제 결과 다시 확인 (PAY-02)",
        description:
          "`READY`·`UNKNOWN` 주문을 Toss 조회 결과로 맞춘다. 계약 당사자 누구나 부를 수 있다. 이미 끝난 주문은 그대로 돌려준다. 브라우저 복귀 값(success·amount·paymentKey)은 결과 증거로 쓰지 않는다.",
        security: [{ bearerAuth: [] }],
        parameters: [orderIdParam],
        responses: {
          200: jsonResponse("최신 주문", "PaymentOrder"),
          400: errorResponse("주문 번호 형식 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("이용 제한·탈퇴 회원 (`FORBIDDEN`)"),
          404: errorResponse("주문이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          503: errorResponse("테스트 결제 미설정 (`SERVICE_UNAVAILABLE`)"),
        },
      },
    },
    "/api/payments/{orderId}/fail": {
      post: {
        tags: ["payments"],
        summary: "결제 취소·실패 기록",
        description:
          "Toss failUrl로 돌아온 `code`·`message`를 기록하고, 서버가 Toss 주문 조회로 결과를 확인한다(브라우저 값만으로 닫지 않는다). 결제 기록이 없으면(`NOT_FOUND_PAYMENT`) `PAY_PROCESS_CANCELED`는 `CANCELED`, 그 밖에는 `FAILED`. 주문과 맞는 `ABORTED`·`EXPIRED`는 `FAILED`, 이미 승인(`DONE`)됐으면 `SUCCEEDED`. 조회가 안 되거나 진행 중·불일치·부분 취소면 `UNKNOWN`으로 두어 새 주문을 막는다(나중에 sync). 이미 끝난 주문은 그대로 돌려준다. 의뢰인만 부를 수 있다.",
        security: [{ bearerAuth: [] }],
        parameters: [orderIdParam],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(paymentFailSchema) },
          },
        },
        responses: {
          200: jsonResponse("닫힌 주문", "PaymentOrder"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...bearerErrors,
          403: errorResponse("의뢰인이 아님 (`FORBIDDEN`)"),
          404: errorResponse("주문이 없거나 당사자가 아님 (`NOT_FOUND`)"),
          409: errorResponse("승인 요청 전 주문이 아님 (`CONFLICT`)"),
        },
      },
    },
    "/api/work-requests/{workRequestId}/terms": {
      get: {
        tags: ["terms"],
        summary: "최종 조건서 조회 (TERMS-01)",
        description:
          "그 요청의 의뢰인·크리에이터만 볼 수 있다. 참조 사본(첫 저장 때 고정), 모든 버전(값·작성자·상태·서명), 계약(있으면)을 준다. 협의가 끝난 뒤에도 기록을 볼 수 있다. 기한이 지난 `SIGNING` 버전은 `EXPIRED`로 보인다. 공개 지원의 요청 ID는 지원 ID와 같다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("workRequestId")],
        responses: {
          200: jsonResponse("조건서", "TermsDocument"),
          ...termsPartyErrors,
        },
      },
    },
    "/api/work-requests/{workRequestId}/terms/versions": {
      post: {
        tags: ["terms"],
        summary: "조건서 새 버전 저장 (TERMS-01·03)",
        description:
          "협의 중(`DISCUSSING`)인 요청에서 양측 누구나 저장할 수 있다. 항목이 비어 있어도 저장된다. 이전 `DRAFT`·`SIGNING` 버전은 `SUPERSEDED`가 되고 서명은 새 버전에 복사되지 않는다. `baseVersionNo`는 화면이 보고 있던 마지막 버전 번호(없으면 0)이며, 다르면 409다. 같은 `commandId`로 같은 내용을 다시 보내면 새 버전 없이 200으로 이전 결과를 준다. 모집 마감은 진행 중인 협의를 막지 않는다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("workRequestId")],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(termsVersionCreateSchema),
            },
          },
        },
        responses: {
          201: jsonResponse("저장된 새 버전", "TermsVersion"),
          200: jsonResponse("같은 요청의 재전송 (이전 결과)", "TermsVersion"),
          400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
          ...termsPartyErrors,
          409: errorResponse(
            "협의 중이 아님, 계약·종료된 프로젝트, 다른 작성본이 먼저 저장됨, 같은 `commandId`에 다른 내용 (`CONFLICT`)",
          ),
        },
      },
    },
    "/api/work-requests/{workRequestId}/terms/versions/{versionNo}/signing": {
      post: {
        tags: ["terms"],
        summary: "서명 요청 (TERMS-02)",
        description: `마지막 \`DRAFT\` 버전에 대해 서명을 요청한다. 요청은 서명이 아니다. 기한은 요청 시각부터 ${TERMS_SIGNING_HOURS}시간이며, 금액과 조건 7개가 모두 있어야 한다. 이미 \`SIGNING\`이면 기한을 늘리지 않고 그대로 200이다. 상대방에게 \`TERMS_SIGNING_REQUESTED\` 알림이 간다.`,
        security: [{ bearerAuth: [] }],
        parameters: [idParam("workRequestId"), versionNoParam],
        responses: {
          200: jsonResponse("서명 요청된 버전", "TermsVersion"),
          400: errorResponse(
            "비어 있는 조건이 있음 (`VALIDATION_FAILED`, `details`에 항목)",
          ),
          ...termsPartyErrors,
          409: errorResponse(
            "협의 중이 아님, 최신 버전이 아님, 기한 만료, 서명 요청할 수 없는 상태 (`CONFLICT`)",
          ),
        },
      },
    },
    "/api/work-requests/{workRequestId}/terms/versions/{versionNo}/signatures":
      {
        post: {
          tags: ["terms"],
          summary: "본인 서명 (CONTRACT-01)",
          description:
            "`SIGNING`이고 기한 전인 버전에만 서명할 수 있다. `termsHash`는 화면이 본 버전의 해시이며 서버 값과 같아야 한다. 같은 버전의 두 번째 서명이면 한 트랜잭션에서 계약을 만들고, 요청·프로젝트를 `CONTRACTED`로, 같은 프로젝트의 다른 활성 지원을 `NOT_SELECTED`(`OTHER_SELECTED`)로, 그 지원들의 미확정 조건서를 `VOID`로 바꾼다. 양측에 `CONTRACT_SIGNED`, 다른 지원자에게 `APPLICATION_AUTO_REJECTED` 알림이 간다. 공고당 계약은 하나다. 이미 서명한 사람이 같은 내용으로 다시 보내면 200으로 이전 결과를 준다.",
          security: [{ bearerAuth: [] }],
          parameters: [idParam("workRequestId"), versionNoParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: requestSchema(signatureCreateSchema),
              },
            },
          },
          responses: {
            201: jsonResponse(
              "서명 결과 (계약이 체결되면 함께)",
              "SignatureResponse",
            ),
            200: jsonResponse(
              "같은 서명의 재전송 (이전 결과)",
              "SignatureResponse",
            ),
            400: errorResponse("입력값 오류 (`VALIDATION_FAILED`)"),
            ...termsPartyErrors,
            409: errorResponse(
              "협의 중이 아님, 서명할 수 없는 버전·기한 만료, 내용 해시 불일치, 이미 다른 내용으로 서명함, 이미 다른 후보와 계약 확정 (`CONFLICT`)",
            ),
          },
        },
      },
    "/api/work-requests/{workRequestId}/contract": {
      get: {
        tags: ["terms"],
        summary: "계약서 조회 (SIGN-01)",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("workRequestId")],
        responses: {
          200: jsonResponse("계약", "Contract"),
          ...bearerErrors,
          403: errorResponse("이용 제한·탈퇴 회원 (`FORBIDDEN`)"),
          404: errorResponse(
            "계약이 없거나 그 요청의 당사자가 아님 (`NOT_FOUND`)",
          ),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "로그인·갱신 응답의 `accessToken` (15분)",
      },
    },
    schemas: {
      PricingAnalysisResponse: {
        type: "object",
        required: [
          "source",
          "currency",
          "summary",
          "workUnits",
          "estimatedBudgetKrw",
          "assumptions",
          "notice",
        ],
        properties: {
          source: { type: "string", const: "AI_ESTIMATE" },
          currency: { type: "string", const: "KRW" },
          summary: { type: "string" },
          workUnits: {
            type: "array",
            items: {
              type: "object",
              required: [
                "name",
                "quantity",
                "unitPriceKrw",
                "rationale",
                "subtotalKrw",
              ],
              properties: {
                name: { type: "string" },
                quantity: { type: "integer" },
                unitPriceKrw: { type: "integer", minimum: 1000 },
                rationale: { type: "string" },
                subtotalKrw: { type: "integer", minimum: 1000 },
              },
            },
          },
          estimatedBudgetKrw: { type: "integer", minimum: 1 },
          assumptions: { type: "array", items: { type: "string" } },
          notice: { type: "string" },
        },
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string", enum: [...ERROR_CODES] },
              message: { type: "string" },
              details: {
                description: "공개해도 되는 추가 정보 (예: 검증 실패 필드)",
              },
            },
          },
        },
      },
      AuthUser: {
        type: "object",
        required: ["id", "email", "name", "role", "status"],
        properties: {
          id: { type: "string", pattern: "^\\d+$", examples: ["42"] },
          email: { type: ["string", "null"] },
          name: { type: "string" },
          role: { type: "string", enum: [...USER_ROLES] },
          status: { type: "string", enum: [...USER_STATUSES] },
        },
      },
      AuthTokenResponse: {
        type: "object",
        required: ["accessToken", "accessTokenExpiresIn", "user"],
        properties: {
          accessToken: { type: "string" },
          accessTokenExpiresIn: {
            type: "integer",
            description: "초 단위 (900 = 15분)",
          },
          user: { $ref: "#/components/schemas/AuthUser" },
        },
      },
      SocialSignupPendingResponse: {
        type: "object",
        required: ["provider", "suggestedName", "providerEmail"],
        properties: {
          provider: { type: "string", enum: [...SOCIAL_PROVIDER_PATHS] },
          suggestedName: {
            type: ["string", "null"],
            description:
              "제공자 이름. 가입 화면의 기본값으로만 쓴다(2~20자 아닐 수 있음).",
          },
          providerEmail: {
            type: ["string", "null"],
            description: "제공자가 확인한 이메일. 로그인 이메일이 아니다.",
          },
        },
      },
      MeResponse: {
        type: "object",
        required: ["user"],
        properties: { user: { $ref: "#/components/schemas/AuthUser" } },
      },
      ClientProfile: {
        type: "object",
        required: [
          "type",
          "brandName",
          "introduction",
          "industry",
          "websiteUrl",
          "socialUrl",
        ],
        properties: {
          type: { const: "CLIENT" },
          brandName: { type: ["string", "null"] },
          introduction: { type: ["string", "null"] },
          industry: nullableEnum(PRODUCT_CATEGORIES),
          websiteUrl: { type: ["string", "null"] },
          socialUrl: { type: ["string", "null"] },
        },
      },
      CreatorProfile: {
        type: "object",
        required: [
          "type",
          "introduction",
          "niche",
          "contentStyles",
          "productionRoles",
          "workMethod",
          "serviceStatus",
          "isAvailable",
          "availableFrom",
        ],
        properties: {
          type: { const: "CREATOR" },
          introduction: { type: ["string", "null"] },
          niche: nullableEnum(PRODUCT_CATEGORIES),
          contentStyles: {
            type: "array",
            items: { type: "string", enum: [...CONTENT_STYLES] },
          },
          productionRoles: {
            type: "array",
            items: { type: "string", enum: [...PRODUCTION_ROLES] },
          },
          workMethod: { type: ["string", "null"] },
          serviceStatus: {
            type: "string",
            enum: [...CREATOR_SERVICE_STATUSES],
            description: "처음에는 DRAFT. 프로필 저장으로는 바뀌지 않는다.",
          },
          isAvailable: { type: "boolean" },
          availableFrom: { type: ["string", "null"], format: "date" },
        },
      },
      MyProfileResponse: {
        type: "object",
        required: ["name", "profile"],
        properties: {
          name: { type: "string", description: "회원 표시 이름" },
          profile: {
            oneOf: [
              { $ref: "#/components/schemas/ClientProfile" },
              { $ref: "#/components/schemas/CreatorProfile" },
            ],
          },
        },
      },
      Project: {
        type: "object",
        required: [
          "id",
          "clientId",
          "clientName",
          "title",
          "description",
          "purpose",
          "styles",
          "budget",
          "expectedDurationSeconds",
          "recruitmentEndAt",
          "deliveryDueDate",
          "status",
          "closeReason",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", pattern: "^\\d+$" },
          clientId: { type: "string", pattern: "^\\d+$" },
          clientName: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          purpose: { type: "string", enum: [...VIDEO_PURPOSES] },
          styles: {
            type: "array",
            items: { type: "string", enum: [...VIDEO_STYLES] },
          },
          budget: { type: "integer", minimum: 1, description: "KRW" },
          expectedDurationSeconds: { type: ["integer", "null"], minimum: 1 },
          recruitmentEndAt: { type: "string", format: "date-time" },
          deliveryDueDate: { type: "string", format: "date" },
          status: { type: "string", enum: [...PROJECT_STATUSES] },
          closeReason: {
            type: ["string", "null"],
            enum: [...PROJECT_CLOSE_REASONS, null],
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProjectListResponse: {
        type: "object",
        required: ["items", "pagination"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Project" },
          },
          pagination: {
            type: "object",
            required: ["page", "pageSize", "total", "totalPages"],
            properties: {
              page: { type: "integer" },
              pageSize: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      Application: {
        type: "object",
        required: [
          "id",
          "projectId",
          "creatorId",
          "creatorName",
          "message",
          "proposedAmount",
          "expectedDays",
          "status",
          "closedReason",
          "respondedAt",
          "createdAt",
        ],
        properties: {
          id: { type: "string" },
          projectId: { type: "string" },
          creatorId: { type: "string" },
          creatorName: { type: "string" },
          message: { type: "string" },
          proposedAmount: { type: "integer" },
          expectedDays: { type: "integer" },
          status: { type: "string", enum: [...WORK_REQUEST_STATUSES] },
          closedReason: nullableEnum(WORK_REQUEST_CLOSED_REASONS),
          respondedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ProjectApplicationListResponse: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Application" },
          },
        },
      },
      MyApplicationListResponse: {
        type: "object",
        required: ["items", "pagination"],
        properties: {
          items: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/Application" },
                {
                  type: "object",
                  required: ["project"],
                  properties: {
                    project: {
                      type: "object",
                      required: ["id", "title", "status"],
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        status: { type: "string" },
                      },
                    },
                  },
                },
              ],
            },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      Pagination: {
        type: "object",
        required: ["page", "pageSize", "total", "totalPages"],
        properties: {
          page: { type: "integer" },
          pageSize: { type: "integer" },
          total: { type: "integer" },
          totalPages: { type: "integer" },
        },
      },
      Notification: {
        type: "object",
        required: [
          "id",
          "type",
          "title",
          "body",
          "projectId",
          "applicationId",
          "readAt",
          "createdAt",
        ],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: [...NOTIFICATION_TYPES] },
          title: { type: "string" },
          body: { type: "string" },
          projectId: { type: ["string", "null"] },
          applicationId: { type: ["string", "null"] },
          readAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      NotificationListResponse: {
        type: "object",
        required: ["items", "unreadCount", "pagination"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Notification" },
          },
          unreadCount: { type: "integer" },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      UnreadCountResponse: {
        type: "object",
        required: ["unreadCount"],
        properties: { unreadCount: { type: "integer" } },
      },
      StoredFile: {
        type: "object",
        required: [
          "id",
          "ownerId",
          "purpose",
          "kind",
          "mimeType",
          "fileName",
          "sizeBytes",
          "status",
          "rejectionReason",
          "workRequestId",
          "createdAt",
        ],
        properties: {
          id: { type: "string" },
          ownerId: { type: "string" },
          purpose: { type: "string", enum: [...FILE_PURPOSES] },
          kind: { type: "string", enum: ["VIDEO", "IMAGE", "ZIP"] },
          mimeType: { type: "string", enum: [...FILE_MIME_TYPES] },
          fileName: { type: "string" },
          sizeBytes: { type: "integer" },
          status: { type: "string", enum: [...FILE_STATUSES] },
          rejectionReason: { type: ["string", "null"] },
          workRequestId: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      FileUploadResponse: {
        type: "object",
        required: ["file", "upload"],
        properties: {
          file: { $ref: "#/components/schemas/StoredFile" },
          upload: {
            type: "object",
            required: ["url", "token"],
            properties: {
              url: { type: "string" },
              token: { type: "string" },
            },
          },
        },
      },
      FileDownloadResponse: {
        type: "object",
        required: ["url", "expiresAt"],
        properties: {
          url: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      ChatMessage: {
        type: "object",
        required: [
          "id",
          "kind",
          "senderId",
          "body",
          "attachments",
          "createdAt",
        ],
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: [...CHAT_MESSAGE_KINDS] },
          senderId: { type: ["string", "null"] },
          body: { type: "string" },
          attachments: {
            type: "array",
            items: {
              type: "object",
              required: ["fileId", "fileName", "mimeType", "sizeBytes"],
              properties: {
                fileId: { type: "string" },
                fileName: { type: "string" },
                mimeType: { type: "string" },
                sizeBytes: { type: "integer" },
              },
            },
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      ChatRoomSummary: {
        type: "object",
        required: [
          "workRequestId",
          "projectId",
          "projectTitle",
          "clientId",
          "creatorId",
          "counterpartName",
          "readOnly",
          "lastMessage",
          "unreadCount",
        ],
        properties: {
          workRequestId: { type: "string" },
          projectId: { type: ["string", "null"] },
          projectTitle: { type: ["string", "null"] },
          clientId: { type: "string" },
          creatorId: { type: "string" },
          counterpartName: { type: "string" },
          readOnly: { type: "boolean" },
          lastMessage: {
            oneOf: [
              { $ref: "#/components/schemas/ChatMessage" },
              { type: "null" },
            ],
          },
          unreadCount: { type: "integer" },
        },
      },
      ChatRoomListResponse: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ChatRoomSummary" },
          },
        },
      },
      ChatMessagesResponse: {
        type: "object",
        required: ["room", "items", "hasMore"],
        properties: {
          room: { $ref: "#/components/schemas/ChatRoomSummary" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ChatMessage" },
          },
          hasMore: { type: "boolean" },
        },
      },
      ServicePackage: {
        type: "object",
        required: [
          "id",
          "creatorId",
          "title",
          "description",
          "purpose",
          "priceKrw",
          "deliveryDays",
          "revisionCount",
          "includes",
          "status",
          "isRepresentative",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          creatorId: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          purpose: { type: ["string", "null"] },
          priceKrw: { type: ["integer", "null"] },
          deliveryDays: { type: ["integer", "null"] },
          revisionCount: { type: ["integer", "null"] },
          includes: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: [...CATALOG_STATUSES] },
          isRepresentative: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ServicePackageList: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ServicePackage" },
          },
        },
      },
      Portfolio: {
        type: "object",
        required: [
          "id",
          "creatorId",
          "title",
          "description",
          "purpose",
          "styles",
          "roles",
          "source",
          "clientConsent",
          "videoFileId",
          "thumbnailFileId",
          "packageId",
          "status",
          "publishedAt",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          creatorId: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          purpose: { type: ["string", "null"] },
          styles: { type: "array", items: { type: "string" } },
          roles: { type: "array", items: { type: "string" } },
          source: { type: "string", enum: [...PORTFOLIO_SOURCES] },
          clientConsent: { type: "boolean" },
          videoFileId: { type: ["string", "null"] },
          thumbnailFileId: { type: ["string", "null"] },
          packageId: { type: ["string", "null"] },
          status: { type: "string", enum: [...CATALOG_STATUSES] },
          publishedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PortfolioList: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Portfolio" },
          },
        },
      },
      PortfolioMedia: {
        type: "object",
        required: ["video", "thumbnail"],
        properties: {
          video: {
            oneOf: [
              {
                type: "object",
                required: ["url", "expiresAt"],
                properties: {
                  url: { type: "string" },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
              { type: "null" },
            ],
          },
          thumbnail: {
            oneOf: [
              {
                type: "object",
                required: ["url", "expiresAt"],
                properties: {
                  url: { type: "string" },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
              { type: "null" },
            ],
          },
        },
      },
      CreatorPublicProfile: {
        type: "object",
        required: [
          "userId",
          "name",
          "introduction",
          "niche",
          "contentStyles",
          "productionRoles",
          "isAvailable",
          "representativePackage",
          "packages",
          "portfolios",
          "review",
        ],
        properties: {
          userId: { type: "string" },
          name: { type: "string" },
          introduction: { type: ["string", "null"] },
          niche: { type: ["string", "null"] },
          contentStyles: { type: "array", items: { type: "string" } },
          productionRoles: { type: "array", items: { type: "string" } },
          isAvailable: { type: "boolean" },
          representativePackage: {
            $ref: "#/components/schemas/ServicePackage",
          },
          packages: {
            type: "array",
            items: { $ref: "#/components/schemas/ServicePackage" },
          },
          portfolios: {
            type: "array",
            items: { $ref: "#/components/schemas/Portfolio" },
          },
          review: {
            type: "object",
            required: ["averageRating", "count"],
            properties: {
              averageRating: { type: ["number", "null"] },
              count: { type: "integer" },
            },
          },
        },
      },
      CreatorServiceStatus: {
        type: "object",
        required: ["serviceStatus"],
        properties: {
          serviceStatus: { type: "string", enum: [...CATALOG_STATUSES] },
        },
      },
      ProjectDraft: {
        type: "object",
        required: [
          "id",
          "values",
          "recruitmentDays",
          "publishedProjectId",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          values: {
            type: "object",
            description: "작성 중인 값(공고 항목과 recruitmentDays)",
          },
          recruitmentDays: { type: "integer", enum: [3, 7, 14] },
          publishedProjectId: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProjectDraftList: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/ProjectDraft" },
          },
        },
      },
      ProjectDraftPublishResult: {
        type: "object",
        required: ["draft", "project"],
        properties: {
          draft: { $ref: "#/components/schemas/ProjectDraft" },
          project: { $ref: "#/components/schemas/Project" },
        },
      },
      Deliverable: {
        type: "object",
        required: [
          "id",
          "versionNo",
          "kind",
          "status",
          "fileIds",
          "note",
          "resolvesRevisionRequestId",
          "createdAt",
          "approvedAt",
          "receivedAt",
        ],
        properties: {
          id: { type: "string" },
          versionNo: { type: "integer" },
          kind: { type: "string", enum: [...DELIVERABLE_KINDS] },
          status: { type: "string", enum: [...DELIVERABLE_STATUSES] },
          fileIds: { type: "array", items: { type: "string" } },
          note: { type: ["string", "null"] },
          resolvesRevisionRequestId: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          approvedAt: { type: ["string", "null"], format: "date-time" },
          receivedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      RevisionRequest: {
        type: "object",
        required: [
          "id",
          "deliverableId",
          "type",
          "status",
          "items",
          "fileIds",
          "note",
          "countsTowardLimit",
          "createdAt",
          "resolvedAt",
        ],
        properties: {
          id: { type: "string" },
          deliverableId: { type: "string" },
          type: { type: "string", enum: [...REVISION_TYPES] },
          status: { type: "string", enum: [...REVISION_STATUSES] },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["problem", "desired"],
              properties: {
                position: { type: "string" },
                problem: { type: "string" },
                desired: { type: "string" },
              },
            },
          },
          fileIds: { type: "array", items: { type: "string" } },
          note: { type: ["string", "null"] },
          countsTowardLimit: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          resolvedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      Settlement: {
        type: "object",
        required: [
          "contractId",
          "status",
          "grossKrw",
          "feeRateBps",
          "feeKrw",
          "payoutKrw",
          "createdAt",
        ],
        properties: {
          contractId: { type: "string" },
          status: { type: "string", enum: [...SETTLEMENT_STATUSES] },
          grossKrw: { type: "integer" },
          feeRateBps: { type: "integer", description: "만분율. 1000 = 10%" },
          feeKrw: { type: "integer" },
          payoutKrw: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Review: {
        type: "object",
        required: [
          "id",
          "contractId",
          "reviewerId",
          "revieweeId",
          "rating",
          "comment",
          "createdAt",
        ],
        properties: {
          id: { type: "string" },
          contractId: { type: "string" },
          reviewerId: { type: "string" },
          revieweeId: { type: "string" },
          rating: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Delivery: {
        type: "object",
        required: [
          "contractId",
          "workRequestId",
          "productionStatus",
          "revisionLimit",
          "revisionsUsed",
          "revisionsRemaining",
          "deliverables",
          "revisionRequests",
          "settlement",
          "reviews",
          "canReview",
        ],
        properties: {
          contractId: { type: "string" },
          workRequestId: { type: "string" },
          productionStatus: { type: "string", enum: [...PRODUCTION_STATUSES] },
          revisionLimit: { type: "integer" },
          revisionsUsed: { type: "integer" },
          revisionsRemaining: { type: "integer" },
          deliverables: {
            type: "array",
            items: { $ref: "#/components/schemas/Deliverable" },
          },
          revisionRequests: {
            type: "array",
            items: { $ref: "#/components/schemas/RevisionRequest" },
          },
          settlement: {
            oneOf: [
              { $ref: "#/components/schemas/Settlement" },
              { type: "null" },
            ],
          },
          reviews: {
            type: "array",
            items: { $ref: "#/components/schemas/Review" },
          },
          canReview: { type: "boolean" },
        },
      },
      SettlementListResponse: {
        type: "object",
        required: ["items"],
        properties: {
          items: {
            type: "array",
            items: {
              allOf: [
                { $ref: "#/components/schemas/Settlement" },
                {
                  type: "object",
                  required: ["workRequestId", "title"],
                  properties: {
                    workRequestId: { type: "string" },
                    title: { type: "string" },
                  },
                },
              ],
            },
          },
        },
      },
      ReviewListResponse: {
        type: "object",
        required: ["averageRating", "count", "items"],
        properties: {
          averageRating: { type: ["number", "null"] },
          count: { type: "integer" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Review" },
          },
        },
      },
      Production: {
        type: "object",
        required: [
          "contractId",
          "workRequestId",
          "status",
          "paid",
          "materials",
          "readyToStart",
          "startedAt",
          "workingDays",
          "dueDate",
          "deadlineChanges",
        ],
        properties: {
          contractId: { type: "string" },
          workRequestId: { type: "string" },
          status: { type: "string", enum: [...PRODUCTION_STATUSES] },
          paid: { type: "boolean" },
          materials: {
            type: "array",
            items: {
              type: "object",
              required: [
                "id",
                "kind",
                "status",
                "fileId",
                "carrier",
                "trackingNumber",
                "note",
                "issueNote",
                "replacesMaterialId",
                "createdAt",
                "confirmedAt",
              ],
              properties: {
                id: { type: "string" },
                kind: { type: "string", enum: [...MATERIAL_KINDS] },
                status: { type: "string", enum: [...MATERIAL_STATUSES] },
                fileId: { type: ["string", "null"] },
                carrier: { type: ["string", "null"] },
                trackingNumber: { type: ["string", "null"] },
                note: { type: ["string", "null"] },
                issueNote: { type: ["string", "null"] },
                replacesMaterialId: { type: ["string", "null"] },
                createdAt: { type: "string", format: "date-time" },
                confirmedAt: { type: ["string", "null"], format: "date-time" },
              },
            },
          },
          readyToStart: { type: "boolean" },
          startedAt: { type: ["string", "null"], format: "date-time" },
          workingDays: { type: "integer" },
          dueDate: { type: ["string", "null"], format: "date" },
          deadlineChanges: {
            type: "array",
            items: {
              type: "object",
              required: [
                "id",
                "requestedBy",
                "previousDueDate",
                "newDueDate",
                "reason",
                "status",
                "respondedBy",
                "respondedAt",
                "createdAt",
              ],
              properties: {
                id: { type: "string" },
                requestedBy: { type: "string" },
                previousDueDate: { type: "string", format: "date" },
                newDueDate: { type: "string", format: "date" },
                reason: { type: "string" },
                status: { type: "string", enum: [...DEADLINE_CHANGE_STATUSES] },
                respondedBy: { type: ["string", "null"] },
                respondedAt: { type: ["string", "null"], format: "date-time" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      PaymentOrder: {
        type: "object",
        required: [
          "orderId",
          "contractId",
          "amountKrw",
          "orderName",
          "status",
          "method",
          "approvedAt",
          "failureCode",
          "failureMessage",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          orderId: { type: "string", format: "uuid" },
          contractId: { type: "string" },
          amountKrw: { type: "integer" },
          orderName: { type: "string" },
          status: { type: "string", enum: [...PAYMENT_STATUSES] },
          method: { type: ["string", "null"] },
          approvedAt: { type: ["string", "null"], format: "date-time" },
          failureCode: { type: ["string", "null"] },
          failureMessage: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PaymentListResponse: {
        type: "object",
        required: ["contract", "items"],
        properties: {
          contract: {
            type: "object",
            required: ["id", "amountKrw", "clientId", "creatorId"],
            properties: {
              id: { type: "string" },
              amountKrw: { type: "integer" },
              clientId: { type: "string" },
              creatorId: { type: "string" },
            },
          },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/PaymentOrder" },
          },
        },
      },
      TermsValues: {
        type: "object",
        required: [
          "amountKrw",
          "specification",
          "scope",
          "materials",
          "deadline",
          "revisions",
          "usageRights",
          "cancellation",
        ],
        properties: {
          amountKrw: {
            type: ["integer", "null"],
            minimum: 1,
            maximum: 1000000000,
          },
          specification: { type: ["string", "null"] },
          scope: { type: ["string", "null"] },
          materials: { type: ["string", "null"] },
          deadline: { type: ["string", "null"] },
          revisions: { type: ["string", "null"] },
          usageRights: { type: ["string", "null"] },
          cancellation: { type: ["string", "null"] },
        },
      },
      TermsVersion: {
        type: "object",
        required: [
          "versionNo",
          "status",
          "values",
          "termsHash",
          "authorId",
          "createdAt",
          "signing",
          "signatures",
        ],
        properties: {
          versionNo: { type: "integer", minimum: 1 },
          status: { type: "string", enum: [...TERMS_VERSION_STATUSES] },
          values: { $ref: "#/components/schemas/TermsValues" },
          termsHash: { type: "string", pattern: "^[0-9a-f]{64}$" },
          authorId: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          signing: {
            type: ["object", "null"],
            required: ["requestedBy", "requestedAt", "expiresAt"],
            properties: {
              requestedBy: { type: "string" },
              requestedAt: { type: "string", format: "date-time" },
              expiresAt: { type: "string", format: "date-time" },
            },
          },
          signatures: {
            type: "array",
            items: {
              type: "object",
              required: ["userId", "signerName", "signedAt"],
              properties: {
                userId: { type: "string" },
                signerName: { type: "string" },
                signedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
      Contract: {
        type: "object",
        required: [
          "id",
          "workRequestId",
          "projectId",
          "termsVersionNo",
          "clientId",
          "creatorId",
          "amountKrw",
          "termsHash",
          "status",
          "signedAt",
        ],
        properties: {
          id: { type: "string" },
          workRequestId: { type: "string" },
          projectId: { type: ["string", "null"] },
          termsVersionNo: { type: "integer" },
          clientId: { type: "string" },
          creatorId: { type: "string" },
          amountKrw: { type: "integer" },
          termsHash: { type: "string" },
          status: { type: "string", enum: [...CONTRACT_STATUSES] },
          signedAt: { type: "string", format: "date-time" },
        },
      },
      TermsDocument: {
        type: "object",
        required: [
          "workRequestId",
          "workRequestStatus",
          "projectStatus",
          "reference",
          "versions",
          "contract",
        ],
        properties: {
          workRequestId: { type: "string" },
          workRequestStatus: {
            type: "string",
            enum: [...WORK_REQUEST_STATUSES],
          },
          projectStatus: nullableEnum(PROJECT_STATUSES),
          reference: {
            type: ["object", "null"],
            description:
              "첫 저장 때 고정한 참조 사본 (프로젝트 공개 필드, 지원 내용)",
            required: ["project", "request"],
            properties: {
              project: {
                type: ["object", "null"],
                required: [
                  "id",
                  "title",
                  "description",
                  "purpose",
                  "styles",
                  "budget",
                ],
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  purpose: { type: "string" },
                  styles: { type: "array", items: { type: "string" } },
                  budget: { type: "integer" },
                },
              },
              request: {
                type: "object",
                required: ["message", "proposedAmount", "expectedDays"],
                properties: {
                  message: { type: "string" },
                  proposedAmount: { type: "integer" },
                  expectedDays: { type: "integer" },
                },
              },
            },
          },
          versions: {
            type: "array",
            items: { $ref: "#/components/schemas/TermsVersion" },
          },
          contract: {
            oneOf: [
              { $ref: "#/components/schemas/Contract" },
              { type: "null" },
            ],
          },
        },
      },
      SignatureResponse: {
        type: "object",
        required: ["version", "contract"],
        properties: {
          version: { $ref: "#/components/schemas/TermsVersion" },
          contract: {
            oneOf: [
              { $ref: "#/components/schemas/Contract" },
              { type: "null" },
            ],
          },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["status", "uptimeSeconds", "timestamp"],
        properties: {
          status: { const: "ok" },
          uptimeSeconds: { type: "integer" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ReadinessResponse: {
        type: "object",
        required: ["status", "checks"],
        properties: {
          status: { type: "string", enum: ["ok", "unavailable"] },
          checks: {
            type: "object",
            required: ["database"],
            properties: { database: { type: "string", enum: ["ok", "error"] } },
          },
        },
      },
    },
  },
};

export default openApiDocument;
