import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import { loadPayments, updatePayment } from "./payment-api";
import type { PaymentCommand } from "./payment-model";
import ProposalConfirm from "./ProposalConfirm";

const labels = {
  READY: "주문 준비 · 테스트 결제 전",
  UNKNOWN: "결과 확인 중 · 새 주문 차단",
  SUCCEEDED: "테스트 결제 성공 · 모의 검증 확인",
  FAILED: "테스트 결제 실패",
  CANCELED: "테스트 결제 취소",
};
export default function PaymentMock({
  contractId,
  orderId,
  result,
}: {
  contractId: string;
  orderId?: string;
  result: boolean;
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PaymentCommand | null>(null);
  const [notice, setNotice] = useState("");
  const valid = z.string().uuid().safeParse(contractId).success;
  const query = useQuery({
    queryKey: ["mock-payments", session.epoch(), user?.id, contractId],
    queryFn: ({ signal }) => loadPayments(contractId, signal),
    enabled: valid,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (cmd: PaymentCommand) => updatePayment(contractId, cmd),
  });
  const orders = query.data?.orders ?? [];
  const order =
    result && orderId ? orders.find((o) => o.id === orderId) : orders.at(-1);
  const displayStatus =
    pending?.type === "verify" && pending.id === order?.id
      ? "UNKNOWN"
      : order?.status;
  const client =
    user?.role === "CLIENT" && user.id === query.data?.contract.clientId;
  const busy = query.isFetching || mutation.isPending;
  const blocked =
    busy || Boolean(query.error) || Boolean(pending) || !query.data;
  const send = (cmd: PaymentCommand) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending(cmd);
    setNotice("");
    mutation.mutate(cmd, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const response = await query.refetch();
        if (epoch !== session.epoch() || response.isError || !response.data)
          return;
        const stored = response.data.orders.find((o) => o.id === cmd.id);
        if (!stored || (cmd.type === "verify" && stored.status === "READY"))
          return;
        setPending(null);
        if (cmd.type === "verify")
          navigate(
            `/payments/result?contractId=${contractId}&orderId=${cmd.id}`,
          );
      },
    });
  };
  return (
    <section
      className="showcase-card grid min-w-0 gap-4 break-words"
      aria-label="테스트 결제"
    >
      <h1 className="type-heading-lg">
        {result ? "테스트 결제 결과 확인" : "전액 테스트 결제"}
      </h1>
      <p>
        개발용 Mock · Toss Sandbox 미연결. 실금전 이동·실제 송금이 아니에요.
        단일 탭 메모리이며 새로고침하면 초기화돼요.
      </p>
      <p>
        복귀 URL은 성공 증거가 아니에요. 계약·당사자·금액·기존 주문을 모의
        서버에서 확인해요. 제작 시작은 후속 범위예요.
      </p>
      {!valid && (
        <p role="alert">
          유효한 계약 식별이 필요해요. 작업 공간에서 다시 진입해 주세요.
        </p>
      )}
      <Button
        variant="outline"
        disabled={!valid || busy}
        onClick={async () => {
          const epoch = session.epoch();
          const response = await query.refetch();
          if (epoch !== session.epoch() || response.isError || !response.data)
            return;
          const found = response.data.orders.find((o) => o.id === pending?.id);
          if (
            found &&
            (pending?.type === "create" || found.status !== "READY")
          ) {
            setPending(null);
            mutation.reset();
          }
          setNotice("기존 주문 결과를 재조회했어요.");
        }}
      >
        기존 결제 재조회
      </Button>
      {busy && <p role="status">주문·결제 결과를 확인하고 있어요.</p>}
      {(query.error || mutation.error || (pending && !mutation.isPending)) && (
        <p role="alert">
          결과를 확인하지 못했어요. 로그인·당사자·계약 상태를 확인하고 기존
          결제를 재조회해 주세요. 확인 전 새 주문은 차단해요.
        </p>
      )}
      {pending && !busy && (
        <Button onClick={() => send(pending)}>같은 요청 재시도</Button>
      )}
      {query.data && !query.error && (
        <>
          <p>
            고정 계약 금액: {query.data.contract.amount.toLocaleString("ko-KR")}
            원 · KRW · 전액
          </p>
          <p>
            계약: {contractId} · 조건 버전: {query.data.contract.versionId}
          </p>
          {result && !order && (
            <p role="alert">
              이 계약에서 해당 주문을 찾지 못했어요. 성공 여부를 확인할 수
              없어요.
            </p>
          )}
          {result && !orderId && (
            <p>
              계약의 최신 주문을 조회했어요. 아래 주문 이력도 확인할 수 있어요.
            </p>
          )}
          {order && (
            <article
              className="grid min-w-0 gap-3 rounded-xl border p-4"
              aria-label="현재 결제 결과"
            >
              <h2 className="type-heading-md">
                {displayStatus && labels[displayStatus]}
              </h2>
              <p>주문: {order.id}</p>
              <p>결제 금액: {order.amount.toLocaleString("ko-KR")}원</p>
              {displayStatus === "READY" && client && !result && (
                <ProposalConfirm
                  label="Mock 테스트 결제 진행"
                  description="표시된 계약 전액을 개발용 PG Mock으로 검증해요. Toss 결제창·실제 승인이 아니에요."
                  busy={blocked}
                  error=""
                  onConfirm={(_, done) => {
                    done();
                    send({ type: "verify", id: order.id });
                  }}
                />
              )}
              {displayStatus === "UNKNOWN" && (
                <p>
                  응답 지연·금액 불일치 등으로 확정하지 못했어요. 재결제 대신
                  기존 결제를 재조회해 주세요.
                </p>
              )}
              {displayStatus === "SUCCEEDED" && (
                <p>
                  모의 PG 검증 결과예요. 실금전 이동·제작 시작·정산 완료를
                  의미하지 않아요.
                </p>
              )}
            </article>
          )}
          {client &&
            !result &&
            (!order || ["FAILED", "CANCELED"].includes(order.status)) && (
              <ProposalConfirm
                label={order ? "새 테스트 주문 만들기" : "테스트 주문 만들기"}
                description="고정된 계약 금액으로 주문 하나를 만들어요. 주문 생성만으로 결제하지 않아요."
                busy={blocked}
                error=""
                onConfirm={(_, done) => {
                  done();
                  send({ type: "create", id: crypto.randomUUID() });
                }}
              />
            )}
          {order && !result && (
            <Link
              to={`/payments/result?contractId=${contractId}&orderId=${order.id}`}
            >
              이 주문 결과 보기
            </Link>
          )}
          {result && client && (
            <Link to={`/contracts/${contractId}/payment`}>
              계약 결제로 돌아가기
            </Link>
          )}
          <Link to={`/workspace/${query.data.contract.requestId}`}>
            같은 작업 공간으로 돌아가기
          </Link>
          <details>
            <summary>주문 이력</summary>
            {orders.map((o) => (
              <p key={o.id}>
                {o.id} · {labels[o.status]}
              </p>
            ))}
          </details>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>3-C 개발 전용 시나리오</summary>
        <Label htmlFor="payment-scenario">Mock 결제 응답</Label>
        <select
          id="payment-scenario"
          defaultValue="success"
          disabled={busy}
          onChange={async (e) => {
            await fetch("/__mock__/payments/scenario", {
              method: "POST",
              body: e.target.value,
            });
          }}
        >
          {[
            "success",
            "failed",
            "cancel",
            "unknown",
            "mismatch",
            "settled",
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
