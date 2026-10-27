import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import { loadSettlementEvents } from "./settlement-api";

export default function SettlementNoticesMock({ roomId }: { roomId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-settlement-events", session.epoch(), user?.id, roomId],
    queryFn: ({ signal }) => loadSettlementEvents(roomId, signal),
  });
  return (
    <section className="grid min-w-0 gap-3" aria-label="모의 정산 시스템 안내">
      <h3 className="type-heading-sm">모의 정산 시스템 안내 (Mock)</h3>
      <p>
        확정된 작업 사건을 일반 대화와 구분해 표시해요. 인앱 알림 생성·읽음은
        별도이며 아직 연결하지 않았어요.
      </p>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        정산 안내 재조회
      </Button>
      {query.isFetching && <p role="status">정산 안내 확인 중…</p>}
      {query.error && (
        <p role="alert">정산 안내 조회 실패 · 거래 결과는 변경하지 않았어요.</p>
      )}
      {!query.error &&
        !query.isFetching &&
        query.data?.map(({ contractId, record }) => (
          <p key={record.id} className="min-w-0 rounded-xl bg-muted p-4">
            시스템 · {record.confirmedAt} ·{" "}
            <Link
              to={`/contracts/${contractId}/settlement?settlement=${record.id}`}
            >
              모의 정산 성공·작업 완료 바로가기
            </Link>
          </p>
        ))}
      {!query.error && !query.isFetching && !query.data?.length && (
        <p>확정된 모의 정산 안내가 없어요.</p>
      )}
    </section>
  );
}
