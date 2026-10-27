import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createProductionService,
  dueDateFrom,
} from "../../src/production/production.service.js";
import { auth, signedDeal, signup } from "../support/deal.js";
import { createTestApp } from "../support/test-app.js";
import { createTestPrismaClient, resetDatabase } from "../support/test-db.js";

const prisma = createTestPrismaClient();

afterAll(async () => {
  await prisma.$disconnect();
});

// 시작 시각을 고정한다: 2026-10-26 15:30 UTC = 10-27 00:30 KST
const START = new Date("2026-10-26T15:30:00.000Z");
let app = createTestApp({ prisma });

beforeEach(async () => {
  await resetDatabase(prisma);
  app = createTestApp({
    prisma,
    productionService: createProductionService({ prisma, now: () => START }),
  });
});

const base = (contractId: string) => `/api/contracts/${contractId}/production`;
const get = (token: string, contractId: string) =>
  request(app).get(base(contractId)).set(auth(token));
// 자료 추가는 commandId가 필요하다. 테스트에서 따로 주지 않으면 새로 만든다.
const post = (token: string, path: string, body: object = {}) =>
  request(app)
    .post(path)
    .set(auth(token))
    .send(
      path.endsWith("/materials") && !("commandId" in body)
        ? { commandId: randomUUID(), ...body }
        : body,
    );

