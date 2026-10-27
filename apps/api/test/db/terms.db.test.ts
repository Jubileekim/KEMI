import { randomUUID } from "node:crypto";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTermsService } from "../../src/terms/terms.service.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// 서명 기한 테스트용 시계. 조건서 서비스만 이 시계를 쓰고, 로그인 토큰은 실제 시각을 쓴다.
let clock = new Date();
let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  clock = new Date();
  app = createTestApp({
    prisma,
    termsService: createTermsService({ prisma, now: () => clock }),
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

async function createProject(clientId: bigint) {
  const recruitmentEndAt = new Date(Date.now() + 3 * DAY_MS);
  return prisma.project.create({
    data: {
      clientId,
      title: "돌잔치 성장영상",
      description: "아이의 첫 생일에 상영할 성장영상을 만들고 싶습니다.",
      purpose: VIDEO_PURPOSES[0],
      styles: [VIDEO_STYLES[0]],
      budget: 50_000n,
      recruitmentEndAt,
      deliveryDueDate: new Date(recruitmentEndAt.getTime() + 7 * DAY_MS),
    },
  });
}

async function apply(token: string, projectId: bigint) {
  const res = await request(app)
    .post(`/api/projects/${projectId}/applications`)
    .set(auth(token))
    .send({
      message: "감성적인 성장영상을 3일 안에 만들어 드릴게요.",
      proposedAmount: 45_000,
      expectedDays: 3,
    });
  expect(res.status).toBe(201);
  return String(res.body.id);
}

const EMPTY = {
  amountKrw: null,
  specification: null,
  scope: null,
  materials: null,
  deadline: null,
  revisions: null,
  usageRights: null,
  cancellation: null,
};

const FULL = {
  amountKrw: 45_000,
  specification: "1분 내외 성장영상 1편 (가로 1080p)",
  scope: "사진·클립 편집, 자막, 배경음악. 촬영은 제외",
  materials: "사진 30장, 짧은 클립 5개를 제작 시작 전 전달",
  deadline: "자료를 모두 받은 날부터 5일",
  revisions: "완성본 수정 2회 (자막·순서 변경)",
  usageRights: "가족 행사 상영과 개인 SNS 게시",
  cancellation: "제작 시작 전 취소 시 전액 환불",
};

const termsOf = (token: string, workRequestId: string) =>
  request(app)
    .get(`/api/work-requests/${workRequestId}/terms`)
    .set(auth(token));

interface SaveOptions {
  baseVersionNo?: number;
  // 잘못된 입력도 보내 보려고 넓은 타입으로 둔다.
  values?: object;
  commandId?: string;
}

const save = (
  token: string,
  workRequestId: string,
  {
    baseVersionNo = 0,
    values = FULL,
    commandId = randomUUID(),
  }: SaveOptions = {},
) =>
  request(app)
    .post(`/api/work-requests/${workRequestId}/terms/versions`)
    .set(auth(token))
    .send({ commandId, baseVersionNo, values });

const requestSigning = (token: string, workRequestId: string, versionNo = 1) =>
  request(app)
    .post(
      `/api/work-requests/${workRequestId}/terms/versions/${versionNo}/signing`,
    )
    .set(auth(token));

const sign = (
  token: string,
  workRequestId: string,
  termsHash: string,
  { versionNo = 1, signerName = "서명자", consent = true } = {},
) =>
  request(app)
    .post(
      `/api/work-requests/${workRequestId}/terms/versions/${versionNo}/signatures`,
    )
    .set(auth(token))
    .send({ signerName, consent, termsHash });

const notificationsOf = (userId: bigint, type: string) =>
  prisma.notification.findMany({
    where: { recipientUserId: userId, eventType: type },
  });

// 지금 API(accept = 선정)로 협의 중(DISCUSSING)인 요청을 만든다.
async function negotiation() {
  const client = await signup("CLIENT");
  const creator = await signup("CREATOR");
  const project = await createProject(client.userId);
  const workRequestId = await apply(creator.token, project.id);
  const accepted = await request(app)
    .post(`/api/applications/${workRequestId}/accept`)
    .set(auth(client.token));
  expect(accepted.status).toBe(200);
  return { client, creator, project, workRequestId };
}

// 서명 요청까지 마친 상태
async function signingNegotiation() {
  const ctx = await negotiation();
  const saved = await save(ctx.client.token, ctx.workRequestId);
  expect(saved.status).toBe(201);
  const signing = await requestSigning(ctx.client.token, ctx.workRequestId);
  expect(signing.status).toBe(200);
  return { ...ctx, termsHash: String(signing.body.termsHash) };
}

// 기능명세서 흐름(여러 후보와 동시 협의)을 흉내 내려고 DB에서 직접 DISCUSSING으로 바꾼다.
async function twoNegotiations() {
  const client = await signup("CLIENT");
  const first = await signup("CREATOR", 1);
  const second = await signup("CREATOR", 2);
  const project = await createProject(client.userId);
  const firstId = await apply(first.token, project.id);
  const secondId = await apply(second.token, project.id);
  await prisma.workRequest.updateMany({
    where: { id: { in: [BigInt(firstId), BigInt(secondId)] } },
    data: { status: "DISCUSSING" },
  });
  return { client, first, second, project, firstId, secondId };
}

describe("조건서 작성·버전 (TERMS-01·03)", () => {
  it("협의 중인 요청의 당사자는 빈 항목이 있어도 저장하고, 첫 저장 때 참조 사본이 고정된다", async () => {
    const { client, creator, workRequestId } = await negotiation();
    const res = await save(client.token, workRequestId, {
      values: { ...EMPTY, amountKrw: 40_000, scope: "  " },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      versionNo: 1,
      status: "DRAFT",
      values: { ...EMPTY, amountKrw: 40_000, scope: null },
      authorId: client.userId.toString(),
      signing: null,
      signatures: [],
    });
    expect(res.body.termsHash).toMatch(/^[0-9a-f]{64}$/);

    const doc = await termsOf(creator.token, workRequestId);
    expect(doc.status).toBe(200);
    expect(doc.body).toMatchObject({
      workRequestStatus: "DISCUSSING",
      projectStatus: "MATCHED",
      reference: {
        project: { title: "돌잔치 성장영상", budget: 50_000 },
        request: { proposedAmount: 45_000, expectedDays: 3 },
      },
      contract: null,
    });
    expect(doc.body.versions).toHaveLength(1);
  });

  it("새 버전을 저장하면 이전 버전은 대체됨으로 남고, 참조 사본은 바뀌지 않는다", async () => {
    const { client, creator, project, workRequestId } = await negotiation();
    expect((await save(client.token, workRequestId)).status).toBe(201);
    await prisma.project.update({
      where: { id: project.id },
      data: { title: "제목을 바꾼 프로젝트" },
    });
    const second = await save(creator.token, workRequestId, {
      baseVersionNo: 1,
      values: { ...FULL, amountKrw: 48_000 },
    });
    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({ versionNo: 2, status: "DRAFT" });

    const doc = await termsOf(client.token, workRequestId);
    expect(doc.body.versions.map((v: { status: string }) => v.status)).toEqual([
      "SUPERSEDED",
      "DRAFT",
    ]);
    expect(doc.body.versions[0].values.amountKrw).toBe(45_000);
    expect(doc.body.reference.project.title).toBe("돌잔치 성장영상");
  });

  it("다른 당사자가 먼저 저장했으면(기준 버전이 다르면) 409", async () => {
    const { client, creator, workRequestId } = await negotiation();
    expect((await save(client.token, workRequestId)).status).toBe(201);
    const stale = await save(creator.token, workRequestId, {
      baseVersionNo: 0,
    });
    expect(stale.status).toBe(409);
    expect(await prisma.termsVersion.count()).toBe(1);
  });

  it("같은 commandId로 같은 내용을 다시 보내면 새 버전 없이 200, 다른 내용이면 409", async () => {
    const { client, workRequestId } = await negotiation();
    const commandId = randomUUID();
    const first = await save(client.token, workRequestId, { commandId });
    expect(first.status).toBe(201);
    const again = await save(client.token, workRequestId, { commandId });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    const different = await save(client.token, workRequestId, {
      commandId,
      values: { ...FULL, amountKrw: 1 },
    });
    expect(different.status).toBe(409);
    expect(await prisma.termsVersion.count()).toBe(1);
  });

  it("당사자가 아니면 404, 로그인하지 않으면 401, 협의 중이 아니면 409", async () => {
    const { workRequestId } = await negotiation();
    const outsider = await signup("CREATOR", 9);
    expect((await termsOf(outsider.token, workRequestId)).status).toBe(404);
    expect((await save(outsider.token, workRequestId)).status).toBe(404);
    expect((await termsOf(outsider.token, "999999")).status).toBe(404);
    expect(
      (await request(app).get(`/api/work-requests/${workRequestId}/terms`))
        .status,
    ).toBe(401);

    // 선정 전(PENDING) 지원은 아직 협의 중이 아니다.
    const client = await signup("CLIENT", 2);
    const creator = await signup("CREATOR", 2);
    const project = await createProject(client.userId);
    const pendingId = await apply(creator.token, project.id);
    expect((await save(client.token, pendingId)).status).toBe(409);
  });

  it("모집 마감(직접·기한)은 진행 중인 협의를 막지 않고, 무선정 종료·삭제는 막는다", async () => {
    const { client, project, workRequestId } = await negotiation();
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "CLOSED", closeReason: "MANUAL" },
    });
    expect((await save(client.token, workRequestId)).status).toBe(201);
    await prisma.project.update({
      where: { id: project.id },
      data: { closeReason: "EXPIRED" },
    });
    expect(
      (await save(client.token, workRequestId, { baseVersionNo: 1 })).status,
    ).toBe(201);
    await prisma.project.update({
      where: { id: project.id },
      data: { closeReason: "NO_SELECTION" },
    });
    expect(
      (await save(client.token, workRequestId, { baseVersionNo: 2 })).status,
    ).toBe(409);
    await prisma.project.update({
      where: { id: project.id },
      data: { closeReason: "MANUAL", deletedAt: new Date() },
    });
    expect(
      (await save(client.token, workRequestId, { baseVersionNo: 2 })).status,
    ).toBe(409);
  });

  it("입력 범위를 벗어나면 400", async () => {
    const { client, workRequestId } = await negotiation();
    const results = await Promise.all(
      [
        { ...FULL, amountKrw: 0 },
        { ...FULL, amountKrw: 1_000_000_001 },
        { ...FULL, scope: "가".repeat(4001) },
        { ...FULL, unknown: "x" },
      ].map((values) => save(client.token, workRequestId, { values })),
    );
    expect(results.map((res) => res.status)).toEqual([400, 400, 400, 400]);
    expect(await prisma.termsVersion.count()).toBe(0);
  });
});

