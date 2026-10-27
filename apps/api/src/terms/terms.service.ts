import { createHash } from "node:crypto";
import {
  type AuthUser,
  type Contract,
  contractStatusSchema,
  projectStatusSchema,
  type SignatureResponse,
  signatureCreateSchema,
  TERMS_SIGNING_HOURS,
  TERMS_TEXT_FIELDS,
  type TermsDocument,
  type TermsValues,
  type TermsVersion,
  termsVersionCreateSchema,
  termsVersionStatusSchema,
  workRequestStatusSchema,
} from "@kemi/shared";
import { z } from "zod";
import AppError from "../http/app-error.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import notify from "../notifications/notify.js";
import lockProject from "../projects/project-lock.js";
import { postSystemMessage } from "../chat/chat.service.js";

type Tx = Prisma.TransactionClient;

// 같은 프로젝트의 변경이 줄을 서서 기다릴 수 있도록 지원 서비스와 같은 값을 쓴다.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 15_000 };
const SIGNING_MS = TERMS_SIGNING_HOURS * 60 * 60 * 1000;

const includeSignatures = {
  signatures: { orderBy: [{ signedAt: "asc" }, { id: "asc" }] },
} satisfies Prisma.TermsVersionInclude;

type VersionRow = Prisma.TermsVersionGetPayload<{
  include: typeof includeSignatures;
}>;
type ContractRow = Prisma.ContractGetPayload<{
  include: { termsVersion: { select: { versionNo: true } } };
}>;

// 저장된 참조 사본을 읽을 때 형식을 다시 확인한다(JSONB라 DB가 형식을 보장하지 않는다).
const referenceSchema = z.object({
  project: z
    .object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      purpose: z.string(),
      styles: z.array(z.string()),
      budget: z.number(),
    })
    .nullable(),
  request: z.object({
    message: z.string(),
    proposedAmount: z.number(),
    expectedDays: z.number(),
  }),
});

type Reference = z.infer<typeof referenceSchema>;

function notFound(what: "의뢰 요청" | "조건서 버전" | "계약"): AppError {
  return new AppError(404, "NOT_FOUND", `${what}을 찾을 수 없습니다.`);
}

function conflict(message: string): AppError {
  return new AppError(409, "CONFLICT", message);
}

function valuesOf(row: VersionRow): TermsValues {
  return {
    amountKrw: row.amountKrw === null ? null : Number(row.amountKrw),
    specification: row.specification,
    scope: row.scope,
    materials: row.materials,
    deadline: row.deadline,
    revisions: row.revisions,
    usageRights: row.usageRights,
    cancellation: row.cancellation,
  };
}

function sameValues(a: TermsValues, b: TermsValues): boolean {
  return (
    a.amountKrw === b.amountKrw &&
    TERMS_TEXT_FIELDS.every((field) => a[field] === b[field])
  );
}