describe("자료 재전송 (READY-01 멱등성)", () => {
  it("같은 commandId·같은 내용은 자료를 하나만 만들고, 내용이 다르면 409", async () => {
    const { client, contractId } = await signedDeal(app, prisma);
    const commandId = randomUUID();
    const shipment = {
      commandId,
      kind: "SHIPMENT",
      carrier: "우체국",
      trackingNumber: "1234-5678",
    };
    // 응답을 못 받은 화면이 같은 요청을 동시에 여러 번 보낸 경우
    const sent = await Promise.all(
      [1, 2, 3].map(() =>
        post(client.token, `${base(contractId)}/materials`, shipment),
      ),
    );
    expect(sent.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(sent.map((r) => r.body.materials.length)).toEqual([1, 1, 1]);
    const changed = await post(client.token, `${base(contractId)}/materials`, {
      ...shipment,
      trackingNumber: "9999-0000",
    });
    expect(changed.status).toBe(409);
    expect(
      await prisma.productionMaterial.count({
        where: { contractId: BigInt(contractId) },
      }),
    ).toBe(1);
  });
});

describe("마감일 계산 [제안, D09]", () => {
  it("KST 시작일 + 작업 일수(달력일)", () => {
    // 10-27 00:30 KST 시작, 5일 → 11-01
    expect(dueDateFrom(START, 5)).toBe("2026-11-01");
    // 10-26 23:59 KST 시작이면 하루 이르다.
    expect(dueDateFrom(new Date("2026-10-26T14:59:00.000Z"), 5)).toBe(
      "2026-10-31",
    );
  });
});

describe("제작 준비 자료 (READY-01·02)", () => {
  it("계약 체결 때 제작 준비가 열리고, 의뢰인이 낸 자료를 크리에이터가 확인한다", async () => {
    const { client, creator, contractId } = await signedDeal(app, prisma, {
      paid: true,
    });
    const before = await get(creator.token, contractId);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({
      status: "PREPARING",
      paid: true,
      materials: [],
      readyToStart: false,
      workingDays: 5,
      dueDate: null,
    });

    const added = await post(client.token, `${base(contractId)}/materials`, {
      kind: "SHIPMENT",
      carrier: "CJ대한통운",
      trackingNumber: "123456789012",
      note: "앨범 원본",
    });
    expect(added.status).toBe(201);
    const materialId = added.body.materials[0].id;
    expect(added.body.materials[0].status).toBe("SUBMITTED");

    // 의뢰인은 확인할 수 없고, 크리에이터는 자료를 낼 수 없다.
    expect(
      (
        await post(
          client.token,
          `${base(contractId)}/materials/${materialId}/confirm`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await post(creator.token, `${base(contractId)}/materials`, {
          kind: "NOTE",
          note: "크리에이터 메모",
        })
      ).status,
    ).toBe(403);

    const confirmed = await post(
      creator.token,
      `${base(contractId)}/materials/${materialId}/confirm`,
    );
    expect(confirmed.body.materials[0].status).toBe("CONFIRMED");
    expect(confirmed.body.readyToStart).toBe(true);
  });

  it("문제를 신고하면 시작할 수 없고, 의뢰인이 대체 자료를 내면 다시 확인할 수 있다", async () => {
    const { client, creator, contractId } = await signedDeal(app, prisma, {
      paid: true,
    });
    const first = await post(client.token, `${base(contractId)}/materials`, {
      kind: "NOTE",
      note: "사진은 드라이브 링크로 드릴게요",
    });
    const [{ id }] = first.body.materials;
    const reported = await post(
      creator.token,
      `${base(contractId)}/materials/${id}/issue`,
      { note: "링크 권한이 없어 열리지 않습니다" },
    );
    expect(reported.body.materials[0]).toMatchObject({
      status: "ISSUE_REPORTED",
      issueNote: "링크 권한이 없어 열리지 않습니다",
    });
    expect(
      (await post(creator.token, `${base(contractId)}/start`)).status,
    ).toBe(409);

    const replaced = await post(client.token, `${base(contractId)}/materials`, {
      kind: "NOTE",
      note: "권한을 열었습니다",
      replacesMaterialId: id,
    });
    expect(
      replaced.body.materials.map((m: { status: string }) => m.status),
    ).toEqual(["REPLACED", "SUBMITTED"]);
    // 같은 자료를 두 번 대체할 수 없다.
    expect(
      (
        await post(client.token, `${base(contractId)}/materials`, {
          kind: "NOTE",
          note: "또 대체",
          replacesMaterialId: id,
        })
      ).status,
    ).toBe(409);
  });

  it("당사자가 아니면 404", async () => {
    const { contractId } = await signedDeal(app, prisma, { paid: true });
    const outsider = await signup(app, "CLIENT", 9);
    expect((await get(outsider.token, contractId)).status).toBe(404);
  });
});

describe("제작 시작 (WORK-01)", () => {
  async function confirmedDeal(paid: boolean) {
    const deal = await signedDeal(app, prisma, { paid });
    const added = await post(
      deal.client.token,
      `${base(deal.contractId)}/materials`,
      {
        kind: "NOTE",
        note: "자료 전달 완료",
      },
    );
    await post(
      deal.creator.token,
      `${base(deal.contractId)}/materials/${added.body.materials[0].id}/confirm`,
    );
    return deal;
  }

  it("결제가 끝나지 않았으면 시작할 수 없다", async () => {
    const { creator, contractId } = await confirmedDeal(false);
    expect((await get(creator.token, contractId)).body.readyToStart).toBe(
      false,
    );
    expect(
      (await post(creator.token, `${base(contractId)}/start`)).status,
    ).toBe(409);
  });

  it("자료가 없거나 미확인 자료가 있으면 시작할 수 없다", async () => {
    const { client, creator, contractId } = await signedDeal(app, prisma, {
      paid: true,
    });
    expect(
      (await post(creator.token, `${base(contractId)}/start`)).status,
    ).toBe(409);
    await post(client.token, `${base(contractId)}/materials`, {
      kind: "NOTE",
      note: "미확인 자료",
    });
    expect(
      (await post(creator.token, `${base(contractId)}/start`)).status,
    ).toBe(409);
  });

  it("조건이 갖춰지면 크리에이터가 시작하고, 마감일은 한 번 계산된다", async () => {
    const { client, creator, contractId, workRequestId } =
      await confirmedDeal(true);
    expect((await post(client.token, `${base(contractId)}/start`)).status).toBe(
      403,
    );
    const started = await post(creator.token, `${base(contractId)}/start`);
    expect(started.status).toBe(200);
    expect(started.body).toMatchObject({
      status: "IN_PROGRESS",
      startedAt: START.toISOString(),
      dueDate: "2026-11-01",
    });
    expect(
      (await post(creator.token, `${base(contractId)}/start`)).status,
    ).toBe(409);
    // 시작 뒤에는 자료를 더 낼 수 없다.
    expect(
      (
        await post(client.token, `${base(contractId)}/materials`, {
          kind: "NOTE",
          note: "늦은 자료",
        })
      ).status,
    ).toBe(409);
    const chat = await request(app)
      .get(`/api/work-requests/${workRequestId}/chat/messages`)
      .set(auth(client.token));
    expect(
      chat.body.items.some((m: { body: string }) =>
        m.body.includes("제작이 시작되었습니다"),
      ),
    ).toBe(true);
  });

  describe("납기 변경 (WORK-02)", () => {
    async function inProgress() {
      const deal = await confirmedDeal(true);
      await post(deal.creator.token, `${base(deal.contractId)}/start`);
      return deal;
    }

    it("한쪽이 요청하고 다른 쪽이 승인해야 마감일이 바뀌며, 이력이 남는다", async () => {
      const { client, creator, contractId } = await inProgress();
      const requested = await post(
        creator.token,
        `${base(contractId)}/deadline-changes`,
        { newDueDate: "2026-11-04", reason: "자료 보강으로 3일 연장 요청" },
      );
      expect(requested.status).toBe(201);
      const change = requested.body.deadlineChanges[0];
      expect(change).toMatchObject({
        previousDueDate: "2026-11-01",
        newDueDate: "2026-11-04",
        status: "PENDING",
      });
      expect(requested.body.dueDate).toBe("2026-11-01");

      // 요청자는 스스로 승인할 수 없고, 대기 중 요청이 있으면 새 요청은 409
      expect(
        (
          await post(
            creator.token,
            `${base(contractId)}/deadline-changes/${change.id}/approve`,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await post(client.token, `${base(contractId)}/deadline-changes`, {
            newDueDate: "2026-11-02",
            reason: "다른 요청",
          })
        ).status,
      ).toBe(409);

      const approved = await post(
        client.token,
        `${base(contractId)}/deadline-changes/${change.id}/approve`,
      );
      expect(approved.body.dueDate).toBe("2026-11-04");
      expect(approved.body.deadlineChanges[0].status).toBe("APPROVED");
      expect(
        (
          await post(
            client.token,
            `${base(contractId)}/deadline-changes/${change.id}/reject`,
          )
        ).status,
      ).toBe(409);
    });

    it("거절하면 기존 마감일을 유지하고, 같은 날짜로는 요청할 수 없다", async () => {
      const { client, creator, contractId } = await inProgress();
      expect(
        (
          await post(client.token, `${base(contractId)}/deadline-changes`, {
            newDueDate: "2026-11-01",
            reason: "같은 날짜",
          })
        ).status,
      ).toBe(409);
      const requested = await post(
        client.token,
        `${base(contractId)}/deadline-changes`,
        { newDueDate: "2026-10-30", reason: "행사가 앞당겨졌어요" },
      );
      const rejected = await post(
        creator.token,
        `${base(contractId)}/deadline-changes/${requested.body.deadlineChanges[0].id}/reject`,
      );
      expect(rejected.body.dueDate).toBe("2026-11-01");
      expect(rejected.body.deadlineChanges[0].status).toBe("REJECTED");
    });

    it("제작 시작 전에는 납기 변경을 요청할 수 없다", async () => {
      const { creator, contractId } = await confirmedDeal(true);
      expect(
        (
          await post(creator.token, `${base(contractId)}/deadline-changes`, {
            newDueDate: "2026-11-04",
            reason: "시작 전",
          })
        ).status,
      ).toBe(409);
    });
  });
});
