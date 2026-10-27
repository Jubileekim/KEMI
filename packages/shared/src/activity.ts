import type { ProjectDraft } from "./catalog.js";

// 내 활동 묶음 조회 (ACT-01). 화면이 여러 API를 조합하지 않고 한 번에 받는다.

// 요청(공개 모집 지원·직접 의뢰)의 진행 단계. 서버가 계약·결제·제작·정산·취소 상태로 계산한다.
export const ACTIVITY_STAGES = [
  "PENDING",
  "DISCUSSING",
  "CLOSED",
  "PAYMENT_PENDING",
  "PREPARING",
  "IN_PROGRESS",
  "DELIVERED",
  "COMPLETED",
  "CANCELED",
  "DISPUTED",
] as const;
export type ActivityStage = (typeof ACTIVITY_STAGES)[number];

export interface ActivityRequest {
  id: string;
  type: "PROJECT_APPLICATION" | "DIRECT_REQUEST";
  // 공개 모집 제목 또는 직접 의뢰 패키지 제목
  title: string;
  counterpartName: string;
  // 요청 자체 상태(WorkRequestStatus)
  status: string;
  stage: ActivityStage;
  contractId: string | null;
  // 이 요청에서 내가 해야 할 일이 있는지(대략적인 안내용)
  needsAction: boolean;
  updatedAt: string;
}

export interface ActivityProject {
  id: string;
  title: string;
  status: string;
  applicationCount: number;
  pendingCount: number;
}

export interface ActivityResponse {
  role: "CLIENT" | "CREATOR";
  // 의뢰인의 모집(크리에이터는 빈 배열)
  projects: ActivityProject[];
  drafts: ProjectDraft[];
  requests: ActivityRequest[];
  // 크리에이터의 관심 공고 수(의뢰인은 0)
  bookmarkCount: number;
  unreadNotifications: number;
}
