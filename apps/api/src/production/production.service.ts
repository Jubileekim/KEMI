import {
  type AuthUser,
  type DeadlineChange,
  type Production,
  type ProductionMaterial,
  deadlineChangeCreateSchema,
  deadlineChangeStatusSchema,
  materialCreateSchema,
  materialIssueSchema,
  materialKindSchema,
  materialStatusSchema,
  productionStatusSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { postSystemMessage } from "../chat/chat.service.js";
import { requireReadyFiles } from "../files/file.service.js";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };
const DAY_MS = 24 * 60 * 60 * 1000;

const includeAll = {
  materials: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  deadlineChanges: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  contract: {
    select: {
      id: true,
      workRequestId: true,
      clientId: true,
      creatorId: true,
      payments: { where: { status: "SUCCEEDED" }, select: { id: true } },
    },
  },
} satisfies Prisma.ProductionInclude;

type ProductionRow = Prisma.ProductionGetPayload<{
  include: typeof includeAll;
}>;

// KST 기준 날짜(YYYY-MM-DD)
export function kstDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
const toDbDate = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00.000Z`);

// [제안, D09] 실제 마감일 = 제작 시작일(KST) + 작업 일수(달력일). 시작일 다음 날부터 센다.
export function dueDateFrom(startedAt: Date, workingDays: number): string {
  return dateOnly(
    new Date(toDbDate(kstDate(startedAt)).getTime() + workingDays * DAY_MS),
  );
}

// 미확인(SUBMITTED)·문제 신고(ISSUE_REPORTED) 자료가 없고, 확인된 자료가 하나 이상이어야 시작할 수 있다.
function materialsReady(materials: { status: string }[]) {
  return (
    materials.some((m) => m.status === "CONFIRMED") &&
    !materials.some(
      (m) => m.status === "SUBMITTED" || m.status === "ISSUE_REPORTED",
    )
  );
}

function toMaterial(
  row: ProductionRow["materials"][number],
): ProductionMaterial {
  return {
    id: row.id.toString(),
    kind: materialKindSchema.parse(row.kind),
    status: materialStatusSchema.parse(row.status),
    fileId: row.fileId?.toString() ?? null,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    note: row.note,
    issueNote: row.issueNote,
    replacesMaterialId: row.replacesMaterialId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

function toChange(
  row: ProductionRow["deadlineChanges"][number],
): DeadlineChange {
  return {
    id: row.id.toString(),
    requestedBy: row.requestedBy.toString(),
    previousDueDate: dateOnly(row.previousDueDate),
    newDueDate: dateOnly(row.newDueDate),
    reason: row.reason,
    status: deadlineChangeStatusSchema.parse(row.status),
    respondedBy: row.respondedBy?.toString() ?? null,
    respondedAt: row.respondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProduction(row: ProductionRow): Production {
  const paid = row.contract.payments.length > 0;
  return {
    contractId: row.contractId.toString(),
    workRequestId: row.contract.workRequestId.toString(),
    status: productionStatusSchema.parse(row.status),
    paid,
    materials: row.materials.map(toMaterial),
    readyToStart:
      row.status === "PREPARING" && paid && materialsReady(row.materials),
    startedAt: row.startedAt?.toISOString() ?? null,
    workingDays: row.workingDays,
    dueDate: row.dueDate ? dateOnly(row.dueDate) : null,
    deadlineChanges: row.deadlineChanges.map(toChange),
  };
}

const conflict = (message: string) => new AppError(409, "CONFLICT", message);
const notFound = (what: string) =>
  new AppError(404, "NOT_FOUND", `${what}을 찾을 수 없습니다.`);

// 계약 체결 때 제작을 만든다(조건서 서비스가 부른다). 작업 일수는 지원 때 제안한 기간이다.
export async function createProductionForContract(
  tx: Tx,
  contractId: bigint,
  workingDays: number,
) {
  await tx.production.create({ data: { contractId, workingDays } });
}

export interface ProductionService {
  get(user: AuthUser, contractId: bigint): Promise<Production>;
  addMaterial(
    user: AuthUser,
    contractId: bigint,
    input: unknown,
  ): Promise<Production>;
  confirmMaterial(
    user: AuthUser,
    contractId: bigint,
    materialId: bigint,
  ): Promise<Production>;
  reportMaterialIssue(
    user: AuthUser,
    contractId: bigint,
    materialId: bigint,
    input: unknown,
  ): Promise<Production>;
  start(user: AuthUser, contractId: bigint): Promise<Production>;
  requestDeadlineChange(
    user: AuthUser,
    contractId: bigint,
    input: unknown,
  ): Promise<Production>;
  respondDeadlineChange(
    user: AuthUser,
    contractId: bigint,
    changeId: bigint,
    approve: boolean,
  ): Promise<Production>;
}

export function createProductionService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): ProductionService {
  // 계약 행을 잠그고 당사자인지 확인한 뒤 제작을 읽는다. 당사자가 아니면 404.
  async function lock(tx: Tx, user: AuthUser, contractId: bigint) {
    const userId = BigInt(user.id);
    const contract = await tx.contract.findUnique({
      where: { id: contractId },
      select: { clientId: true, creatorId: true },
    });
    if (
      !contract ||
      (contract.clientId !== userId && contract.creatorId !== userId)
    ) {
      throw notFound("계약");
    }
    await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${contractId} FOR UPDATE`;
    const production = await tx.production.findUnique({
      where: { contractId },
      include: includeAll,
    });
    if (!production) throw notFound("제작 정보");
    return {
      userId,
      production,
      role: contract.clientId === userId ? "CLIENT" : "CREATOR",
    } as const;
  }

  function requireRole(role: "CLIENT" | "CREATOR", expected: string) {
    if (role !== expected) {
      throw new AppError(
        403,
        "FORBIDDEN",
        expected === "CLIENT"
          ? "의뢰인만 할 수 있습니다."
          : "크리에이터만 할 수 있습니다.",
      );
    }
  }

  async function reload(tx: Tx, contractId: bigint) {
    return toProduction(
      await tx.production.findUniqueOrThrow({
        where: { contractId },
        include: includeAll,
      }),
    );
  }

  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  return {
    async get(user, contractId) {
      return inTransaction(async (tx) => {
        const { production } = await lock(tx, user, contractId);
        return toProduction(production);
      });
    },

    // READY-01: 의뢰인이 제작 자료(파일·실물 발송·메모)를 낸다. 문제 신고된 자료는 대체 자료로 바꾼다.
    async addMaterial(user, contractId, input) {
      const data = materialCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, role, production } = await lock(tx, user, contractId);
        requireRole(role, "CLIENT");
        if (production.status !== "PREPARING") {
          throw conflict("제작 준비 단계에서만 자료를 낼 수 있습니다.");
        }
        const replaces = data.replacesMaterialId
          ? production.materials.find(
              (m) => m.id === BigInt(data.replacesMaterialId ?? "0"),
            )
          : undefined;
        if (data.replacesMaterialId) {
          if (!replaces) throw notFound("자료");
          if (replaces.status !== "ISSUE_REPORTED") {
            throw conflict("문제가 신고된 자료만 대체할 수 있습니다.");
          }
          await tx.productionMaterial.update({
            where: { id: replaces.id },
            data: { status: "REPLACED" },
          });
        }
        if (data.kind === "FILE") {
          await requireReadyFiles(tx, [BigInt(data.fileId)], {
            ownerId: userId,
            purpose: "MATERIAL",
            workRequestId: production.contract.workRequestId,
          });
        }
        await tx.productionMaterial.create({
          data: {
            contractId,
            kind: data.kind,
            fileId: data.kind === "FILE" ? BigInt(data.fileId) : null,
            carrier: data.kind === "SHIPMENT" ? data.carrier : null,
            trackingNumber:
              data.kind === "SHIPMENT" ? data.trackingNumber : null,
            note: data.note ?? null,
            replacesMaterialId: replaces?.id ?? null,
            submittedBy: userId,
          },
        });
        return reload(tx, contractId);
      });
    },

    // READY-02: 크리에이터가 받은 자료로 작업할 수 있는지 확인한다(발송 등록과 정상 수령은 다르다).
    async confirmMaterial(user, contractId, materialId) {
      return inTransaction(async (tx) => {
        const { role, production } = await lock(tx, user, contractId);
        requireRole(role, "CREATOR");
        const material = production.materials.find((m) => m.id === materialId);
        if (!material) throw notFound("자료");
        if (
          production.status !== "PREPARING" ||
          material.status !== "SUBMITTED"
        ) {
          throw conflict("확인할 수 있는 자료가 아닙니다.");
        }
        await tx.productionMaterial.update({
          where: { id: materialId },
          data: { status: "CONFIRMED", confirmedAt: now() },
        });
        return reload(tx, contractId);
      });
    },

    // READY-02: 누락·문제 신고. 의뢰인이 대체 자료를 낼 때까지 제작을 시작할 수 없다.
    async reportMaterialIssue(user, contractId, materialId, input) {
      const { note } = materialIssueSchema.parse(input);
      return inTransaction(async (tx) => {
        const { role, production } = await lock(tx, user, contractId);
        requireRole(role, "CREATOR");
        const material = production.materials.find((m) => m.id === materialId);
        if (!material) throw notFound("자료");
        if (
          production.status !== "PREPARING" ||
          (material.status !== "SUBMITTED" && material.status !== "CONFIRMED")
        ) {
          throw conflict("문제를 신고할 수 있는 자료가 아닙니다.");
        }
        await tx.productionMaterial.update({
          where: { id: materialId },
          data: {
            status: "ISSUE_REPORTED",
            issueNote: note,
            confirmedAt: null,
          },
        });
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `material:${materialId}:issue`,
          `크리에이터가 제작 자료 문제를 알렸습니다: ${note}`,
        );
        return reload(tx, contractId);
      });
    },

    // WORK-01: 계약·결제·자료가 모두 준비됐을 때만 크리에이터가 시작한다. 마감일은 이때 한 번 계산한다.
    async start(user, contractId) {
      return inTransaction(async (tx) => {
        const { role, production } = await lock(tx, user, contractId);
        requireRole(role, "CREATOR");
        if (production.status !== "PREPARING") {
          throw conflict("이미 제작을 시작했습니다.");
        }
        if (production.contract.payments.length === 0) {
          throw conflict("결제가 완료되지 않아 제작을 시작할 수 없습니다.");
        }
        if (!materialsReady(production.materials)) {
          throw conflict(
            "확인되지 않았거나 문제가 신고된 자료가 있어 제작을 시작할 수 없습니다.",
          );
        }
        const startedAt = now();
        const dueDate = dueDateFrom(startedAt, production.workingDays);
        await tx.production.update({
          where: { contractId },
          data: {
            status: "IN_PROGRESS",
            startedAt,
            dueDate: toDbDate(dueDate),
          },
        });
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `production:${contractId}:started`,
          `제작이 시작되었습니다. 마감일은 ${dueDate}입니다.`,
        );
        return reload(tx, contractId);
      });
    },

    // WORK-02: 납기 변경 요청. 한쪽이 요청하고 다른 쪽이 승인해야 바뀐다(대화 속 동의로 바뀌지 않음).
    async requestDeadlineChange(user, contractId, input) {
      const data = deadlineChangeCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const { userId, production } = await lock(tx, user, contractId);
        if (production.status !== "IN_PROGRESS" || !production.dueDate) {
          throw conflict("제작 중에만 납기 변경을 요청할 수 있습니다.");
        }
        if (dateOnly(production.dueDate) === data.newDueDate) {
          throw conflict("지금 마감일과 같은 날짜입니다.");
        }
        try {
          await tx.deadlineChange.create({
            data: {
              contractId,
              requestedBy: userId,
              previousDueDate: production.dueDate,
              newDueDate: toDbDate(data.newDueDate),
              reason: data.reason,
            },
          });
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw conflict("답을 기다리는 납기 변경 요청이 이미 있습니다.");
          }
          throw err;
        }
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `deadline:${contractId}:${data.newDueDate}:requested:${now().getTime()}`,
          `마감일을 ${data.newDueDate}로 바꾸자는 요청이 있습니다. 사유: ${data.reason}`,
        );
        return reload(tx, contractId);
      });
    },

    async respondDeadlineChange(user, contractId, changeId, approve) {
      return inTransaction(async (tx) => {
        const { userId, production } = await lock(tx, user, contractId);
        const change = production.deadlineChanges.find(
          (c) => c.id === changeId,
        );
        if (!change) throw notFound("납기 변경 요청");
        if (change.status !== "PENDING") {
          throw conflict("이미 답한 납기 변경 요청입니다.");
        }
        if (change.requestedBy === userId) {
          throw new AppError(
            403,
            "FORBIDDEN",
            "요청한 사람은 직접 승인·거절할 수 없습니다.",
          );
        }
        await tx.deadlineChange.update({
          where: { id: changeId },
          data: {
            status: approve ? "APPROVED" : "REJECTED",
            respondedBy: userId,
            respondedAt: now(),
          },
        });
        if (approve) {
          await tx.production.update({
            where: { contractId },
            data: { dueDate: change.newDueDate },
          });
        }
        await postSystemMessage(
          tx,
          production.contract.workRequestId,
          `deadline-change:${changeId}:${approve ? "approved" : "rejected"}`,
          approve
            ? `마감일이 ${dateOnly(change.newDueDate)}로 바뀌었습니다.`
            : "납기 변경 요청이 거절되었습니다. 기존 마감일을 유지합니다.",
        );
        return reload(tx, contractId);
      });
    },
  };
}
