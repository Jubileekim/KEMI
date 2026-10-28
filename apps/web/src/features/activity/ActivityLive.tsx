import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router";
import { ACTIVITY_STAGES, type ActivityStage } from "@kemi/shared";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import { kemi } from "../../shared/api/kemi";
import {
  dateTime,
  label,
  projectStatusLabels,
  stageLabels,
  won,
} from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import readPage from "./navigation";

// 요청 단계에 맞는 다음 화면
const nextPath = (
  stage: ActivityStage,
  id: string,
  contractId: string | null,
) => {
  if (!contractId) return `/requests/${id}`;
  if (stage === "PAYMENT_PENDING") return `/contracts/${contractId}/payment`;
  if (stage === "PREPARING") return `/contracts/${contractId}/production`;
  if (stage === "IN_PROGRESS" || stage === "DELIVERED")
    return `/contracts/${contractId}/deliveries`;
  if (stage === "CANCELED" || stage === "DISPUTED")
    return `/contracts/${contractId}/cancellation`;
  return `/contracts/${contractId}/settlement`;
};

export { default as NotificationsLive } from "./NotificationsLive";

// 상단 메뉴의 알림 링크(안 읽은 수). 1분마다 다시 센다.
export function NotificationLink() {
  const count = useQuery({
    queryKey: ["unread-count"],
    queryFn: ({ signal }) => kemi.unreadCount(signal),
    refetchInterval: 60_000,
  });
  const unread = count.data?.unreadCount ?? 0;
  return (
    <Link to="/notifications" aria-label={`알림, 안 읽음 ${unread}개`}>
      알림{unread > 0 ? ` ${unread}` : ""}
    </Link>
  );
}

// 관심 공고(/bookmarks)·추천 공고(/recommendations)
function CampaignList({ kind }: { kind: "bookmarks" | "recommendations" }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = readPage(params.get("page"));
  const list = useQuery({
    queryKey: [kind, page],
    queryFn: ({ signal }) =>
      kind === "bookmarks"
        ? kemi.bookmarks(signal, page)
        : kemi.recommendations(signal, page),
  });
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      on ? kemi.bookmark(id) : kemi.unbookmark(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bookmarks"] });
      client.invalidateQueries({ queryKey: ["activity"] });
      client.invalidateQueries({ queryKey: ["recommendations"] });
    },
  });
  useEffect(() => {
    if (!list.data || list.isFetching || list.isError) return;
    const last = Math.max(1, list.data.pagination.totalPages);
    if (page > last)
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("page", String(last));
          return next;
        },
        { replace: true },
      );
  }, [list.data, list.isFetching, list.isError, page, setParams]);
  return (
    <>
      <h1 className="type-heading-lg">
        {kind === "bookmarks" ? "저장한 캠페인" : "추천 캠페인"}
      </h1>
      {kind === "recommendations" && (
        <p className="text-muted-foreground">
          {list.data?.recommendation?.reason ??
            "현재 프로필·저장 이력으로 추천을 확인해요."}
          스타일·예산·일정의 적합을 보장하지 않아요.{" "}
          <Link to="/me/profile" className="underline">
            프로필 확인·수정
          </Link>
        </p>
      )}
      {list.isPending && <Loading />}
      {list.error && <Failure error={list.error} />}
      <Button
        variant="outline"
        disabled={list.isFetching}
        onClick={() => list.refetch()}
      >
        목록 다시 확인
      </Button>
      {!list.error &&
        list.data?.items.length === 0 &&
        !list.data.unavailableIds?.length && (
          <Card>
            <p>
              {kind === "bookmarks"
                ? "저장한 공고가 없어요."
                : "추천할 공고가 아직 없어요. 프로필 분야를 채우면 정확해져요."}
            </p>
          </Card>
        )}
      <ul className="grid gap-3">
        {!list.error &&
          list.data?.items.map((p) => (
            <li
              key={p.id}
              className="showcase-card flex flex-wrap items-center gap-3"
            >
              <Link
                to={`/campaigns/${p.id}`}
                className="type-title underline-offset-4 hover:underline"
              >
                {p.title}
              </Link>
              <span className="text-muted-foreground">
                {won(p.budget)} · 마감 {dateTime(p.recruitmentEndAt)}·{" "}
                {p.status === "OPEN" &&
                new Date(p.recruitmentEndAt).getTime() > list.dataUpdatedAt
                  ? "모집 중"
                  : "모집 종료"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={toggle.isPending}
                onClick={() =>
                  toggle.mutate({ id: p.id, on: kind === "recommendations" })
                }
              >
                {kind === "bookmarks" ? "저장 해제" : "저장"}
              </Button>
            </li>
          ))}
        {!list.error &&
          list.data?.unavailableIds?.map((id) => (
            <li key={id} className="showcase-card grid gap-3">
              <p>조회할 수 없는 저장 항목이에요.</p>
              <Button
                variant="outline"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ id, on: false })}
              >
                저장 해제
              </Button>
            </li>
          ))}
      </ul>
      {!list.error && list.data && (
        <nav aria-label="모집 목록 페이지" className="flex gap-3">
          <Button
            variant="outline"
            disabled={list.isFetching || page <= 1}
            onClick={() => setParams({ page: String(page - 1) })}
          >
            이전 모집
          </Button>
          <span>
            {page} / {Math.max(1, list.data.pagination.totalPages)}
          </span>
          <Button
            variant="outline"
            disabled={
              list.isFetching || page >= list.data.pagination.totalPages
            }
            onClick={() => setParams({ page: String(page + 1) })}
          >
            다음 모집
          </Button>
        </nav>
      )}
      {toggle.error && <p role="alert">{errorText(toggle.error)}</p>}
    </>
  );
}

