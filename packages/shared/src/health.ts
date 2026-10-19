export interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResponse {
  status: "ok" | "unavailable";
  checks: {
    database: "ok" | "error";
  };
}
