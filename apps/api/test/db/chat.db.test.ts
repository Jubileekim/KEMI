import { randomUUID } from "node:crypto";
import { VIDEO_PURPOSES, VIDEO_STYLES } from "@kemi/shared";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
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

// 의뢰인 1명, 크리에이터 n명이 지원하고 모두 협의 요청을 받은 상태
async function negotiations(count: number) {
  const client = await signup("CLIENT");
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
  const creators = await Promise.all(
    Array.from({ length: count }, (_, i) => signup("CREATOR", i + 1)),
  );
  const ids = await creators.reduce<Promise<string[]>>(
    async (previous, creator) => {
      const list = await previous;
      const applied = await request(app)
        .post(`/api/projects/${project.id}/applications`)
        .set(auth(creator.token))
        .send({
          message: "감성적인 성장영상을 3일 안에 만들어 드릴게요.",
          proposedAmount: 45_000,
          expectedDays: 3,
        });
      const id = String(applied.body.id);
      const discussed = await request(app)
        .post(`/api/applications/${id}/discuss`)
        .set(auth(client.token));
      expect(discussed.status).toBe(200);
      return [...list, id];
    },
    Promise.resolve([]),
  );
  return { client, creators, project, ids };
}

const send = (
  token: string,
  workRequestId: string,
  body: string,
  clientMessageId = randomUUID(),
) =>
  request(app)
    .post(`/api/work-requests/${workRequestId}/chat/messages`)
    .set(auth(token))
    .send({ clientMessageId, body });

const messages = (token: string, workRequestId: string, query = "") =>
  request(app)
    .get(`/api/work-requests/${workRequestId}/chat/messages${query}`)
    .set(auth(token));

const rooms = (token: string) =>
  request(app).get("/api/chat/rooms").set(auth(token));

describe("요청별 대화방 (CHAT-01~03)", () => {
  it("협의 요청 때 방이 생기고, 당사자끼리 메시지를 주고받는다", async () => {
    const { client, creators, ids } = await negotiations(1);
    const id = ids[0] ?? "";
    const creator = creators[0];

    const sent = await send(
      client.token,
      id,
      "안녕하세요, 일정 먼저 여쭤볼게요.",
    );
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({
      kind: "USER",
      senderId: client.userId.toString(),
    });
    await send(creator?.token ?? "", id, "네, 이번 주 금요일까지 가능합니다.");

    const list = await messages(creator?.token ?? "", id);
    expect(list.status).toBe(200);
    expect(list.body.items.map((m: { body: string }) => m.body)).toEqual([
      "안녕하세요, 일정 먼저 여쭤볼게요.",
      "네, 이번 주 금요일까지 가능합니다.",
    ]);
    expect(list.body.room).toMatchObject({
      workRequestId: id,
      projectTitle: "돌잔치 성장영상",
      counterpartName: "CLIENT 1",
      readOnly: false,
    });
  });

  it("후보별 방은 서로 보이지 않는다(다른 후보·제3자는 404)", async () => {
    const { client, creators, ids } = await negotiations(2);
    await send(client.token, ids[0] ?? "", "1번 후보에게만 보내는 견적 질문");

    expect(
      (await messages(creators[1]?.token ?? "", ids[0] ?? "")).status,
    ).toBe(404);
    expect(
      (await send(creators[1]?.token ?? "", ids[0] ?? "", "끼어들기")).status,
    ).toBe(404);
    const outsider = await signup("CLIENT", 9);
    expect((await messages(outsider.token, ids[0] ?? "")).status).toBe(404);

    const clientRooms = await rooms(client.token);
    expect(clientRooms.body.items).toHaveLength(2);
    const creatorRooms = await rooms(creators[1]?.token ?? "");
    expect(
      creatorRooms.body.items.map(
        (r: { workRequestId: string }) => r.workRequestId,
      ),
    ).toEqual([ids[1]]);
  });

  it("같은 clientMessageId의 재전송은 한 번만 저장하고, 다른 내용이면 409", async () => {
    const { client, ids } = await negotiations(1);
    const id = ids[0] ?? "";
    const messageId = randomUUID();
    const first = await send(client.token, id, "중복 확인", messageId);
    const again = await send(client.token, id, "중복 확인", messageId);
    expect([first.status, again.status]).toEqual([201, 200]);
    expect(again.body).toEqual(first.body);
    expect((await send(client.token, id, "다른 내용", messageId)).status).toBe(
      409,
    );
    expect(await prisma.chatMessage.count()).toBe(1);
  });

  it("미확인 수는 상대가 보낸 메시지만 세고, 읽음 위치는 뒤로 가지 않는다", async () => {
    const { client, creators, ids } = await negotiations(1);
    const id = ids[0] ?? "";
    const creator = creators[0];
    await send(client.token, id, "첫 메시지");
    const second = await send(client.token, id, "두 번째 메시지");
    await send(creator?.token ?? "", id, "제 답장");

    const before = await rooms(creator?.token ?? "");
    expect(before.body.items[0]).toMatchObject({
      unreadCount: 2,
      lastMessage: { body: "제 답장" },
    });

    const read = await request(app)
      .post(`/api/work-requests/${id}/chat/read`)
      .set(auth(creator?.token ?? ""))
      .send({ lastReadMessageId: second.body.id });
    expect(read.status).toBe(200);
    expect(read.body.unreadCount).toBe(0);

    const first = (await messages(creator?.token ?? "", id)).body.items[0].id;
    await request(app)
      .post(`/api/work-requests/${id}/chat/read`)
      .set(auth(creator?.token ?? ""))
      .send({ lastReadMessageId: first });
    expect((await rooms(creator?.token ?? "")).body.items[0].unreadCount).toBe(
      0,
    );
  });

  it("before·after로 페이지를 나눠 받는다", async () => {
    const { client, ids } = await negotiations(1);
    const id = ids[0] ?? "";
    await [1, 2, 3, 4, 5].reduce(
      (p, n) =>
        p.then(() => send(client.token, id, `메시지 ${n}`).then(() => {})),
      Promise.resolve(),
    );
    const latest = await messages(client.token, id, "?limit=2");
    expect(latest.body.items.map((m: { body: string }) => m.body)).toEqual([
      "메시지 4",
      "메시지 5",
    ]);
    expect(latest.body.hasMore).toBe(true);
    const older = await messages(
      client.token,
      id,
      `?limit=2&before=${latest.body.items[0].id}`,
    );
    expect(older.body.items.map((m: { body: string }) => m.body)).toEqual([
      "메시지 2",
      "메시지 3",
    ]);
    const newer = await messages(
      client.token,
      id,
      `?after=${older.body.items[1].id}`,
    );
    expect(newer.body.items.map((m: { body: string }) => m.body)).toEqual([
      "메시지 4",
      "메시지 5",
    ]);
  });
});

