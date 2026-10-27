import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import { loadDispute } from "./resolution-api";
import Button from "../components/ui/button";

export default function DisputeMock({ disputeId }: { disputeId: string }) {
  const { user } = useSession();
  const valid = z.string().uuid().safeParse(disputeId).success;
  const query = useQuery({
    queryKey: ["mock-dispute", session.epoch(), user?.id, disputeId],
    queryFn: ({ signal }) => loadDispute(disputeId, signal),
    enabled: valid,
  });
  const data = !query.error && !query.isFetching ? query.data : undefined;
  const dispute = data?.state.workflow.disputes.find((d) => d.id === disputeId);
  return (
    <section
      className="showcase-card grid min-w-0 gap-4 break-words"
      aria-label="분쟁 현황"
    >
      <h1 className="type-heading-lg">분쟁 현황 (Mock)</h1>
      <p>실제 운영·API 미연결 · 요청·무응답으로 환불·정산하지 않아요.</p>
      <Button
        disabled={!valid || query.isFetching}
        onClick={() => query.refetch()}
      >
        분쟁 현황 재조회
      </Button>
      {query.isFetching && <p role="status">확인 중…</p>}
      {(!valid || query.error) && (
        <p role="alert">
          분쟁을 확인하지 못했어요. 본인 거래와 정확한 분쟁 링크를 확인해
          주세요.
        </p>
      )}
      {data && dispute && (
        <>
          <p>
            분쟁 {dispute.id} · {dispute.reason} · 증빙 {dispute.evidence}
          </p>
          <p>
            {dispute.released
              ? "근거 기록 후 합의 흐름 복귀"
              : "운영 검토 대기 · 정산 보류"}
          </p>
          {!dispute.reviews.length && (
            <p>
              담당 미배정 · 다음 안내: 양측 합의 조건과 증빙을 확인해 주세요.
            </p>
          )}
          {dispute.reviews.map((r) => (
            <p key={r.id}>
              담당 {r.actorId} · {r.at} · 근거 {r.note} · 다음 안내 {r.nextStep}
            </p>
          ))}
          <div className="flex flex-wrap gap-4">
            <Link to={`/contracts/${data.contractId}/cancellation`}>
              취소 합의·환불·파일 확인
            </Link>
            <Link to={`/workspace/${data.requestId}`}>
              같은 작업 공간에서 대화·증빙 확인
            </Link>
            <Link to={`/contracts/${data.contractId}/deliveries`}>
              기존 영상·파일 증빙 확인
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
