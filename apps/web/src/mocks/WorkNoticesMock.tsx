import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import { loadWorkEvents } from "./settlement-api";

export default function WorkNoticesMock({ roomId }: { roomId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-work-events", session.epoch(), user?.id, roomId],
    queryFn: ({ signal }) => loadWorkEvents(roomId, signal),
  });
  return (
    <section className="grid min-w-0 gap-3" aria-label="서명·준비 시스템 안내">
      <h3 className="type-heading-sm">서명·준비 시스템 안내 (Mock)</h3>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        서명·준비 안내 재조회
      </Button>
      {query.error && (
        <p role="alert">작업 안내 조회 실패 · 재조회해 주세요.</p>
      )}
      {query.isFetching && <p role="status">작업 안내 확인 중…</p>}
      {!query.error &&
        !query.isFetching &&
        query.data?.map((event) => (
          <p key={event.id} className="min-w-0 rounded-xl bg-muted p-4">
            시스템 · {event.at} · <Link to={event.path}>{event.label}</Link>
          </p>
        ))}
      {!query.error && !query.isFetching && !query.data?.length && (
        <p>확정된 서명·준비 안내가 없어요.</p>
      )}
    </section>
  );
}
