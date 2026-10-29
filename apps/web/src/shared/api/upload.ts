import {
  FILE_MIME_TYPES,
  type FileMimeType,
  type FilePurpose,
  type StoredFile,
} from "@kemi/shared";
import { toast } from "sonner";
import openSignedDownload from "../files/signed-download";
import { ApiError } from "./client";
import { kemi } from "./kemi";

// 실제 파일 업로드 (FILE-01). 서버가 서명 업로드 주소를 주면 브라우저가 Storage에 직접 올리고,
// 서버가 크기·실제 형식을 확인한 뒤 READY로 바꾼다. 거부되면 REJECTED와 사유가 온다.

export const isAllowedMime = (mime: string): mime is FileMimeType =>
  FILE_MIME_TYPES.some((allowed) => allowed === mime);

export async function uploadFile(
  file: File,
  purpose: FilePurpose,
  workRequestId?: string,
): Promise<StoredFile> {
  if (!isAllowedMime(file.type))
    throw new ApiError(
      400,
      "UNSUPPORTED_TYPE",
      "올릴 수 없는 파일 형식이에요.",
    );
  const prepared = await kemi.prepareUpload({
    purpose,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    ...(workRequestId ? { workRequestId } : {}),
  });
  let uploaded: Response;
  try {
    uploaded = await fetch(prepared.upload.url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new ApiError(
      0,
      "UPLOAD_FAILED",
      "파일을 올리지 못했어요. 연결을 확인해 주세요.",
    );
  }
  if (!uploaded.ok)
    throw new ApiError(
      uploaded.status,
      "UPLOAD_FAILED",
      "파일을 올리지 못했어요. 다시 시도해 주세요.",
    );
  const checked = await kemi.completeUpload(prepared.file.id);
  if (checked.status !== "READY")
    throw new ApiError(
      400,
      "FILE_REJECTED",
      checked.rejectionReason ??
        "파일 확인에 실패했어요. 다른 파일을 올려 주세요.",
    );
  return checked;
}

// 서명된 다운로드 주소를 받아 새 창으로 연다(만료 10분).
export function openFile(fileId: string) {
  return openSignedDownload(
    async () => (await kemi.download(fileId)).url,
    () => window.open("about:blank", "_blank"),
    (message) => toast.error(message),
  );
}
