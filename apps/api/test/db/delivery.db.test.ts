import { randomUUID } from "node:crypto";
import type { FilePurpose } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, type Party, signedDeal, signup } from "../support/deal.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({ prisma });
});

const post = (token: string, path: string, body: object = {}) =>
  request(app).post(path).set(auth(token)).send(body);
const delivery = (token: string, contractId: string) =>
  request(app).get(`/api/contracts/${contractId}/delivery`).set(auth(token));

// 확인이 끝난(READY) 파일을 바로 만든다(업로드 흐름은 files 테스트에서 검증).
async function readyFile(
  owner: Party,
  purpose: FilePurpose,
  workRequestId: string,
) {
  const file = await prisma.file.create({
    data: {
      ownerId: owner.userId,
      purpose,
      mimeType: "video/mp4",
      fileName: "cut.mp4",
      sizeBytes: 1024n,
      storagePath: `test/${randomUUID()}.mp4`,
      status: "READY",
      workRequestId: BigInt(workRequestId),
      completedAt: new Date(),
    },
  });
  return file.id.toString();
}

// 결제·자료 확인을 마치고 제작을 시작한 거래
async function inProduction() {
  const deal = await signedDeal(app, prisma, { paid: true });
  await prisma.productionMaterial.create({
    data: {
      contractId: BigInt(deal.contractId),
      kind: "NOTE",
      note: "사진은 메일로 보냈습니다.",
      status: "CONFIRMED",
      confirmedAt: new Date(),
      submittedBy: deal.client.userId,
      commandId: randomUUID(),
    },
  });
  const started = await post(
    deal.creator.token,
    `/api/contracts/${deal.contractId}/production/start`,
  );
  expect(started.body.status).toBe("IN_PROGRESS");

  // 같은 commandId로 다시 보내면 같은 파일을 쓴다(진짜 재전송과 같게).
  const filesByCommand = new Map<string, string>();
  const submit = async (
    kind: "DRAFT" | "REVIEW" | "FINAL",
    commandId = randomUUID(),
  ) => {
    const fileId =
      filesByCommand.get(commandId) ??
      (await readyFile(deal.creator, "DELIVERABLE", deal.workRequestId));
    filesByCommand.set(commandId, fileId);
    return post(
      deal.creator.token,
      `/api/contracts/${deal.contractId}/deliverables`,
      { commandId, kind, fileIds: [fileId] },
    );
  };
  const revise = (
    deliverableId: string,
    type: "GENERAL" | "DRAFT_FEEDBACK" | "CONTRACT_FIX",
    body: object = {},
  ) =>
    post(
      deal.client.token,
      `/api/contracts/${deal.contractId}/deliverables/${deliverableId}/revision-requests`,
      {
        commandId: randomUUID(),
        type,
        items: [
          {
            position: "00:42",
            problem: "자막이 빨리 지나갑니다.",
            desired: "자막을 1초 더 보여주세요.",
          },
        ],
        ...body,
      },
    );
  const answer = (
    token: string,
    deliverableId: string,
    action: "approve" | "receive",
  ) =>
    post(
      token,
      `/api/contracts/${deal.contractId}/deliverables/${deliverableId}/${action}`,
    );
  const latestId = (body: { deliverables: { id: string }[] }) =>
    String(body.deliverables.at(-1)?.id);
  return { ...deal, submit, revise, answer, latestId };
}

