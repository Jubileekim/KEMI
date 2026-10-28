import type {
  ActivityResponse,
  BulkInquiryCreateRequest,
  BulkInquiryResponse,
  WorkBookmarkListResponse,
  AiReportApplyRequest,
  AiReportApplyResponse,
  PricingAnalysisRequest,
  PricingAnalysisResponse,
  AnalyticsBatchRequest,
  AnalyticsSummary,
  MySafetyView,
  ReportActionRequest,
  ReportCreateRequest,
  SafetyReport,
  Application,
  CancellationCreateRequest,
  CancellationOverview,
  ChatMessage,
  ChatMessagesResponse,
  ChatRoomListResponse,
  Contract,
  CreatorPublicProfile,
  DeadlineChangeCreateRequest,
  Delivery,
  DeliverableCreateRequest,
  DirectRequest,
  DirectRequestCreateRequest,
  Dispute,
  FeedResponse,
  FileDownloadResponse,
  FileUploadCreateRequest,
  FileUploadResponse,
  MaterialCreateRequest,
  MetricsSummary,
  MyApplicationListResponse,
  NotificationListResponse,
  OperationRecord,
  PackageCreateRequest,
  PaymentListResponse,
  PaymentOrder,
  Portfolio,
  PortfolioCreateRequest,
  PortfolioMedia,
  Production,
  ProjectApplicationListResponse,
  ProjectCreateRequest,
  ProjectListResponse,
  ProjectSummary,
  ProjectDraft,
  ProjectDraftValues,
  ReviewCreateRequest,
  Review,
  RevisionRequestCreateRequest,
  ServicePackage,
  SettlementListItem,
  SignatureCreateRequest,
  SignatureResponse,
  StoredFile,
  TermsDocument,
  TermsVersion,
  TermsVersionCreateRequest,
  UnreadCountResponse,
} from "@kemi/shared";
import { api } from "./client";

// 실제 백엔드 API(/api). 경로·요청·응답은 apps/api 라우터와 @kemi/shared 타입을 그대로 따른다.
// 개발 Mock(/__mock__)과 달리 배포 빌드에서도 같은 코드가 동작한다.

const enc = encodeURIComponent;
const get = async <T>(url: string, signal?: AbortSignal) =>
  (await api.get<T>(url, { signal })).data;
const post = async <T>(url: string, body?: unknown) =>
  (await api.post<T>(url, body ?? {})).data;
const patch = async <T>(url: string, body: unknown) =>
  (await api.patch<T>(url, body)).data;
const put = async <T>(url: string, body?: unknown) =>
  (await api.put<T>(url, body ?? {})).data;
const del = async <T>(url: string) => (await api.delete<T>(url)).data;

