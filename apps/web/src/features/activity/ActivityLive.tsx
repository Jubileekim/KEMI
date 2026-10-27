import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import type { ActivityStage, Notification } from "@kemi/shared";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import { kemi } from "../../shared/api/kemi";
import { dateTime, label, projectStatusLabels, won } from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";

const stageLabels: Record<ActivityStage, string> = {
  PENDING: "검토 대기",
  DISCUSSING: "협의 중",
  CLOSED: "종료",
  PAYMENT_PENDING: "계약 확정 · 결제 대기",
  PREPARING: "제작 준비",
  IN_PROGRESS: "제작 중",
  DELIVERED: "수령 완료 · 정산 대기",
  COMPLETED: "거래 완료",
  CANCELED: "취소됨",
};

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
  if (stage === "CANCELED") return `/contracts/${contractId}/cancellation`;
  return `/contracts/${contractId}/settlement`;
};

// 알림을 누르면 갈 곳: 요청(협의·계약)이 있으면 의뢰 상세, 없으면 모집 상세
const targetOf = (n: Notification) => {
  if (n.type.startsWith("SAFETY_") || n.type === "REPORT_RESOLVED")
    return "/reports/new";
  if (n.applicationId) return `/requests/${n.applicationId}`;
  if (n.projectId) return `/campaigns/${n.projectId}`;
  return null;
};

// NOTI-01·02: 인앱 알림. 안 읽은 것만 보기, 골라서 읽음, 모두 읽음 (실제 API)
export function NotificationsLive() {
  const client = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const list = useQuery({
    queryKey: ["notifications", unreadOnly],
    queryFn: ({ signal }) =>
      kemi.notifications(
        `?pageSize=50${unreadOnly ? "&unread=true" : ""}`,
        signal,
      ),
  });
  const refresh = () => {
    setSelected([]);
    client.invalidateQueries({ queryKey: ["notifications"] });
    client.invalidateQueries({ queryKey: ["unread-count"] });
  };
  const readMany = useMutation({
    mutationFn: (ids: string[]) => kemi.readNotifications(ids),
    onSuccess: refresh,
  });
  const readAll = useMutation({
    mutationFn: () => kemi.readAllNotifications(),
    onSuccess: refresh,
  });
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-heading-lg">알림</h1>
        {!!list.data?.unreadCount && (
          <Badge>안 읽음 {list.data.unreadCount}</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant={unreadOnly ? "default" : "outline"}
          onClick={() => setUnreadOnly((v) => !v)}
        >
          {unreadOnly ? "전체 보기" : "안 읽은 것만"}
        </Button>
        <Button
          variant="outline"
          disabled={readMany.isPending || selected.length === 0}
          onClick={() => readMany.mutate(selected)}
        >
          선택한 {selected.length}개 읽음
        </Button>
        <Button
          variant="outline"
          disabled={readAll.isPending || !list.data?.unreadCount}
          onClick={() => readAll.mutate()}
        >
          모두 읽음
        </Button>
      </div>
      {list.isPending && <Loading />}
      {list.error && <Failure error={list.error} />}
      {list.data?.items.length === 0 && (
        <Card>
          <p>{unreadOnly ? "안 읽은 알림이 없어요." : "알림이 없어요."}</p>
        </Card>
      )}
      <ul className="grid gap-3">
        {list.data?.items.map((n) => {
          const target = targetOf(n);
          return (
            <li key={n.id} className="showcase-card grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                {!n.readAt && (
                  <input
                    type="checkbox"
                    aria-label={`${n.title} 선택`}
                    checked={selected.includes(n.id)}
                    onChange={(event) =>
                      setSelected((prev) =>
                        event.target.checked
                          ? [...prev, n.id]
                          : prev.filter((id) => id !== n.id),
                      )
                    }
                  />
                )}
                <span className="type-title">{n.title}</span>
                {!n.readAt && <Badge>새 알림</Badge>}
                <span className="text-muted-foreground">
                  {dateTime(n.createdAt)}
                </span>
              </div>
              <p>{n.body}</p>
              {target && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                >
                  <Link
                    to={target}
                    onClick={() =>
                      !n.readAt &&
                      kemi.readNotification(n.id).then(refresh, () => undefined)
                    }
                  >
                    바로 가기
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {(readMany.error ?? readAll.error) && (
        <p role="alert">{errorText(readMany.error ?? readAll.error)}</p>
      )}
    </>
  );
}

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
  const list = useQuery({
    queryKey: [kind],
    queryFn: ({ signal }) =>
      kind === "bookmarks"
        ? kemi.bookmarks(signal)
        : kemi.recommendations(signal),
  });
  const toggle = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) =>
      on ? kemi.bookmark(id) : kemi.unbookmark(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["bookmarks"] });
      client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
  return (
    <>
      <h1 className="type-heading-lg">
        {kind === "bookmarks" ? "저장한 캠페인" : "추천 캠페인"}
      </h1>
      {kind === "recommendations" && (
        <p className="text-muted-foreground">
          프로필의 분야·스타일과 맞는 모집 중 공고를 보여줘요.
        </p>
      )}
      {list.isPending && <Loading />}
      {list.error && <Failure error={list.error} />}
      {list.data?.items.length === 0 && (
        <Card>
          <p>
            {kind === "bookmarks"
              ? "저장한 공고가 없어요."
              : "추천할 공고가 아직 없어요. 프로필 분야를 채우면 정확해져요."}
          </p>
        </Card>
      )}
      <ul className="grid gap-3">
        {list.data?.items.map((p) => (
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
              {won(p.budget)} · 마감 {dateTime(p.recruitmentEndAt)}
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
      </ul>
      {toggle.error && <p role="alert">{errorText(toggle.error)}</p>}
    </>
  );
}

// ACT-01: 내 활동 — GET /api/activity 한 번으로 모집·요청의 진행 단계를 보여준다.
function Activity() {
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: ({ signal }) => kemi.activity(signal),
  });
  if (activity.isPending) return <Loading text="내 활동을 불러오고 있어요." />;
  if (activity.error) return <Failure error={activity.error} />;
  const a = activity.data;
  const todo = a.requests.filter((r) => r.needsAction);
  return (
    <>
      <h1 className="type-heading-lg">내 활동</h1>
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
        {a.requests.length === 0 && <p>아직 진행한 의뢰가 없어요.</p>}
        <ul className="grid gap-2">
          {a.requests.map((r) => (
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
