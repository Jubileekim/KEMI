import { randomUUID } from "node:crypto";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createFileService } from "../../src/files/file.service.js";
import { detectMimeType } from "../../src/files/storage.js";
import { createFakeStorage, fileBytes } from "../support/fake-storage.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

let fake = createFakeStorage();
let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  fake = createFakeStorage();
  app = createTestApp({
    prisma,
    fileService: createFileService({ prisma, storage: fake.storage }),
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

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

async function negotiation() {
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
      proposedAmount: 45_000,
      expectedDays: 3,
    });
  const workRequestId = String(applied.body.id);
  await request(app)
    .post(`/api/applications/${workRequestId}/discuss`)
    .set(auth(client.token));
  return { client, creator, workRequestId };
}

const prepare = (token: string, body: object) =>
  request(app).post("/api/files").set(auth(token)).send(body);

// 업로드 준비 → (가짜) 업로드 → 확인
async function uploadReady(
  token: string,
  body: object,
  bytes: Uint8Array,
): Promise<string> {
  const prepared = await prepare(token, body);
  expect(prepared.status).toBe(201);
  const file = await prisma.file.findUniqueOrThrow({
    where: { id: BigInt(String(prepared.body.file.id)) },
  });
  fake.put(file.storagePath, bytes);
  const done = await request(app)
    .post(`/api/files/${prepared.body.file.id}/complete`)
    .set(auth(token));
  expect(done.body.status).toBe("READY");
  return String(prepared.body.file.id);
}

describe("매직 바이트 판정", () => {
  it("형식 시그니처로 실제 형식을 판정한다", () => {
    expect(detectMimeType(fileBytes("png"))).toBe("image/png");
    expect(detectMimeType(fileBytes("jpeg"))).toBe("image/jpeg");
    expect(detectMimeType(fileBytes("mp4"))).toBe("video/mp4");
    expect(detectMimeType(fileBytes("zip"))).toBe("application/zip");
    expect(detectMimeType(new Uint8Array(16))).toBeNull();
  });
});

