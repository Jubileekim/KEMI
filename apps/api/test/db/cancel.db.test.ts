import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCancelService } from "../../src/cancel/cancel.service.js";
import type { TossClient, TossOutcome } from "../../src/payments/toss.js";
import { auth, type Party, signedDeal, signup } from "../support/deal.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// 가짜 Toss. 환불(cancel)·조회 응답을 테스트마다 정한다.
const cancel = vi.fn<TossClient["cancel"]>();
const getByOrderId = vi.fn<TossClient["getByOrderId"]>();
const fakeToss: TossClient = { confirm: vi.fn(), getByOrderId, cancel };

let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  cancel.mockReset();
  getByOrderId.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  app = createTestApp({
    prisma,
    cancelService: createCancelService({ prisma, toss: fakeToss }),
  });
});

const post = (token: string, path: string, body: object = {}) =>
  request(app).post(path).set(auth(token)).send(body);

async function deliverableFile(owner: Party, workRequestId: string) {
  const file = await prisma.file.create({
    data: {
      ownerId: owner.userId,
      purpose: "DELIVERABLE",
      mimeType: "video/mp4",
      fileName: "half.mp4",
      sizeBytes: 1024n,
      storagePath: `test/${randomUUID()}.mp4`,
      status: "READY",
      workRequestId: BigInt(workRequestId),
      completedAt: new Date(),
    },
  });
  return file.id.toString();
}

// 결제 완료 후 제작을 시작한 20만원 거래
async function startedDeal() {
  const deal = await signedDeal(app, prisma, { paid: true });
  await prisma.productionMaterial.create({
    data: {
      contractId: BigInt(deal.contractId),
      kind: "NOTE",
      note: "자료 전달 완료",
      status: "CONFIRMED",
      confirmedAt: new Date(),
      submittedBy: deal.client.userId,
    },
  });
  await post(
    deal.creator.token,
    `/api/contracts/${deal.contractId}/production/start`,
  );
  const payment = await prisma.payment.findFirstOrThrow({
    where: { contractId: BigInt(deal.contractId) },
  });
  const base = `/api/contracts/${deal.contractId}`;
  return { ...deal, payment, base };
}

const partiallyCanceled = (
  orderId: string,
  balanceAmount: number,
): TossOutcome => ({
  kind: "payment",
  payment: {
    paymentKey: "pk",
    orderId,
    status: "PARTIAL_CANCELED",
    totalAmount: 200_000,
    balanceAmount,
  },
});

