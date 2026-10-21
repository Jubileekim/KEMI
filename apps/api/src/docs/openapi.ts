import {
  clientProfileUpdateSchema,
  CONTENT_STYLES,
  CREATOR_SERVICE_STATUSES,
  creatorProfileUpdateSchema,
  ERROR_CODES,
  loginRequestSchema,
  PACKAGE_LIMITS,
  packageCreateSchema,
  packageUpdateSchema,
  PRODUCT_CATEGORIES,
  PRODUCTION_ROLES,
  SERVICE_REQUIREMENTS,
  serviceStatusUpdateSchema,
  signupRequestSchema,
  SOCIAL_CALLBACK_ERRORS,
  SOCIAL_PROVIDER_PATHS,
  socialSignupRequestSchema,
  USER_ROLES,
  USER_STATUSES,
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

const myPackagesResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/MyPackagesResponse" },
    },
  },
});

const creatorOnly = errorResponse(
  "크리에이터가 아님, 또는 이용 제한·탈퇴된 계정 (`FORBIDDEN`)",
);

const idParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^\\d+$" },
});

const representativeRequired = errorResponse(
  "다른 공개 패키지가 있는 대표 패키지 (`REPRESENTATIVE_REQUIRED`). 먼저 다른 패키지를 대표로 지정한다.",
);