describe("파일 업로드 (FILE-01)", () => {
  it("준비 → 업로드 → 확인으로 READY가 되고, 다운로드 URL을 받는다", async () => {
    const { creator, client, workRequestId } = await negotiation();
    const body = {
      purpose: "MATERIAL",
      fileName: "아기사진.png",
      mimeType: "image/png",
      sizeBytes: 64,
      workRequestId,
    };
    const prepared = await prepare(client.token, body);
    expect(prepared.status).toBe(201);
    expect(prepared.body).toMatchObject({
      file: { status: "PENDING", kind: "IMAGE", purpose: "MATERIAL" },
      upload: { token: "t" },
    });
    const fileId = String(prepared.body.file.id);

    // 아직 안 올렸으면 409
    expect(
      (
        await request(app)
          .post(`/api/files/${fileId}/complete`)
          .set(auth(client.token))
      ).status,
    ).toBe(409);

    const row = await prisma.file.findUniqueOrThrow({
      where: { id: BigInt(fileId) },
    });
    fake.put(row.storagePath, fileBytes("png"));
    const done = await request(app)
      .post(`/api/files/${fileId}/complete`)
      .set(auth(client.token));
    expect(done.body.status).toBe("READY");

    // 거래 당사자(크리에이터)도 받을 수 있다.
    const download = await request(app)
      .get(`/api/files/${fileId}/download`)
      .set(auth(creator.token));
    expect(download.status).toBe(200);
    expect(download.body.url).toContain(row.storagePath);
  });

  it("실제 형식·크기가 선언과 다르면 REJECTED이고 다운로드할 수 없다", async () => {
    const { client, workRequestId } = await negotiation();
    const base = {
      purpose: "MATERIAL",
      fileName: "사진.png",
      mimeType: "image/png",
      sizeBytes: 64,
      workRequestId,
    };
    const cases = [
      { bytes: fileBytes("zip"), reason: "형식" },
      { bytes: fileBytes("png", 70), reason: "크기" },
    ];
    const results = await Promise.all(
      cases.map(async ({ bytes }) => {
        const prepared = await prepare(client.token, base);
        const row = await prisma.file.findUniqueOrThrow({
          where: { id: BigInt(String(prepared.body.file.id)) },
        });
        fake.put(row.storagePath, bytes);
        return request(app)
          .post(`/api/files/${prepared.body.file.id}/complete`)
          .set(auth(client.token));
      }),
    );
    results.forEach((res, i) => {
      expect(res.body.status).toBe("REJECTED");
      expect(res.body.rejectionReason).toContain(cases[i]?.reason);
    });
    expect(
      (
        await request(app)
          .get(`/api/files/${results[0]?.body.id}/download`)
          .set(auth(client.token))
      ).status,
    ).toBe(409);
  });

  it("한도를 넘는 크기·허용하지 않는 형식·요청 ID 누락은 400", async () => {
    const { client, workRequestId } = await negotiation();
    const results = await Promise.all(
      [
        {
          purpose: "MATERIAL",
          fileName: "큰사진.png",
          mimeType: "image/png",
          sizeBytes: 10 * 1024 * 1024 + 1,
          workRequestId,
        },
        {
          purpose: "MATERIAL",
          fileName: "문서.pdf",
          mimeType: "application/pdf",
          sizeBytes: 10,
          workRequestId,
        },
        {
          purpose: "MATERIAL",
          fileName: "사진.png",
          mimeType: "image/png",
          sizeBytes: 10,
        },
        {
          purpose: "PROFILE_IMAGE",
          fileName: "로고.png",
          mimeType: "image/png",
          sizeBytes: 10,
          workRequestId,
        },
      ].map((body) => prepare(client.token, body)),
    );
    expect(results.map((r) => r.status)).toEqual([400, 400, 400, 400]);
  });

  it("거래 파일은 당사자만, 프로필 파일은 올린 사람만 볼 수 있다", async () => {
    const { client, workRequestId } = await negotiation();
    const outsider = await signup("CLIENT", 9);
    const material = await uploadReady(
      client.token,
      {
        purpose: "MATERIAL",
        fileName: "사진.png",
        mimeType: "image/png",
        sizeBytes: 64,
        workRequestId,
      },
      fileBytes("png"),
    );
    expect(
      (
        await request(app)
          .get(`/api/files/${material}`)
          .set(auth(outsider.token))
      ).status,
    ).toBe(404);
    expect(
      (
        await prepare(outsider.token, {
          purpose: "MATERIAL",
          fileName: "사진.png",
          mimeType: "image/png",
          sizeBytes: 64,
          workRequestId,
        })
      ).status,
    ).toBe(404);
    // 확인은 올린 사람만
    expect(
      (
        await request(app)
          .post(`/api/files/${material}/complete`)
          .set(auth(outsider.token))
      ).status,
    ).toBe(404);
  });

  it("작업물은 크리에이터만 올리고, 저장소가 없으면 503", async () => {
    const { client } = await negotiation();
    expect(
      (
        await prepare(client.token, {
          purpose: "PORTFOLIO",
          fileName: "작품.mp4",
          mimeType: "video/mp4",
          sizeBytes: 64,
        })
      ).status,
    ).toBe(403);
    app = createTestApp({ prisma });
    expect(
      (
        await prepare(client.token, {
          purpose: "PROFILE_IMAGE",
          fileName: "로고.png",
          mimeType: "image/png",
          sizeBytes: 64,
        })
      ).status,
    ).toBe(503);
  });
});

describe("채팅 첨부 (CHAT-01)", () => {
  it("확인이 끝난 본인 첨부만 붙이고, 첨부만 보낼 수도 있다", async () => {
    const { client, creator, workRequestId } = await negotiation();
    const fileId = await uploadReady(
      client.token,
      {
        purpose: "CHAT_ATTACHMENT",
        fileName: "참고영상.mp4",
        mimeType: "video/mp4",
        sizeBytes: 64,
        workRequestId,
      },
      fileBytes("mp4"),
    );
    const sent = await request(app)
      .post(`/api/work-requests/${workRequestId}/chat/messages`)
      .set(auth(client.token))
      .send({
        clientMessageId: randomUUID(),
        body: "",
        attachmentFileIds: [fileId],
      });
    expect(sent.status).toBe(201);
    expect(sent.body.attachments).toEqual([
      {
        fileId,
        fileName: "참고영상.mp4",
        mimeType: "video/mp4",
        sizeBytes: 64,
      },
    ]);

    // 남이 올린 파일·자료용 파일은 첨부할 수 없다.
    const rejected = await request(app)
      .post(`/api/work-requests/${workRequestId}/chat/messages`)
      .set(auth(creator.token))
      .send({
        clientMessageId: randomUUID(),
        body: "남의 파일",
        attachmentFileIds: [fileId],
      });
    expect(rejected.status).toBe(400);
    const empty = await request(app)
      .post(`/api/work-requests/${workRequestId}/chat/messages`)
      .set(auth(creator.token))
      .send({ clientMessageId: randomUUID(), body: " " });
    expect(empty.status).toBe(400);
  });
});
