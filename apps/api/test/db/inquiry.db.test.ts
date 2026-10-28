import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { auth, type Party, signup } from "../support/deal.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

const makeApp = () => createTestApp({ prisma });
let app = makeApp();

beforeEach(async () => {
  await resetDatabase(prisma);
  app = makeApp();
});

const post = (token: string, path: string, body: object = {}) =>
  request(app).post(path).set(auth(token)).send(body);

async function readyFile(owner: Party, mimeType: string) {
  const file = await prisma.file.create({
    data: {
      ownerId: owner.userId,
      purpose: "PORTFOLIO",
      mimeType,
      fileName: mimeType.startsWith("video") ? "work.mp4" : "thumb.png",
      sizeBytes: 2048n,
      storagePath: `portfolio/${randomUUID()}`,
      status: "READY",
      completedAt: new Date(),
    },
  });
  return file.id.toString();
}

// 공개 서비스·대표 패키지를 갖춘 크리에이터와, 그 패키지에 연결한 공개 작품 works개
async function creatorWithWorks(index: number, works = 1) {
  const creator = await signup(app, "CREATOR", index);
  const pkg = await post(creator.token, "/api/creator/packages", {
    title: `식전영상 1분 ${index}`,
    description: "사진 20장으로 1분 식전영상을 만들어 드립니다.",
    purpose: "WEDDING_COUPLE",
    priceKrw: 30_000 + index * 1_000,
    deliveryDays: 4,
    revisionCount: 1,
    includes: ["1분 영상 1편"],
  });
  const packageId = String(pkg.body.id);
  await post(creator.token, `/api/creator/packages/${packageId}/publish`);
  await post(
    creator.token,
    `/api/creator/packages/${packageId}/representative`,
  );
  await post(creator.token, "/api/creator/service/publish");
  const portfolioIds = await Array.from({ length: works }).reduce<
    Promise<string[]>
  >(async (previous, _, n) => {
    const done = await previous;
    const created = await post(creator.token, "/api/creator/portfolios", {
      title: `웨딩 작품 ${index}-${n + 1}`,
      purpose: "WEDDING_COUPLE",
      styles: ["EMOTIONAL"],
      roles: ["EDITING"],
      source: "OWN_WORK",
      videoFileId: await readyFile(creator, "video/mp4"),
      thumbnailFileId: await readyFile(creator, "image/png"),
      packageId,
    });
    const id = String(created.body.id);
    const published = await post(
      creator.token,
      `/api/creator/portfolios/${id}/publish`,
    );
    expect(published.status).toBe(200);
    return [...done, id];
  }, Promise.resolve([]));
  return { creator, packageId, portfolioIds };
}

const conditions = {
  message: "세로 사진이 많은데 1분 식전영상으로 만들 수 있을까요?",
  purpose: "WEDDING_COUPLE",
  materialType: "PHOTOS_ONLY",
  eventDate: "2026-12-12",
  desiredDeliveryDate: "2026-12-05",
};

describe("작품 저장함 (SAVE-01)", () => {
  it("공개 작품을 저장·조회·해제하고, 같은 작품 저장은 한 번만 남는다", async () => {
    const { portfolioIds } = await creatorWithWorks(1, 1);
    const [workId] = portfolioIds;
    const client = await signup(app, "CLIENT");

    expect(
      (await request(app).put(`/api/portfolios/${workId}/bookmark`)).status,
    ).toBe(401);
    const save = () =>
      request(app)
        .put(`/api/portfolios/${workId}/bookmark`)
        .set(auth(client.token));
    expect((await save()).body).toEqual({ saved: true });
    expect((await save()).status).toBe(200);

    const list = await request(app)
      .get("/api/me/work-bookmarks")
      .set(auth(client.token));
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      portfolio: { id: workId },
      available: true,
      startingPriceKrw: 31_000,
    });

    const removed = await request(app)
      .delete(`/api/portfolios/${workId}/bookmark`)
      .set(auth(client.token));
    expect(removed.body).toEqual({ saved: false });
    expect(
      (await request(app).get("/api/me/work-bookmarks").set(auth(client.token)))
        .body.items,
    ).toEqual([]);
  });

  it("비공개 작품은 저장할 수 없고, 저장 뒤 비공개가 되면 available=false로 남는다", async () => {
    const { creator, portfolioIds } = await creatorWithWorks(1, 1);
    const [workId] = portfolioIds;
    const client = await signup(app, "CLIENT");
    await request(app)
      .put(`/api/portfolios/${workId}/bookmark`)
      .set(auth(client.token));
    await post(creator.token, `/api/creator/portfolios/${workId}/hide`);

    const list = await request(app)
      .get("/api/me/work-bookmarks")
      .set(auth(client.token));
    expect(list.body.items[0]).toMatchObject({ available: false });
    await request(app)
      .delete(`/api/portfolios/${workId}/bookmark`)
      .set(auth(client.token));
    expect(
      (
        await request(app)
          .put(`/api/portfolios/${workId}/bookmark`)
          .set(auth(client.token))
      ).status,
    ).toBe(404);
  });
});

