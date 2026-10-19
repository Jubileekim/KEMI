import {
  ERROR_CODES,
  loginRequestSchema,
  signupRequestSchema,
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
          401: errorResponse(
            "토큰 없음·잘못됨 (`UNAUTHENTICATED`), 만료 (`TOKEN_EXPIRED`), 세션 폐기 (`SESSION_REVOKED`)",
          ),
          403: errorResponse("이용 제한된 계정 (`FORBIDDEN`)"),
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
      MeResponse: {
        type: "object",
        required: ["user"],
        properties: { user: { $ref: "#/components/schemas/AuthUser" } },
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