// URL 검색어로 바꾼다(빈 값은 뺀다).
export function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const kemi = {
  // ─── 공개 모집 (CAMP) ───
  projects: (search: string, signal?: AbortSignal) =>
    get<ProjectListResponse>(`/api/projects${search}`, signal),
  myProjects: (signal?: AbortSignal) =>
    get<ProjectListResponse>("/api/projects/me?pageSize=50", signal),
  project: (id: string, signal?: AbortSignal) =>
    get<ProjectSummary>(`/api/projects/${enc(id)}`, signal),
  createProject: (body: ProjectCreateRequest) =>
    post<ProjectSummary>("/api/projects", body),
  updateProject: (id: string, body: Partial<ProjectCreateRequest>) =>
    patch<ProjectSummary>(`/api/projects/${enc(id)}`, body),
  closeProject: (id: string) =>
    post<ProjectSummary>(`/api/projects/${enc(id)}/close`),
  endWithoutSelection: (id: string) =>
    post<ProjectSummary>(`/api/projects/${enc(id)}/end-without-selection`),
  bookmarks: (signal?: AbortSignal, page = 1) =>
    get<ProjectListResponse>(
      `/api/bookmarks/projects?page=${page}&pageSize=20`,
      signal,
    ),
  bookmark: (id: string) => put(`/api/bookmarks/projects/${enc(id)}`),
  unbookmark: (id: string) => del(`/api/bookmarks/projects/${enc(id)}`),
  recommendations: (signal?: AbortSignal, page = 1) =>
    get<ProjectListResponse>(
      `/api/recommendations/projects?page=${page}&pageSize=20`,
      signal,
    ),
  drafts: (signal?: AbortSignal) =>
    get<{ items: ProjectDraft[] }>("/api/project-drafts", signal),
  saveDraft: (body: ProjectDraftValues, id?: string) =>
    id
      ? patch<ProjectDraft>(`/api/project-drafts/${enc(id)}`, body)
      : post<ProjectDraft>("/api/project-drafts", body),
  // AI-01·02: AI 참고 제작비 분석과 분석 결과의 예산 반영
  analyzePricing: (body: PricingAnalysisRequest) =>
    post<PricingAnalysisResponse>("/api/pricing/analyze", body),
  applyPricingReport: (reportId: string, target: AiReportApplyRequest) =>
    post<AiReportApplyResponse>(
      `/api/pricing/reports/${enc(reportId)}/apply`,
      target,
    ),
  publishDraft: (id: string) =>
    post<{ draft: ProjectDraft; project: ProjectSummary }>(
      `/api/project-drafts/${enc(id)}/publish`,
    ),

  // ─── 지원·협의 (APPLY) ───
  apply: (
    projectId: string,
    body: { message: string; proposedAmount: number; expectedDays: number },
  ) => post<Application>(`/api/projects/${enc(projectId)}/applications`, body),
  projectApplications: (projectId: string, signal?: AbortSignal) =>
    get<ProjectApplicationListResponse>(
      `/api/projects/${enc(projectId)}/applications?pageSize=50`,
      signal,
    ),
  myApplications: (signal?: AbortSignal) =>
    get<MyApplicationListResponse>("/api/applications/me?pageSize=50", signal),
  discuss: (id: string) =>
    post<Application>(`/api/applications/${enc(id)}/discuss`),
  decline: (id: string) =>
    post<Application>(`/api/applications/${enc(id)}/decline`),
  withdraw: (id: string) =>
    post<Application>(`/api/applications/${enc(id)}/withdraw`),

  // ─── 알림 (NOTI) ───
  notifications: (search: string, signal?: AbortSignal) =>
    get<NotificationListResponse>(`/api/notifications${search}`, signal),
  unreadCount: (signal?: AbortSignal) =>
    get<UnreadCountResponse>("/api/notifications/unread-count", signal),
  readNotification: (id: string) => post(`/api/notifications/${enc(id)}/read`),
  readAllNotifications: () => post("/api/notifications/read-all"),
  readNotifications: (ids: string[]) =>
    post<UnreadCountResponse>("/api/notifications/read", { ids }),

  // ─── 내 활동 (ACT-01) ───
  activity: (signal?: AbortSignal) =>
    get<ActivityResponse>("/api/activity", signal),

  // ─── 신고·이용 제한 (OPS-01·02) ───
  report: (body: ReportCreateRequest) =>
    post<SafetyReport>("/api/reports", body),
  mySafety: (signal?: AbortSignal) =>
    get<MySafetyView>("/api/reports/me", signal),
  appeal: (reportId: string, body: { commandId: string; note: string }) =>
    post<MySafetyView>(`/api/reports/${enc(reportId)}/appeal`, body),
  adminReports: (signal?: AbortSignal) =>
    get<{ items: SafetyReport[] }>("/api/admin/reports", signal),
  actOnReport: (reportId: string, body: ReportActionRequest) =>
    post<SafetyReport>(`/api/admin/reports/${enc(reportId)}/actions`, body),

  // ─── 행동 기록 (METRIC-01) ───
  analytics: (body: AnalyticsBatchRequest) =>
    post<{ accepted: number }>("/api/analytics/events", body),
  analyticsSummary: (signal?: AbortSignal) =>
    get<AnalyticsSummary>("/api/admin/analytics", signal),

  // ─── 대화 (CHAT) ───
  chatRooms: (signal?: AbortSignal) =>
    get<ChatRoomListResponse>("/api/chat/rooms", signal),
  chatMessages: (requestId: string, signal?: AbortSignal) =>
    get<ChatMessagesResponse>(
      `/api/work-requests/${enc(requestId)}/chat/messages`,
      signal,
    ),
  sendMessage: (
    requestId: string,
    body: {
      clientMessageId: string;
      body: string;
      attachmentFileIds?: string[];
    },
  ) =>
    post<ChatMessage>(
      `/api/work-requests/${enc(requestId)}/chat/messages`,
      body,
    ),
  readChat: (requestId: string, lastReadMessageId: string) =>
    post(`/api/work-requests/${enc(requestId)}/chat/read`, {
      lastReadMessageId,
    }),

  // ─── 조건서·서명·계약 (TERMS·CONTRACT) ───
  terms: (requestId: string, signal?: AbortSignal) =>
    get<TermsDocument>(`/api/work-requests/${enc(requestId)}/terms`, signal),
  saveTerms: (requestId: string, body: TermsVersionCreateRequest) =>
    post<TermsVersion>(
      `/api/work-requests/${enc(requestId)}/terms/versions`,
      body,
    ),
  requestSigning: (requestId: string, versionNo: number) =>
    post<TermsVersion>(
      `/api/work-requests/${enc(requestId)}/terms/versions/${versionNo}/signing`,
    ),
  sign: (requestId: string, versionNo: number, body: SignatureCreateRequest) =>
    post<SignatureResponse>(
      `/api/work-requests/${enc(requestId)}/terms/versions/${versionNo}/signatures`,
      body,
    ),
  contractOf: (requestId: string, signal?: AbortSignal) =>
    get<Contract>(`/api/work-requests/${enc(requestId)}/contract`, signal),

  // ─── 결제 (PAY) ───
  payments: (contractId: string, signal?: AbortSignal) =>
    get<PaymentListResponse>(
      `/api/contracts/${enc(contractId)}/payments`,
      signal,
    ),
  createPayment: (contractId: string, commandId: string) =>
    post<PaymentOrder>(`/api/contracts/${enc(contractId)}/payments`, {
      commandId,
    }),
  confirmPayment: (body: {
    paymentKey: string;
    orderId: string;
    amount: number;
  }) => post<PaymentOrder>("/api/payments/confirm", body),
  failPayment: (orderId: string, body: { code: string; message?: string }) =>
    post<PaymentOrder>(`/api/payments/${enc(orderId)}/fail`, body),
  syncPayment: (orderId: string) =>
    post<PaymentOrder>(`/api/payments/${enc(orderId)}/sync`),

  // ─── 파일 (FILE) ───
  prepareUpload: (body: FileUploadCreateRequest) =>
    post<FileUploadResponse>("/api/files", body),
  completeUpload: (fileId: string) =>
    post<StoredFile>(`/api/files/${enc(fileId)}/complete`),
  file: (fileId: string, signal?: AbortSignal) =>
    get<StoredFile>(`/api/files/${enc(fileId)}`, signal),
  download: (fileId: string) =>
    get<FileDownloadResponse>(`/api/files/${enc(fileId)}/download`),

  // ─── 제작 (READY·WORK) ───
  production: (contractId: string, signal?: AbortSignal) =>
    get<Production>(`/api/contracts/${enc(contractId)}/production`, signal),
  addMaterial: (contractId: string, body: MaterialCreateRequest) =>
    post<Production>(
      `/api/contracts/${enc(contractId)}/production/materials`,
      body,
    ),
  confirmMaterial: (contractId: string, materialId: string) =>
    post<Production>(
      `/api/contracts/${enc(contractId)}/production/materials/${enc(materialId)}/confirm`,
    ),
  reportMaterial: (contractId: string, materialId: string, note: string) =>
    post<Production>(
      `/api/contracts/${enc(contractId)}/production/materials/${enc(materialId)}/issue`,
      { note },
    ),
  startProduction: (contractId: string) =>
    post<Production>(`/api/contracts/${enc(contractId)}/production/start`),
  requestDeadline: (contractId: string, body: DeadlineChangeCreateRequest) =>
    post<Production>(
      `/api/contracts/${enc(contractId)}/production/deadline-changes`,
      body,
    ),
  answerDeadline: (contractId: string, changeId: string, approve: boolean) =>
    post<Production>(
      `/api/contracts/${enc(contractId)}/production/deadline-changes/${enc(changeId)}/${approve ? "approve" : "reject"}`,
    ),

  // ─── 납품·수정·수령·정산·리뷰 (DEL·REV·SETTLE·REVIEW) ───
  delivery: (contractId: string, signal?: AbortSignal) =>
    get<Delivery>(`/api/contracts/${enc(contractId)}/delivery`, signal),
  submitDeliverable: (contractId: string, body: DeliverableCreateRequest) =>
    post<Delivery>(`/api/contracts/${enc(contractId)}/deliverables`, body),
  requestRevision: (
    contractId: string,
    deliverableId: string,
    body: RevisionRequestCreateRequest,
  ) =>
    post<Delivery>(
      `/api/contracts/${enc(contractId)}/deliverables/${enc(deliverableId)}/revision-requests`,
      body,
    ),
  approveDeliverable: (contractId: string, deliverableId: string) =>
    post<Delivery>(
      `/api/contracts/${enc(contractId)}/deliverables/${enc(deliverableId)}/approve`,
    ),
  receiveDeliverable: (contractId: string, deliverableId: string) =>
    post<Delivery>(
      `/api/contracts/${enc(contractId)}/deliverables/${enc(deliverableId)}/receive`,
    ),
  review: (contractId: string, body: ReviewCreateRequest) =>
    post<Delivery>(`/api/contracts/${enc(contractId)}/reviews`, body),
  mySettlements: (signal?: AbortSignal) =>
    get<{ items: SettlementListItem[] }>("/api/settlements/me", signal),
  userReviews: (userId: string, signal?: AbortSignal) =>
    get<{ items: Review[] }>(`/api/users/${enc(userId)}/reviews`, signal),

  // ─── 패키지·작업물·제작자 (PACK·PORT) ───
  myPackages: (signal?: AbortSignal) =>
    get<{ items: ServicePackage[] }>("/api/creator/packages", signal),
  createPackage: (body: PackageCreateRequest) =>
    post<ServicePackage>("/api/creator/packages", body),
  updatePackage: (id: string, body: Partial<PackageCreateRequest>) =>
    patch<ServicePackage>(`/api/creator/packages/${enc(id)}`, body),
  setPackageVisible: (id: string, visible: boolean) =>
    post<ServicePackage>(
      `/api/creator/packages/${enc(id)}/${visible ? "publish" : "hide"}`,
    ),
  makeRepresentative: (id: string) =>
    post<ServicePackage>(`/api/creator/packages/${enc(id)}/representative`),
  myPortfolios: (signal?: AbortSignal) =>
    get<{ items: Portfolio[] }>("/api/creator/portfolios", signal),
  createPortfolio: (body: PortfolioCreateRequest) =>
    post<Portfolio>("/api/creator/portfolios", body),
  updatePortfolio: (id: string, body: Partial<PortfolioCreateRequest>) =>
    patch<Portfolio>(`/api/creator/portfolios/${enc(id)}`, body),
  setPortfolioVisible: (id: string, visible: boolean) =>
    post<Portfolio>(
      `/api/creator/portfolios/${enc(id)}/${visible ? "publish" : "hide"}`,
    ),
  deletePortfolio: (id: string) =>
    del<void>(`/api/creator/portfolios/${enc(id)}`),
  setServiceVisible: (visible: boolean) =>
    post<{ serviceStatus: string }>(
      `/api/creator/service/${visible ? "publish" : "hide"}`,
    ),
  creator: (userId: string, signal?: AbortSignal) =>
    get<CreatorPublicProfile>(`/api/creators/${enc(userId)}`, signal),
  servicePackage: (id: string, signal?: AbortSignal) =>
    get<ServicePackage>(`/api/packages/${enc(id)}`, signal),
  portfolio: (id: string, signal?: AbortSignal) =>
    get<Portfolio>(`/api/portfolios/${enc(id)}`, signal),
  portfolioMedia: (id: string, signal?: AbortSignal) =>
    get<PortfolioMedia>(`/api/portfolios/${enc(id)}/media`, signal),
  feed: (search: string, signal?: AbortSignal) =>
    get<FeedResponse>(`/api/feed${search}`, signal),

  // ─── 직접 의뢰 (DIRECT) ───
  sendDirectRequest: (packageId: string, body: DirectRequestCreateRequest) =>
    post<DirectRequest>(
      `/api/packages/${enc(packageId)}/direct-requests`,
      body,
    ),
  // SAVE-01·INQ-01: 작품 저장함과 일괄 문의
  workBookmarks: (signal?: AbortSignal) =>
    get<WorkBookmarkListResponse>("/api/me/work-bookmarks", signal),
  saveWork: (portfolioId: string) =>
    put<{ saved: true }>(`/api/portfolios/${enc(portfolioId)}/bookmark`),
  unsaveWork: (portfolioId: string) =>
    del<{ saved: false }>(`/api/portfolios/${enc(portfolioId)}/bookmark`),
  sendBulkInquiry: (body: BulkInquiryCreateRequest) =>
    post<BulkInquiryResponse>("/api/direct-inquiries", body),
  directRequests: (signal?: AbortSignal) =>
    get<{ items: DirectRequest[] }>("/api/direct-requests", signal),
  directRequest: (id: string, signal?: AbortSignal) =>
    get<DirectRequest>(`/api/direct-requests/${enc(id)}`, signal),
  answerDirect: (id: string, action: "accept" | "decline" | "withdraw") =>
    post<DirectRequest>(`/api/direct-requests/${enc(id)}/${action}`),

  // ─── 취소·환불·분쟁·운영 (CANCEL·REFUND·DISPUTE·OPS) ───
  cancellation: (contractId: string, signal?: AbortSignal) =>
    get<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/cancellation`,
      signal,
    ),
  proposeCancellation: (contractId: string, body: CancellationCreateRequest) =>
    post<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/cancellations`,
      body,
    ),
  answerCancellation: (
    contractId: string,
    cancellationId: string,
    action: "accept" | "reject" | "withdraw",
  ) =>
    post<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/cancellations/${enc(cancellationId)}/${action}`,
    ),
  retryRefund: (contractId: string) =>
    post<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/refund/retry`,
    ),
  syncRefund: (contractId: string) =>
    post<CancellationOverview>(`/api/contracts/${enc(contractId)}/refund/sync`),
  confirmHandover: (contractId: string) =>
    post<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/handover/confirm`,
    ),
  openDispute: (
    contractId: string,
    body: { reason: string; fileIds?: string[] },
  ) =>
    post<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/disputes`,
      body,
    ),
  addEvidence: (
    contractId: string,
    disputeId: string,
    body: { note: string; fileIds?: string[] },
  ) =>
    post<CancellationOverview>(
      `/api/contracts/${enc(contractId)}/disputes/${enc(disputeId)}/evidence`,
      body,
    ),
  adminDisputes: (signal?: AbortSignal) =>
    get<{ items: Dispute[] }>("/api/admin/disputes", signal),
  adminDispute: (id: string, signal?: AbortSignal) =>
    get<Dispute>(`/api/admin/disputes/${enc(id)}`, signal),
  resolveDispute: (id: string, reason: string) =>
    post<Dispute>(`/api/admin/disputes/${enc(id)}/resolve`, { reason }),
  operationRecords: (signal?: AbortSignal) =>
    get<{ items: OperationRecord[] }>("/api/admin/operation-records", signal),
  metrics: (signal?: AbortSignal) =>
    get<MetricsSummary>("/api/admin/metrics", signal),
};

// 화면이 만든 요청 식별자(재전송해도 한 번만 처리된다).
export const newCommandId = () => crypto.randomUUID();

// 이 프로젝트의 지원이 MyApplication인지 Application인지와 관계없이 쓰는 최소 형태
export type RequestRef = Pick<Application, "id" | "status">;
