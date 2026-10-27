import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import loadSafety from "./safety-api";

export default function RestrictionNoticeMock() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-safety", session.epoch(), user?.id, false],
    queryFn: ({ signal }) => loadSafety(false, signal),
    enabled: Boolean(user) && user?.role !== "ADMIN",
    refetchInterval: 10000,
  });
  if (!query.data?.limited || query.isError) return null;
  return (
    <aside
      className="rounded-xl border border-primary bg-muted p-4"
      aria-label="이용 제한 안내"
    >
      <p>
        개발용 이용 제한 · 신규 모집 공개·제안·직접 의뢰 발송을 보류해요. 기존
        거래·대화·납품·이의 경로는 유지돼요.
      </p>
      <Link to="/me/activity">기존 거래 확인</Link> ·{" "}
      <Link to="/reports/new">제한 사유·이의 확인</Link>
    </aside>
  );
}
