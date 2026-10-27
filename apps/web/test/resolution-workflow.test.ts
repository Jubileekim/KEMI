import { it, expect } from "vitest";
import {
  changeWorkflow,
  emptyWorkflow,
  workflowCommandSchema,
  type WorkflowContext,
  type WorkflowCommand,
} from "../src/mocks/resolution-workflow-model";
import {
  resolutionViewSchema,
  emptyResolution,
} from "../src/mocks/resolution-model";

const uuid = () => crypto.randomUUID();
const versionId = uuid();
const orderId = uuid();
const now = "2026-10-27T00:00:00.000Z";
const context: WorkflowContext = {
  actorId: "client",
  role: "CLIENT",
  clientId: "client",
  creatorId: "creator",
  amount: 200000,
  paidOrder: { id: orderId, amount: 200000, currency: "KRW" },
  version: {
    id: versionId,
    actorId: "client",
    at: now,
    values: {
      reason: "취소",
      progress: "편집 일부",
      compensation: 80000,
      files: "합의 파일",
      unfinished: "중단",
      originals: "인도",
      rights: "광고1회",
    },
    refund: 120000,
    confirmations: ["client", "creator"],
  },
  outcome: "SUCCEEDED",
  now,
  ownedFiles: [],
};
const creator = { ...context, actorId: "creator", role: "CREATOR" } as const;
const admin = { ...context, actorId: "ops", role: "ADMIN" } as const;
const command = (type: "refund" | "settle") =>
  type === "refund"
    ? { type, id: uuid(), revision: 0, versionId, orderId }
    : { type, id: uuid(), revision: 0, versionId };