describe("취소 합의·부분 환불 (CANCEL·REFUND)", () => {
  it("20만원 결제·대가 8만원 합의: 환불 12만원, 인도 파일 확인 뒤 수수료 8천원·모의 정산 7만2천원", async () => {
    const deal = await startedDeal();
    const { client, creator, base } = deal;
    const half = await deliverableFile(creator, deal.workRequestId);
    const proposal = {
      reason: "행사 일정이 취소되었습니다.",
      completedWorkKrw: 80_000,
      refundKrw: 120_000,
      deliveredFileIds: [half],
      unfinishedState: "컷 편집까지 완료, 자막 전",
      usageRights: "가족 내 개인 보관",
    };

    // 대가 + 환불 = 원결제가 아니면 거절한다.
    expect(
      (
        await post(client.token, `${base}/cancellations`, {
          ...proposal,
          refundKrw: 100_000,
        })
      ).status,
    ).toBe(400);
    const proposed = await post(
      client.token,
      `${base}/cancellations`,
      proposal,
    );
    expect(proposed.status).toBe(201);
    expect(proposed.body).toMatchObject({ paidKrw: 200_000 });
    const cancellationId = proposed.body.cancellations[0].id;

    // 제안자는 직접 승인할 수 없다.
    expect(
      (
        await post(
          client.token,
          `${base}/cancellations/${cancellationId}/accept`,
        )
      ).status,
    ).toBe(403);

    cancel.mockResolvedValueOnce(
      partiallyCanceled(deal.payment.orderId, 80_000),
    );
    const accepted = await post(
      creator.token,
      `${base}/cancellations/${cancellationId}/accept`,
    );
    expect(accepted.status).toBe(200);
    expect(cancel).toHaveBeenCalledWith({
      paymentKey: deal.payment.paymentKey,
      cancelAmount: 120_000,
      cancelReason: "KEMI 취소 합의",
      idempotencyKey: `refund-${cancellationId}-1`,
    });
    expect(accepted.body).toMatchObject({
      contractStatus: "CANCELED",
      settlementHold: "인도 파일 수령 확인 전",
      cancellations: [
        {
          status: "ACCEPTED",
          refund: { status: "SUCCEEDED", amountKrw: 120_000 },
        },
      ],
    });
    // 같은 제안을 다시 승인할 수 없고(중복 환불 없음), 취소된 거래는 납품·리뷰를 받지 않는다.
    expect(
      (
        await post(
          creator.token,
          `${base}/cancellations/${cancellationId}/accept`,
        )
      ).status,
    ).toBe(409);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(
      (
        await post(creator.token, `${base}/deliverables`, {
          commandId: randomUUID(),
          kind: "REVIEW",
          fileIds: [half],
        })
      ).status,
    ).toBe(409);
    expect(await prisma.settlement.count()).toBe(0);

    // 크리에이터는 인도 확인을 할 수 없고, 의뢰인이 확인하면 잔여 대가를 정산한다.
    expect((await post(creator.token, `${base}/handover/confirm`)).status).toBe(
      403,
    );
    const confirmed = await post(client.token, `${base}/handover/confirm`);
    expect(confirmed.body.settlementHold).toBeNull();
    const settlement = await request(app)
      .get(`${base}/delivery`)
      .set(auth(creator.token));
    expect(settlement.body).toMatchObject({
      productionStatus: "CANCELED",
      canReview: false,
      settlement: { grossKrw: 80_000, feeKrw: 8_000, payoutKrw: 72_000 },
    });
    expect(
      await prisma.notification.count({
        where: { eventType: "REFUND_SUCCEEDED" },
      }),
    ).toBe(2);
  });

  it("미결제 계약 취소는 환불 없이 끝나고, 이후 결제를 만들 수 없다", async () => {
    const deal = await signedDeal(app, prisma);
    const base = `/api/contracts/${deal.contractId}`;
    expect(
      (
        await post(deal.creator.token, `${base}/cancellations`, {
          reason: "일정이 맞지 않습니다.",
          completedWorkKrw: 10_000,
          refundKrw: 0,
        })
      ).status,
    ).toBe(400);
    const proposed = await post(deal.creator.token, `${base}/cancellations`, {
      reason: "일정이 맞지 않습니다.",
      completedWorkKrw: 0,
      refundKrw: 0,
    });
    const accepted = await post(
      deal.client.token,
      `${base}/cancellations/${proposed.body.cancellations[0].id}/accept`,
    );
    expect(accepted.body).toMatchObject({
      contractStatus: "CANCELED",
      paidKrw: 0,
      cancellations: [{ status: "ACCEPTED", refund: null }],
    });
    expect(cancel).not.toHaveBeenCalled();
    expect(await prisma.settlement.count()).toBe(0);
  });

  it("환불이 거절되면 새 시도로 다시 요청하고, 결과 불명확이면 조회로 맞춘다", async () => {
    const deal = await startedDeal();
    const { client, creator, base } = deal;
    const proposed = await post(client.token, `${base}/cancellations`, {
      reason: "취소합니다.",
      completedWorkKrw: 0,
      refundKrw: 200_000,
    });
    const { id } = proposed.body.cancellations[0];
    cancel.mockResolvedValueOnce({
      kind: "rejected",
      httpStatus: 400,
      code: "NOT_CANCELABLE_AMOUNT",
      message: "취소 할 수 없는 금액 입니다.",
    });
    const failed = await post(
      creator.token,
      `${base}/cancellations/${id}/accept`,
    );
    expect(failed.body.cancellations[0].refund).toMatchObject({
      status: "FAILED",
      failureCode: "NOT_CANCELABLE_AMOUNT",
      attempt: 1,
    });
    expect(failed.body.settlementHold).toBe("환불 처리 중");

    cancel.mockResolvedValueOnce({ kind: "unavailable" });
    const unknown = await post(client.token, `${base}/refund/retry`);
    expect(unknown.body.cancellations[0].refund).toMatchObject({
      status: "UNKNOWN",
      attempt: 2,
    });
    expect(cancel).toHaveBeenLastCalledWith(
      expect.objectContaining({ idempotencyKey: `refund-${id}-2` }),
    );
    // 결과를 모르는 동안에는 재시도할 수 없다(중복 환불 방지).
    expect((await post(client.token, `${base}/refund/retry`)).status).toBe(409);

    getByOrderId.mockResolvedValueOnce({
      kind: "payment",
      payment: {
        paymentKey: "pk",
        orderId: deal.payment.orderId,
        status: "CANCELED",
        totalAmount: 200_000,
        balanceAmount: 0,
      },
    });
    const synced = await post(client.token, `${base}/refund/sync`);
    expect(synced.body.cancellations[0].refund.status).toBe("SUCCEEDED");
    // 대가 0원이면 정산할 것이 없다.
    expect(synced.body.settlementHold).toBe("정산할 대가 없음");
  });
});