describe("협의 종료·계약 전후 (CHAT-04·05, WORK-04)", () => {
  it("거절·철회된 협의의 방은 읽기만 되고, 모집 마감만으로는 닫히지 않는다", async () => {
    const { client, creators, project, ids } = await negotiations(2);
    await send(creators[0]?.token ?? "", ids[0] ?? "", "기록으로 남을 대화");
    await request(app)
      .post(`/api/projects/${project.id}/close`)
      .set(auth(client.token));
    expect(
      (await send(client.token, ids[0] ?? "", "마감 뒤에도 대화")).status,
    ).toBe(201);

    await request(app)
      .post(`/api/applications/${ids[0]}/decline`)
      .set(auth(client.token));
    await request(app)
      .post(`/api/applications/${ids[1]}/withdraw`)
      .set(auth(creators[1]?.token ?? ""));

    const pairs = [
      [client.token, ids[0] ?? ""],
      [creators[1]?.token ?? "", ids[1] ?? ""],
    ];
    const lists = await Promise.all(
      pairs.map(([token, id]) => messages(token ?? "", id ?? "")),
    );
    expect(lists.map((list) => [list.status, list.body.room.readOnly])).toEqual(
      [
        [200, true],
        [200, true],
      ],
    );
    const sends = await Promise.all(
      pairs.map(([token, id]) => send(token ?? "", id ?? "", "닫힌 방")),
    );
    expect(sends.map((r) => r.status)).toEqual([409, 409]);
    expect(
      (await messages(creators[0]?.token ?? "", ids[0] ?? "")).body.items,
    ).toHaveLength(2);
  });

  it("서명 요청·계약 체결이 같은 방에 시스템 안내로 남고, 계약 뒤에도 대화가 이어진다", async () => {
    const { client, creators, ids } = await negotiations(1);
    const id = ids[0] ?? "";
    const creator = creators[0];
    await send(client.token, id, "조건 정리할게요");
    await request(app)
      .post(`/api/work-requests/${id}/terms/versions`)
      .set(auth(client.token))
      .send({
        commandId: randomUUID(),
        baseVersionNo: 0,
        values: {
          amountKrw: 45_000,
          specification: "1분 영상 1편",
          scope: "편집·자막",
          materials: "사진 30장",
          deadline: "자료를 받은 날부터 5일",
          revisions: "2회",
          usageRights: "가족 행사 상영",
          cancellation: "제작 시작 전 전액 환불",
        },
      });
    const signing = await request(app)
      .post(`/api/work-requests/${id}/terms/versions/1/signing`)
      .set(auth(client.token));
    // 서명 순서를 고정한다(두 번째 서명이 계약을 만든다).
    await [creator?.token ?? "", client.token].reduce(
      (previous, token) =>
        previous.then(async () => {
          await request(app)
            .post(`/api/work-requests/${id}/terms/versions/1/signatures`)
            .set(auth(token))
            .send({
              signerName: "서명자",
              consent: true,
              termsHash: signing.body.termsHash,
            });
        }),
      Promise.resolve(),
    );
    expect(
      (await send(creator?.token ?? "", id, "계약 감사합니다")).status,
    ).toBe(201);

    const list = await messages(client.token, id);
    expect(
      list.body.items.map((m: { kind: string; body: string }) =>
        m.kind === "SYSTEM" ? `SYSTEM:${m.body.slice(0, 10)}` : m.body,
      ),
    ).toEqual([
      "조건 정리할게요",
      "SYSTEM:조건서 1번 버전의",
      "SYSTEM:조건서 1번 버전에",
      "계약 감사합니다",
    ]);
    expect(list.body.room.readOnly).toBe(false);
    expect(await prisma.chatRoom.count()).toBe(1);
  });
});