describe("서명 요청 (TERMS-02)", () => {
  it("비어 있는 조건이 있으면 400과 함께 항목을 알려 준다", async () => {
    const { client, workRequestId } = await negotiation();
    await save(client.token, workRequestId, {
      values: { ...FULL, amountKrw: null, cancellation: null },
    });
    const res = await requestSigning(client.token, workRequestId);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: ["values", "amountKrw"] },
      { path: ["values", "cancellation"] },
    ]);
  });

  it("요청하면 48시간 기한이 생기고 상대방에게 알림이 간다. 다시 보내도 기한은 늘지 않는다", async () => {
    const { client, creator, workRequestId } = await negotiation();
    await save(client.token, workRequestId);
    const res = await requestSigning(client.token, workRequestId);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SIGNING");
    expect(
      Date.parse(res.body.signing.expiresAt) -
        Date.parse(res.body.signing.requestedAt),
    ).toBe(48 * HOUR_MS);

    clock = new Date(clock.getTime() + HOUR_MS);
    const again = await requestSigning(creator.token, workRequestId);
    expect(again.status).toBe(200);
    expect(again.body.signing).toEqual(res.body.signing);
    expect(
      await notificationsOf(creator.userId, "TERMS_SIGNING_REQUESTED"),
    ).toHaveLength(1);
    expect(
      await notificationsOf(client.userId, "TERMS_SIGNING_REQUESTED"),
    ).toHaveLength(0);
  });

  it("마지막 버전이 아니면 409", async () => {
    const { client, workRequestId } = await negotiation();
    await save(client.token, workRequestId);
    await save(client.token, workRequestId, { baseVersionNo: 1 });
    expect((await requestSigning(client.token, workRequestId, 1)).status).toBe(
      409,
    );
    expect((await requestSigning(client.token, workRequestId, 3)).status).toBe(
      404,
    );
  });
});

