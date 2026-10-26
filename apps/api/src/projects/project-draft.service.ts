import {
  type AuthUser,
  DEFAULT_RECRUITMENT_DAYS,
  type ProjectDraft,
  type ProjectSummary,
  projectDraftValuesSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { insertProject } from "./project.service.js";

type DraftRow = Prisma.ProjectDraftGetPayload<object>;

const DAY_MS = 24 * 60 * 60 * 1000;

function toDraft(row: DraftRow): ProjectDraft {
  return {
    id: row.id.toString(),
    values: projectDraftValuesSchema.parse(row.values),
    recruitmentDays: row.recruitmentDays,
    publishedProjectId: row.publishedProjectId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function requireClient(user: AuthUser): bigint {
  if (user.role !== "CLIENT") {
    throw new AppError(403, "FORBIDDEN", "의뢰인만 공고를 작성할 수 있습니다.");
  }
  return BigInt(user.id);
}

const notFound = () =>
  new AppError(404, "NOT_FOUND", "임시 저장한 공고를 찾을 수 없습니다.");

export interface ProjectDraftService {
  list(user: AuthUser): Promise<{ items: ProjectDraft[] }>;
  create(user: AuthUser, input: unknown): Promise<ProjectDraft>;
  update(
    user: AuthUser,
    draftId: bigint,
    input: unknown,
  ): Promise<ProjectDraft>;
  remove(user: AuthUser, draftId: bigint): Promise<void>;
  publish(
    user: AuthUser,
    draftId: bigint,
  ): Promise<{ draft: ProjectDraft; project: ProjectSummary }>;
}

// CAMP-01·02: 공고 임시 저장과 공개. 공개 시각 + 모집 기간(3·7·14일, 기본 7일)으로 마감을 정한다.
export function createProjectDraftService({
  prisma,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  now?: () => Date;
}): ProjectDraftService {
  async function lockOwn(
    tx: Prisma.TransactionClient,
    clientId: bigint,
    draftId: bigint,
  ) {
    await tx.$queryRaw`SELECT id FROM project_drafts WHERE id = ${draftId} FOR UPDATE`;
    const row = await tx.projectDraft.findUnique({ where: { id: draftId } });
    if (!row || row.clientId !== clientId) throw notFound();
    return row;
  }

  const published = () =>
    new AppError(409, "CONFLICT", "이미 공개한 공고입니다.");

  return {
    async list(user) {
      const clientId = requireClient(user);
      const rows = await prisma.projectDraft.findMany({
        where: { clientId, publishedProjectId: null },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      });
      return { items: rows.map(toDraft) };
    },

    async create(user, input) {
      const clientId = requireClient(user);
      const values = projectDraftValuesSchema.parse(input);
      const row = await prisma.projectDraft.create({
        data: {
          clientId,
          values,
          recruitmentDays: values.recruitmentDays ?? DEFAULT_RECRUITMENT_DAYS,
        },
      });
      return toDraft(row);
    },

    // 보낸 항목만 덮어쓴다(null은 지움).
    async update(user, draftId, input) {
      const clientId = requireClient(user);
      const values = projectDraftValuesSchema.parse(input);
      return prisma.$transaction(async (tx) => {
        const row = await lockOwn(tx, clientId, draftId);
        if (row.publishedProjectId !== null) throw published();
        const merged = projectDraftValuesSchema.parse({
          ...projectDraftValuesSchema.parse(row.values),
          ...values,
        });
        return toDraft(
          await tx.projectDraft.update({
            where: { id: draftId },
            data: {
              values: merged,
              recruitmentDays: merged.recruitmentDays ?? row.recruitmentDays,
            },
          }),
        );
      });
    },

    async remove(user, draftId) {
      const clientId = requireClient(user);
      await prisma.$transaction(async (tx) => {
        const row = await lockOwn(tx, clientId, draftId);
        if (row.publishedProjectId !== null) throw published();
        await tx.projectDraft.delete({ where: { id: draftId } });
      });
    },

    // 공개: 바로 등록과 같은 검사를 하고, 마감은 서버가 계산한다. 같은 초안을 두 번 공개할 수 없다.
    async publish(user, draftId) {
      const clientId = requireClient(user);
      return prisma.$transaction(async (tx) => {
        const row = await lockOwn(tx, clientId, draftId);
        if (row.publishedProjectId !== null) throw published();
        const at = now();
        const values = projectDraftValuesSchema.parse(row.values);
        // 빈 항목(null)은 보내지 않은 것으로 보고 필수 항목 검사에 맡긴다.
        const project = await insertProject(
          tx,
          user,
          {
            title: values.title ?? undefined,
            description: values.description ?? undefined,
            purpose: values.purpose ?? undefined,
            styles: values.styles,
            budget: values.budget ?? undefined,
            expectedDurationSeconds: values.expectedDurationSeconds,
            deliveryDueDate: values.deliveryDueDate ?? undefined,
            recruitmentEndAt: new Date(
              at.getTime() + row.recruitmentDays * DAY_MS,
            ).toISOString(),
          },
          at,
        );
        const draft = await tx.projectDraft.update({
          where: { id: draftId },
          data: { publishedProjectId: BigInt(project.id) },
        });
        return { draft: toDraft(draft), project };
      });
    },
  };
}
