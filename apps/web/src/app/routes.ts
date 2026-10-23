export type Role = "guest" | "client" | "creator" | "ops";
export interface Screen {
  path: string;
  title: string;
  layout: "public" | "member" | "workspace" | "ops";
  roles?: Role[];
}
const members: Role[] = ["client", "creator"];
export const screens: Screen[] = [
  { path: "/", title: "작품 피드", layout: "public" },
  { path: "/works/:workId", title: "작품 상세", layout: "public" },
  {
    path: "/creators/:creatorId",
    title: "크리에이터 프로필",
    layout: "public",
  },
  { path: "/login", title: "로그인", layout: "public" },
  { path: "/signup", title: "회원가입", layout: "public" },
  {
    path: "/auth/social/callback",
    title: "소셜 로그인 확인",
    layout: "public",
  },
  {
    path: "/onboarding",
    title: "역할·이름 설정",
    layout: "member",
    roles: members,
  },
  { path: "/me/profile", title: "내 프로필", layout: "member", roles: members },
  {
    path: "/studio/portfolio",
    title: "작품 관리",
    layout: "member",
    roles: ["creator"],
  },
  {
    path: "/studio/packages",
    title: "패키지 관리",
    layout: "member",
    roles: ["creator"],
  },
  { path: "/campaigns", title: "공개 모집", layout: "public" },
  { path: "/campaigns/:campaignId", title: "모집 상세", layout: "public" },
  {
    path: "/campaigns/new",
    title: "모집 작성",
    layout: "member",
    roles: ["client"],
  },
  {
    path: "/campaigns/:campaignId/edit",
    title: "모집 수정",
    layout: "member",
    roles: ["client"],
  },
  {
    path: "/campaigns/:campaignId/proposals",
    title: "후보 비교",
    layout: "member",
    roles: ["client"],
  },
  {
    path: "/campaigns/:campaignId/apply",
    title: "제안 제출",
    layout: "member",
    roles: ["creator"],
  },
  { path: "/requests", title: "의뢰 현황", layout: "member", roles: members },
  {
    path: "/requests/:requestId",
    title: "의뢰 상세",
    layout: "member",
    roles: members,
  },
  {
    path: "/creators/:creatorId/request",
    title: "직접 의뢰",
    layout: "member",
    roles: ["client"],
  },
  {
    path: "/workspace/:requestId",
    title: "작업 공간",
    layout: "workspace",
    roles: members,
  },
  {
    path: "/contracts/:contractId/payment",
    title: "테스트 결제",
    layout: "member",
    roles: ["client"],
  },
  {
    path: "/payments/result",
    title: "결제 결과 확인",
    layout: "member",
    roles: members,
  },
  {
    path: "/contracts/:contractId/cancellation",
    title: "취소 협의",
    layout: "member",
    roles: members,
  },
  {
    path: "/disputes/:disputeId",
    title: "분쟁 현황",
    layout: "member",
    roles: members,
  },
  { path: "/me/activity", title: "내 활동", layout: "member", roles: members },
  {
    path: "/bookmarks",
    title: "저장한 캠페인",
    layout: "member",
    roles: ["creator"],
  },
  {
    path: "/recommendations",
    title: "추천 캠페인",
    layout: "member",
    roles: ["creator"],
  },
  { path: "/notifications", title: "알림", layout: "member", roles: members },
  {
    path: "/contracts/:contractId/review",
    title: "리뷰 작성",
    layout: "member",
    roles: members,
  },
  {
    path: "/reports/new",
    title: "신고 접수",
    layout: "member",
    roles: members,
  },
  { path: "/ops/reports", title: "신고 검토", layout: "ops", roles: ["ops"] },
  { path: "/ops/disputes", title: "분쟁 검토", layout: "ops", roles: ["ops"] },
];
