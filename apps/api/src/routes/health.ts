import type { HealthResponse, ReadinessResponse } from "@kemi/shared";
import { Router } from "express";

export type DatabaseCheck = () => Promise<void>;
export type StorageReadiness = NonNullable<
  ReadinessResponse["checks"]["storage"]
>;

export function createHealthRouter(
  checkDatabase: DatabaseCheck,
  checkStorage?: () => Promise<StorageReadiness>,
): Router {
  const router = Router();

  // 프로세스가 살아 있는지만 확인한다. DB 장애로 Render가 서버를 재시작하지 않도록 DB는 보지 않는다.
  router.get("/health", (_req, res) => {
    const body: HealthResponse = {
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  });

  // 요청을 처리할 준비가 됐는지(DB 연결 포함) 확인한다.
  router.get("/health/ready", async (_req, res) => {
    let database: ReadinessResponse["checks"]["database"] = "ok";
    try {
      await checkDatabase();
    } catch (err) {
      console.error(
        "DB readiness check failed:",
        err instanceof Error ? err.message : err,
      );
      database = "error";
    }
    // 저장소 상태는 진단용으로만 알린다. 저장소 장애로 서버 전체를 준비 안 됨으로 만들지 않는다.
    const storage = checkStorage
      ? await checkStorage().catch((): StorageReadiness => "error")
      : undefined;
    const body: ReadinessResponse = {
      status: database === "ok" ? "ok" : "unavailable",
      checks: storage ? { database, storage } : { database },
    };
    res.status(database === "ok" ? 200 : 503).json(body);
  });

  return router;
}
