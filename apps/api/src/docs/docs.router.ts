import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import openApiDocument from "./openapi.js";

// API 문서: /api/openapi.json(원본), /api/docs(Swagger UI). 운영 환경에서는 붙이지 않는다(server.ts).
export default function createDocsRouter(): Router {
  const router = Router();
  router.get("/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });
  router.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return router;
}
