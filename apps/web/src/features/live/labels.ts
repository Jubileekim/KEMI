import type { ActivityStage } from "@kemi/shared";
// 실제 API 상태값의 화면 표시 문구. 값 목록은 @kemi/shared 상수와 같다.

export const purposeLabels: Record<string, string> = {
  WEDDING_COUPLE: "웨딩·커플",
  CHILD_FAMILY: "아이·가족",
  THANKS_CELEBRATION: "감사·축하",
  TRAVEL_DAILY: "여행·일상",
  SNS_SHORTFORM: "SNS·숏폼",
  OTHER: "기타",
};
// 의뢰할 때 가진 자료(INQ-01)
export const materialTypeLabels: Record<string, string> = {
  PHOTOS_ONLY: "사진만 있어요",
  PHOTOS_AND_VIDEOS: "사진·영상이 있어요",
  NEEDS_SHOOTING: "촬영도 필요해요",
};
export const bulkResultLabels: Record<string, string> = {
  SENT: "보냈어요",
  ALREADY_OPEN: "이 패키지로 진행 중인 의뢰가 있어 건너뛰었어요",
  SAME_CREATOR: "같은 크리에이터에게 이미 보냈어요",
  UNAVAILABLE: "지금은 의뢰할 수 없는 작품이에요",
};
export const styleLabels: Record<string, string> = {
  EMOTIONAL: "감성",
  FUN: "유쾌",
  CINEMATIC: "시네마틱",
  CLEAN: "깔끔",
  TRENDY: "트렌디",
  RETRO: "레트로",
  OTHER: "기타",
};
export const roleLabels: Record<string, string> = {
  PLANNING: "기획",
  ON_CAMERA: "출연",
  FILMING: "촬영",
  EDITING: "편집",
};
export const projectStatusLabels: Record<string, string> = {
  OPEN: "모집 중",
  MATCHED: "선정 완료",
  CLOSED: "모집 마감",
  CONTRACTED: "계약 완료",
};
export const requestStatusLabels: Record<string, string> = {
  PENDING: "검토 대기",
  DISCUSSING: "협의 중",
  CONTRACTED: "계약 체결",
  DECLINED: "거절됨",
  WITHDRAWN: "철회됨",
  EXPIRED: "만료됨",
  NOT_SELECTED: "미선정",
};
export const termsStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  SIGNING: "서명 대기",
  SIGNED: "서명 완료",
  SUPERSEDED: "새 버전으로 대체",
  EXPIRED: "서명 기한 만료",
  VOID: "무효",
};
export const paymentStatusLabels: Record<string, string> = {
  READY: "결제 대기",
  UNKNOWN: "결과 확인 중",
  SUCCEEDED: "결제 완료",
  FAILED: "결제 실패",
  CANCELED: "결제 취소",
};
export const productionStatusLabels: Record<string, string> = {
  PREPARING: "제작 준비",
  IN_PROGRESS: "제작 중",
  DELIVERED: "수령 완료(정산 대기)",
  COMPLETED: "거래 완료",
  CANCELED: "취소됨",
};
export const materialKindLabels: Record<string, string> = {
  FILE: "파일",
  SHIPMENT: "실물 발송",
  NOTE: "메모",
};
export const materialStatusLabels: Record<string, string> = {
  SUBMITTED: "확인 대기",
  CONFIRMED: "확인 완료",
  ISSUE_REPORTED: "문제 신고",
  REPLACED: "대체됨",
};
export const deliverableKindLabels: Record<string, string> = {
  DRAFT: "초안",
  REVIEW: "검토본",
  FINAL: "최종본",
};
export const deliverableStatusLabels: Record<string, string> = {
  SUBMITTED: "검토 대기",
  APPROVED: "승인됨",
  REVISION_REQUESTED: "수정 요청됨",
  SUPERSEDED: "새 버전으로 대체",
  RECEIVED: "수령 완료",
};
export const revisionTypeLabels: Record<string, string> = {
  GENERAL: "일반 수정(회차 차감)",
  DRAFT_FEEDBACK: "초안 의견(차감 없음)",
  CONTRACT_FIX: "계약 내용 미반영 수정(차감 없음)",
};
export const catalogStatusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  PUBLIC: "공개",
  PRIVATE: "비공개",
};
export const cancellationStatusLabels: Record<string, string> = {
  PROPOSED: "답변 대기",
  ACCEPTED: "합의됨",
  REJECTED: "거절됨",
  SUPERSEDED: "새 제안으로 대체",
  WITHDRAWN: "철회됨",
};
export const refundStatusLabels: Record<string, string> = {
  REQUESTED: "환불 요청 중",
  UNKNOWN: "결과 확인 중",
  SUCCEEDED: "환불 완료",
  FAILED: "환불 실패",
};
export const label = (labels: Record<string, string>, value: string) =>
  labels[value] ?? value;

export const won = (amount: number) =>
  `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));
export const dateOnly = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));

// 요청의 거래 진행 단계(서버가 계약·결제·제작·정산 상태로 계산). 내 활동·의뢰 현황·의뢰 상세가 같은 문구를 쓴다.
export const stageLabels: Record<ActivityStage, string> = {
  PENDING: "검토 대기",
  DISCUSSING: "협의 중",
  CLOSED: "종료",
  PAYMENT_PENDING: "계약 확정 · 결제 대기",
  PREPARING: "제작 준비",
  IN_PROGRESS: "제작 중",
  DELIVERED: "수령 완료 · 정산 대기",
  COMPLETED: "거래 완료",
  CANCELED: "취소됨",
  DISPUTED: "분쟁 처리 중",
};
// 계약 전에는 요청 상태(거절·철회·미선정처럼 자세한 값), 계약 뒤에는 거래 진행 단계를 보여 준다.
// 진행 단계를 아직 주지 않는 응답(이전 서버·시연 데이터)은 요청 상태로 보여 준다.
export function requestProgress(
  status: string,
  stage: ActivityStage | undefined,
) {
  return !stage || ["PENDING", "DISCUSSING", "CLOSED"].includes(stage)
    ? label(requestStatusLabels, status)
    : stageLabels[stage];
}