describe("양측 서명·계약 (CONTRACT-01)", () => {
  it("한쪽만 서명하면 계약이 아니고, 같은 버전에 양측이 서명하면 계약이 체결된다", async () => {
    const { client, creator, project, workRequestId, termsHash } =
      await signingNegotiation();
    const first = await sign(creator.token, workRequestId, termsHash, {
      signerName: "크리에이터 이름",
    });
    expect(first.status).toBe(201);
    expect(first.body.contract).toBeNull();
    expect(first.body.version.status).toBe("SIGNING");
    expect(await prisma.contract.count()).toBe(0);

    const second = await sign(client.token, workRequestId, termsHash, {
      signerName: "의뢰인 이름",
    });
    expect(second.status).toBe(201);
    expect(second.body.version.status).toBe("SIGNED");
    expect(second.body.version.signatures).toHaveLength(2);
    expect(second.body.contract).toMatchObject({
      workRequestId,
      projectId: project.id.toString(),
      termsVersionNo: 1,
      clientId: client.userId.toString(),
      creatorId: creator.userId.toString(),
      amountKrw: 45_000,
      termsHash,
      status: "SIGNED",
    });

    expect(
      (
        await prisma.workRequest.findUniqueOrThrow({
          where: { id: BigInt(workRequestId) },
        })
      ).status,
    ).toBe("CONTRACTED");
    expect(
      await prisma.project.findUniqueOrThrow({ where: { id: project.id } }),
    ).toMatchObject({ status: "CONTRACTED", closeReason: null });
    expect(
      await notificationsOf(client.userId, "CONTRACT_SIGNED"),
    ).toHaveLength(1);
    expect(
      await notificationsOf(creator.userId, "CONTRACT_SIGNED"),
    ).toHaveLength(1);

    const contracts = await Promise.all(
      [client.token, creator.token].map((token) =>
        request(app)
          .get(`/api/work-requests/${workRequestId}/contract`)
          .set(auth(token)),
      ),
    );
    contracts.forEach((contract) => {
      expect(contract.status).toBe(200);
      expect(contract.body).toEqual(second.body.contract);
    });
    const outsider = await signup("CREATOR", 9);
    expect(
      (
        await request(app)
          .get(`/api/work-requests/${workRequestId}/contract`)
          .set(auth(outsider.token))
      ).status,
    ).toBe(404);
  });

  it("같은 서명을 다시 보내면 200으로 이전 결과를 주고 계약을 다시 만들지 않는다", async () => {
    const { client, creator, workRequestId, termsHash } =
      await signingNegotiation();
    await sign(creator.token, workRequestId, termsHash);
    const done = await sign(client.token, workRequestId, termsHash);
    expect(done.status).toBe(201);
    const again = await sign(client.token, workRequestId, termsHash);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(done.body);
    expect(await prisma.contract.count()).toBe(1);
    expect(
      (
        await sign(client.token, workRequestId, termsHash, {
          signerName: "다른 이름",
        })
      ).status,
    ).toBe(409);
  });

  it("화면이 본 내용의 해시가 다르거나, 동의하지 않거나, 이름이 없으면 서명할 수 없다", async () => {
    const { creator, workRequestId, termsHash } = await signingNegotiation();
    expect(
      (await sign(creator.token, workRequestId, "0".repeat(64))).status,
    ).toBe(409);
    expect(
      (await sign(creator.token, workRequestId, termsHash, { consent: false }))
        .status,
    ).toBe(400);
    expect(
      (await sign(creator.token, workRequestId, termsHash, { signerName: " " }))
        .status,
    ).toBe(400);
    expect(
      (
        await sign(creator.token, workRequestId, termsHash, {
          signerName: "가".repeat(101),
        })
      ).status,
    ).toBe(400);
    expect(await prisma.signature.count()).toBe(0);
  });

  it("서명 요청 전(DRAFT) 버전에는 서명할 수 없다", async () => {
    const { client, workRequestId } = await negotiation();
    const saved = await save(client.token, workRequestId);
    expect(
      (await sign(client.token, workRequestId, String(saved.body.termsHash)))
        .status,
    ).toBe(409);
  });

  it("계약 뒤에는 새 버전 저장·서명 요청이 409다", async () => {
    const { client, creator, workRequestId, termsHash } =
      await signingNegotiation();
    await sign(creator.token, workRequestId, termsHash);
    await sign(client.token, workRequestId, termsHash);
    expect(
      (await save(client.token, workRequestId, { baseVersionNo: 1 })).status,
    ).toBe(409);
    expect((await requestSigning(client.token, workRequestId)).status).toBe(
      409,
    );
  });
});

