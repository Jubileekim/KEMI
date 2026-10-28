import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createCatalogService } from "../../src/catalog/catalog.service.js";
import { auth, type Party, signup } from "../support/deal.js";
import { createFakeStorage } from "../support/fake-storage.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({
    prisma,
    catalogService: createCatalogService({
      prisma,
      storage: createFakeStorage().storage,
    }),
  });
});

const post = (token: string, path: string, body: object = {}) =>
  request(app).post(path).set(auth(token)).send(body);
const patch = (token: string, path: string, body: object) =>
  request(app).patch(path).set(auth(token)).send(body);

const FULL_PACKAGE = {
  title: "돌잔치 성장영상 기본",
  description: "사진 50장으로 3분 성장영상을 만들어 드립니다.",
  purpose: "CHILD_FAMILY",
  priceKrw: 150_000,
  deliveryDays: 5,
  revisionCount: 2,
  includes: ["3분 영상 1편", "자막", "배경음악"],
};

async function portfolioFile(owner: Party, mimeType: string) {
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

describe("제작 패키지·서비스 공개 (PACK-01~03)", () => {
  it("초안 저장 → 필수 항목을 갖춰 공개 → 대표 지정 → 서비스 공개, 대표 외 공개 패키지도 보인다", async () => {
    const creator = await signup(app, "CREATOR");
    const draft = await post(creator.token, "/api/creator/packages", {
      title: "초안 패키지",
    });
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ status: "DRAFT", priceKrw: null });

    // 필수 항목이 빠지면 공개할 수 없다.
    const incomplete = await post(
      creator.token,
      `/api/creator/packages/${draft.body.id}/publish`,
    );
    expect(incomplete.status).toBe(400);
    expect(
      incomplete.body.error.details.map((d: { path: string[] }) => d.path[0]),
    ).toEqual(expect.arrayContaining(["description", "priceKrw", "includes"]));
    // 공개 안 된 패키지는 대표가 될 수 없고, 대표가 없으면 서비스를 공개할 수 없다.
    expect(
      (
        await post(
          creator.token,
          `/api/creator/packages/${draft.body.id}/representative`,
        )
      ).status,
    ).toBe(409);
    expect(
      (await post(creator.token, "/api/creator/service/publish")).status,
    ).toBe(409);

    const main = await post(
      creator.token,
      "/api/creator/packages",
      FULL_PACKAGE,
    );
    const extra = await post(creator.token, "/api/creator/packages", {
      ...FULL_PACKAGE,
      title: "결혼식 하이라이트",
      purpose: "WEDDING_COUPLE",
      priceKrw: 300_000,
    });
    const publishedStatuses = await Promise.all(
      [main.body.id, extra.body.id].map(
        async (id) =>
          (await post(creator.token, `/api/creator/packages/${id}/publish`))
            .body.status,
      ),
    );
    expect(publishedStatuses).toEqual(["PUBLIC", "PUBLIC"]);
    await post(
      creator.token,
      `/api/creator/packages/${main.body.id}/representative`,
    );
    // 대표를 바꾸면 이전 대표는 해제된다(크리에이터당 하나).
    await post(
      creator.token,
      `/api/creator/packages/${extra.body.id}/representative`,
    );
    await post(
      creator.token,
      `/api/creator/packages/${main.body.id}/representative`,
    );
    expect(
      await prisma.servicePackage.count({ where: { isRepresentative: true } }),
    ).toBe(1);

    // 서비스 공개 전에는 공개 페이지가 없다.
    expect(
      (await request(app).get(`/api/creators/${creator.userId}`)).status,
    ).toBe(404);
    expect(
      (await post(creator.token, "/api/creator/service/publish")).body,
    ).toEqual({ serviceStatus: "PUBLIC" });

    const page = await request(app).get(`/api/creators/${creator.userId}`);
    expect(page.status).toBe(200);
    expect(page.body.representativePackage).toMatchObject({
      id: main.body.id,
      priceKrw: 150_000,
    });
    expect(page.body.packages.map((p: { id: string }) => p.id)).toEqual([
      extra.body.id,
    ]);
    expect(
      (await request(app).get(`/api/packages/${extra.body.id}`)).status,
    ).toBe(200);
    expect(
      (await request(app).get(`/api/packages/${draft.body.id}`)).status,
    ).toBe(404);

    // 공개 서비스의 대표 패키지는 바로 내릴 수 없고, 공개 패키지의 필수 항목은 비울 수 없다.
    expect(
      (await post(creator.token, `/api/creator/packages/${main.body.id}/hide`))
        .status,
    ).toBe(409);
    expect(
      (
        await patch(creator.token, `/api/creator/packages/${main.body.id}`, {
          priceKrw: null,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await patch(creator.token, `/api/creator/packages/${main.body.id}`, {
          priceKrw: 170_000,
        })
      ).body.priceKrw,
    ).toBe(170_000);

    // 서비스를 내리면 공개 조회도 막힌다.
    await post(creator.token, "/api/creator/service/hide");
    expect(
      (await request(app).get(`/api/packages/${main.body.id}`)).status,
    ).toBe(404);
  });

  it("남의 패키지는 고칠 수 없고, 의뢰인은 패키지를 만들 수 없다", async () => {
    const creator = await signup(app, "CREATOR");
    const other = await signup(app, "CREATOR", 2);
    const client = await signup(app, "CLIENT");
    const own = await post(
      creator.token,
      "/api/creator/packages",
      FULL_PACKAGE,
    );
    expect(
      (
        await patch(other.token, `/api/creator/packages/${own.body.id}`, {
          title: "남의 것",
        })
      ).status,
    ).toBe(404);
    expect(
      (await post(client.token, "/api/creator/packages", FULL_PACKAGE)).status,
    ).toBe(403);
  });
});

describe("작업물 (PORT-01·02)", () => {
  it("영상·목적·본인 역할이 있어야 공개하고, 고객 의뢰 작업은 공개할 수 없다", async () => {
    const creator = await signup(app, "CREATOR");
    const other = await signup(app, "CREATOR", 2);
    const video = await portfolioFile(creator, "video/mp4");
    const thumb = await portfolioFile(creator, "image/png");
    const othersVideo = await portfolioFile(other, "video/mp4");

    expect(
      (
        await post(creator.token, "/api/creator/portfolios", {
          title: "남의 영상",
          videoFileId: othersVideo,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(creator.token, "/api/creator/portfolios", {
          title: "영상 자리에 이미지",
          videoFileId: thumb,
        })
      ).status,
    ).toBe(400);

    const created = await post(creator.token, "/api/creator/portfolios", {
      title: "가족 여행 브이로그",
      videoFileId: video,
      thumbnailFileId: thumb,
      purpose: "TRAVEL_DAILY",
      styles: ["EMOTIONAL"],
      source: "CLIENT_WORK",
    });
    expect(created.status).toBe(201);
    const { id } = created.body;
    const publish = () =>
      post(creator.token, `/api/creator/portfolios/${id}/publish`);

    const noRoles = await publish();
    expect(noRoles.status).toBe(400);
    expect(
      noRoles.body.error.details.map((d: { path: string[] }) => d.path[0]),
    ).toEqual(["roles"]);

    await patch(creator.token, `/api/creator/portfolios/${id}`, {
      roles: ["FILMING", "EDITING"],
      clientConsent: true,
    });
    // 고객 의뢰 작업물은 크리에이터가 동의를 표시해도 공개할 수 없다(고객 동의 기록 기능 전까지).
    const clientWork = await publish();
    expect(clientWork.status).toBe(409);
    expect(
      (await prisma.portfolio.findUniqueOrThrow({ where: { id: BigInt(id) } }))
        .status,
    ).toBe("DRAFT");
    // DB도 고객 의뢰 작업물의 공개를 막는다.
    await expect(
      prisma.portfolio.update({
        where: { id: BigInt(id) },
        data: { status: "PUBLIC" },
      }),
    ).rejects.toThrow();

    await patch(creator.token, `/api/creator/portfolios/${id}`, {
      source: "OWN_WORK",
    });
    const published = await publish();
    expect(published.body).toMatchObject({ status: "PUBLIC" });
    expect(published.body.publishedAt).not.toBeNull();

    // 서비스가 공개되지 않았으면 작업물도 공개 조회되지 않는다.
    expect((await request(app).get(`/api/portfolios/${id}`)).status).toBe(404);
    const pkg = await post(
      creator.token,
      "/api/creator/packages",
      FULL_PACKAGE,
    );
    await post(creator.token, `/api/creator/packages/${pkg.body.id}/publish`);
    await post(
      creator.token,
      `/api/creator/packages/${pkg.body.id}/representative`,
    );
    await post(creator.token, "/api/creator/service/publish");

    expect((await request(app).get(`/api/portfolios/${id}`)).status).toBe(200);
    const media = await request(app).get(`/api/portfolios/${id}/media`);
    expect(media.status).toBe(200);
    expect(media.body.video.url).toContain("portfolio/");
    expect(media.body.thumbnail.url).toContain("portfolio/");

    // 공개 중에는 고객 의뢰 작업물로 바꿀 수 없다. 내리면 공개 조회가 막힌다.
    expect(
      (
        await patch(creator.token, `/api/creator/portfolios/${id}`, {
          source: "CLIENT_WORK",
        })
      ).status,
    ).toBe(409);
    await post(creator.token, `/api/creator/portfolios/${id}/hide`);
    expect((await request(app).get(`/api/portfolios/${id}`)).status).toBe(404);
  });
});

describe("작업물 삭제 (PORT-03)", () => {
  async function publicWork(creator: Party, title: string) {
    const video = await portfolioFile(creator, "video/mp4");
    const work = await post(creator.token, "/api/creator/portfolios", {
      title,
      videoFileId: video,
      purpose: "TRAVEL_DAILY",
      roles: ["EDITING"],
    });
    await post(
      creator.token,
      `/api/creator/portfolios/${work.body.id}/publish`,
    );
    return String(work.body.id);
  }

  it("본인 작업물만 지우고, 저장함에서도 빠지며, 의뢰의 참고 작품은 지우지 않는다", async () => {
    const creator = await signup(app, "CREATOR");
    const other = await signup(app, "CREATOR", 2);
    const client = await signup(app, "CLIENT");
    const pkg = await post(
      creator.token,
      "/api/creator/packages",
      FULL_PACKAGE,
    );
    await post(creator.token, `/api/creator/packages/${pkg.body.id}/publish`);
    await post(
      creator.token,
      `/api/creator/packages/${pkg.body.id}/representative`,
    );
    await post(creator.token, "/api/creator/service/publish");
    const saved = await publicWork(creator, "저장된 작업물");
    const referenced = await publicWork(creator, "참고 작품");
    const draft = await post(creator.token, "/api/creator/portfolios", {
      title: "초안",
    });
    const del = (token: string, id: string) =>
      request(app).delete(`/api/creator/portfolios/${id}`).set(auth(token));

    expect(
      (
        await request(app)
          .put(`/api/portfolios/${saved}/bookmark`)
          .set(auth(client.token))
      ).status,
    ).toBe(200);
    const direct = await post(
      client.token,
      `/api/packages/${pkg.body.id}/direct-requests`,
      {
        message: "이 작품처럼 여행 영상을 만들고 싶어요.",
        referencePortfolioId: referenced,
      },
    );
    expect(direct.status).toBe(201);

    expect((await del(other.token, saved)).status).toBe(404);
    expect((await del(client.token, saved)).status).toBe(403);
    expect((await del(creator.token, referenced)).status).toBe(409);
    expect(
      await prisma.portfolio.count({ where: { id: BigInt(referenced) } }),
    ).toBe(1);

    expect((await del(creator.token, saved)).status).toBe(204);
    expect((await del(creator.token, draft.body.id)).status).toBe(204);
    expect(
      await prisma.portfolio.count({
        where: { id: { in: [BigInt(saved), BigInt(draft.body.id)] } },
      }),
    ).toBe(0);
    expect(
      await prisma.portfolioBookmark.count({
        where: { portfolioId: BigInt(saved) },
      }),
    ).toBe(0);
    expect((await request(app).get(`/api/portfolios/${saved}`)).status).toBe(
      404,
    );
    expect((await del(creator.token, saved)).status).toBe(404);
  });
});

describe("공고 임시 저장·공개 (CAMP-01·02)", () => {
  it("비어 있어도 저장하고, 공개할 때 검사한 뒤 공개 시각 + 모집 기간으로 마감한다", async () => {
    const client = await signup(app, "CLIENT");
    const draft = await post(client.token, "/api/project-drafts", {
      title: "돌잔치 성장영상",
    });
    expect(draft.status).toBe(201);
    expect(draft.body).toMatchObject({ recruitmentDays: 7 });

    // 필수 항목이 비어 있으면 공개할 수 없다.
    expect(
      (await post(client.token, `/api/project-drafts/${draft.body.id}/publish`))
        .status,
    ).toBe(400);
    expect(
      (
        await patch(client.token, `/api/project-drafts/${draft.body.id}`, {
          recruitmentDays: 5,
        })
      ).status,
    ).toBe(400);

    const updated = await patch(
      client.token,
      `/api/project-drafts/${draft.body.id}`,
      {
        description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
        purpose: "CHILD_FAMILY",
        styles: ["EMOTIONAL"],
        budget: 200_000,
        deliveryDueDate: "2099-01-31",
        recruitmentDays: 14,
      },
    );
    expect(updated.body.values.title).toBe("돌잔치 성장영상");
    expect(updated.body.recruitmentDays).toBe(14);

    const before = Date.now();
    const published = await post(
      client.token,
      `/api/project-drafts/${draft.body.id}/publish`,
    );
    expect(published.status).toBe(201);
    expect(published.body.project.status).toBe("OPEN");
    const endAt = new Date(published.body.project.recruitmentEndAt).getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(endAt).toBeGreaterThanOrEqual(before + fourteenDays - 1000);
    expect(endAt).toBeLessThanOrEqual(Date.now() + fourteenDays + 1000);

    // 같은 초안을 두 번 공개하거나 공개 뒤 고칠 수 없다. 목록에서는 빠진다.
    expect(
      (await post(client.token, `/api/project-drafts/${draft.body.id}/publish`))
        .status,
    ).toBe(409);
    expect(
      (
        await patch(client.token, `/api/project-drafts/${draft.body.id}`, {
          title: "바꾸기",
        })
      ).status,
    ).toBe(409);
    const list = await request(app)
      .get("/api/project-drafts")
      .set(auth(client.token));
    expect(list.body.items).toEqual([]);
    expect(
      (await request(app).get(`/api/projects/${published.body.project.id}`))
        .status,
    ).toBe(200);
  });

  it("남의 초안은 보거나 지울 수 없고, 크리에이터는 쓸 수 없다", async () => {
    const client = await signup(app, "CLIENT");
    const other = await signup(app, "CLIENT", 2);
    const creator = await signup(app, "CREATOR");
    const draft = await post(client.token, "/api/project-drafts", {});
    expect(
      (
        await request(app)
          .delete(`/api/project-drafts/${draft.body.id}`)
          .set(auth(other.token))
      ).status,
    ).toBe(404);
    expect((await post(creator.token, "/api/project-drafts", {})).status).toBe(
      403,
    );
    expect(
      (
        await request(app)
          .delete(`/api/project-drafts/${draft.body.id}`)
          .set(auth(client.token))
      ).status,
    ).toBe(204);
  });
});
