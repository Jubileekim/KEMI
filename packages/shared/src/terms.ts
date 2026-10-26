import { z } from "zod";
import type { ProjectStatus } from "./project.js";
import type { WorkRequestStatus } from "./application.js";

// 최종 조건서 버전 상태 (결정 기록 13-1). ERD v0.6 terms_versions 값 그대로 둔다.
// DRAFT → SIGNING(서명 요청, 48시간) → SIGNED(양측 서명). 새 버전 저장 시 SUPERSEDED, 기한이 지나면 EXPIRED,
// 협의가 끝나면(다른 후보 계약 등) VOID.
export const TERMS_VERSION_STATUSES = [
  "DRAFT",
  "SIGNING",
  "SIGNED",
  "SUPERSEDED",
  "EXPIRED",
  "VOID",
] as const;
export const termsVersionStatusSchema = z.enum(TERMS_VERSION_STATUSES);
export type TermsVersionStatus = z.infer<typeof termsVersionStatusSchema>;

// 계약 상태. 이번에는 체결(SIGNED)만 만든다. 취소·진행·완료는 결제·제작 기능에서 추가한다.
export const CONTRACT_STATUSES = ["SIGNED"] as const;
export const contractStatusSchema = z.enum(CONTRACT_STATUSES);
export type ContractStatus = z.infer<typeof contractStatusSchema>;

// 서명 요청부터 양측 서명까지의 기한 [제안, D08]
export const TERMS_SIGNING_HOURS = 48;

// 금액 외 조건 항목 (TERMS-01). 화면 이름: 규격·수량, 포함·제외 작업 범위, 필요 자료·제공 조건,
// 납기·작업 기간 기준, 수정 횟수·범위, 사용권·원본 제공 조건, 취소 조건
export const TERMS_TEXT_FIELDS = [
  "specification",
  "scope",
  "materials",
  "deadline",
  "revisions",
  "usageRights",
  "cancellation",
] as const;
export type TermsTextField = (typeof TERMS_TEXT_FIELDS)[number];

// 빈 문자열은 "아직 안 씀"(null)으로 저장한다. 작성본은 비어 있어도 저장할 수 있다.
const termsText = z
  .string()
  .trim()
  .max(4000)
  .nullable()
  .transform((value) => (value === "" ? null : value));

export const termsValuesSchema = z.strictObject({
  // 최종 금액(원, 정수). 프로젝트 budget과 같은 범위 [제안]
  amountKrw: z.int().min(1).max(1_000_000_000).nullable(),
  specification: termsText,
  scope: termsText,
  materials: termsText,
  deadline: termsText,
  revisions: termsText,
  usageRights: termsText,
  cancellation: termsText,
});
export type TermsValues = z.output<typeof termsValuesSchema>;

// 새 버전 저장. commandId는 화면이 만든 요청 식별자(같은 저장의 재전송 확인),
// baseVersionNo는 화면이 보고 있던 마지막 버전 번호(없으면 0)다.
export const termsVersionCreateSchema = z.strictObject({
  commandId: z.uuid(),
  baseVersionNo: z.int().min(0),
  values: termsValuesSchema,
});
export type TermsVersionCreateRequest = z.input<
  typeof termsVersionCreateSchema
>;

// 본인 서명 (CONTRACT-01). 이름 입력과 동의 체크 [제안, D08]. termsHash는 화면이 본 버전의 해시다.
export const signatureCreateSchema = z.strictObject({
  signerName: z.string().trim().min(1).max(100),
  consent: z.literal(true),
  termsHash: z.string().regex(/^[0-9a-f]{64}$/),
});
export type SignatureCreateRequest = z.input<typeof signatureCreateSchema>;

// 첫 저장 때 고정하는 참조 사본. 프로젝트 공개 필드와 그 요청의 지원 내용만 담는다.
export interface TermsReference {
  project: {
    id: string;
    title: string;
    description: string;
    purpose: string;
    styles: string[];
    budget: number;
  } | null;
  request: {
    message: string;
    proposedAmount: number;
    expectedDays: number;
  };
}

export interface TermsSignature {
  userId: string;
  signerName: string;
  signedAt: string;
}

export interface TermsVersion {
  versionNo: number;
  // 기한이 지난 SIGNING은 저장 전이어도 EXPIRED로 보여 준다.
  status: TermsVersionStatus;
  values: TermsValues;
  termsHash: string;
  authorId: string;
  createdAt: string;
  signing: {
    requestedBy: string;
    requestedAt: string;
    expiresAt: string;
  } | null;
  signatures: TermsSignature[];
}

export interface Contract {
  id: string;
  workRequestId: string;
  projectId: string | null;
  termsVersionNo: number;
  clientId: string;
  creatorId: string;
  amountKrw: number;
  termsHash: string;
  status: ContractStatus;
  signedAt: string;
}

export interface TermsDocument {
  workRequestId: string;
  workRequestStatus: WorkRequestStatus;
  projectStatus: ProjectStatus | null;
  // 첫 버전을 저장하기 전에는 null
  reference: TermsReference | null;
  versions: TermsVersion[];
  contract: Contract | null;
}

export interface SignatureResponse {
  version: TermsVersion;
  // 두 번째 서명으로 계약이 체결되면 함께 준다.
  contract: Contract | null;
}