describe("분쟁·운영 (DISPUTE·OPS)", () => {
  it("분쟁 중에는 수령 확인 뒤에도 정산하지 않고, 운영자가 근거를 남기고 닫으면 정산이 이어진다", async () => {
    const deal = await startedDeal();
    const { client, creator, base } = deal;
    const admin = await signup(app, "CLIENT", 9);
    await prisma.user.update({
      where: { id: admin.userId },
      data: { role: "ADMIN" },
    });

    const opened = await post(creator.token, `${base}/disputes`, {
      reason: "자료가 계약과 다르게 왔습니다.",
    });
    expect(opened.status).toBe(201);
    const disputeId = opened.body.disputes[0].id;
    expect(
      (await post(client.token, `${base}/disputes`, { reason: "중복" })).status,
    ).toBe(409);
    // 상대방도 증빙을 낼 수 있다.
    expect(
      (
        await post(client.token, `${base}/disputes/${disputeId}/evidence`, {
          note: "계약서대로 보냈습니다.",
        })
      ).status,
    ).toBe(201);

    // 분쟁 중에도 납품·수령 확인은 되지만 정산은 보류된다.
    const file = async () => deliverableFile(creator, deal.workRequestId);
    const review = await post(creator.token, `${base}/deliverables`, {
      commandId: randomUUID(),
      kind: "REVIEW",
      fileIds: [await file()],
    });
    await post(
      client.token,
      `${base}/deliverables/${review.body.deliverables[0].id}/approve`,
    );
    const final = await post(creator.token, `${base}/deliverables`, {
      commandId: randomUUID(),
      kind: "FINAL",
      fileIds: [await file()],
    });
    const received = await post(
      client.token,
      `${base}/deliverables/${final.body.deliverables[1].id}/receive`,
    );
    expect(received.body).toMatchObject({
      productionStatus: "DELIVERED",
      settlement: null,
    });

    // 운영자만 처리하고, 처리 근거가 남는다.
    expect(
      (
        await post(client.token, `/api/admin/disputes/${disputeId}/resolve`, {
          reason: "확인",
        })
      ).status,
    ).toBe(403);
    const list = await request(app)
      .get("/api/admin/disputes")
      .set(auth(admin.token));
    expect(list.body.items[0].evidence).toHaveLength(2);
    const resolved = await post(
      admin.token,
      `/api/admin/disputes/${disputeId}/resolve`,
      { reason: "양측 증빙 확인 결과 계약대로 진행합니다." },
    );
    expect(resolved.body).toMatchObject({
      status: "RESOLVED",
      resolvedBy: String(admin.userId),
    });
    const records = await request(app)
      .get("/api/admin/operation-records")
      .set(auth(admin.token));
    expect(records.body.items[0]).toMatchObject({
      targetType: "DISPUTE",
      targetId: disputeId,
      action: "RESOLVE",
    });
    const after = await request(app)
      .get(`${base}/delivery`)
      .set(auth(client.token));
    expect(after.body).toMatchObject({
      productionStatus: "COMPLETED",
      settlement: { feeKrw: 20_000, payoutKrw: 180_000 },
    });
  });
});
