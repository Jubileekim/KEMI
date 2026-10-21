import type { Request } from "express";

// Authorization: Bearer <Access 토큰> 헤더에서 토큰을 읽는다.
export default function readBearerToken(req: Request): string | undefined {
  const header = req.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}