// ACT-01: 내 활동 — GET /api/activity 한 번으로 모집·요청의 진행 단계를 보여준다.
function Activity() {
  const [params, setParams] = useSearchParams();
  const stage = params.get("stage") ?? "";
  const activity = useQuery({
    queryKey: ["activity"],
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => kemi.activity(signal),
  });
  if (activity.isPending) return <Loading text="내 활동을 불러오고 있어요." />;
  if (activity.error)
    return (
      <>
        <Failure error={activity.error} />
        <Button variant="outline" onClick={() => activity.refetch()}>
          활동 다시 확인
        </Button>
      </>
    );
  const a = activity.data;
  const todo = a.requests.filter((r) => r.needsAction);
  const requests = a.requests.filter(
    (r) =>
      !ACTIVITY_STAGES.some((value) => value === stage) || r.stage === stage,
  );
  return (
    <>
      <h1 className="type-heading-lg">내 활동</h1>
      <Button
        variant="outline"
        disabled={activity.isFetching}
        onClick={() => activity.refetch()}
      >
        활동 다시 확인
      </Button>
      <nav aria-label="활동 메뉴" className="flex flex-wrap gap-3">
        <Link to="/requests">내 제안·협의</Link>
        <Link to="/reports/new">신고·이용 안내</Link>
      </nav>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/notifications">
            알림{a.unreadNotifications > 0 ? ` ${a.unreadNotifications}` : ""}
          </Link>
        </Button>
        {a.role === "CLIENT" ? (
          <Button asChild>
            <Link to="/campaigns/new">모집 작성</Link>
          </Button>
        ) : (
          <>
            <Button asChild variant="outline">
              <Link to="/bookmarks">저장한 캠페인 {a.bookmarkCount}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/recommendations">추천 캠페인</Link>
            </Button>
          </>
        )}
      </div>
      {a.role === "CLIENT" && (
        <Card title="저장한 초안">
          {!a.drafts.length && <p>저장한 초안이 없어요.</p>}
          {a.drafts.map((draft) => (
            <Link
              key={draft.id}
              className="underline"
              to={`/campaigns/new?draft=${draft.id}`}
            >
              {draft.values.title || "제목 없는 초안"} · 이어 쓰기
            </Link>
          ))}
        </Card>
      )}
      {todo.length > 0 && (
        <Card title="지금 할 일">
          <ul className="grid gap-2">
            {todo.map((r) => (
              <li key={r.id}>
                <Link
                  to={nextPath(r.stage, r.id, r.contractId)}
                  className="underline-offset-4 hover:underline"
                >
                  {r.title} · {stageLabels[r.stage]}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {a.role === "CLIENT" && (
        <Card title="내 모집">
          {a.projects.length === 0 && <p>작성한 모집이 없어요.</p>}
          <ul className="grid gap-2">
            {a.projects.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/campaigns/${p.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {p.title}
                </Link>
                <Badge variant="secondary">
                  {label(projectStatusLabels, p.status)}
                </Badge>
                <Link
                  to={`/campaigns/${p.id}/proposals`}
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  지원 {p.applicationCount}건
                  {p.pendingCount > 0 ? ` · 검토 대기 ${p.pendingCount}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card
        title={
          a.role === "CLIENT"
            ? "받은 지원·보낸 직접 의뢰"
            : "내 지원·받은 직접 의뢰"
        }
      >
        <label htmlFor="activity-stage" className="grid gap-2">
          거래 단계
          <select
            id="activity-stage"
            className="rounded-xl border p-3"
            value={
              ACTIVITY_STAGES.some((value) => value === stage) ? stage : ""
            }
            onChange={(event) =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                if (event.target.value) next.set("stage", event.target.value);
                else next.delete("stage");
                return next;
              })
            }
          >
            <option value="">전체</option>
            {ACTIVITY_STAGES.map((value) => (
              <option key={value} value={value}>
                {stageLabels[value]}
              </option>
            ))}
          </select>
        </label>
        {requests.length === 0 && <p>표시할 의뢰가 없어요.</p>}
        <ul className="grid gap-2">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <Link
                to={nextPath(r.stage, r.id, r.contractId)}
                className="underline-offset-4 hover:underline"
              >
                {r.title}
              </Link>
              <span className="text-muted-foreground">{r.counterpartName}</span>
              <Badge variant={r.needsAction ? "default" : "secondary"}>
                {stageLabels[r.stage]}
              </Badge>
              {r.type === "DIRECT_REQUEST" && (
                <Badge variant="outline">직접 의뢰</Badge>
              )}
              {r.contractId && (
                <div className="flex flex-wrap gap-3 text-sm">
                  <Link to={`/contracts/${r.contractId}/deliveries`}>
                    영상·납품 확인
                  </Link>
                  <Link to={`/contracts/${r.contractId}/settlement`}>
                    정산 결과
                  </Link>
                  <Link to={`/contracts/${r.contractId}/review`}>
                    완료 거래 리뷰
                  </Link>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

// /me/activity, /bookmarks, /recommendations
export default function ActivityLive() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/bookmarks"))
    return <CampaignList kind="bookmarks" />;
  if (pathname.startsWith("/recommendations"))
    return <CampaignList kind="recommendations" />;
  return <Activity />;
}