const myProfileResponse = {
  description: "표시 이름과 역할별 프로필. 저장한 적이 없으면 빈 기본값.",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/MyProfileResponse" },
    },
  },
};

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
    {
      name: "packages",
      description: "서비스 패키지와 제작 서비스 공개·비공개 (크리에이터)",
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
    "/api/packages/me": {
      get: {
        tags: ["packages"],
        summary: "본인 패키지 목록과 서비스 상태",
        description: "삭제한 패키지는 나오지 않는다. 비공개 패키지는 나온다.",
        security: [{ bearerAuth: [] }],
        responses: {
          200: myPackagesResponse("본인 패키지와 서비스 상태"),
          ...bearerErrors,
          403: creatorOnly,
        },
      },
      post: {
        tags: ["packages"],
        summary: "패키지 만들기 (PACK-01)",
        description: `\`isPublic\`을 빼면 비공개로 만든다. 대표 패키지가 없을 때 공개 패키지를 만들면 대표가 된다. 삭제하지 않은 패키지는 최대 ${PACKAGE_LIMITS.maxPackages}개다 [제안].`,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(packageCreateSchema) },
          },
        },
        responses: {
          201: myPackagesResponse("만든 뒤의 패키지 목록과 서비스 상태"),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: creatorOnly,
          409: errorResponse("최대 개수 초과 (`PACKAGE_LIMIT_EXCEEDED`)"),
        },
      },
    },
    "/api/packages/me/{packageId}": {
      patch: {
        tags: ["packages"],
        summary: "패키지 수정·공개 전환 (PACK-02)",
        description:
          "보낸 항목만 바꾸고, 객체 항목(`specification` 등)은 통째로 바꾼다. 이미 보낸 요청·계약의 금액과 조건은 요청 쪽에 따로 저장되므로 바뀌지 않는다. 마지막 공개 패키지를 비공개로 바꾸면 공개 중인 서비스가 비공개가 된다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: requestSchema(packageUpdateSchema) },
          },
        },
        responses: {
          200: myPackagesResponse("수정 뒤의 패키지 목록과 서비스 상태"),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: creatorOnly,
          404: errorResponse("본인 패키지가 아니거나 삭제됨 (`NOT_FOUND`)"),
          409: representativeRequired,
        },
      },
      delete: {
        tags: ["packages"],
        summary: "패키지 삭제",
        description:
          "목록에서 사라지고 되살릴 수 없다. 요청·계약이 참조할 수 있어 기록은 서버에 남는다. 마지막 공개 패키지를 삭제하면 공개 중인 서비스가 비공개가 된다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        responses: {
          200: myPackagesResponse("삭제 뒤의 패키지 목록과 서비스 상태"),
          ...bearerErrors,
          403: creatorOnly,
          404: errorResponse(
            "본인 패키지가 아니거나 이미 삭제됨 (`NOT_FOUND`)",
          ),
          409: representativeRequired,
        },
      },
    },
    "/api/packages/me/{packageId}/representative": {
      put: {
        tags: ["packages"],
        summary: "대표 패키지 지정 (PACK-03)",
        description:
          "기존 대표는 대표가 아니게 된다. 공개 패키지만 대표가 될 수 있다.",
        security: [{ bearerAuth: [] }],
        parameters: [idParam("packageId")],
        responses: {
          200: myPackagesResponse("지정 뒤의 패키지 목록과 서비스 상태"),
          ...bearerErrors,
          403: creatorOnly,
          404: errorResponse("본인 패키지가 아니거나 삭제됨 (`NOT_FOUND`)"),
          409: errorResponse("비공개 패키지 (`CONFLICT`)"),
        },
      },
    },
    "/api/profiles/me/service-status": {
      put: {
        tags: ["packages"],
        summary: "제작 서비스 공개·비공개 (PROFILE-03·04)",
        description: `\`PUBLIC\`은 공개 조건을 모두 채워야 한다. 빠진 항목은 \`details.missing\`(${SERVICE_REQUIREMENTS.join(", ")} 중 일부)으로 알려준다 [제안 · D01]. \`PRIVATE\`은 공개했던 서비스에만 쓸 수 있으며 기존 거래는 영향받지 않는다.`,
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: requestSchema(serviceStatusUpdateSchema),
            },
          },
        },
        responses: {
          200: myPackagesResponse("바뀐 서비스 상태와 패키지 목록"),
          400: errorResponse(
            "입력값 오류 (`VALIDATION_FAILED`, `INVALID_JSON`)",
          ),
          ...bearerErrors,
          403: creatorOnly,
          409: errorResponse(
            "공개 조건 미충족 (`SERVICE_REQUIREMENTS_MISSING`, `details.missing`) 또는 공개한 적 없는 서비스의 비공개 요청 (`CONFLICT`)",
          ),
        },
      },
    },
    "/api/creators/{creatorId}/packages": {
      get: {
        tags: ["packages"],
        summary: "크리에이터의 공개 패키지",
        description:
          "로그인 없이 조회할 수 있다 [제안]. 공개 서비스의 공개 패키지만 대표가 먼저 오도록 돌려준다. 비공개·초안 서비스나 이용 제한 회원은 404다.",
        parameters: [idParam("creatorId")],
        responses: {
          200: {
            description: "공개 패키지 목록",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreatorPackagesResponse",
                },
              },
            },
          },
          404: errorResponse("공개된 제작 서비스 없음 (`NOT_FOUND`)"),
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
      ServicePackage: {
        type: "object",
        required: [
          "id",
          "title",
          "description",
          "basePrice",
          "currency",
          "specification",
          "includedScope",
          "excludedScope",
          "requiredMaterials",
          "deliveryDays",
          "revisionLimit",
          "revisionScope",
          "sourceDelivery",
          "usageTerms",
          "isPublic",
          "isRepresentative",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string", pattern: "^\\d+$" },
          title: { type: "string" },
          description: { type: "string" },
          basePrice: { type: "integer", description: "원 단위 기본 금액" },
          currency: { const: "KRW" },
          specification: {
            type: "object",
            required: [
              "videoCount",
              "lengthSeconds",
              "aspectRatio",
              "resolution",
              "format",
            ],
            properties: {
              videoCount: { type: "integer" },
              lengthSeconds: { type: ["integer", "null"] },
              aspectRatio: { type: ["string", "null"] },
              resolution: { type: ["string", "null"] },
              format: { type: ["string", "null"] },
            },
          },
          includedScope: { type: "string" },
          excludedScope: { type: "string" },
          requiredMaterials: { type: "array", items: { type: "string" } },
          deliveryDays: { type: "integer", description: "달력일" },
          revisionLimit: { type: "integer" },
          revisionScope: { type: "string" },
          sourceDelivery: {
            type: "object",
            required: ["provided", "note"],
            properties: {
              provided: { type: "boolean" },
              note: { type: ["string", "null"] },
            },
          },
          usageTerms: {
            type: "object",
            required: ["note"],
            properties: { note: { type: ["string", "null"] } },
          },
          isPublic: { type: "boolean" },
          isRepresentative: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      MyPackagesResponse: {
        type: "object",
        required: ["serviceStatus", "packages"],
        properties: {
          serviceStatus: {
            type: "string",
            enum: [...CREATOR_SERVICE_STATUSES],
          },
          packages: {
            type: "array",
            items: { $ref: "#/components/schemas/ServicePackage" },
          },
        },
      },
      CreatorPackagesResponse: {
        type: "object",
        required: ["creatorId", "packages"],
        properties: {
          creatorId: { type: "string", pattern: "^\\d+$" },
          packages: {
            type: "array",
            items: { $ref: "#/components/schemas/ServicePackage" },
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
