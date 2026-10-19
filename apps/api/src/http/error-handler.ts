import type { ApiErrorBody } from "@kemi/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import AppError from "./app-error.js";

// express.json()의 본문 파싱 실패를 구분하는 타입 가드
function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    err.type === "entity.parse.failed"
  );
}

function toErrorBody(err: unknown): { status: number; payload: ApiErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      payload: {
        error: { code: err.code, message: err.message, details: err.details },
      },
    };
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      payload: {
        error: {
          code: "VALIDATION_FAILED",
          message: "입력값을 확인해주세요.",
          details: err.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        },
      },
    };
  }
  if (isBodyParserError(err)) {
    return {
      status: 400,
      payload: {
        error: {
          code: "INVALID_JSON",
          message: "요청 본문이 올바른 JSON이 아닙니다.",
        },
      },
    };
  }

  console.error(err);
  return {
    status: 500,
    payload: {
      error: { code: "INTERNAL_ERROR", message: "서버 오류가 발생했습니다." },
    },
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new AppError(
      404,
      "NOT_FOUND",
      `${req.method} ${req.path} 경로를 찾을 수 없습니다.`,
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const body = toErrorBody(err);
  res.status(body.status).json(body.payload);
};