describe("검토·수정·최종 수령 (DEL·REV)", () => {
  it("초안 의견·일반 수정·수정본·검토본 승인·최종본 수령까지, 일반 회차는 수정본 제출 때 한 번만 차감한다", async () => {
    const deal = await inProduction();
    const { client, creator, contractId } = deal;

    const draft = await deal.submit("DRAFT");
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({
      revisionLimit: 2,
      revisionsUsed: 0,
      revisionsRemaining: 2,
    });
    expect(draft.body.deliverables[0]).toMatchObject({
      versionNo: 1,
      kind: "DRAFT",
      status: "SUBMITTED",
    });

    // 초안에는 일반 수정을 쓸 수 없고 초안 의견만 남긴다(회차 차감 없음).
    const draftId = deal.latestId(draft.body);
    expect((await deal.revise(draftId, "GENERAL")).status).toBe(409);
    const feedback = await deal.revise(draftId, "DRAFT_FEEDBACK");
    expect(feedback.status).toBe(201);
    expect(feedback.body.revisionsRemaining).toBe(2);

    // 열린 요청에 대한 첫 검토본이 수정본이 된다.
    const review1 = await deal.submit("REVIEW");
    expect(review1.body.revisionRequests[0].status).toBe("RESOLVED");
    expect(review1.body.revisionsUsed).toBe(0);

    // 일반 수정: 요청 중에는 회차를 잡아 두고, 수정본 제출 때 완료된다.
    const general = await deal.revise(deal.latestId(review1.body), "GENERAL");
    expect(general.body).toMatchObject({
      revisionsUsed: 0,
      revisionsRemaining: 1,
    });

    // 수정본을 같은 요청 식별자로 다시 보내도 버전·회차는 한 번만 생긴다.
    const commandId = randomUUID();
    const review2 = await deal.submit("REVIEW", commandId);
    expect(review2.body).toMatchObject({
      revisionsUsed: 1,
      revisionsRemaining: 1,
    });
    const resent = await deal.submit("REVIEW", commandId);
    expect(resent.body.deliverables).toHaveLength(3);
    expect(resent.body.revisionsUsed).toBe(1);

    // 같은 식별자에 다른 내용(종류·파일·메모)은 409이고 새 버전을 만들지 않는다.
    const changedFile = await readyFile(
      creator,
      "DELIVERABLE",
      deal.workRequestId,
    );
    const deliverables = `/api/contracts/${contractId}/deliverables`;
    const reused = await Promise.all(
      [
        { kind: "REVIEW", fileIds: [changedFile] },
        { kind: "FINAL", fileIds: resent.body.deliverables[2].fileIds },
        {
          kind: "REVIEW",
          fileIds: resent.body.deliverables[2].fileIds,
          note: "메모 추가",
        },
      ].map((body) =>
        post(creator.token, deliverables, { commandId, ...body }),
      ),
    );
    expect(reused.map((r) => r.status)).toEqual([409, 409, 409]);
    expect(
      await prisma.deliverable.count({
        where: { contractId: BigInt(contractId) },
      }),
    ).toBe(3);

    // 승인 전에는 최종본을 낼 수 없고, 검토본 승인만으로는 정산되지 않는다.
    expect((await deal.submit("FINAL")).status).toBe(409);
    const review2Id = deal.latestId(review2.body);
    expect(
      (await deal.answer(creator.token, review2Id, "approve")).status,
    ).toBe(403);
    expect((await deal.answer(client.token, review2Id, "receive")).status).toBe(
      409,
    );
    const approved = await deal.answer(client.token, review2Id, "approve");
    expect(approved.body.deliverables[2].status).toBe("APPROVED");
    expect(approved.body).toMatchObject({
      productionStatus: "IN_PROGRESS",
      settlement: null,
    });
    // 승인 뒤에는 검토본을 더 낼 수 없다.
    expect((await deal.submit("REVIEW")).status).toBe(409);

    const final = await deal.submit("FINAL");
    expect(final.body.deliverables[3]).toMatchObject({
      versionNo: 4,
      kind: "FINAL",
      status: "SUBMITTED",
    });
    const received = await deal.answer(
      client.token,
      deal.latestId(final.body),
      "receive",
    );
    expect(received.status).toBe(200);
    expect(received.body).toMatchObject({
      productionStatus: "COMPLETED",
      canReview: true,
      settlement: {
        status: "SIMULATED",
        grossKrw: 200_000,
        feeRateBps: 1000,
        feeKrw: 20_000,
        payoutKrw: 180_000,
      },
    });
    expect(received.body.deliverables[3].status).toBe("RECEIVED");

    // 알림과 대화방 안내가 남는다.
    const types = (
      await prisma.notification.findMany({
        where: { recipientUserId: creator.userId },
        select: { eventType: true },
      })
    ).map((n) => n.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        "REVISION_REQUESTED",
        "DELIVERABLE_APPROVED",
        "DELIVERY_RECEIVED",
      ]),
    );
    expect(
      await prisma.notification.count({
        where: {
          recipientUserId: client.userId,
          eventType: "DELIVERABLE_SUBMITTED",
        },
      }),
    ).toBe(4);

    // 정산 내역: 양 당사자가 본다.
    const settlements = await request(app)
      .get("/api/settlements/me")
      .set(auth(creator.token));
    expect(settlements.body.items).toEqual([
      expect.objectContaining({
        contractId,
        payoutKrw: 180_000,
        title: "돌잔치 성장영상",
      }),
    ]);
  });

  it("일반 수정은 계약한 회차까지만, 계약 오류 시정은 회차와 무관하다", async () => {
    const deal = await inProduction();
    const round = async (type: "GENERAL" | "CONTRACT_FIX") => {
      const view = await delivery(deal.client.token, deal.contractId);
      const res = await deal.revise(deal.latestId(view.body), type);
      if (res.status === 201) await deal.submit("REVIEW");
      return res.status;
    };
    await deal.submit("REVIEW");
    expect(await round("GENERAL")).toBe(201);
    expect(await round("GENERAL")).toBe(201);
    expect(await round("GENERAL")).toBe(409);
    expect(await round("CONTRACT_FIX")).toBe(201);
    const view = await delivery(deal.creator.token, deal.contractId);
    expect(view.body).toMatchObject({
      revisionsUsed: 2,
      revisionsRemaining: 0,
    });
    expect(
      view.body.revisionRequests.map(
        (r: { countsTowardLimit: boolean }) => r.countsTowardLimit,
      ),
    ).toEqual([true, true, false]);
  });

  it("역할·당사자·최신 버전·파일을 검증한다", async () => {
    const deal = await inProduction();
    const outsider = await signup(app, "CLIENT", 9);
    const first = await deal.submit("REVIEW");
    const firstId = deal.latestId(first.body);

    // 의뢰인은 납품을 제출할 수 없고, 당사자가 아니면 볼 수도 없다.
    expect(
      (
        await post(
          deal.client.token,
          `/api/contracts/${deal.contractId}/deliverables`,
          {
            commandId: randomUUID(),
            kind: "REVIEW",
            fileIds: [
              await readyFile(deal.client, "DELIVERABLE", deal.workRequestId),
            ],
          },
        )
      ).status,
    ).toBe(403);
    expect((await delivery(outsider.token, deal.contractId)).status).toBe(404);

    // 다른 쓰임의 파일·남의 파일은 연결할 수 없다.
    const wrongPurpose = await post(
      deal.creator.token,
      `/api/contracts/${deal.contractId}/deliverables`,
      {
        commandId: randomUUID(),
        kind: "REVIEW",
        fileIds: [
          await readyFile(deal.creator, "CHAT_ATTACHMENT", deal.workRequestId),
        ],
      },
    );
    expect(wrongPurpose.status).toBe(400);

    // 새 버전이 나오면 이전 버전에는 답할 수 없다.
    const second = await deal.submit("REVIEW");
    expect(second.body.deliverables[0].status).toBe("SUPERSEDED");
    expect(
      (await deal.answer(deal.client.token, firstId, "approve")).status,
    ).toBe(409);
    expect((await deal.revise(firstId, "GENERAL")).status).toBe(409);
  });

  it("결제가 완료 상태가 아니면 수령 확인 뒤에도 정산·리뷰하지 않는다", async () => {
    const deal = await inProduction();
    const review = await deal.submit("REVIEW");
    await deal.answer(deal.client.token, deal.latestId(review.body), "approve");
    const final = await deal.submit("FINAL");
    await prisma.payment.updateMany({
      where: { contractId: BigInt(deal.contractId) },
      data: { status: "CANCELED" },
    });
    const received = await deal.answer(
      deal.client.token,
      deal.latestId(final.body),
      "receive",
    );
    expect(received.body).toMatchObject({
      productionStatus: "DELIVERED",
      settlement: null,
      canReview: false,
    });
    expect(
      (
        await post(
          deal.client.token,
          `/api/contracts/${deal.contractId}/reviews`,
          { rating: 5 },
        )
      ).status,
    ).toBe(409);
  });

  it("수령 확인이 동시에 두 번 들어와도 정산은 한 번이다", async () => {
    const deal = await inProduction();
    const review = await deal.submit("REVIEW");
    await deal.answer(deal.client.token, deal.latestId(review.body), "approve");
    const finalId = deal.latestId((await deal.submit("FINAL")).body);
    const results = await Promise.all([
      deal.answer(deal.client.token, finalId, "receive"),
      deal.answer(deal.client.token, finalId, "receive"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.settlement.count()).toBe(1);
  });
});