// 서명이 어떤 내용에 대한 것인지 묶는 해시. 같은 값이라도 요청·버전이 다르면 다른 해시다.
function hashTerms(
  workRequestId: bigint,
  versionNo: number,
  values: TermsValues,
): string {
  const canonical = JSON.stringify({
    workRequestId: workRequestId.toString(),
    versionNo,
    amountKrw: values.amountKrw,
    ...Object.fromEntries(TERMS_TEXT_FIELDS.map((f) => [f, values[f]])),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// 기한이 지난 SIGNING은 저장 전이어도 만료로 본다(스케줄러를 쓰지 않는다).
function isExpired(
  row: { status: string; signingExpiresAt: Date | null },
  at: Date,
) {
  return (
    row.status === "SIGNING" &&
    row.signingExpiresAt !== null &&
    row.signingExpiresAt <= at
  );
}

function toVersion(row: VersionRow, at: Date): TermsVersion {
  const signing =
    row.signingRequestedBy !== null &&
    row.signingRequestedAt !== null &&
    row.signingExpiresAt !== null
      ? {
          requestedBy: row.signingRequestedBy.toString(),
          requestedAt: row.signingRequestedAt.toISOString(),
          expiresAt: row.signingExpiresAt.toISOString(),
        }
      : null;
  return {
    versionNo: row.versionNo,
    status: isExpired(row, at)
      ? "EXPIRED"
      : termsVersionStatusSchema.parse(row.status),
    values: valuesOf(row),
    termsHash: row.termsHash,
    authorId: row.authorId.toString(),
    createdAt: row.createdAt.toISOString(),
    signing,
    signatures: row.signatures.map((signature) => ({
      userId: signature.userId.toString(),
      signerName: signature.signerName,
      signedAt: signature.signedAt.toISOString(),
    })),
  };
}

function toContract(row: ContractRow): Contract {
  return {
    id: row.id.toString(),
    workRequestId: row.workRequestId.toString(),
    projectId: row.projectId?.toString() ?? null,
    termsVersionNo: row.termsVersion.versionNo,
    clientId: row.clientId.toString(),
    creatorId: row.creatorId.toString(),
    amountKrw: Number(row.amountKrw),
    termsHash: row.termsHash,
    status: contractStatusSchema.parse(row.status),
    signedAt: row.signedAt.toISOString(),
  };
}

const includeContractVersion = {
  termsVersion: { select: { versionNo: true } },
} satisfies Prisma.ContractInclude;

// 협의가 끝난 요청(거절·철회·미선정)의 미확정 조건서를 무효로 한다. 값과 서명 기록은 남긴다.
export async function voidOpenTerms(tx: Tx, workRequestIds: bigint[]) {
  if (workRequestIds.length === 0) return;
  await tx.termsVersion.updateMany({
    where: {
      workRequestId: { in: workRequestIds },
      status: { in: ["DRAFT", "SIGNING"] },
    },
    data: { status: "VOID" },
  });
}

export interface TermsService {
  getDocument(user: AuthUser, workRequestId: bigint): Promise<TermsDocument>;
  saveVersion(
    user: AuthUser,
    workRequestId: bigint,
    input: unknown,
  ): Promise<{ created: boolean; version: TermsVersion }>;
  requestSigning(
    user: AuthUser,
    workRequestId: bigint,
    versionNo: number,
  ): Promise<TermsVersion>;
  sign(
    user: AuthUser,
    workRequestId: bigint,
    versionNo: number,
    input: unknown,
  ): Promise<{ created: boolean; result: SignatureResponse }>;
  getContract(user: AuthUser, workRequestId: bigint): Promise<Contract>;
}

export function createTermsService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): TermsService {
  const inTransaction = <T>(work: (tx: Tx) => Promise<T>) =>
    prisma.$transaction(work, TRANSACTION_OPTIONS);

  // 그 요청의 의뢰인·크리에이터만 접근한다. 다른 사람에게는 존재를 드러내지 않는다(404).
  function requireParty(
    user: AuthUser,
    request: { clientId: bigint; creatorId: bigint } | null,
  ): bigint {
    const userId = BigInt(user.id);
    if (
      !request ||
      (request.clientId !== userId && request.creatorId !== userId)
    ) {
      throw notFound("의뢰 요청");
    }
    return userId;
  }

  // 변경은 모두 프로젝트 행(공개 지원) → 요청 행 순서로 잠근 뒤 최신 상태를 다시 읽는다.
  // 지원·선정·마감(12장)과 같은 프로젝트 잠금을 써서, 서로 겹쳐도 하나씩 처리된다.
  async function lockRequest(tx: Tx, user: AuthUser, workRequestId: bigint) {
    const found = await tx.workRequest.findUnique({
      where: { id: workRequestId },
      select: { clientId: true, creatorId: true, projectId: true },
    });
    const userId = requireParty(user, found);
    if (found?.projectId) await lockProject(tx, found.projectId);
    await tx.$queryRaw`SELECT id FROM work_requests WHERE id = ${workRequestId} FOR UPDATE`;
    const request = await tx.workRequest.findUniqueOrThrow({
      where: { id: workRequestId },
      include: { project: true },
    });
    return { userId, request };
  }

  // 협의가 진행 중인지: 요청이 DISCUSSING이고, 프로젝트가 계약·삭제·무선정 종료되지 않았다.
  // 모집 마감(CLOSED + MANUAL·EXPIRED)은 진행 중인 협의를 막지 않는다(CAMP-05).
  function requireNegotiable(request: {
    status: string;
    project: {
      status: string;
      closeReason: string | null;
      deletedAt: Date | null;
    } | null;
  }) {
    if (request.status !== "DISCUSSING") {
      throw conflict("협의 중인 요청이 아닙니다.");
    }
    const { project } = request;
    if (
      project &&
      (project.deletedAt !== null ||
        project.status === "CONTRACTED" ||
        (project.status === "CLOSED" && project.closeReason === "NO_SELECTION"))
    ) {
      throw conflict("계약이 확정됐거나 종료된 프로젝트입니다.");
    }
  }

  function buildReference(request: {
    message: string;
    initialAmount: bigint;
    expectedDays: number;
    project: {
      id: bigint;
      title: string;
      description: string;
      purpose: string;
      styles: string[];
      budget: bigint;
    } | null;
  }): Reference {
    const { project } = request;
    return {
      project: project
        ? {
            id: project.id.toString(),
            title: project.title,
            description: project.description,
            purpose: project.purpose,
            styles: project.styles,
            budget: Number(project.budget),
          }
        : null,
      request: {
        message: request.message,
        proposedAmount: Number(request.initialAmount),
        expectedDays: request.expectedDays,
      },
    };
  }

  async function latestVersion(tx: Tx, workRequestId: bigint) {
    return tx.termsVersion.findFirst({
      where: { workRequestId },
      orderBy: { versionNo: "desc" },
      include: includeSignatures,
    });
  }

  async function findVersion(tx: Tx, workRequestId: bigint, versionNo: number) {
    const version = await tx.termsVersion.findUnique({
      where: { workRequestId_versionNo: { workRequestId, versionNo } },
      include: includeSignatures,
    });
    if (!version) throw notFound("조건서 버전");
    return version;
  }

  async function contractOfVersion(tx: Tx, termsVersionId: bigint) {
    const row = await tx.contract.findUnique({
      where: { termsVersionId },
      include: includeContractVersion,
    });
    return row ? toContract(row) : null;
  }

  return {
    async getDocument(user, workRequestId) {
      const request = await prisma.workRequest.findUnique({
        where: { id: workRequestId },
        include: {
          project: { select: { status: true } },
          termsVersions: {
            orderBy: { versionNo: "asc" },
            include: includeSignatures,
          },
          contract: { include: includeContractVersion },
        },
      });
      requireParty(user, request);
      if (!request) throw notFound("의뢰 요청");
      const at = now();
      const first = request.termsVersions[0];
      return {
        workRequestId: request.id.toString(),
        workRequestStatus: workRequestStatusSchema.parse(request.status),
        projectStatus: request.project
          ? projectStatusSchema.parse(request.project.status)
          : null,
        reference: first
          ? referenceSchema.parse(first.referenceSnapshot)
          : null,
        versions: request.termsVersions.map((row) => toVersion(row, at)),
        contract: request.contract ? toContract(request.contract) : null,
      };
    },

    // TERMS-01: 새 작성본을 저장한다. 이전 작성본은 바꾸지 않고 대체됨(또는 만료)으로 남긴다.
    async saveVersion(user, workRequestId, input) {
      const data = termsVersionCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const at = now();
        const { userId, request } = await lockRequest(tx, user, workRequestId);

        // 같은 저장의 재전송(응답 유실 등)이면 새 버전을 만들지 않고 이전 결과를 준다.
        const repeated = await tx.termsVersion.findUnique({
          where: {
            workRequestId_commandId: {
              workRequestId,
              commandId: data.commandId,
            },
          },
          include: includeSignatures,
        });
        if (repeated) {
          if (
            repeated.authorId === userId &&
            sameValues(valuesOf(repeated), data.values)
          ) {
            return { created: false, version: toVersion(repeated, at) };
          }
          throw conflict("같은 요청 식별자로 다른 내용을 저장할 수 없습니다.");
        }

        requireNegotiable(request);
        const latest = await latestVersion(tx, workRequestId);
        const latestNo = latest?.versionNo ?? 0;
        if (data.baseVersionNo !== latestNo) {
          throw conflict(
            "다른 작성본이 먼저 저장되었습니다. 최신 버전을 확인해주세요.",
          );
        }
        if (
          latest &&
          (latest.status === "DRAFT" || latest.status === "SIGNING")
        ) {
          // 서명 요청 중이던 버전은 기존 서명과 함께 그대로 보존한다. 서명은 새 버전에 복사하지 않는다.
          await tx.termsVersion.update({
            where: { id: latest.id },
            data: { status: isExpired(latest, at) ? "EXPIRED" : "SUPERSEDED" },
          });
        }

        const versionNo = latestNo + 1;
        const created = await tx.termsVersion.create({
          data: {
            workRequestId,
            versionNo,
            amountKrw:
              data.values.amountKrw === null
                ? null
                : BigInt(data.values.amountKrw),
            specification: data.values.specification,
            scope: data.values.scope,
            materials: data.values.materials,
            deadline: data.values.deadline,
            revisions: data.values.revisions,
            usageRights: data.values.usageRights,
            cancellation: data.values.cancellation,
            // 첫 저장 때 고정한 참조 사본을 다음 버전에도 그대로 쓴다.
            referenceSnapshot: latest
              ? referenceSchema.parse(latest.referenceSnapshot)
              : buildReference(request),
            termsHash: hashTerms(workRequestId, versionNo, data.values),
            authorId: userId,
            commandId: data.commandId,
          },
          include: includeSignatures,
        });
        return { created: true, version: toVersion(created, at) };
      });
    },

    // TERMS-02: 마지막 작성본에 대해 서명을 요청한다. 요청은 서명이 아니다. 기한은 요청 시각 + 48시간.
    async requestSigning(user, workRequestId, versionNo) {
      return inTransaction(async (tx) => {
        const at = now();
        const { userId, request } = await lockRequest(tx, user, workRequestId);
        requireNegotiable(request);
        const version = await findVersion(tx, workRequestId, versionNo);
        const latest = await latestVersion(tx, workRequestId);
        if (latest?.id !== version.id) {
          throw conflict("최신 조건서 버전이 아닙니다.");
        }
        if (version.status === "SIGNING") {
          if (isExpired(version, at)) {
            throw conflict(
              "서명 기한이 지났습니다. 같은 내용으로 새 버전을 저장한 뒤 다시 요청해주세요.",
            );
          }
          // 같은 요청의 재전송: 기한을 연장하지 않는다.
          return toVersion(version, at);
        }
        if (version.status !== "DRAFT") {
          throw conflict("서명을 요청할 수 없는 조건서 버전입니다.");
        }
        const values = valuesOf(version);
        const missing = [
          ...(values.amountKrw === null ? ["amountKrw"] : []),
          ...TERMS_TEXT_FIELDS.filter((field) => values[field] === null),
        ];
        if (missing.length > 0) {
          throw new AppError(
            400,
            "VALIDATION_FAILED",
            "서명을 요청하려면 모든 조건을 입력해야 합니다.",
            missing.map((field) => ({ path: ["values", field] })),
          );
        }
        const updated = await tx.termsVersion.update({
          where: { id: version.id },
          data: {
            status: "SIGNING",
            signingRequestedBy: userId,
            signingRequestedAt: at,
            signingExpiresAt: new Date(at.getTime() + SIGNING_MS),
          },
          include: includeSignatures,
        });
        const counterpartId =
          userId === request.clientId ? request.creatorId : request.clientId;
        await notify(tx, [
          {
            recipientUserId: counterpartId,
            type: "TERMS_SIGNING_REQUESTED",
            eventKey: `terms:${version.id}:signing-requested`,
            title: "최종 조건 서명 요청이 도착했습니다",
            body: `조건서 ${versionNo}번 버전의 서명을 요청받았습니다. ${TERMS_SIGNING_HOURS}시간 안에 확인해주세요.`,
            projectId: request.projectId ?? undefined,
            workRequestId,
          },
        ]);
        await postSystemMessage(
          tx,
          workRequestId,
          `terms:${version.id}:signing-requested`,
          `조건서 ${versionNo}번 버전의 서명이 요청되었습니다. ${TERMS_SIGNING_HOURS}시간 안에 양측이 서명해야 계약이 체결됩니다.`,
        );
        return toVersion(updated, at);
      });
    },

    // CONTRACT-01: 본인 서명. 같은 버전에 두 번째 서명이 들어오면 계약을 체결하고,
    // 같은 프로젝트의 다른 활성 요청은 미선정(NOT_SELECTED)으로 바꾼다(결정 기록 2·13장).
    async sign(user, workRequestId, versionNo, input) {
      const data = signatureCreateSchema.parse(input);
      return inTransaction(async (tx) => {
        const at = now();
        const { userId, request } = await lockRequest(tx, user, workRequestId);
        const version = await findVersion(tx, workRequestId, versionNo);

        // 응답 유실 뒤 같은 서명을 다시 보내면 이전 결과를 준다(계약을 다시 만들지 않는다).
        const prior = version.signatures.find((s) => s.userId === userId);
        if (prior) {
          if (
            prior.signerName === data.signerName &&
            prior.termsHash === data.termsHash
          ) {
            return {
              created: false,
              result: {
                version: toVersion(version, at),
                contract: await contractOfVersion(tx, version.id),
              },
            };
          }
          throw conflict("이미 이 버전에 서명했습니다.");
        }

        requireNegotiable(request);
        if (version.status !== "SIGNING" || isExpired(version, at)) {
          throw conflict("서명할 수 있는 조건서 버전이 아닙니다.");
        }
        if (data.termsHash !== version.termsHash) {
          throw conflict(
            "서명하려는 조건서 내용이 서버와 다릅니다. 최신 내용을 확인해주세요.",
          );
        }

        await tx.signature.create({
          data: {
            termsVersionId: version.id,
            userId,
            signerName: data.signerName,
            termsHash: data.termsHash,
            signedAt: at,
          },
        });
        const signatureCount = version.signatures.length + 1;
        if (signatureCount < 2) {
          const signed = await findVersion(tx, workRequestId, versionNo);
          return {
            created: true,
            result: { version: toVersion(signed, at), contract: null },
          };
        }

        // ─── 두 번째 서명: 계약 체결 ───
        await tx.termsVersion.update({
          where: { id: version.id },
          data: { status: "SIGNED" },
        });
        if (version.amountKrw === null) {
          // 서명 요청 때 금액을 확인하고 DB CHECK도 막는다. 여기 오면 데이터가 잘못된 것이다.
          throw new Error("금액이 없는 조건서 버전에 서명했습니다.");
        }
        let contract: ContractRow;
        try {
          contract = await tx.contract.create({
            data: {
              workRequestId,
              projectId: request.projectId,
              termsVersionId: version.id,
              clientId: request.clientId,
              creatorId: request.creatorId,
              amountKrw: version.amountKrw,
              termsHash: version.termsHash,
              signedAt: at,
            },
            include: includeContractVersion,
          });
        } catch (err) {
          // 공고당 계약 1개(contracts.project_id UNIQUE). 프로젝트 잠금이 1차 방어이고 이것이 마지막 방어선이다.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002"
          ) {
            throw conflict("이미 다른 후보와 계약이 확정되었습니다.");
          }
          throw err;
        }
        await tx.workRequest.update({
          where: { id: workRequestId },
          data: { status: "CONTRACTED" },
        });

        const others = request.projectId
          ? await tx.workRequest.findMany({
              where: {
                projectId: request.projectId,
                id: { not: workRequestId },
                status: { in: ["PENDING", "DISCUSSING"] },
              },
              select: { id: true, creatorId: true },
            })
          : [];
        if (request.project) {
          // 계약에는 종료 사유가 없다(projects_close_state_check).
          await tx.project.update({
            where: { id: request.project.id },
            data: { status: "CONTRACTED", closeReason: null },
          });
          const otherIds = others.map((other) => other.id);
          await tx.workRequest.updateMany({
            where: { id: { in: otherIds } },
            data: {
              status: "NOT_SELECTED",
              closedReason: "OTHER_SELECTED",
              respondedAt: at,
            },
          });
          await tx.termsVersion.updateMany({
            where: {
              workRequestId: { in: otherIds },
              status: { in: ["DRAFT", "SIGNING"] },
            },
            data: { status: "VOID" },
          });
        }

        const projectTitle = request.project?.title ?? "의뢰";
        await notify(tx, [
          ...[request.clientId, request.creatorId].map((recipientUserId) => ({
            recipientUserId,
            type: "CONTRACT_SIGNED" as const,
            eventKey: `contract:${contract.id}:signed`,
            title: "계약이 체결되었습니다",
            body: `'${projectTitle}'의 최종 조건에 양측이 서명해 계약이 체결되었습니다.`,
            projectId: request.projectId ?? undefined,
            workRequestId,
          })),
          ...others.map((other) => ({
            recipientUserId: other.creatorId,
            type: "APPLICATION_AUTO_REJECTED" as const,
            eventKey: `application:${other.id}:auto-rejected`,
            title: "다른 지원자와 계약이 체결되었습니다",
            body: `'${projectTitle}' 프로젝트는 다른 지원자와 계약이 체결되어 모집이 종료되었습니다.`,
            projectId: request.projectId ?? undefined,
            workRequestId: other.id,
          })),
        ]);

        await postSystemMessage(
          tx,
          workRequestId,
          `contract:${contract.id}:signed`,
          `조건서 ${versionNo}번 버전에 양측이 서명해 계약이 체결되었습니다.`,
        );
        const signed = await findVersion(tx, workRequestId, versionNo);
        return {
          created: true,
          result: {
            version: toVersion(signed, at),
            contract: toContract(contract),
          },
        };
      });
    },

    // SIGN-01: 계약서 조회. 당사자만 볼 수 있다.
    async getContract(user, workRequestId) {
      const request = await prisma.workRequest.findUnique({
        where: { id: workRequestId },
        select: {
          clientId: true,
          creatorId: true,
          contract: { include: includeContractVersion },
        },
      });
      requireParty(user, request);
      if (!request?.contract) throw notFound("계약");
      return toContract(request.contract);
    },
  };
}
