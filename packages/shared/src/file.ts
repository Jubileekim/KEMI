import { z } from "zod";

// 파일 (FILE-01, 결정 기록 4장). 브라우저가 Supabase Storage(비공개 버킷)에 직접 올리고, 서버가 실제 파일을 확인한다.
// 쓰임: 프로필 로고·작업물(공개 가능), 채팅 첨부·제작 자료·납품물·수정 요청 첨부(거래 당사자만)
export const FILE_PURPOSES = [
  "PROFILE_IMAGE",
  "PORTFOLIO",
  "CHAT_ATTACHMENT",
  "MATERIAL",
  "DELIVERABLE",
  "REVISION",
  "EVIDENCE",
] as const;
export const filePurposeSchema = z.enum(FILE_PURPOSES);
export type FilePurpose = z.infer<typeof filePurposeSchema>;

// 거래(요청) 하나에 묶이는 쓰임. 그 요청의 의뢰인·크리에이터만 볼 수 있다.
export const REQUEST_SCOPED_FILE_PURPOSES = [
  "CHAT_ATTACHMENT",
  "MATERIAL",
  "DELIVERABLE",
  "REVISION",
  "EVIDENCE",
] as const satisfies readonly FilePurpose[];

export const FILE_KINDS = ["VIDEO", "IMAGE", "ZIP"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

// 형식과 파일당 한도 [확정, 결정 기록 4장]. Supabase 무료 플랜 한도(50MB)에 맞춘다.
export const FILE_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/zip",
] as const;
export type FileMimeType = (typeof FILE_MIME_TYPES)[number];
const MB = 1024 * 1024;
export const FILE_TYPES = {
  "video/mp4": { kind: "VIDEO", maxBytes: 50 * MB },
  "video/quicktime": { kind: "VIDEO", maxBytes: 50 * MB },
  "image/jpeg": { kind: "IMAGE", maxBytes: 10 * MB },
  "image/png": { kind: "IMAGE", maxBytes: 10 * MB },
  "image/webp": { kind: "IMAGE", maxBytes: 10 * MB },
  "application/zip": { kind: "ZIP", maxBytes: 50 * MB },
} as const satisfies Record<FileMimeType, { kind: FileKind; maxBytes: number }>;

export const FILE_STATUSES = ["PENDING", "READY", "REJECTED"] as const;
export const fileStatusSchema = z.enum(FILE_STATUSES);
export type FileStatus = z.infer<typeof fileStatusSchema>;

// 업로드 준비. 선언한 형식·크기가 한도 안이어야 하고, 거래용 파일은 요청 ID가 필요하다.
export const fileUploadCreateSchema = z
  .strictObject({
    purpose: filePurposeSchema,
    fileName: z.string().trim().min(1).max(200),
    mimeType: z.enum(FILE_MIME_TYPES),
    sizeBytes: z.int().min(1),
    workRequestId: z
      .string()
      .regex(/^[1-9]\d*$/)
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sizeBytes > FILE_TYPES[value.mimeType].maxBytes) {
      ctx.addIssue({
        code: "custom",
        path: ["sizeBytes"],
        message: "파일이 허용 크기를 넘습니다.",
      });
    }
    const scoped = REQUEST_SCOPED_FILE_PURPOSES.some(
      (purpose) => purpose === value.purpose,
    );
    if (scoped !== (value.workRequestId !== undefined)) {
      ctx.addIssue({
        code: "custom",
        path: ["workRequestId"],
        message: scoped
          ? "거래 파일은 요청 ID가 필요합니다."
          : "이 파일에는 요청 ID를 보내지 않습니다.",
      });
    }
  });
export type FileUploadCreateRequest = z.input<typeof fileUploadCreateSchema>;

export interface StoredFile {
  id: string;
  ownerId: string;
  purpose: FilePurpose;
  kind: FileKind;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  status: FileStatus;
  rejectionReason: string | null;
  workRequestId: string | null;
  createdAt: string;
}

export interface FileUploadResponse {
  file: StoredFile;
  // 브라우저가 이 주소로 직접 PUT 한다(Supabase 서명 업로드 URL, 2시간).
  upload: { url: string; token: string };
}

export interface FileDownloadResponse {
  url: string;
  expiresAt: string;
}