describe("조건 변경·만료·재확인 (TERMS-03)", () => {
  it("서명 도중 조건을 바꾸면 이전 버전과 서명은 보존되고, 서명은 새 버전에 복사되지 않는다", async () => {
    const { client, creator, workRequestId, termsHash } =
      await signingNegotiation();
    await sign(creator.token, workRequestId, termsHash);
    const changed = await save(client.token, workRequestId, {
      baseVersionNo: 1,
      values: { ...FULL, amountKrw: 50_000 },
    });
    expect(changed.status).toBe(201);
    expect(changed.body.signatures).toEqual([]);

    const doc = await termsOf(client.token, workRequestId);
    expect(doc.body.versions[0]).toMatchObject({ status: "SUPERSEDED" });
    expect(doc.body.versions[0].signatures).toHaveLength(1);
    // 대체된 버전에는 더 이상 서명할 수 없다.
    expect((await sign(client.token, workRequestId, termsHash)).status).toBe(
      409,
    );
    expect(await prisma.contract.count()).toBe(0);
  });

  it("48시간이 지나면 만료로 보이고 서명·같은 버전 재요청은 막힌다. 같은 내용으로 새 버전을 만들면 다시 요청할 수 있다", async () => {
    const { client, creator, workRequestId, termsHash } =
      await signingNegotiation();
    clock = new Date(clock.getTime() + 48 * HOUR_MS);

    const doc = await termsOf(client.token, workRequestId);
    expect(doc.body.versions[0].status).toBe("EXPIRED");
    expect((await sign(creator.token, workRequestId, termsHash)).status).toBe(
      409,
    );
    expect((await requestSigning(client.token, workRequestId)).status).toBe(
      409,
    );

    const renewed = await save(client.token, workRequestId, {
      baseVersionNo: 1,
    });
    expect(renewed.status).toBe(201);
    expect(renewed.body.termsHash).not.toBe(termsHash);
    const stored = await prisma.termsVersion.findMany({
      orderBy: { versionNo: "asc" },
    });
    expect(stored.map((v) => v.status)).toEqual(["EXPIRED", "DRAFT"]);
    expect((await requestSigning(client.token, workRequestId, 2)).status).toBe(
      200,
    );
  });

  it("기한 직전에는 서명할 수 있다", async () => {
    const { client, creator, workRequestId, termsHash } =
      await signingNegotiation();
    clock = new Date(clock.getTime() + 48 * HOUR_MS - 1);
    await sign(creator.token, workRequestId, termsHash);
    const done = await sign(client.token, workRequestId, termsHash);
    expect(done.status).toBe(201);
    expect(done.body.contract).not.toBeNull();
  });
});

