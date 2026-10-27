import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import { loadDeliveryEvents } from "./delivery-api";
import deadlineTime from "../features/production/time";
import { deliveryEventLabels } from "./delivery-model";

export default function DeliveryNoticesMock({ roomId }: { roomId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-delivery-events", session.epoch(), user?.id, roomId],
    queryFn: ({ signal }) => loadDeliveryEvents(roomId, signal),
  });
  return (
    <section className="grid gap-3" aria-label="영상 제출 시스템 안내">
      <h3 className="type-heading-sm">영상 제출 시스템 안내 (Mock)</h3>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        영상 안내 재조회
      </Button>
      {query.isFetching && <p role="status">영상 안내 확인 중…</p>}
      {query.error && (
        <p role="alert">영상 안내를 확인하지 못했어요. 재조회해 주세요.</p>
      )}
      {!query.error &&
        query.data?.map(({ contractId, version }) => (
          <p key={version.id} className="rounded-xl bg-muted p-4">
            시스템 · {deadlineTime(version.at)} ·{" "}
            <Link
              to={`/contracts/${contractId}/deliveries?version=${version.id}${version.requestId ? `&request=${version.requestId}` : ""}`}
            >
              v{version.number} {deliveryEventLabels[version.kind]} 바로가기
            </Link>
          </p>
        ))}
      {!query.error && query.data?.length === 0 && (
        <p>확정된 영상 제출 안내가 없어요.</p>
      )}
    </section>
  );
}
