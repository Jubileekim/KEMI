import {
  clientProfileUpdateSchema,
  CONTENT_STYLES,
  CREATOR_SERVICE_STATUSES,
  creatorProfileUpdateSchema,
  ERROR_CODES,
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
  signupRequestSchema,
  socialSignupRequestSchema,
  USER_ROLES,
  USER_STATUSES,
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

const nullableEnum = (values: readonly string[]) => ({
  type: ["string", "null"],
  enum: [...values, null],
});

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
    { name: "discovery", description: "프로젝트 북마크·기본 추천" },
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
          "모집 중(OPEN)이고 마감 전이며, 이용 제한·탈퇴되지 않은 회원의 프로젝트만 보여준다. 그 밖에는 404다.",
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
    "/api/projects/{projectId}/close": {
      post: {
        tags: ["projects"],
        summary: "내 프로젝트 모집 마감",
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
