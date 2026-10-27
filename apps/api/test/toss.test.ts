import { describe, expect, it, vi } from "vitest";
import { createTossClient } from "../src/payments/toss.js";

const PAYMENT = {
  paymentKey: "pk_test",
  orderId: "11111111-1111-4111-8111-111111111111",
  status: "DONE",
  totalAmount: 45_000,
  approvedAt: "2026-10-26T10:00:00+09:00",
  method: "카드",
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("Toss 클라이언트", () => {
  it("승인은 Basic 인증(시크릿 키 + 콜론)·멱등 키·본문으로 부른다", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(200, PAYMENT));
    const client = createTossClient({ secretKey: "test_sk_abc", fetchFn });
    const outcome = await client.confirm({
      paymentKey: "pk_test",
      orderId: PAYMENT.orderId,
      amount: 45_000,
      idempotencyKey: `confirm-${PAYMENT.orderId}`,
    });
    expect(outcome).toEqual({ kind: "payment", payment: PAYMENT });

    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("test_sk_abc:").toString("base64")}`,
      "Idempotency-Key": `confirm-${PAYMENT.orderId}`,
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      paymentKey: "pk_test",
      orderId: PAYMENT.orderId,
      amount: 45_000,
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("주문 번호로 조회한다", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => jsonResponse(200, PAYMENT));
    const client = createTossClient({ secretKey: "test_sk_abc", fetchFn });
    await client.getByOrderId(PAYMENT.orderId);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(
      `https://api.tosspayments.com/v1/payments/orders/${PAYMENT.orderId}`,
    );
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it("부분 취소는 결제 키 경로·멱등 키·취소 금액으로 부르고, 남은 금액을 읽는다", async () => {
    const canceled = {
      ...PAYMENT,
      status: "PARTIAL_CANCELED",
      balanceAmount: 25_000,
    };
    const fetchFn = vi.fn<typeof fetch>(async () =>
      jsonResponse(200, canceled),
    );
    const client = createTossClient({ secretKey: "test_sk_abc", fetchFn });
    const outcome = await client.cancel({
      paymentKey: "pk_test",
      cancelAmount: 20_000,
      cancelReason: "KEMI 취소 합의",
      idempotencyKey: "refund-1-1",
    });
    expect(outcome).toEqual({ kind: "payment", payment: canceled });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/pk_test/cancel");
    expect(init?.headers).toMatchObject({ "Idempotency-Key": "refund-1-1" });
    expect(JSON.parse(String(init?.body))).toEqual({
      cancelAmount: 20_000,
      cancelReason: "KEMI 취소 합의",
    });
  });

  it("4xx 오류 코드는 거절, 5xx·네트워크 오류·잘못된 본문은 결과 불명확으로 나눈다", async () => {
    const outcomes = await Promise.all(
      [
        async () =>
          jsonResponse(403, {
            code: "REJECT_CARD_PAYMENT",
            message: "한도 초과",
          }),
        async () =>
          jsonResponse(500, {
            code: "FAILED_INTERNAL_SYSTEM_PROCESSING",
            message: "내부 오류",
          }),
        async () => {
          throw new TypeError("fetch failed");
        },
        async () => jsonResponse(200, { unexpected: true }),
        async () => new Response("not json", { status: 400 }),
      ].map((impl) =>
        createTossClient({
          secretKey: "test_sk_abc",
          fetchFn: vi.fn<typeof fetch>(impl),
        }).confirm({
          paymentKey: "pk",
          orderId: PAYMENT.orderId,
          amount: 1,
          idempotencyKey: "k",
        }),
      ),
    );
    expect(outcomes).toEqual([
      {
        kind: "rejected",
        httpStatus: 403,
        code: "REJECT_CARD_PAYMENT",
        message: "한도 초과",
      },
      { kind: "unavailable" },
      { kind: "unavailable" },
      { kind: "unavailable" },
      { kind: "unavailable" },
    ]);
  });

  it("오류 로그에 시크릿 키를 남기지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = createTossClient({
      secretKey: "test_sk_secret-value",
      fetchFn: vi.fn<typeof fetch>(async () =>
        jsonResponse(401, { code: "UNAUTHORIZED_KEY", message: "키 오류" }),
      ),
    });
    await client.getByOrderId(PAYMENT.orderId);
    const logged = JSON.stringify(warn.mock.calls);
    warn.mockRestore();
    expect(logged).toContain("UNAUTHORIZED_KEY");
    expect(logged).not.toContain("secret-value");
    expect(logged).not.toContain(
      Buffer.from("test_sk_secret-value:").toString("base64"),
    );
  });
});