function ready() {
  let state = changeWorkflow(emptyWorkflow(), command("refund"), context);
  const handover: WorkflowCommand = {
    type: "handover",
    id: uuid(),
    revision: 0,
    versionId,
    fileIds: [],
    description: "파일 없음에 양측 별도 확인",
  };
  state = changeWorkflow(state, handover, creator);
  return changeWorkflow(
    state,
    {
      type: "receive",
      id: uuid(),
      revision: 0,
      versionId,
      handoverId: handover.id,
      consent: true,
    },
    context,
  );
}
it("20만원-8만원=12만원 환불 후 파일 수령과 해제 근거가 있어야 수수료8천원/정산7.2만원", () => {
  const state = ready();
  expect(state.refunds.at(-1)).toMatchObject({
    amount: 120000,
    status: "SUCCEEDED",
    orderId,
    versionId,
  });
  expect(() => changeWorkflow(state, command("settle"), context)).toThrow();
  const released = changeWorkflow(
    state,
    {
      type: "release",
      id: uuid(),
      revision: 0,
      versionId,
      reason: "양측 동일 합의·환불·파일 수령 증빙 대조",
    },
    admin,
  );
  const done = changeWorkflow(released, command("settle"), context);
  expect(done.settlement).toMatchObject({
    compensation: 80000,
    fee: 8000,
    net: 72000,
    status: "SUCCEEDED",
  });
  expect(changeWorkflow(done, command("settle"), creator)).toBe(done);
});
it("원결제 불일치·합의 버전/양측 확인 누락·초과금액·사용자 환불 결과 주입을 거부한다", () => {
  expect(() =>
    changeWorkflow(
      emptyWorkflow(),
      { type: "refund", id: uuid(), revision: 0, versionId, orderId: uuid() },
      context,
    ),
  ).toThrow();
  expect(() =>
    changeWorkflow(emptyWorkflow(), command("refund"), {
      ...context,
      paidOrder: undefined,
    }),
  ).toThrow();
  expect(() =>
    changeWorkflow(emptyWorkflow(), command("refund"), {
      ...context,
      version: context.version && {
        ...context.version,
        confirmations: ["client"],
      },
    }),
  ).toThrow();
  expect(() =>
    changeWorkflow(emptyWorkflow(), command("refund"), {
      ...context,
      version: context.version && { ...context.version, refund: 200001 },
    }),
  ).toThrow();
  expect(
    workflowCommandSchema.safeParse({
      ...command("refund"),
      outcome: "SUCCEEDED",
      amount: 1,
    }).success,
  ).toBe(false);
});
it("결과 확인 중/처리 중은 완료가 아니며 다른 환불 ID 차단·같은 ID로 조정한다", () => {
  const cmd = command("refund");
  const state = changeWorkflow(emptyWorkflow(), cmd, {
    ...context,
    outcome: "UNKNOWN",
  });
  expect(state.settlement).toBeNull();
  expect(() => changeWorkflow(state, command("refund"), context)).toThrow();
  const done = changeWorkflow(state, cmd, context);
  expect(done.refunds).toHaveLength(1);
  expect(done.refunds[0]?.status).toBe("SUCCEEDED");
  expect(changeWorkflow(done, command("refund"), context)).toBe(done);
});
it("실패한 요청은 같은 ID로 성공 변환하지 않으며 명시적 새 요청만 가능하다", () => {
  const cmd = command("refund");
  const state = changeWorkflow(emptyWorkflow(), cmd, {
    ...context,
    outcome: "FAILED",
  });
  expect(changeWorkflow(state, cmd, context)).toBe(state);
  expect(
    changeWorkflow(state, command("refund"), context).refunds,
  ).toHaveLength(2);
});
it("분쟁 중 환불·잔여 정산 보류, 운영자는 합의 대행 불가·근거 기록 후 복귀", () => {
  const dispute: WorkflowCommand = {
    type: "dispute",
    id: uuid(),
    revision: 0,
    reason: "납품 이견",
    evidence: "검토본v1과 계약 대조",
  };
  const state = changeWorkflow(emptyWorkflow(), dispute, context);
  expect(() => changeWorkflow(state, command("refund"), context)).toThrow();
  const review: WorkflowCommand = {
    type: "review",
    id: uuid(),
    revision: 0,
    disputeId: dispute.id,
    note: "동일 버전 양측 확인 증빙",
    nextStep: "합의 파일 인도",
    release: true,
  };
  expect(() => changeWorkflow(state, review, context)).toThrow();
  expect(() =>
    changeWorkflow(state, review, { ...admin, version: undefined }),
  ).toThrow();
  const released = changeWorkflow(state, review, admin);
  expect(released.disputes[0]?.reviews[0]).toMatchObject({
    actorId: "ops",
    note: review.note,
  });
  expect(
    changeWorkflow(released, command("refund"), context).refunds[0]?.status,
  ).toBe("SUCCEEDED");
});
it("인도·수령 역할과 파일 소유권·구버전·운영 해제 권한을 검사한다", () => {
  const cmd: WorkflowCommand = {
    type: "handover",
    id: uuid(),
    revision: 0,
    versionId,
    fileIds: [uuid()],
    description: "타인 파일",
  };
  expect(() => changeWorkflow(emptyWorkflow(), cmd, creator)).toThrow();
  expect(() =>
    changeWorkflow(emptyWorkflow(), { ...cmd, fileIds: [] }, context),
  ).toThrow();
  expect(() =>
    changeWorkflow(
      ready(),
      {
        type: "release",
        id: uuid(),
        revision: 0,
        versionId,
        reason: "자가 해제",
      },
      context,
    ),
  ).toThrow();
  expect(() =>
    changeWorkflow(
      ready(),
      {
        type: "release",
        id: uuid(),
        revision: 0,
        versionId: uuid(),
        reason: "구버전",
      },
      admin,
    ),
  ).toThrow();
});
it("전액 환불은 잔여 정산0, 소수 원 수수료는 D12 조율 전 보류한다", () => {
  const zero = {
    ...context,
    version: context.version && {
      ...context.version,
      refund: 200000,
      values: { ...context.version.values, compensation: 0 },
    },
  };
  let state = changeWorkflow(emptyWorkflow(), command("refund"), zero);
  const handover: WorkflowCommand = {
    type: "handover",
    id: uuid(),
    revision: 0,
    versionId,
    fileIds: [],
    description: "인도 파일 없음",
  };
  state = changeWorkflow(state, handover, {
    ...zero,
    ...creator,
    version: zero.version,
  });
  state = changeWorkflow(
    state,
    {
      type: "receive",
      id: uuid(),
      revision: 0,
      versionId,
      handoverId: handover.id,
      consent: true,
    },
    zero,
  );
  state = changeWorkflow(
    state,
    {
      type: "release",
      id: uuid(),
      revision: 0,
      versionId,
      reason: "전액 환불·파일 없음 합의 대조",
    },
    { ...zero, actorId: "ops", role: "ADMIN" },
  );
  expect(
    changeWorkflow(state, command("settle"), zero).settlement,
  ).toMatchObject({ fee: 0, net: 0 });
  expect(() =>
    changeWorkflow(state, command("settle"), {
      ...zero,
      version: zero.version && {
        ...zero.version,
        values: { ...zero.version.values, compensation: 1 },
      },
    }),
  ).toThrow();
});
it("정산 응답의 금액 변조를 스키마에서 차단한다", () => {
  const state = ready();
  const released = changeWorkflow(
    state,
    { type: "release", id: uuid(), revision: 0, versionId, reason: "근거" },
    admin,
  );
  const workflow = changeWorkflow(released, command("settle"), context);
  const view = {
    contractId: uuid(),
    requestId: uuid(),
    clientId: "client",
    creatorId: "creator",
    amount: 200000,
    paidAmount: 200000,
    orderId,
    blocked: "",
    state: {
      ...emptyResolution(),
      versions: context.version ? [context.version] : [],
      workflow,
    },
  };
  expect(resolutionViewSchema.safeParse(view).success).toBe(true);
  expect(
    resolutionViewSchema.safeParse({
      ...view,
      state: {
        ...view.state,
        workflow: {
          ...workflow,
          settlement: workflow.settlement && {
            ...workflow.settlement,
            net: 999999,
          },
        },
      },
    }).success,
  ).toBe(false);
});
it("잔여 정산 미확정 중 분쟁은 완료를 보류하고 근거 재검토 후 같은 요청으로 확인한다", () => {
  let state = changeWorkflow(
    ready(),
    {
      type: "release",
      id: uuid(),
      revision: 0,
      versionId,
      reason: "최초 근거",
    },
    admin,
  );
  const cmd = command("settle");
  state = changeWorkflow(state, cmd, { ...context, outcome: "UNKNOWN" });
  const dispute: WorkflowCommand = {
    type: "dispute",
    id: uuid(),
    revision: 0,
    reason: "새 증빙",
    evidence: "기록 대조",
  };
  state = changeWorkflow(state, dispute, context);
  expect(() => changeWorkflow(state, cmd, context)).toThrow();
  state = changeWorkflow(
    state,
    {
      type: "review",
      id: uuid(),
      revision: 0,
      disputeId: dispute.id,
      note: "증빙 확인·동일 합의 유지",
      nextStep: "기존 결과 확인",
      release: true,
    },
    admin,
  );
  state = changeWorkflow(
    state,
    {
      type: "release",
      id: uuid(),
      revision: 0,
      versionId,
      reason: "재검토 근거",
    },
    admin,
  );
  expect(changeWorkflow(state, cmd, context).settlement?.status).toBe(
    "SUCCEEDED",
  );
});
