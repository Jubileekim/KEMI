import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPaymentService } from "../../src/payments/payment.service.js";
import type { TossClient, TossOutcome } from "../../src/payments/toss.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

const DAY_MS = 24 * 60 * 60 * 1000;
const AMOUNT = 45_000;

// 가짜 Toss. 테스트마다 승인·조회 응답을 정한다.
const confirm = vi.fn<TossClient["confirm"]>();
const getByOrderId = vi.fn<TossClient["getByOrderId"]>();
const fakeToss: TossClient = { confirm, getByOrderId };

let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  confirm.mockReset();
  getByOrderId.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  app = createTestApp({
    prisma,
    paymentService: createPaymentService({ prisma, toss: fakeToss }),
  });
});

async function signup(role: "CLIENT" | "CREATOR", index = 1) {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({
      email: `${role.toLowerCase()}-${index}@example.com`,
      password: "correct-horse-battery",
      name: `${role} ${index}`,
      role,
    });
  expect(res.status).toBe(201);
  return {
    token: String(res.body.accessToken),
    userId: BigInt(String(res.body.user.id)),
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const TERMS = {
  amountKrw: AMOUNT,
  specification: "1분 성장영상 1편",
  scope: "사진·클립 편집, 자막",
  materials: "사진 30장",
  deadline: "자료를 받은 날부터 5일",
  revisions: "2회",
  usageRights: "가족 행사 상영",
  cancellation: "제작 시작 전 전액 환불",
};

// 지원 → 선정 → 조건서 저장 → 서명 요청 → 양측 서명으로 계약까지 만든다.
async function signedContract() {
  const client = await signup("CLIENT");
  const creator = await signup("CREATOR");
  const recruitmentEndAt = new Date(Date.now() + 3 * DAY_MS);
  const project = await prisma.project.create({
    data: {
      clientId: client.userId,
      title: "돌잔치 성장영상",
      description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
      purpose: VIDEO_PURPOSES[0],
      styles: [VIDEO_STYLES[0]],
      budget: 50_000n,
      recruitmentEndAt,
      deliveryDueDate: new Date(recruitmentEndAt.getTime() + 7 * DAY_MS),
    },
  });
  const applied = await request(app)
    .post(`/api/projects/${project.id}/applications`)
    .set(auth(creator.token))
    .send({
      message: "감성적인 성장영상을 3일 안에 만들어 드릴게요.",
      proposedAmount: AMOUNT,
      expectedDays: 3,
    });
  const requestId = String(applied.body.id);
  await request(app)
    .post(`/api/applications/${requestId}/accept`)
    .set(auth(client.token));
  await request(app)
    .post(`/api/work-requests/${requestId}/terms/versions`)
    .set(auth(client.token))
    .send({ commandId: randomUUID(), baseVersionNo: 0, values: TERMS });
  const signing = await request(app)
    .post(`/api/work-requests/${requestId}/terms/versions/1/signing`)
    .set(auth(client.token));
  const termsHash = String(signing.body.termsHash);
  const signs = await Promise.all(
    [creator.token, client.token].map(async (token, index) => {
      // 서명 순서를 고정한다(두 번째 서명이 계약을 만든다).
      if (index === 1) await sleep(50);
      return request(app)
        .post(`/api/work-requests/${requestId}/terms/versions/1/signatures`)
        .set(auth(token))
        .send({ signerName: "서명자", consent: true, termsHash });
    }),
  );
  const contractId = String(signs[1]?.body.contract.id);
  expect(contractId).toMatch(/^\d+$/);
  return { client, creator, contractId };
}

const createOrder = (
  token: string,
  contractId: string,
  commandId = randomUUID(),
) =>
  request(app)
    .post(`/api/contracts/${contractId}/payments`)
    .set(auth(token))
    .send({ commandId });

const confirmOrder = (
  token: string,
  orderId: string,
  { amount = AMOUNT, paymentKey = "pk_test_1" } = {},
) =>
  request(app)
    .post("/api/payments/confirm")
    .set(auth(token))
    .send({ paymentKey, orderId, amount });

const sync = (token: string, orderId: string) =>
  request(app).post(`/api/payments/${orderId}/sync`).set(auth(token));

const done = (orderId: string, overrides: object = {}): TossOutcome => ({
  kind: "payment",
  payment: {
    paymentKey: "pk_test_1",
    orderId,
    status: "DONE",
    totalAmount: AMOUNT,
    approvedAt: "2026-10-26T10:00:00+09:00",
    method: "카드",
    ...overrides,
  },
});

const orderOf = (orderId: string) =>
  prisma.payment.findUniqueOrThrow({ where: { orderId } });

describe("결제 주문 (PAY-01)", () => {
  it("의뢰인이 계약 전액으로 주문을 만들고, 같은 요청의 재전송은 기존 주문을 준다", async () => {
    const { client, creator, contractId } = await signedContract();
    const commandId = randomUUID();
    const res = await createOrder(client.token, contractId, commandId);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      orderId: commandId,
      contractId,
      amountKrw: AMOUNT,
      orderName: "돌잔치 성장영상",
      status: "READY",
    });
    const again = await createOrder(client.token, contractId, commandId);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(res.body);

    const list = await request(app)
      .get(`/api/contracts/${contractId}/payments`)
      .set(auth(creator.token));
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      contract: { id: contractId, amountKrw: AMOUNT },
      items: [{ orderId: commandId, status: "READY" }],
    });
  });

  it("진행 중인 주문이 있으면 새 주문은 409, 크리에이터는 403, 당사자가 아니면 404", async () => {
    const { client, creator, contractId } = await signedContract();
    expect((await createOrder(client.token, contractId)).status).toBe(201);
    expect((await createOrder(client.token, contractId)).status).toBe(409);
    expect((await createOrder(creator.token, contractId)).status).toBe(403);
    const outsider = await signup("CLIENT", 9);
    expect((await createOrder(outsider.token, contractId)).status).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/contracts/${contractId}/payments`)
          .set(auth(outsider.token))
      ).status,
    ).toBe(404);
  });

  it("테스트 키가 없으면 주문·승인은 503이고 내역 조회는 된다", async () => {
    const { client, contractId } = await signedContract();
    app = createTestApp({ prisma });
    expect((await createOrder(client.token, contractId)).status).toBe(503);
    expect((await confirmOrder(client.token, randomUUID())).status).toBe(503);
    expect(
      (
        await request(app)
          .get(`/api/contracts/${contractId}/payments`)
          .set(auth(client.token))
      ).status,
    ).toBe(200);
  });
});

describe("결제 승인 (PAY-01)", () => {
  it("금액이 맞으면 Toss에 같은 멱등 키로 승인하고, 성공하면 크리에이터에게 알린다", async () => {
    const { client, creator, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce(done(orderId));

    const res = await confirmOrder(client.token, orderId);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "SUCCEEDED",
      method: "카드",
      approvedAt: "2026-10-26T01:00:00.000Z",
    });
    expect(confirm).toHaveBeenCalledWith({
      paymentKey: "pk_test_1",
      orderId,
      amount: AMOUNT,
      idempotencyKey: `confirm-${orderId}`,
    });
    expect(
      await prisma.notification.count({
        where: {
          recipientUserId: creator.userId,
          eventType: "PAYMENT_SUCCEEDED",
        },
      }),
    ).toBe(1);

    // 같은 승인의 재전송은 Toss를 다시 부르지 않는다. 결제가 끝나면 새 주문도 막힌다.
    const again = await confirmOrder(client.token, orderId);
    expect(again.status).toBe(200);
    expect(again.body.status).toBe("SUCCEEDED");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((await createOrder(client.token, contractId)).status).toBe(409);
  });

  it("복귀 금액이 주문 금액과 다르면 Toss를 부르지 않고 400", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    const res = await confirmOrder(client.token, orderId, { amount: 100 });
    expect(res.status).toBe(400);
    expect(confirm).not.toHaveBeenCalled();
    expect((await orderOf(orderId)).status).toBe("READY");
  });

  it("Toss가 거절하면 FAILED로 남고, 그 뒤에는 새 주문을 만들 수 있다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({
      kind: "rejected",
      httpStatus: 403,
      code: "REJECT_CARD_PAYMENT",
      message: "한도초과 혹은 잔액부족으로 결제에 실패했습니다.",
    });
    const res = await confirmOrder(client.token, orderId);
    expect(res.body).toMatchObject({
      status: "FAILED",
      failureCode: "REJECT_CARD_PAYMENT",
    });
    expect((await createOrder(client.token, contractId)).status).toBe(201);
  });

  it("응답을 받지 못하면 UNKNOWN으로 두고 새 주문을 막는다. 조회(sync)로 결과를 맞춘다", async () => {
    const { client, creator, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({ kind: "unavailable" });
    expect((await confirmOrder(client.token, orderId)).body.status).toBe(
      "UNKNOWN",
    );
    expect((await createOrder(client.token, contractId)).status).toBe(409);

    getByOrderId.mockResolvedValueOnce(done(orderId));
    const synced = await sync(creator.token, orderId);
    expect(synced.status).toBe(200);
    expect(synced.body.status).toBe("SUCCEEDED");
    expect(getByOrderId).toHaveBeenCalledWith(orderId);

    // 끝난 주문의 sync는 Toss를 다시 부르지 않는다.
    expect((await sync(client.token, orderId)).body.status).toBe("SUCCEEDED");
    expect(getByOrderId).toHaveBeenCalledTimes(1);
  });

  it("Toss가 DONE이어도 금액이나 주문 번호가 다르면 성공으로 인정하지 않는다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce(done(orderId, { totalAmount: 100 }));
    expect((await confirmOrder(client.token, orderId)).body.status).toBe(
      "UNKNOWN",
    );
    getByOrderId.mockResolvedValueOnce(done(randomUUID()));
    expect((await sync(client.token, orderId)).body.status).toBe("UNKNOWN");
  });

  it("이미 처리된 결제(ALREADY_PROCESSED_PAYMENT)면 Toss 조회 결과를 반영한다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({
      kind: "rejected",
      httpStatus: 400,
      code: "ALREADY_PROCESSED_PAYMENT",
      message: "이미 처리된 결제 입니다.",
    });
    getByOrderId.mockResolvedValueOnce(done(orderId));
    expect((await confirmOrder(client.token, orderId)).body.status).toBe(
      "SUCCEEDED",
    );
  });

  it("Toss 키 오류는 서버 설정 문제라 503이고 주문 상태는 그대로다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({
      kind: "rejected",
      httpStatus: 401,
      code: "UNAUTHORIZED_KEY",
      message: "인증되지 않은 시크릿 키 혹은 클라이언트 키 입니다.",
    });
    expect((await confirmOrder(client.token, orderId)).status).toBe(503);
    expect((await orderOf(orderId)).status).toBe("READY");
  });

  it("결과 불명확 주문을 조회했는데 결제 기록이 없으면 FAILED", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({ kind: "unavailable" });
    await confirmOrder(client.token, orderId);
    getByOrderId.mockResolvedValueOnce({
      kind: "rejected",
      httpStatus: 404,
      code: "NOT_FOUND_PAYMENT",
      message: "존재하지 않는 결제 정보 입니다.",
    });
    expect((await sync(client.token, orderId)).body).toMatchObject({
      status: "FAILED",
      failureCode: "NOT_FOUND_PAYMENT",
    });
  });

  it("같은 주문에 승인이 동시에 두 번 들어와도 Toss 승인은 한 번만 부른다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockImplementation(async () => {
      await sleep(100);
      return done(orderId);
    });
    const results = await Promise.all([
      confirmOrder(client.token, orderId),
      confirmOrder(client.token, orderId),
    ]);
    expect(results.map((r) => [r.status, r.body.status])).toEqual([
      [200, "SUCCEEDED"],
      [200, "SUCCEEDED"],
    ]);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("크리에이터는 승인할 수 없다", async () => {
    const { client, creator, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    expect((await confirmOrder(creator.token, orderId)).status).toBe(403);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("결제 취소·실패 기록", () => {
  const fail = (token: string, orderId: string, code: string) =>
    request(app)
      .post(`/api/payments/${orderId}/fail`)
      .set(auth(token))
      .send({ code, message: "사용자가 결제를 취소했습니다." });

  const notFound: TossOutcome = {
    kind: "rejected",
    httpStatus: 404,
    code: "NOT_FOUND_PAYMENT",
    message: "존재하지 않는 결제 정보 입니다.",
  };
  const inProgress = (orderId: string) =>
    done(orderId, { status: "IN_PROGRESS", approvedAt: null });

  it("Toss에 결제 기록이 없음을 확인해야 취소·실패로 닫고, 그 뒤에만 새 주문을 만든다", async () => {
    const { client, creator, contractId } = await signedContract();
    const first = (await createOrder(client.token, contractId)).body.orderId;
    expect(
      (await fail(creator.token, first, "PAY_PROCESS_CANCELED")).status,
    ).toBe(403);
    expect(getByOrderId).not.toHaveBeenCalled();

    getByOrderId.mockResolvedValueOnce(notFound);
    expect(
      (await fail(client.token, first, "PAY_PROCESS_CANCELED")).body,
    ).toMatchObject({
      status: "CANCELED",
      failureCode: "PAY_PROCESS_CANCELED",
    });
    expect(getByOrderId).toHaveBeenCalledWith(first);

    const second = (await createOrder(client.token, contractId)).body.orderId;
    getByOrderId.mockResolvedValueOnce(notFound);
    expect(
      (await fail(client.token, second, "PAY_PROCESS_ABORTED")).body.status,
    ).toBe("FAILED");

    // 결제창에서 끝난 미승인 결제(ABORTED)도 주문과 맞으면 닫는다.
    const third = (await createOrder(client.token, contractId)).body.orderId;
    getByOrderId.mockResolvedValueOnce(done(third, { status: "ABORTED" }));
    expect(
      (await fail(client.token, third, "REJECT_CARD_COMPANY")).body,
    ).toMatchObject({
      status: "FAILED",
      failureCode: "ABORTED",
    });

    const history = await request(app)
      .get(`/api/contracts/${contractId}/payments`)
      .set(auth(client.token));
    expect(history.body.items.map((o: { status: string }) => o.status)).toEqual(
      ["FAILED", "FAILED", "CANCELED"],
    );
  });

  it("조회가 안 되거나 아직 진행 중이면 UNKNOWN으로 묶어 새 주문을 막고, 늦은 승인은 조회로 반영한다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;

    getByOrderId.mockResolvedValueOnce({ kind: "unavailable" });
    expect(
      (await fail(client.token, orderId, "PAY_PROCESS_CANCELED")).body,
    ).toMatchObject({
      status: "UNKNOWN",
      failureCode: "PAY_PROCESS_CANCELED",
    });
    // fail 직후 새 주문(이중 결제 위험)은 막힌다.
    expect((await createOrder(client.token, contractId)).status).toBe(409);

    // 다시 fail이 와도 Toss가 진행 중이면 그대로 UNKNOWN이다.
    getByOrderId.mockResolvedValueOnce(inProgress(orderId));
    expect(
      (await fail(client.token, orderId, "PAY_PROCESS_CANCELED")).body.status,
    ).toBe("UNKNOWN");
    expect((await createOrder(client.token, contractId)).status).toBe(409);

    // 늦게 승인된 결제는 조회로 SUCCEEDED가 되고, 새 주문은 계속 막힌다.
    getByOrderId.mockResolvedValueOnce(done(orderId));
    expect((await sync(client.token, orderId)).body).toMatchObject({
      status: "SUCCEEDED",
      failureCode: null,
    });
    expect((await createOrder(client.token, contractId)).status).toBe(409);

    // 끝난 주문에 늦게 온 fail 콜백은 결과를 바꾸지 않는다(Toss도 다시 부르지 않는다).
    const calls = getByOrderId.mock.calls.length;
    expect(
      (await fail(client.token, orderId, "PAY_PROCESS_CANCELED")).body.status,
    ).toBe("SUCCEEDED");
    expect(getByOrderId).toHaveBeenCalledTimes(calls);
    expect(await prisma.payment.count()).toBe(1);
  });

  it("fail 조회 시점에 이미 승인됐으면 SUCCEEDED로 맞춘다", async () => {
    const { client, creator, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    getByOrderId.mockResolvedValueOnce(done(orderId));
    expect(
      (await fail(client.token, orderId, "PAY_PROCESS_CANCELED")).body.status,
    ).toBe("SUCCEEDED");
    expect(
      await prisma.notification.count({
        where: {
          recipientUserId: creator.userId,
          eventType: "PAYMENT_SUCCEEDED",
        },
      }),
    ).toBe(1);
  });

  it("fail과 승인이 동시에 들어와도 결제는 하나로 끝나고 새 주문은 막힌다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockImplementation(async () => {
      await sleep(100);
      return done(orderId);
    });
    getByOrderId.mockResolvedValue(inProgress(orderId));
    await Promise.all([
      confirmOrder(client.token, orderId),
      fail(client.token, orderId, "PAY_PROCESS_CANCELED"),
    ]);
    expect((await orderOf(orderId)).status).toBe("SUCCEEDED");
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((await createOrder(client.token, contractId)).status).toBe(409);
  });

  it("Toss 키가 없으면 조회할 수 없어 UNKNOWN으로 둔다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    app = createTestApp({
      prisma,
      paymentService: createPaymentService({ prisma }),
    });
    expect(
      (await fail(client.token, orderId, "PAY_PROCESS_CANCELED")).body.status,
    ).toBe("UNKNOWN");
  });
});

describe("결제사 조회 결과 검증", () => {
  it("부분 취소(PARTIAL_CANCELED)는 재결제를 열지 않고 UNKNOWN으로 보류한다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({ kind: "unavailable" });
    await confirmOrder(client.token, orderId);
    getByOrderId.mockResolvedValueOnce(
      done(orderId, { status: "PARTIAL_CANCELED" }),
    );
    expect((await sync(client.token, orderId)).body).toMatchObject({
      status: "UNKNOWN",
      failureCode: "PARTIAL_CANCELED",
    });
    expect((await createOrder(client.token, contractId)).status).toBe(409);
  });

  it("ABORTED·CANCELED여도 주문 번호·금액이 다르면 닫지 않는다", async () => {
    const { client, contractId } = await signedContract();
    const { orderId } = (await createOrder(client.token, contractId)).body;
    confirm.mockResolvedValueOnce({ kind: "unavailable" });
    await confirmOrder(client.token, orderId);

    getByOrderId.mockResolvedValueOnce(
      done(orderId, { status: "ABORTED", totalAmount: 100 }),
    );
    expect((await sync(client.token, orderId)).body).toMatchObject({
      status: "UNKNOWN",
      failureCode: "PG_ORDER_MISMATCH",
    });
    getByOrderId.mockResolvedValueOnce(
      done(randomUUID(), { status: "CANCELED" }),
    );
    expect((await sync(client.token, orderId)).body.status).toBe("UNKNOWN");
    expect((await createOrder(client.token, contractId)).status).toBe(409);

    // 같은 주문의 CANCELED만 닫는다.
    getByOrderId.mockResolvedValueOnce(done(orderId, { status: "CANCELED" }));
    expect((await sync(client.token, orderId)).body.status).toBe("CANCELED");
  });
});