describe("리뷰 (REVIEW-01)", () => {
  it("완료 거래의 당사자가 한 번씩 리뷰하고, 받은 리뷰는 공개 목록에 나온다", async () => {
    const deal = await inProduction();
    const review = await deal.submit("REVIEW");
    await deal.answer(deal.client.token, deal.latestId(review.body), "approve");
    const final = await deal.submit("FINAL");
    await deal.answer(deal.client.token, deal.latestId(final.body), "receive");
    const reviews = `/api/contracts/${deal.contractId}/reviews`;

    expect((await post(deal.client.token, reviews, { rating: 6 })).status).toBe(
      400,
    );
    const byClient = await post(deal.client.token, reviews, {
      rating: 5,
      comment: "행사에서 모두 울었어요.",
    });
    expect(byClient.status).toBe(201);
    expect(byClient.body.canReview).toBe(false);
    expect((await post(deal.client.token, reviews, { rating: 4 })).status).toBe(
      409,
    );
    const byCreator = await post(deal.creator.token, reviews, { rating: 4 });
    expect(byCreator.body.reviews).toHaveLength(2);

    const publicList = await request(app).get(
      `/api/users/${deal.creator.userId}/reviews`,
    );
    expect(publicList.body).toMatchObject({
      averageRating: 5,
      count: 1,
      items: [
        expect.objectContaining({
          rating: 5,
          reviewerId: String(deal.client.userId),
        }),
      ],
    });
    expect(
      await prisma.notification.count({
        where: { eventType: "REVIEW_RECEIVED" },
      }),
    ).toBe(2);
  });
});

