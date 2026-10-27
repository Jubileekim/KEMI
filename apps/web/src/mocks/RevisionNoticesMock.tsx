import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import { loadRevisionEvents } from "./delivery-api";
import { revisionLabels } from "./revision-model";

export default function RevisionNoticesMock({
  requestId,
}: {
  requestId: string;
}) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-revision-events", session.epoch(), user?.id, requestId],
    queryFn: ({ signal }) => loadRevisionEvents(requestId, signal),
  });
  return (
    <section className="grid gap-3" aria-label="수정 요청 시스템 안내">
      <h3 className="type-heading-sm">수정 요청 시스템 안내 (Mock)</h3>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        수정 안내 재조회
      </Button>
      {query.isFetching && <p role="status">수정 안내 확인 중…</p>}
      {query.error && (
        <p role="alert">수정 안내를 확인하지 못했어요. 재조회해 주세요.</p>
      )}
      {!query.error &&
        query.data?.map(({ contractId, revision }) => (
          <p key={revision.id} className="rounded-xl bg-muted p-4">
            시스템 ·{" "}
            <Link
              to={`/contracts/${contractId}/deliveries?version=${revision.versionId}&request=${revision.id}`}
            >
              {revisionLabels[revision.category]} 요청 바로가기
            </Link>
          </p>
        ))}
      {!query.error && query.data?.length === 0 && (
        <p>확정된 수정 요청 안내가 없어요.</p>
      )}
    </section>
  );
}
