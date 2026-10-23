import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/shared/api/client";
import Button from "@/components/ui/button";
import { mockEnabled, useSession, session } from "@/app/session";

export default function DevTools() {
  const { role, setRole } = useSession();
  const [scenario, setScenario] = useState("success");
  const probe = useQuery({
    queryKey: ["mock-probe", scenario, role],
    enabled: mockEnabled,
    queryFn: async ({ signal }) =>
      (
        await api.get<{ source: string; items: string[] }>("/__mock__/probe", {
          baseURL: "/",
          params: { scenario },
          signal,
        })
      ).data,
  });
  let result: ReactNode = probe.data?.items.join(", ");
  if (probe.data?.items.length === 0) result = "결과가 없어요.";
  if (probe.error) {
    const message =
      probe.error instanceof ApiError
        ? `${probe.error.status} · ${probe.error.message}`
        : "요청 오류";
    result = <p role="alert">{message}</p>;
  }
  if (probe.isFetching) result = "불러오는 중…";
  return (
    <aside aria-label="개발 전용 도구" className="dev-tools">
      <p>
        개발 전용 ·{" "}
        {mockEnabled
          ? "Mock 활성 · 실제 API 미연결"
          : "Mock 비활성 · 인증 API는 명시적 설정으로 연결"}
      </p>
      <Link to="/__dev/ui">공통 UI 예시</Link>
      {mockEnabled && (
        <>
          <Button variant="outline" onClick={() => session.verify()}>
            인증 세션 확인
          </Button>
          <label htmlFor="mock-auth">
            Mock 인증 응답{" "}
            <select
              id="mock-auth"
              onChange={(e) => {
                api.post("/__mock__/auth/scenario", e.target.value, {
                  baseURL: "/",
                  headers: { "Content-Type": "text/plain" },
                });
              }}
            >
              {[
                "success",
                "delay",
                "invalid",
                "restricted",
                "rate",
                "server",
                "network",
                "expired",
                "logout-error",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label htmlFor="mock-role">
            Mock 역할{" "}
            <select
              id="mock-role"
              value={role}
              onChange={(e) => {
                const { value } = e.target;
                if (
                  value === "guest" ||
                  value === "client" ||
                  value === "creator" ||
                  value === "ops"
                )
                  setRole(value);
              }}
            >
              {(["guest", "client", "creator", "ops"] as const).map((value) => (
                <option key={value} value={value}>
                  {
                    {
                      guest: "비회원",
                      client: "의뢰인",
                      creator: "크리에이터",
                      ops: "운영(가정)",
                    }[value]
                  }
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="mock-response">
            Mock 응답{" "}
            <select
              id="mock-response"
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
            >
              {[
                "success",
                "empty",
                "delay",
                "401",
                "403",
                "409",
                "500",
                "network",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <div aria-live="polite" data-testid="probe-result">
            {result}
          </div>
          <Button
            variant="outline"
            disabled={probe.isFetching}
            onClick={async () => {
              await probe.refetch();
            }}
          >
            다시 요청
          </Button>
        </>
      )}
    </aside>
  );
}
