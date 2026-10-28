import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDirectRequestService } from "../../src/direct/direct.service.js";
import { createPricingService } from "../../src/pricing/pricing.service.js";
import { auth, FULL_TERMS, type Party, signup } from "../support/deal.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

const HOUR_MS = 60 * 60 * 1000;
let clock = new Date("2026-10-27T01:00:00.000Z");
const pricing = createPricingService({
  prisma,
  generate: async () => ({
    summary: "성장영상 편집 비용 추정",
    workUnits: [
      {
        name: "사진·클립 편집",
        quantity: 1,
        unitPriceKrw: 150_000,
        rationale: "사진 50장 기준",
      },
      {
        name: "자막·음악",
        quantity: 1,
        unitPriceKrw: 30_000,
        rationale: "기본 자막",
      },
    ],
    assumptions: ["3분 내외"],
  }),
});
const makeApp = () =>
  createTestApp({
    prisma,
    pricingService: pricing,
    directRequestService: createDirectRequestService({
      prisma,
      now: () => clock,
    }),
  });
let app = makeApp();

beforeEach(async () => {
  await resetDatabase(prisma);
  clock = new Date("2026-10-27T01:00:00.000Z");
  app = makeApp();
});

// 의뢰 상세·목록·조건서가 보여 주는 거래 진행 단계(요청 상태는 계약 뒤 CONTRACTED로 멈춘다)
async function stagesOf(token: string, requestId: string) {
  const [detail, list, terms] = await Promise.all([
    request(app).get(`/api/direct-requests/${requestId}`).set(auth(token)),
    request(app).get("/api/direct-requests").set(auth(token)),
    request(app).get(`/api/work-requests/${requestId}/terms`).set(auth(token)),
  ]);
  return [
    detail.body.stage,
    list.body.items.find((i: { id: string }) => i.id === requestId)?.stage,
    terms.body.stage,
  ];
}

const post = (token: string, path: string, body: object = {}) =>
  request(app).post(path).set(auth(token)).send(body);

// 공개 서비스와 대표 패키지를 갖춘 크리에이터
async function publicCreator(index = 1) {
  const creator = await signup(app, "CREATOR", index);
  const pkg = await post(creator.token, "/api/creator/packages", {
    title: "돌잔치 성장영상 기본",
    description: "사진 50장으로 3분 성장영상을 만들어 드립니다.",
    purpose: "CHILD_FAMILY",
    priceKrw: 200_000,
    deliveryDays: 5,
    revisionCount: 2,
    includes: ["3분 영상 1편", "자막"],
  });
  await post(creator.token, `/api/creator/packages/${pkg.body.id}/publish`);
  await post(
    creator.token,
    `/api/creator/packages/${pkg.body.id}/representative`,
  );
  await post(creator.token, "/api/creator/service/publish");
  return { creator, packageId: String(pkg.body.id) };
}

const sendDirect = (client: Party, packageId: string) =>
  post(client.token, `/api/packages/${packageId}/direct-requests`, {
    message: "아이 돌잔치에 상영할 영상을 부탁드려요.",
    eventDate: "2026-11-20",
  });

