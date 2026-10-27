// Toss Payments 결제 SDK(v2 standard). 테스트 클라이언트 키만 쓴다.
// - test_ck_: 결제창(API 개별 연동) — 버튼을 누르면 Toss 결제창이 열린다.
// - test_gck_: 결제위젯 — 화면 안에 결제 수단·약관을 그리고 그 자리에서 결제를 요청한다.
// 결제 승인은 서버가 한다(브라우저가 돌려받은 값은 서버 확인 전까지 결과가 아니다).

const SDK_URL = "https://js.tosspayments.com/v2/standard";

interface PaymentRequest {
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
}
interface Amount {
  currency: "KRW";
  value: number;
}
export interface TossWidgets {
  setAmount: (amount: Amount) => Promise<void>;
  renderPaymentMethods: (options: {
    selector: string;
    variantKey?: string;
  }) => Promise<unknown>;
  renderAgreement: (options: {
    selector: string;
    variantKey?: string;
  }) => Promise<unknown>;
  requestPayment: (request: PaymentRequest) => Promise<void>;
}
interface TossPaymentsInstance {
  payment: (options: { customerKey: string }) => {
    requestPayment: (
      request: PaymentRequest & { method: "CARD"; amount: Amount },
    ) => Promise<void>;
  };
  widgets: (options: { customerKey: string }) => TossWidgets;
}
interface TossPaymentsFactory {
  (clientKey: string): TossPaymentsInstance;
  ANONYMOUS: string;
}
declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

export const tossClientKey: string = import.meta.env.VITE_TOSS_CLIENT_KEY ?? "";
export const tossWidgetMode = /^test_gck_/.test(tossClientKey);
export const tossReady = /^test_g?ck_/.test(tossClientKey);

let loading: Promise<TossPaymentsFactory> | undefined;
function loadSdk(): Promise<TossPaymentsFactory> {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () =>
      window.TossPayments
        ? resolve(window.TossPayments)
        : reject(new Error("결제 모듈을 불러오지 못했어요."));
    script.onerror = () => {
      loading = undefined;
      reject(new Error("결제 모듈을 불러오지 못했어요."));
    };
    document.head.append(script);
  });
  return loading;
}

const returnUrls = (contractId: string) => {
  const base = `${window.location.origin}/payments/result?contractId=${encodeURIComponent(contractId)}`;
  return {
    successUrl: `${base}&outcome=success`,
    failUrl: `${base}&outcome=fail`,
  };
};

// 결제창(test_ck_)
export async function openTossPayment(order: {
  orderId: string;
  orderName: string;
  amountKrw: number;
  contractId: string;
}) {
  if (!tossReady || tossWidgetMode)
    throw new Error("결제창용 테스트 클라이언트 키(test_ck_)가 필요해요.");
  const factory = await loadSdk();
  await factory(tossClientKey)
    .payment({ customerKey: factory.ANONYMOUS })
    .requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: order.amountKrw },
      orderId: order.orderId,
      orderName: order.orderName,
      ...returnUrls(order.contractId),
    });
}

// 결제위젯(test_gck_): 결제 수단·약관을 화면에 그린다.
export async function mountTossWidgets(
  amountKrw: number,
  methodsSelector: string,
  agreementSelector: string,
) {
  const factory = await loadSdk();
  const widgets = factory(tossClientKey).widgets({
    customerKey: factory.ANONYMOUS,
  });
  await widgets.setAmount({ currency: "KRW", value: amountKrw });
  await Promise.all([
    widgets.renderPaymentMethods({ selector: methodsSelector }),
    widgets.renderAgreement({ selector: agreementSelector }),
  ]);
  return widgets;
}

export function requestWidgetPayment(
  widgets: TossWidgets,
  order: { orderId: string; orderName: string; contractId: string },
) {
  return widgets.requestPayment({
    orderId: order.orderId,
    orderName: order.orderName,
    ...returnUrls(order.contractId),
  });
}
