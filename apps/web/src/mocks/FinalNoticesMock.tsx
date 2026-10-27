import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import { loadFinalEvents } from "./delivery-api";

export default function FinalNoticesMock({ roomId }: { roomId: string }) {
  const { user } = useSession();
  const query = useQuery({
    queryKey: ["mock-final-events", session.epoch(), user?.id, roomId],
    queryFn: ({ signal }) => loadFinalEvents(roomId, signal),
  });
  return (
    <section
      className="grid min-w-0 gap-3"
      aria-label="승인·최종 전달·수령 시스템 안내"
    >
      <h3 className="type-heading-sm">
        승인·최종 전달·수령 시스템 안내 (Mock)
      </h3>
      <Button
        variant="outline"
        disabled={query.isFetching}
        onClick={() => query.refetch()}
      >
        최종 전달 안내 재조회
      </Button>
      {query.isFetching && <p role="status">최종 작업 안내 확인 중…</p>}
      {query.error && (
        <p role="alert">최종 작업 안내 조회 실패 · 재조회해 주세요.</p>
      )}
      {!query.error &&
        query.data?.flatMap(({ contractId, final }) =>
          [
            final.approval && {
              event: final.approval,
              label: "검토 승인",
              version: final.approval.versionId,
            },
            final.delivery && {
              event: final.delivery,
              label: "최종 파일 전달",
              version: final.delivery.versionId,
            },
            final.receipt && {
              event: final.receipt,
              label: "최종 수령 확인·정산 미실행",
              version: final.approval?.versionId,
            },
            final.problem && {
              event: final.problem,
              label: "파일 문제·수령 보류",
              version: final.approval?.versionId,
            },
          ].map(
            (value) =>
              value && (
                <p
                  key={value.event.id}
                  className="min-w-0 rounded-xl bg-muted p-4"
                >
                  시스템 · {value.event.at} ·{" "}
                  <Link
                    to={`/contracts/${contractId}/deliveries?version=${value.version}${final.delivery ? `&final=${final.delivery.id}` : ""}`}
                  >
                    {value.label} 바로가기
                  </Link>
                </p>
              ),
          ),
        )}
      {!query.error && !query.data?.some((v) => v.final.approval) && (
        <p>확정된 승인·최종 전달 안내가 없어요.</p>
      )}
    </section>
  );
}