describe("일괄 문의 (INQ-01)", () => {
  it("작품마다 제작자에게 같은 조건으로 보내고, 같은 제작자·진행 중 의뢰는 건너뛴다", async () => {
    const a = await creatorWithWorks(1, 2);
    const b = await creatorWithWorks(2, 1);
    const c = await creatorWithWorks(3, 1);
    const client = await signup(app, "CLIENT");
    // C에게는 이미 진행 중인 직접 의뢰가 있다
    expect(
      (
        await post(
          client.token,
          `/api/packages/${c.packageId}/direct-requests`,
          { message: "먼저 보낸 의뢰입니다. 확인 부탁드려요." },
        )
      ).status,
    ).toBe(201);

    const commandId = randomUUID();
    const body = {
      commandId,
      portfolioIds: [
        a.portfolioIds[0],
        a.portfolioIds[1],
        b.portfolioIds[0],
        c.portfolioIds[0],
      ],
      ...conditions,
    };
    const sent = await post(client.token, "/api/direct-inquiries", body);
    expect(sent.status).toBe(201);
    expect(sent.body.inquiryGroupId).toBe(commandId);
    expect(sent.body.results.map((r: { status: string }) => r.status)).toEqual([
      "SENT",
      "SAME_CREATOR",
      "SENT",
      "ALREADY_OPEN",
    ]);
    expect(sent.body.results[0].request).toMatchObject({
      materialType: "PHOTOS_ONLY",
      eventDate: "2026-12-12",
      desiredDeliveryDate: "2026-12-05",
      referencePortfolio: { id: a.portfolioIds[0], title: "웨딩 작품 1-1" },
      inquiryGroupId: commandId,
      status: "PENDING",
      package: { packageId: a.packageId, priceKrw: 31_000 },
    });

    // 받은 크리에이터는 같은 조건을 본다
    const received = await request(app)
      .get("/api/direct-requests")
      .set(auth(b.creator.token));
    expect(received.body.items).toHaveLength(1);
    expect(received.body.items[0]).toMatchObject({
      message: conditions.message,
      materialType: "PHOTOS_ONLY",
      referencePortfolio: { id: b.portfolioIds[0] },
    });

    // 같은 commandId로 다시 보내면 새로 만들지 않고 처음 결과를 돌려준다
    const again = await post(client.token, "/api/direct-inquiries", body);
    expect(again.status).toBe(201);
    expect(
      again.body.results
        .filter((r: { status: string }) => r.status === "SENT")
        .map((r: { request: { id: string } }) => r.request.id),
    ).toEqual(
      sent.body.results
        .filter((r: { status: string }) => r.status === "SENT")
        .map((r: { request: { id: string } }) => r.request.id),
    );
    expect(
      await prisma.workRequest.count({ where: { inquiryGroupId: commandId } }),
    ).toBe(2);
  });

  it("공개가 아닌 작품은 UNAVAILABLE, 의뢰인만 보낼 수 있고 희망 납품일은 행사일보다 늦을 수 없다", async () => {
    const a = await creatorWithWorks(1, 1);
    const client = await signup(app, "CLIENT");
    await post(
      a.creator.token,
      `/api/creator/portfolios/${a.portfolioIds[0]}/hide`,
    );

    const hidden = await post(client.token, "/api/direct-inquiries", {
      commandId: randomUUID(),
      portfolioIds: [a.portfolioIds[0]],
      ...conditions,
    });
    expect(hidden.status).toBe(201);
    expect(hidden.body.results[0]).toMatchObject({
      status: "UNAVAILABLE",
      request: null,
    });

    expect(
      (
        await post(a.creator.token, "/api/direct-inquiries", {
          commandId: randomUUID(),
          portfolioIds: [a.portfolioIds[0]],
          ...conditions,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post(client.token, "/api/direct-inquiries", {
          commandId: randomUUID(),
          portfolioIds: [a.portfolioIds[0]],
          ...conditions,
          desiredDeliveryDate: "2026-12-20",
        })
      ).status,
    ).toBe(400);
  });
});

describe("직접 의뢰의 새 조건 (INQ-01)", () => {
  it("참고 작품·보유 자료·희망 납품일을 저장하고, 다른 크리에이터 작품은 참고로 받지 않는다", async () => {
    const a = await creatorWithWorks(1, 1);
    const b = await creatorWithWorks(2, 1);
    const client = await signup(app, "CLIENT");

    const wrong = await post(
      client.token,
      `/api/packages/${a.packageId}/direct-requests`,
      { ...conditions, referencePortfolioId: b.portfolioIds[0] },
    );
    expect(wrong.status).toBe(400);

    const ok = await post(
      client.token,
      `/api/packages/${a.packageId}/direct-requests`,
      { ...conditions, referencePortfolioId: a.portfolioIds[0] },
    );
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      materialType: "PHOTOS_ONLY",
      desiredDeliveryDate: "2026-12-05",
      referencePortfolio: { id: a.portfolioIds[0] },
      inquiryGroupId: null,
    });
  });
});
