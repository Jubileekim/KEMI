import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { DirectRequest } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import { ApiError } from "../../shared/api/client";
import { kemi } from "../../shared/api/kemi";
import {
  dateOnly,
  dateTime,
  label,
  purposeLabels,
  materialTypeLabels,
  requestProgress,
  won,
} from "../live/labels";
import { Card, Facts, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import TermsLive from "../terms/TermsLive";
import ChatLive from "./ChatLive";

const notFound = (error: unknown) =>
  error instanceof ApiError && error.status === 404;

// DIRECT-02: 직접 의뢰 정보와 크리에이터 수락·거절, 의뢰인 철회
function DirectHeader({
  requestId,
  item,
}: {
  requestId: string;
  item?: DirectRequest;
}) {
  const { role } = useSession();
  const client = useQueryClient();
  const answer = useMutation({
    mutationFn: (action: "accept" | "decline" | "withdraw") =>
      kemi.answerDirect(requestId, action),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["direct-request", requestId] });
      client.invalidateQueries({ queryKey: ["terms", requestId] });
      client.invalidateQueries({ queryKey: ["chat", requestId] });
    },
  });
  if (!item) return null;
  return (
    <Card title={`직접 의뢰 · ${item.package.title}`}>
      <Facts
        items={[
          ["상태", requestProgress(item.status, item.stage)],
          ["패키지 금액", won(item.package.priceKrw)],
          ["작업 일수", `${item.package.deliveryDays}일`],
          ["목적", item.purpose ? label(purposeLabels, item.purpose) : "미정"],
          ["행사일", item.eventDate ? dateOnly(item.eventDate) : "없음"],
          [
            "희망 납품일",
            item.desiredDeliveryDate
              ? dateOnly(item.desiredDeliveryDate)
              : "없음",
          ],
          [
            "가진 자료",
            item.materialType
              ? label(materialTypeLabels, item.materialType)
              : "미정",
          ],
          [
            "참고 작품",
            item.referencePortfolio ? (
              <Link
                to={`/works/${item.referencePortfolio.id}`}
                className="underline"
              >
                {item.referencePortfolio.title}
              </Link>
            ) : (
              "없음"
            ),
          ],
          ["응답 기한", dateTime(item.respondDueAt)],
        ]}
      />
      <p className="whitespace-pre-wrap">{item.message}</p>
      {item.inquiryGroupId && (
        <p className="text-sm text-muted-foreground">
          의뢰인이 같은 조건으로 여러 크리에이터에게 함께 보낸 문의예요.
        </p>
      )}
      {item.status === "PENDING" && (
        <div className="flex flex-wrap gap-3">
          {role === "creator" && (
            <>
              <Button
                disabled={answer.isPending}
                onClick={() => answer.mutate("accept")}
              >
                수락하고 협의 시작
              </Button>
              <Button
                variant="outline"
                disabled={answer.isPending}
                onClick={() => answer.mutate("decline")}
              >
                거절
              </Button>
            </>
          )}
          {role === "client" && (
            <Button
              variant="outline"
              disabled={answer.isPending}
              onClick={() => answer.mutate("withdraw")}
            >
              의뢰 철회
            </Button>
          )}
        </div>
      )}
      {answer.error && <p role="alert">{errorText(answer.error)}</p>}
    </Card>
  );
}

// 의뢰 상세(작업 공간): 직접 의뢰 정보, 대화, 최종 조건서·서명, 계약 이후 단계로 가는 길
export default function WorkspaceLive({ requestId }: { requestId: string }) {
  const direct = useQuery({
    queryKey: ["direct-request", requestId],
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => kemi.directRequest(requestId, signal),
    retry: false,
  });
  const terms = useQuery({
    queryKey: ["terms", requestId],
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => kemi.terms(requestId, signal),
    retry: (count, error) =>
      !(error instanceof ApiError && [403, 404].includes(error.status)) &&
      count < 2,
  });
  const termsDocument = terms.error ? undefined : terms.data;
  // Terms can legitimately be absent before a direct request is accepted.
  // Only the server's successful party-scoped read may open the workspace.
  if (terms.isPending) return <Loading text="접근 권한을 확인하고 있어요." />;
  if (terms.error && !notFound(terms.error))
    return <Failure error={terms.error} />;
  if (terms.error) {
    if (direct.isPending)
      return <Loading text="접근 권한을 확인하고 있어요." />;
    if (direct.error) return <Failure error={direct.error} />;
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-heading-lg">
          {termsDocument?.reference?.project?.title ?? "의뢰 상세"}
        </h1>
        {termsDocument && (
          <Badge variant="secondary">
            {requestProgress(
              termsDocument.workRequestStatus,
              termsDocument.stage,
            )}
          </Badge>
        )}
      </div>
      <DirectHeader
        requestId={requestId}
        item={direct.error ? undefined : direct.data}
      />
      {termsDocument?.reference && (
        <Card title="제안 내용">
          <p className="whitespace-pre-wrap">
            {termsDocument.reference.request.message}
          </p>
          <p className="text-muted-foreground">
            제안 {won(termsDocument.reference.request.proposedAmount)} ·{" "}
            {termsDocument.reference.request.expectedDays}일
          </p>
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <ChatLive requestId={requestId} />
        {terms.isPending && <Loading text="조건서를 불러오고 있어요." />}
        {terms.error &&
          (notFound(terms.error) ? (
            <Card title="최종 조건서">
              <p>협의가 시작되면 조건서를 쓸 수 있어요.</p>
            </Card>
          ) : (
            <Failure error={terms.error} />
          ))}
        {termsDocument && (
          <TermsLive requestId={requestId} document={termsDocument} />
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="ghost">
          <Link to="/requests">의뢰 현황으로</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link
            to={`/reports/new?targetType=WORK_REQUEST&targetId=${requestId}`}
          >
            이 의뢰 신고
          </Link>
        </Button>
      </div>
    </>
  );
}