describe("수정 요청 재전송 (REV-01 멱등성)", () => {
  it("같은 commandId·같은 내용은 한 번만 만들고, 대상·종류·항목·메모가 다르면 409", async () => {
    const deal = await inProduction();
    const review = await deal.submit("REVIEW");
    const reviewId = deal.latestId(review.body);
    const commandId = randomUUID();
    const items = [
      { position: "00:42", problem: "자막이 빠릅니다.", desired: "1초 더" },
    ];
    const body = { commandId, items };

    const sent = await Promise.all([
      deal.revise(reviewId, "GENERAL", body),
      deal.revise(reviewId, "GENERAL", body),
    ]);
    expect(sent.map((r) => r.status)).toEqual([201, 201]);
    // 공백 차이는 입력 정리 뒤 같은 값이다.
    const trimmed = await deal.revise(reviewId, "GENERAL", {
      commandId,
      items: [{ ...items[0], problem: " 자막이 빠릅니다. " }],
    });
    expect(trimmed.status).toBe(201);

    const changed = await Promise.all([
      deal.revise(reviewId, "CONTRACT_FIX", body),
      deal.revise(reviewId, "GENERAL", {
        commandId,
        items: [{ ...items[0], desired: "2초 더" }],
      }),
      deal.revise(reviewId, "GENERAL", { ...body, note: "추가 메모" }),
      deal.revise(reviewId, "GENERAL", {
        commandId,
        items: [{ problem: items[0]?.problem, desired: items[0]?.desired }],
      }),
    ]);
    expect(changed.map((r) => r.status)).toEqual([409, 409, 409, 409]);
    expect(
      await prisma.revisionRequest.count({
        where: { contractId: BigInt(deal.contractId) },
      }),
    ).toBe(1);
  });
});
