// Toss Payments 결제창 SDK(v2 standard). 테스트 클라이언트 키(test_ck_ 또는 test_gck_)만 쓴다.
// 결제 승인은 서버가 한다(브라우저가 돌려받은 값은 서버 확인 전까지 결과가 아니다).

const SDK_URL = "https://js.tosspayments.com/v2/standard";

interface TossPaymentRequest {
  method: "CARD";
  amount: { currency: "KRW"; value: number };
  orderId: string;
  orderName: string;
  successUrl: string;
  failUrl: string;
}
interface TossPaymentsInstance {
  payment: (options: { customerKey: string }) => {
    requestPayment: (request: TossPaymentRequest) => Promise<void>;
  };
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

export async function openTossPayment(order: {
  orderId: string;
  orderName: string;
  amountKrw: number;
  contractId: string;
}) {
  if (!tossReady) throw new Error("테스트 결제 키가 설정되지 않았어요.");
  const factory = await loadSdk();
  const result = `${window.location.origin}/payments/result?contractId=${encodeURIComponent(order.contractId)}`;
  await factory(tossClientKey)
    .payment({ customerKey: factory.ANONYMOUS })
    .requestPayment({
      method: "CARD",
      amount: { currency: "KRW", value: order.amountKrw },
      orderId: order.orderId,
      orderName: order.orderName,
      successUrl: `${result}&outcome=success`,
      failUrl: `${result}&outcome=fail`,
    });
}
