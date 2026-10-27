import { z } from "zod";

// 신고·이용 제한·이의 제기 (OPS-01·OPS-02) [제안, D18·D21]
// - 회원은 공개 모집(PROJECT)이나 본인이 당사자인 의뢰(WORK_REQUEST)를 신고한다. 신고만으로 제재하지 않는다.
// - 운영자(ADMIN)만 검토·경고·제한·해제한다. 근거가 운영 기록에 남는다.
// - 제한된 회원은 새 공고·지원·직접 의뢰를 할 수 없다. 진행 중인 대화·납품·결제는 계속된다.
// - 제한된 본인만 이의를 남길 수 있다.

export const REPORT_TARGET_TYPES = ["PROJECT", "WORK_REQUEST"] as const;
export const reportTargetTypeSchema = z.enum(REPORT_TARGET_TYPES);
export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;

export const REPORT_STATUSES = ["RECEIVED", "REVIEWING", "RESOLVED"] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

// 신고 이력 사건. RECEIVED는 접수, APPEAL은 이의 제기, 나머지는 운영자 조치다.
export const SAFETY_ACTIONS = [
  "RECEIVED",
  "REVIEW",
  "WARN",
  "LIMIT",
  "RELEASE",
  "APPEAL",
] as const;
export const safetyActionSchema = z.enum(SAFETY_ACTIONS);
export type SafetyAction = z.infer<typeof safetyActionSchema>;

export const OPERATOR_ACTIONS = ["REVIEW", "WARN", "LIMIT", "RELEASE"] as const;

const note = z.string().trim().min(1).max(2000);
const idString = z.string().regex(/^[1-9]\d*$/);

export const reportCreateSchema = z.strictObject({
  // 화면이 만든 요청 식별자. 같은 내용 재전송은 처음 접수를 돌려준다.
  commandId: z.uuid(),
  targetType: reportTargetTypeSchema,
  targetId: idString,
  reason: note,
  evidence: z.string().trim().max(4000).default(""),
});
export type ReportCreateRequest = z.input<typeof reportCreateSchema>;

export const reportActionSchema = z.strictObject({
  commandId: z.uuid(),
  action: z.enum(OPERATOR_ACTIONS),
  note,
});
export type ReportActionRequest = z.input<typeof reportActionSchema>;

export const reportAppealSchema = z.strictObject({
  commandId: z.uuid(),
  note,
});
export type ReportAppealRequest = z.input<typeof reportAppealSchema>;

export interface SafetyEvent {
  id: string;
  actorId: string;
  action: SafetyAction;
  note: string;
  createdAt: string;
}

export interface SafetyReport {
  id: string;
  reporterId: string;
  subjectId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  evidence: string;
  status: ReportStatus;
  // 이 신고로 대상자가 제한 중인지
  limited: boolean;
  history: SafetyEvent[];
  createdAt: string;
}

// 회원 본인 화면: 내가 낸 신고와, 나를 대상으로 한 제한·경고 안내
export interface MySafetyView {
  // 지금 이용 제한 중인지(새 공고·지원·직접 의뢰 불가)
  limited: boolean;
  // 내가 낸 신고(진행 상태만, 운영자 메모 포함)
  reports: SafetyReport[];
  // 나를 대상으로 경고·제한이 있었던 신고. 신고자 정보는 보여주지 않는다.
  notices: {
    reportId: string;
    limited: boolean;
    history: SafetyEvent[];
  }[];
}
