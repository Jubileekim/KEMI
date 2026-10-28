export interface HealthResponse {
  status: "ok";
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResponse {
  status: "ok" | "unavailable";
  checks: {
    database: "ok" | "error";
    // 파일 저장소 점검(운영 진단용). 결과와 관계없이 status는 DB만 본다.
    // not_configured: 저장소 환경변수 없음, missing_bucket: STORAGE_BUCKET 이름의 버킷 없음,
    // unauthorized: 키 거부, error: 연결·기타 오류
    storage?:
      "ok" | "not_configured" | "missing_bucket" | "unauthorized" | "error";
  };
}
