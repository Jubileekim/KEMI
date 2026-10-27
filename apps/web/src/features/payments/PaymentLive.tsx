import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import type { PaymentOrder } from "@kemi/shared";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import { kemi, newCommandId } from "../../shared/api/kemi";
import { dateTime, label, paymentStatusLabels, won } from "../live/labels";
import { Card, Facts, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import {
  mountTossWidgets,
  openTossPayment,
  requestWidgetPayment,
  tossReady,
  tossWidgetMode,
  type TossWidgets,
} from "./toss";

function OrderRow({ order }: { order: PaymentOrder }) {
  return (
    <li className="flex flex-wrap items-center gap-3">
      <Badge variant="secondary">
        {label(paymentStatusLabels, order.status)}
      </Badge>
      <span>{won(order.amountKrw)}</span>
      <span className="text-muted-foreground">{dateTime(order.createdAt)}</span>
      {order.failureMessage && (
        <span className="text-muted-foreground">{order.failureMessage}</span>
      )}
    </li>
  );
}

// PAY-01·02: 계약 전액 테스트 결제(Toss Sandbox). 실제 돈은 나가지 않는다.
function Checkout({ contractId }: { contractId: string }) {
  const client = useQueryClient();
  const key = ["payments", contractId];
  const payments = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => kemi.payments(contractId, signal),
  });
  const [commandId] = useState(newCommandId);
  // 결제위젯(test_gck_)은 결제 수단·약관을 화면에 먼저 그린다.
  const widgets = useRef<TossWidgets | null>(null);
  const [widgetError, setWidgetError] = useState("");
  const amount = payments.data?.contract.amountKrw;
  const showWidget =
    tossWidgetMode &&
    !!payments.data &&
    !payments.data.items.some(
      (p) => p.status === "SUCCEEDED" || p.status === "UNKNOWN",
    );
  useEffect(() => {
    if (!showWidget || !amount || widgets.current) return;
    mountTossWidgets(amount, "#toss-methods", "#toss-agreement")
      .then((mounted) => {
        widgets.current = mounted;
      })
      .catch(() =>
        setWidgetError("결제 수단을 불러오지 못했어요. 새로고침해 주세요."),
      );
  }, [showWidget, amount]);
  const start = useMutation({
    mutationFn: async (existing?: PaymentOrder) => {
      if (tossWidgetMode && !widgets.current)
        throw new Error(
          "결제 수단을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.",
        );
      const order =
        existing ?? (await kemi.createPayment(contractId, commandId));
      if (widgets.current)
        await requestWidgetPayment(widgets.current, { ...order, contractId });
      else await openTossPayment({ ...order, contractId });
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  const sync = useMutation({
    mutationFn: (orderId: string) => kemi.syncPayment(orderId),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  if (payments.isPending)
    return <Loading text="결제 정보를 불러오고 있어요." />;
  if (payments.error) return <Failure error={payments.error} />;
  const { contract, items } = payments.data;
  const paid = items.find((p) => p.status === "SUCCEEDED");
  const open = items.find(
    (p) => p.status === "READY" || p.status === "UNKNOWN",
  );
  return (
    <>
      <h1 className="type-heading-lg">테스트 결제</h1>
      <Card title="결제할 금액">
        <Facts items={[["계약 금액", won(contract.amountKrw)]]} />
        <p className="text-muted-foreground">
          Toss 테스트 환경 결제예요. 실제 돈은 나가지 않아요.
        </p>
        {paid && (
          <p role="status">결제가 완료됐어요. 제작 준비를 시작할 수 있어요.</p>
        )}
        {showWidget && (
          <div className="grid gap-3">
            <div id="toss-methods" />
            <div id="toss-agreement" />
            {widgetError && <p role="alert">{widgetError}</p>}
          </div>
        )}
        {!paid && !open && (
          <Button
            disabled={!tossReady || start.isPending}
            onClick={() => start.mutate(undefined)}
          >
            테스트 결제하기
          </Button>
        )}
        {!paid && open?.status === "READY" && (
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!tossReady || start.isPending}
              onClick={() => start.mutate(open)}
            >
              결제 계속하기
            </Button>
            <Button
              variant="outline"
              disabled={sync.isPending}
              onClick={() => sync.mutate(open.orderId)}
            >
              결제 상태 확인
            </Button>
          </div>
        )}
        {!paid && open?.status === "UNKNOWN" && (
          <div className="grid gap-3">
            <p role="status">
              결제 결과를 확인하고 있어요. 확인이 끝나기 전에는 새로 결제할 수
              없어요.
            </p>
            <Button
              variant="outline"
              disabled={sync.isPending}
              onClick={() => sync.mutate(open.orderId)}
            >
              결제 결과 다시 확인
            </Button>
          </div>
        )}
        {!tossReady && (
          <p role="alert">
            테스트 결제 키(VITE_TOSS_CLIENT_KEY)가 설정되지 않았어요.
          </p>
        )}
        {(start.error ?? sync.error) && (
          <p role="alert">
            {errorText(
              start.error ?? sync.error,
              start.error instanceof Error
                ? start.error.message
                : "결제를 시작하지 못했어요.",
            )}
          </p>
        )}
      </Card>
      {items.length > 0 && (
        <Card title="결제 기록">
          <ul className="grid gap-2">
            {items.map((order) => (
              <OrderRow key={order.orderId} order={order} />
            ))}
          </ul>
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        {paid && (
          <Button asChild>
            <Link to={`/contracts/${contractId}/production`}>제작 준비로</Link>
          </Button>
        )}
      </div>
    </>
  );
}

// Toss에서 돌아온 결과. successUrl 값은 서버 승인 전까지 결과가 아니고, failUrl 값도 서버가 조회로 확인한다.
function Result({ contractId }: { contractId: string }) {
  const [params] = useSearchParams();
  const client = useQueryClient();
  const sent = useRef(false);
  const outcome = params.get("outcome");
  const orderId = params.get("orderId") ?? "";
  const finish = useMutation({
    mutationFn: () =>
      outcome === "success"
        ? kemi.confirmPayment({
            paymentKey: params.get("paymentKey") ?? "",
            orderId,
            amount: Number(params.get("amount")),
          })
        : kemi.failPayment(orderId, {
            code: params.get("code") ?? "UNKNOWN",
            message: params.get("message") ?? undefined,
          }),
    onSettled: () =>
      client.invalidateQueries({ queryKey: ["payments", contractId] }),
  });
  useEffect(() => {
    if (sent.current || !orderId) return;
    sent.current = true;
    finish.mutate();
  }, [finish, orderId]);
  return (
    <>
      <h1 className="type-heading-lg">결제 결과</h1>
      <Card>
        {finish.isPending && (
          <p role="status">결제 결과를 서버에서 확인하고 있어요.</p>
        )}
        {finish.data && (
          <p role="status">
            {finish.data.status === "SUCCEEDED"
              ? "결제가 완료됐어요."
              : `결제 상태: ${label(paymentStatusLabels, finish.data.status)}`}
          </p>
        )}
        {finish.error && (
          <p role="alert">
            {errorText(finish.error, "결제 결과를 확인하지 못했어요.")}
          </p>
        )}
        {!orderId && <p role="alert">결제 주문 정보가 없어요.</p>}
        <Button asChild>
          <Link to={`/contracts/${contractId}/payment`}>결제 화면으로</Link>
        </Button>
      </Card>
    </>
  );
}

export default function PaymentLive({
  contractId,
  result,
}: {
  contractId: string;
  result: boolean;
}) {
  return result ? (
    <Result contractId={contractId} />
  ) : (
    <Checkout contractId={contractId} />
  );
}