async function readyFile(owner: Party, purpose: string, workRequestId: string) {
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

describe("직접 의뢰 (DIRECT-01~03)", () => {
  it("공고 없는 직접 거래가 협의 수락 → 조건서·서명 → 결제 → 납품 → 리뷰까지 끝난다", async () => {
    const { creator, packageId } = await publicCreator();
    const client = await signup(app, "CLIENT");

    const sent = await sendDirect(client, packageId);
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({
      status: "PENDING",
      package: { priceKrw: 200_000, deliveryDays: 5, revisionCount: 2 },
      eventDate: "2026-11-20",
      respondDueAt: new Date(clock.getTime() + 48 * HOUR_MS).toISOString(),
    });
    const requestId = String(sent.body.id);
    // 같은 패키지로 진행 중인 의뢰는 하나뿐, 의뢰인은 수락할 수 없다.
    expect((await sendDirect(client, packageId)).status).toBe(409);
    expect(
      (await post(client.token, `/api/direct-requests/${requestId}/accept`))
        .status,
    ).toBe(403);

    // 협의 수락은 계약이 아니다.
    const accepted = await post(
      creator.token,
      `/api/direct-requests/${requestId}/accept`,
    );
    expect(accepted.body.status).toBe("DISCUSSING");
    expect(await prisma.contract.count()).toBe(0);
    expect(
      await prisma.chatRoom.count({
        where: { workRequestId: BigInt(requestId) },
      }),
    ).toBe(1);

    // 조건서 → 양측 서명 → 계약(공고 없음)
    await post(client.token, `/api/work-requests/${requestId}/terms/versions`, {
      commandId: randomUUID(),
      baseVersionNo: 0,
      values: FULL_TERMS,
    });
    const signing = await post(
      client.token,
      `/api/work-requests/${requestId}/terms/versions/1/signing`,
    );
    const sign = (party: Party) =>
      post(
        party.token,
        `/api/work-requests/${requestId}/terms/versions/1/signatures`,
        {
          signerName: "서명자",
          consent: true,
          termsHash: signing.body.termsHash,
        },
      );
    await sign(creator);
    const signed = await sign(client);
    const contractId = String(signed.body.contract.id);
    expect(
      await prisma.contract.findUniqueOrThrow({
        where: { id: BigInt(contractId) },
        select: { projectId: true },
      }),
    ).toEqual({ projectId: null });
    const detail = await request(app)
      .get(`/api/direct-requests/${requestId}`)
      .set(auth(client.token));
    expect(detail.body).toMatchObject({
      status: "CONTRACTED",
      stage: "PAYMENT_PENDING",
    });
    expect(await stagesOf(creator.token, requestId)).toEqual(
      Array(3).fill("PAYMENT_PENDING"),
    );

    // 결제(기록) → 자료 확인 → 제작 → 검토본 승인 → 최종본 수령 → 리뷰
    await prisma.payment.create({
      data: {
        contractId: BigInt(contractId),
        orderId: randomUUID(),
        amountKrw: 200_000n,
        orderName: "직접 의뢰",
        status: "SUCCEEDED",
        paymentKey: `pk_${randomUUID()}`,
        approvedAt: new Date(),
        createdBy: client.userId,
      },
    });
    await prisma.productionMaterial.create({
      data: {
        contractId: BigInt(contractId),
        kind: "NOTE",
        note: "사진은 메일로 보냈습니다.",
        status: "CONFIRMED",
        confirmedAt: new Date(),
        submittedBy: client.userId,
        commandId: randomUUID(),
      },
    });
    expect(await stagesOf(client.token, requestId)).toEqual(
      Array(3).fill("PREPARING"),
    );
    await post(creator.token, `/api/contracts/${contractId}/production/start`);
    expect(await stagesOf(client.token, requestId)).toEqual(
      Array(3).fill("IN_PROGRESS"),
    );
    const submit = async (kind: string) =>
      post(creator.token, `/api/contracts/${contractId}/deliverables`, {
        commandId: randomUUID(),
        kind,
        fileIds: [await readyFile(creator, "DELIVERABLE", requestId)],
      });
    const review = await submit("REVIEW");
    await post(
      client.token,
      `/api/contracts/${contractId}/deliverables/${review.body.deliverables[0].id}/approve`,
    );
    const final = await submit("FINAL");
    const received = await post(
      client.token,
      `/api/contracts/${contractId}/deliverables/${final.body.deliverables[1].id}/receive`,
    );
    expect(received.body).toMatchObject({
      productionStatus: "COMPLETED",
      settlement: { feeKrw: 20_000, payoutKrw: 180_000 },
    });
    // 내 활동과 같은 값: 의뢰 상세·목록·조건서 모두 거래 완료
    expect(await stagesOf(client.token, requestId)).toEqual(
      Array(3).fill("COMPLETED"),
    );
    expect(
      (await request(app).get("/api/activity").set(auth(client.token))).body
        .requests[0].stage,
    ).toBe("COMPLETED");
    expect(
      (
        await post(client.token, `/api/contracts/${contractId}/reviews`, {
          rating: 5,
        })
      ).status,
    ).toBe(201);
    const listed = await request(app)
      .get("/api/settlements/me")
      .set(auth(creator.token));
    expect(listed.body.items[0].title).toBe("직접 의뢰");
  });

  it("48시간 안에 답하지 않으면 만료되고, 그 뒤 같은 패키지로 다시 보낼 수 있다", async () => {
    const { creator, packageId } = await publicCreator();
    const client = await signup(app, "CLIENT");
    const requestId = String((await sendDirect(client, packageId)).body.id);

    clock = new Date(clock.getTime() + 48 * HOUR_MS);
    const list = await request(app)
      .get("/api/direct-requests")
      .set(auth(creator.token));
    expect(list.body.items[0].status).toBe("EXPIRED");
    expect(
      (await post(creator.token, `/api/direct-requests/${requestId}/accept`))
        .status,
    ).toBe(409);
    expect(
      await prisma.notification.count({
        where: { eventType: "DIRECT_REQUEST_EXPIRED" },
      }),
    ).toBe(2);
    expect((await sendDirect(client, packageId)).status).toBe(201);
  });

  it("거절·철회, 비공개 패키지·크리에이터의 요청을 막는다", async () => {
    const { creator, packageId } = await publicCreator();
    const other = await publicCreator(2);
    const client = await signup(app, "CLIENT");

    expect((await sendDirect(other.creator, packageId)).status).toBe(403);
    const first = String((await sendDirect(client, packageId)).body.id);
    // 다른 크리에이터는 이 의뢰를 볼 수 없다.
    expect(
      (
        await request(app)
          .get(`/api/direct-requests/${first}`)
          .set(auth(other.creator.token))
      ).status,
    ).toBe(404);
    expect(
      (await post(creator.token, `/api/direct-requests/${first}/decline`)).body
        .status,
    ).toBe("DECLINED");
    const second = String((await sendDirect(client, packageId)).body.id);
    expect(
      (await post(client.token, `/api/direct-requests/${second}/withdraw`)).body
        .status,
    ).toBe("WITHDRAWN");

    await post(creator.token, "/api/creator/service/hide");
    expect((await sendDirect(client, packageId)).status).toBe(404);
  });
});

describe("작업물 피드 (FEED-01~03)", () => {
  it("공개 서비스의 공개 작업물만 최근 공개순으로, 목적·스타일·역할로 거른다", async () => {
    const a = await publicCreator(1);
    const b = await publicCreator(2);
    const hidden = await signup(app, "CREATOR", 3);
    const work = async (
      owner: Party,
      title: string,
      purpose: string,
      styles: string[],
      roles: string[],
    ) => {
      const video = await prisma.file.create({
        data: {
          ownerId: owner.userId,
          purpose: "PORTFOLIO",
          mimeType: "video/mp4",
          fileName: "w.mp4",
          sizeBytes: 10n,
          storagePath: `portfolio/${randomUUID()}`,
          status: "READY",
          completedAt: new Date(),
        },
      });
      const created = await post(owner.token, "/api/creator/portfolios", {
        title,
        purpose,
        styles,
        roles,
        videoFileId: video.id.toString(),
      });
      await post(
        owner.token,
        `/api/creator/portfolios/${created.body.id}/publish`,
      );
    };
    await work(
      a.creator,
      "웨딩 하이라이트",
      "WEDDING_COUPLE",
      ["CINEMATIC"],
      ["FILMING"],
    );
    await work(
      b.creator,
      "돌잔치 영상",
      "CHILD_FAMILY",
      ["EMOTIONAL"],
      ["EDITING"],
    );
    await work(
      hidden,
      "비공개 서비스 작업",
      "CHILD_FAMILY",
      ["EMOTIONAL"],
      ["EDITING"],
    );

    const all = await request(app).get("/api/feed");
    expect(all.body.total).toBe(2);
    expect(
      all.body.items.map(
        (i: { portfolio: { title: string } }) => i.portfolio.title,
      ),
    ).toEqual(["돌잔치 영상", "웨딩 하이라이트"]);
    expect(all.body.items[0]).toMatchObject({
      creator: { userId: String(b.creator.userId) },
      startingPriceKrw: 200_000,
    });

    const byStyle = await request(app).get("/api/feed?styles=CINEMATIC,FUN");
    expect(byStyle.body.total).toBe(1);
    const byRole = await request(app).get("/api/feed?roles=EDITING");
    expect(byRole.body.items[0].portfolio.title).toBe("돌잔치 영상");
    expect(
      (await request(app).get("/api/feed?purpose=TRAVEL_DAILY")).body.total,
    ).toBe(0);
    expect((await request(app).get("/api/feed?styles=NOPE")).status).toBe(400);
  });
});

describe("AI 분석 보고서·예산 반영 (AI-01·02)", () => {
  it("분석은 보고서로 남고 예산을 바꾸지 않으며, 의뢰인이 반영할 때만 한 번 반영된다", async () => {
    const client = await signup(app, "CLIENT");
    const other = await signup(app, "CLIENT", 2);
    const draft = await post(client.token, "/api/project-drafts", {
      title: "돌잔치 성장영상",
      budget: 100_000,
    });

    const analyzed = await post(client.token, "/api/pricing/analyze", {
      description: "아이 첫 생일에 상영할 3분 성장영상을 만들고 싶어요.",
    });
    expect(analyzed.status).toBe(200);
    expect(analyzed.body.estimatedBudgetKrw).toBe(180_000);
    const { reportId } = analyzed.body;
    expect(reportId).toMatch(/^\d+$/);
    // 분석만으로는 초안 예산이 바뀌지 않는다.
    expect(
      (
        await prisma.projectDraft.findUniqueOrThrow({
          where: { id: BigInt(draft.body.id) },
        })
      ).values,
    ).toMatchObject({ budget: 100_000 });

    expect(
      (
        await post(other.token, `/api/pricing/reports/${reportId}/apply`, {
          draftId: draft.body.id,
        })
      ).status,
    ).toBe(404);
    const applied = await post(
      client.token,
      `/api/pricing/reports/${reportId}/apply`,
      { draftId: draft.body.id },
    );
    expect(applied.body).toMatchObject({
      appliedBudgetKrw: 180_000,
      draftId: draft.body.id,
      projectId: null,
    });
    expect(
      (
        await prisma.projectDraft.findUniqueOrThrow({
          where: { id: BigInt(draft.body.id) },
        })
      ).values,
    ).toMatchObject({ budget: 180_000, title: "돌잔치 성장영상" });
    expect(
      (
        await post(client.token, `/api/pricing/reports/${reportId}/apply`, {
          draftId: draft.body.id,
        })
      ).status,
    ).toBe(409);
  });
});

describe("운영 지표 (METRIC-01)", () => {
  it("운영자만 보고, 시연 계정(kemi.test)은 빼고 센다", async () => {
    const admin = await signup(app, "CLIENT", 9);
    await prisma.user.update({
      where: { id: admin.userId },
      data: { role: "ADMIN" },
    });
    const { packageId } = await publicCreator();
    const client = await signup(app, "CLIENT");
    await sendDirect(client, packageId);
    // 시연 계정의 의뢰는 지표에서 뺀다.
    const demo = await signup(app, "CLIENT", 5);
    await prisma.user.update({
      where: { id: demo.userId },
      data: { email: "demo-client@kemi.test" },
    });
    await sendDirect(demo, packageId);

    expect(
      (await request(app).get("/api/admin/metrics").set(auth(client.token)))
        .status,
    ).toBe(403);
    const metrics = await request(app)
      .get("/api/admin/metrics")
      .set(auth(admin.token));
    expect(metrics.body).toMatchObject({
      directRequests: 1,
      contracts: 0,
      revisionRequestRate: null,
    });
  });
});
