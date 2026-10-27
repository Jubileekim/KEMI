import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import type { Dispute } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Textarea from "../../components/ui/textarea";
import { kemi } from "../../shared/api/kemi";
import { openFile } from "../../shared/api/upload";
import { dateTime, won } from "../live/labels";
import { Card, Facts, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";

function metricValue(key: string, value: unknown) {
  if (typeof value !== "number") return JSON.stringify(value);
  return key.toLowerCase().includes("krw") ? won(value) : String(value);
}

function DisputeCard({ dispute }: { dispute: Dispute }) {
  const client = useQueryClient();
  const resolve = useMutation({
    mutationFn: (reason: string) => kemi.resolveDispute(dispute.id, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-disputes"] });
      client.invalidateQueries({ queryKey: ["admin-dispute", dispute.id] });
      client.invalidateQueries({ queryKey: ["operation-records"] });
    },
  });
  return (
    <li className="showcase-card grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/disputes/${dispute.id}`}
          className="type-title underline-offset-4 hover:underline"
        >
          분쟁 {dispute.id} · 계약 {dispute.contractId}
        </Link>
        <Badge variant="secondary">
          {dispute.status === "OPEN" ? "검토 중" : "처리 완료"}
        </Badge>
        <span className="text-muted-foreground">
          {dateTime(dispute.createdAt)}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{dispute.reason}</p>
      <ul className="grid gap-1 text-sm">
        {dispute.evidence.map((e) => (
          <li key={e.id}>
            증빙({e.submittedBy}): {e.note}
            {e.fileIds.map((id, i) => (
              <Button
                key={id}
                variant="link"
                size="sm"
                className="p-1"
                onClick={() => openFile(id)}
              >
                파일 {i + 1}
              </Button>
            ))}
          </li>
        ))}
      </ul>
      {dispute.resolution && <p>처리 근거: {dispute.resolution}</p>}
      {dispute.status === "OPEN" && (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const reason = String(
              new FormData(event.currentTarget).get("reason") ?? "",
            ).trim();
            if (reason) resolve.mutate(reason);
          }}
        >
          <Textarea
            aria-label="처리 근거"
            name="reason"
            rows={2}
            required
            maxLength={2000}
          />
          <p className="text-sm text-muted-foreground">
            처리하면 근거가 운영 기록에 남고 정산 보류가 풀려요. 지급·환불을
            대신 실행하지는 않아요.
          </p>
          {resolve.error && <p role="alert">{errorText(resolve.error)}</p>}
          <Button
            type="submit"
            size="sm"
            disabled={resolve.isPending}
            className="justify-self-start"
          >
            분쟁 처리
          </Button>
        </form>
      )}
    </li>
  );
}

// OPS-01: 운영자 분쟁 검토·처리 기록·운영 지표 (ADMIN)
export default function OpsLive() {
  const { role } = useSession();
  const disputes = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: ({ signal }) => kemi.adminDisputes(signal),
  });
  const records = useQuery({
    queryKey: ["operation-records"],
    queryFn: ({ signal }) => kemi.operationRecords(signal),
  });
  const metrics = useQuery({
    queryKey: ["metrics"],
    queryFn: ({ signal }) => kemi.metrics(signal),
  });
  if (role !== "ops") return <p role="alert">운영자만 볼 수 있어요.</p>;
  return (
    <>
      <h1 className="type-heading-lg">분쟁 검토</h1>
      {metrics.data && (
        <Card title="운영 지표 (시연 계정 제외)">
          <Facts
            items={Object.entries(metrics.data).map(
              ([key, value]): [string, string] => [
                key,
                metricValue(key, value),
              ],
            )}
          />
        </Card>
      )}
      {disputes.isPending && <Loading />}
      {disputes.error && <Failure error={disputes.error} />}
      {disputes.data?.items.length === 0 && (
        <Card>
          <p>분쟁이 없어요.</p>
        </Card>
      )}
      <ul className="grid gap-4">
        {disputes.data?.items.map((d) => (
          <DisputeCard key={d.id} dispute={d} />
        ))}
      </ul>
      <Card title="운영 처리 기록">
        {records.data?.items.length === 0 && <p>기록이 없어요.</p>}
        <ul className="grid gap-2 text-sm">
          {records.data?.items.map((r) => (
            <li key={r.id}>
              {dateTime(r.createdAt)} · {r.targetType} {r.targetId} · {r.action}{" "}
              · {r.reason}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

// 분쟁 상세(/disputes/:disputeId). 운영자는 처리할 수 있고, 당사자는 계약의 취소·분쟁 화면에서 본다.
export function DisputeLive() {
  const { disputeId = "" } = useParams();
  const { role } = useSession();
  const dispute = useQuery({
    queryKey: ["admin-dispute", disputeId],
    enabled: role === "ops",
    queryFn: ({ signal }) => kemi.adminDispute(disputeId, signal),
  });
  if (role !== "ops")
    return (
      <Card title="분쟁">
        <p>
          분쟁 내용과 증빙은 계약의 취소·분쟁 화면에서 확인하고 추가할 수
          있어요.
        </p>
        <Button asChild variant="outline" className="justify-self-start">
          <Link to="/requests">의뢰 현황으로</Link>
        </Button>
      </Card>
    );
  if (dispute.isPending) return <Loading />;
  if (dispute.error) return <Failure error={dispute.error} />;
  return (
    <ul className="grid gap-4">
      <DisputeCard dispute={dispute.data} />
    </ul>
  );
}
