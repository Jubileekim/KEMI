import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import { loadSettlement } from "./settlement-api";
import type { SettlementCommand } from "./settlement-model";

const statusLabels = {
  PROCESSING: "모의 정산 처리 중",
  UNKNOWN: "모의 정산 결과 확인 중",
  FAILED: "모의 정산 실패",
  SUCCEEDED: "모의 정산 성공 · 작업 완료",
};
const money = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;
export default function SettlementMock({ contractId }: { contractId: string }) {
  const { user } = useSession();
  const [params] = useSearchParams();
  const [pending, setPending] = useState<SettlementCommand | null>(null);
  const valid = z.string().uuid().safeParse(contractId).success;
  const query = useQuery({
    queryKey: ["mock-settlement", session.epoch(), user?.id, contractId],
    queryFn: ({ signal }) => loadSettlement(contractId, signal),
    enabled: valid,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (cmd: SettlementCommand) =>
      loadSettlement(contractId, undefined, cmd),
  });
  const busy = query.isFetching || mutation.isPending;
  const refresh = async () => {
    const epoch = session.epoch();
    const result = await query.refetch();
    if (epoch !== session.epoch() || result.isError || !result.data) return;
    if (pending && result.data.record?.id === pending.id) {
      setPending(null);
      mutation.reset();
    }
  };
  const run = (cmd: SettlementCommand) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending(cmd);
    mutation.mutate(cmd, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const result = await query.refetch();
        if (epoch !== session.epoch() || result.isError || !result.data) return;
        setPending(null);
      },
    });
  };
  const { data } = query;
  const record = data?.record;
  const wrong = Boolean(
    params.get("settlement") && params.get("settlement") !== record?.id,
  );
  const complete = record?.status === "SUCCEEDED" && !data?.reason;
  return (
    <section
      className="showcase-card grid min-w-0 gap-4 break-words [&_button]:h-auto [&_button]:whitespace-normal [&_button]:py-2"
      aria-label="모의 정산"
    >
      <h1 className="type-heading-lg">모의 정산 결과</h1>
      <p>
        개발용 Mock · 실제 지급·API·DB·외부 제공자 미연결. 단일 탭 메모리로
        새로고침하면 계약과 정산 기록이 초기화돼요.
      </p>
      <p>
        정상 계약액의 10% 공제 · 의뢰인 별도 수수료 0%. D12 세금·VAT·절사 기준은
        미결정이며, 소수 원 수수료는 계산을 보류해요.
      </p>
      <Button variant="outline" disabled={busy || !valid} onClick={refresh}>
        정산 상태 재조회
      </Button>
      {!valid && <p role="alert">유효한 계약 식별이 필요해요.</p>}
      {busy && <p role="status">모의 정산 상태 확인 중…</p>}
      {(query.error || mutation.error || pending) && !busy && (
        <p role="alert">
          정산 응답을 확인하지 못했어요. 완료로 표시하지 않아요. 재조회하거나
          같은 요청을 재시도해 주세요.
        </p>
      )}
      {pending && !busy && (
        <Button disabled={Boolean(query.error)} onClick={() => run(pending)}>
          같은 정산 요청 재시도
        </Button>
      )}
      {data && !query.error && !busy && !pending && (
        <>
          <p>고정 계약 금액: {money(data.amount)} · KRW</p>
          <div className="flex flex-wrap gap-4">
            <Link to={`/contracts/${contractId}/cancellation`}>
              취소 요청·합의 (Mock)
            </Link>
            <Link to={`/workspace/${data.requestId}`}>
              같은 작업 공간으로 돌아가기
            </Link>
            <Link
              to={`/contracts/${contractId}/deliveries${record ? `?version=${record.versionId}&final=${record.deliveryId}` : ""}`}
            >
              승인·최종 전달·수령 확인
            </Link>
          </div>
          {wrong ? (
            <p role="alert">
              지정한 정산 기록을 찾을 수 없어요. 다른 정산으로 바꾸지 않아요.
            </p>
          ) : (
            <>
              {data.reason ? (
                <p role="status">정산 보류 · {data.reason}</p>
              ) : (
                <p role="status">
                  {record
                    ? statusLabels[record.status]
                    : "정산 조건 확인 가능 · 정산 미실행"}
                </p>
              )}
              {complete && record && (
                <dl
                  aria-label="확정 모의 정산 내역"
                  className="grid gap-2 rounded-xl bg-muted p-4"
                >
                  <dt>정산 기록</dt>
                  <dd>{record.id}</dd>
                  <dt>정상 계약액</dt>
                  <dd>{money(record.amount)}</dd>
                  <dt>수수료 10%</dt>
                  <dd>{money(record.fee)}</dd>
                  <dt>크리에이터 모의 정산액</dt>
                  <dd>{money(record.net)}</dd>
                  <dt>의뢰인 별도 수수료</dt>
                  <dd>{money(record.clientFee)}</dd>
                  <dt>Mock 성공 확인 시각</dt>
                  <dd>{record.confirmedAt}</dd>
                </dl>
              )}
              {!complete && (
                <p>
                  승인·다운로드·대화·수령 기록만으로 완료하지 않아요. 처리
                  중·실패·결과 확인 중에는 완료가 아니에요.
                </p>
              )}
              {!data.reason && !complete && data.receiptId && (
                <Button
                  onClick={() => {
                    if (!data.receiptId) return;
                    const unresolved =
                      record &&
                      ["PROCESSING", "UNKNOWN"].includes(record.status);
                    run({
                      id: unresolved ? record.id : crypto.randomUUID(),
                      revision: data.revision,
                      receiptId: data.receiptId,
                    });
                  }}
                >
                  {record && ["PROCESSING", "UNKNOWN"].includes(record.status)
                    ? "기존 모의 정산 결과 확인"
                    : "모의 정산 결과 확인"}
                </Button>
              )}
            </>
          )}
        </>
      )}
      <details>
        <summary>4-E 개발 전용 시나리오</summary>
        <Label htmlFor="settlement-scenario">Mock 정산 응답</Label>
        <select
          id="settlement-scenario"
          className="w-full rounded-xl border p-3"
          defaultValue="success"
          disabled={busy}
          onChange={async (e) => {
            await fetch("/__mock__/settlements/scenario", {
              method: "POST",
              body: e.target.value,
            });
          }}
        >
          {[
            "success",
            "events-error",
            "processing",
            "unknown",
            "failed",
            "held",
            "mismatch",
            "delay",
            "lost-response",
            "network",
            "401",
            "403",
            "409",
            "500",
            "malformed",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </details>
    </section>
  );
}