describe("같은 프로젝트의 다른 협의 (기능명세서 흐름)", () => {
  async function readyToSign(
    token: string,
    otherToken: string,
    workRequestId: string,
  ) {
    await save(token, workRequestId);
    const signing = await requestSigning(token, workRequestId);
    expect(signing.status).toBe(200);
    const termsHash = String(signing.body.termsHash);
    expect((await sign(otherToken, workRequestId, termsHash)).status).toBe(201);
    return termsHash;
  }

  it("한 후보와 계약하면 다른 활성 후보는 미선정이 되고, 그 조건서는 무효가 되며 알림이 간다", async () => {
    const { client, first, second, firstId, secondId } =
      await twoNegotiations();
    const hash = await readyToSign(client.token, first.token, firstId);
    await save(second.token, secondId);
    const other = await requestSigning(second.token, secondId);
    expect(other.status).toBe(200);

    expect((await sign(client.token, firstId, hash)).status).toBe(201);

    expect(
      await prisma.workRequest.findUniqueOrThrow({
        where: { id: BigInt(secondId) },
      }),
    ).toMatchObject({ status: "NOT_SELECTED", closedReason: "OTHER_SELECTED" });
    expect(
      (
        await prisma.termsVersion.findFirstOrThrow({
          where: { workRequestId: BigInt(secondId) },
        })
      ).status,
    ).toBe("VOID");
    expect(
      await notificationsOf(second.userId, "APPLICATION_AUTO_REJECTED"),
    ).toHaveLength(1);
    // 미선정된 협의는 기록만 볼 수 있다.
    expect((await termsOf(second.token, secondId)).status).toBe(200);
    expect(
      (await save(second.token, secondId, { baseVersionNo: 1 })).status,
    ).toBe(409);
  });

  it("두 협의에서 동시에 두 번째 서명이 들어와도 계약은 하나만 생긴다", async () => {
    const { client, first, second, firstId, secondId } =
      await twoNegotiations();
    const firstHash = await readyToSign(client.token, first.token, firstId);
    const secondHash = await readyToSign(client.token, second.token, secondId);

    const results = await Promise.all([
      sign(client.token, firstId, firstHash),
      sign(client.token, secondId, secondHash),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.contract.count()).toBe(1);
    const statuses = await prisma.workRequest.findMany({
      select: { status: true },
      orderBy: { status: "asc" },
    });
    expect(statuses.map((s) => s.status)).toEqual([
      "CONTRACTED",
      "NOT_SELECTED",
    ]);
  });
});
