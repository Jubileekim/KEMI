import { randomUUID } from "node:crypto";
import {
  type AuthUser,
  FILE_TYPES,
  type FileDownloadResponse,
  type FilePurpose,
  type FileUploadResponse,
  type StoredFile,
  filePurposeSchema,
  fileStatusSchema,
  fileUploadCreateSchema,
} from "@kemi/shared";
import AppError from "../http/app-error.js";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import {
  detectMimeType,
  type FileStorage,
  StorageUnavailableError,
} from "./storage.js";

type Tx = Prisma.TransactionClient;
type FileRow = Prisma.FileGetPayload<object>;

const DOWNLOAD_URL_SECONDS = 10 * 60;
const HEAD_BYTES = 16;
const EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/zip": "zip",
};

// 거래 파일을 올릴 수 있는 요청 상태: 협의 중이거나 계약 뒤
const ACTIVE_REQUEST_STATUSES = new Set(["DISCUSSING", "CONTRACTED"]);

export function toStoredFile(row: FileRow): StoredFile {
  const type = Object.entries(FILE_TYPES).find(
    ([mime]) => mime === row.mimeType,
  );
  return {
    id: row.id.toString(),
    ownerId: row.ownerId.toString(),
    purpose: filePurposeSchema.parse(row.purpose),
    kind: type ? type[1].kind : "ZIP",
    mimeType: row.mimeType,
    fileName: row.fileName,
    sizeBytes: Number(row.sizeBytes),
    status: fileStatusSchema.parse(row.status),
    rejectionReason: row.rejectionReason,
    workRequestId: row.workRequestId?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function notFound(): AppError {
  return new AppError(404, "NOT_FOUND", "파일을 찾을 수 없습니다.");
}

function unavailable(): AppError {
  return new AppError(
    503,
    "SERVICE_UNAVAILABLE",
    "파일 저장소가 아직 설정되지 않았거나 응답하지 않습니다.",
  );
}

// 다른 기능(채팅 첨부·자료·납품물)이 파일을 연결할 때 쓴다.
// 본인이 올렸고, 확인이 끝났고(READY), 쓰임과 요청이 맞는 파일만 받는다.
export async function requireReadyFiles(
  tx: Tx,
  fileIds: bigint[],
  expected: { ownerId: bigint; purpose: FilePurpose; workRequestId: bigint },
): Promise<FileRow[]> {
  if (fileIds.length === 0) return [];
  const rows = await tx.file.findMany({ where: { id: { in: fileIds } } });
  const valid = rows.filter(
    (row) =>
      row.ownerId === expected.ownerId &&
      row.purpose === expected.purpose &&
      row.workRequestId === expected.workRequestId &&
      row.status === "READY",
  );
  if (valid.length !== new Set(fileIds.map(String)).size) {
    throw new AppError(
      400,
      "VALIDATION_FAILED",
      "연결할 수 없는 파일이 있습니다. 본인이 올려 확인이 끝난 같은 거래의 파일만 쓸 수 있습니다.",
    );
  }
  return valid;
}

export interface FileService {
  create(user: AuthUser, input: unknown): Promise<FileUploadResponse>;
  complete(user: AuthUser, fileId: bigint): Promise<StoredFile>;
  get(user: AuthUser, fileId: bigint): Promise<StoredFile>;
  download(user: AuthUser, fileId: bigint): Promise<FileDownloadResponse>;
}

export function createFileService({
  prisma,
  storage,
  now = () => new Date(),
}: {
  prisma: PrismaClient;
  // 없으면(Supabase 미설정) 업로드·다운로드는 503
  storage?: FileStorage;
  now?: () => Date;
}): FileService {
  function requireStorage(): FileStorage {
    if (!storage) throw unavailable();
    return storage;
  }

  async function guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (err) {
      if (err instanceof StorageUnavailableError) throw unavailable();
      throw err;
    }
  }

  // 올린 사람, 또는 거래 파일이면 그 요청의 당사자만 볼 수 있다. 나머지는 404.
  async function findAccessible(user: AuthUser, fileId: bigint) {
    const userId = BigInt(user.id);
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        workRequest: { select: { clientId: true, creatorId: true } },
      },
    });
    if (!file) throw notFound();
    const party =
      file.workRequest &&
      (file.workRequest.clientId === userId ||
        file.workRequest.creatorId === userId);
    if (file.ownerId !== userId && !party) throw notFound();
    return file;
  }

  return {
    // FILE-01 1단계: 권한 확인 뒤 업로드 URL 발급
    async create(user, input) {
      const data = fileUploadCreateSchema.parse(input);
      const store = requireStorage();
      const userId = BigInt(user.id);
      const workRequestId = data.workRequestId
        ? BigInt(data.workRequestId)
        : null;
      if (data.purpose === "PORTFOLIO" && user.role !== "CREATOR") {
        throw new AppError(
          403,
          "FORBIDDEN",
          "작업물은 크리에이터만 올릴 수 있습니다.",
        );
      }
      if (workRequestId !== null) {
        const request = await prisma.workRequest.findUnique({
          where: { id: workRequestId },
          select: { clientId: true, creatorId: true, status: true },
        });
        if (
          !request ||
          (request.clientId !== userId && request.creatorId !== userId)
        ) {
          throw new AppError(404, "NOT_FOUND", "의뢰 요청을 찾을 수 없습니다.");
        }
        if (!ACTIVE_REQUEST_STATUSES.has(request.status)) {
          throw new AppError(
            409,
            "CONFLICT",
            "협의 중이거나 계약된 요청에만 파일을 올릴 수 있습니다.",
          );
        }
      }
      const storagePath = `${data.purpose.toLowerCase()}/${userId}/${randomUUID()}.${EXTENSIONS[data.mimeType] ?? "bin"}`;
      const upload = await guard(() => store.createUploadUrl(storagePath));
      const file = await prisma.file.create({
        data: {
          ownerId: userId,
          purpose: data.purpose,
          mimeType: data.mimeType,
          fileName: data.fileName,
          sizeBytes: BigInt(data.sizeBytes),
          storagePath,
          workRequestId,
        },
      });
      return { file: toStoredFile(file), upload };
    },

    // FILE-01 3단계: 실제 파일의 크기·형식(매직 바이트)을 확인한다. 하나라도 틀리면 REJECTED.
    async complete(user, fileId) {
      const store = requireStorage();
      const file = await prisma.file.findUnique({ where: { id: fileId } });
      if (!file || file.ownerId !== BigInt(user.id)) throw notFound();
      if (file.status !== "PENDING") return toStoredFile(file);

      const info = await guard(() => store.stat(file.storagePath));
      if (!info) {
        throw new AppError(409, "CONFLICT", "업로드가 아직 끝나지 않았습니다.");
      }
      const limit =
        Object.entries(FILE_TYPES).find(([mime]) => mime === file.mimeType)?.[1]
          .maxBytes ?? 0;
      let rejection: string | null = null;
      if (info.sizeBytes > limit) {
        rejection = "파일이 허용 크기를 넘습니다.";
      } else if (info.sizeBytes !== Number(file.sizeBytes)) {
        rejection = "선언한 크기와 실제 크기가 다릅니다.";
      } else {
        const head = await guard(() =>
          store.readHead(file.storagePath, HEAD_BYTES),
        );
        if (!head || detectMimeType(head) !== file.mimeType) {
          rejection = "파일 형식이 선언한 형식과 다릅니다.";
        }
      }
      const updated = await prisma.file.update({
        where: { id: file.id },
        data: rejection
          ? { status: "REJECTED", rejectionReason: rejection }
          : { status: "READY", completedAt: now() },
      });
      return toStoredFile(updated);
    },

    async get(user, fileId) {
      return toStoredFile(await findAccessible(user, fileId));
    },

    // 다운로드·재생용 서명 URL(10분). 확인이 끝난 파일만.
    async download(user, fileId) {
      const store = requireStorage();
      const file = await findAccessible(user, fileId);
      if (file.status !== "READY") {
        throw new AppError(409, "CONFLICT", "확인이 끝나지 않은 파일입니다.");
      }
      const url = await guard(() =>
        store.createDownloadUrl(file.storagePath, DOWNLOAD_URL_SECONDS),
      );
      return {
        url,
        expiresAt: new Date(
          now().getTime() + DOWNLOAD_URL_SECONDS * 1000,
        ).toISOString(),
      };
    },
  };
}
