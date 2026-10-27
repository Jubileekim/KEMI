import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { Notification } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import { kemi } from "../../shared/api/kemi";
import {
  dateTime,
  label,
  projectStatusLabels,
  requestStatusLabels,
  won,
} from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";

// 알림을 누르면 갈 곳: 요청(협의·계약)이 있으면 의뢰 상세, 없으면 모집 상세
const targetOf = (n: Notification) => {
  if (n.applicationId) return `/requests/${n.applicationId}`;
  if (n.projectId) return `/campaigns/${n.projectId}`;
  return null;
};

// NOTI-01·02: 인앱 알림·읽음 (실제 API)
export function NotificationsLive() {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) => kemi.notifications("?pageSize=50", signal),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({
    mutationFn: (id: string) => kemi.readNotification(id),
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
      <Button
        variant="outline"
        className="justify-self-start"
        disabled={readAll.isPending || !list.data?.unreadCount}
        onClick={() => readAll.mutate()}
      >
        모두 읽음
      </Button>
      {list.isPending && <Loading />}
      {list.error && <Failure error={list.error} />}
      {list.data?.items.length === 0 && (
        <Card>
          <p>알림이 없어요.</p>
        </Card>
      )}
      <ul className="grid gap-3">
        {list.data?.items.map((n) => {
          const target = targetOf(n);
          return (
            <li key={n.id} className="showcase-card grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-title">{n.title}</span>
                {!n.readAt && <Badge>새 알림</Badge>}
                <span className="text-muted-foreground">
                  {dateTime(n.createdAt)}
                </span>
              </div>
              <p>{n.body}</p>
              <div className="flex flex-wrap gap-2">
                {target && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={target}
                      onClick={() => !n.readAt && read.mutate(n.id)}
                    >
                      바로 가기
                    </Link>
                  </Button>
                )}
                {!n.readAt && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={read.isPending}
                    onClick={() => read.mutate(n.id)}
                  >
                    읽음
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {(read.error ?? readAll.error) && (
        <p role="alert">{errorText(read.error ?? readAll.error)}</p>
      )}
    </>
  );
}

// 내 활동: 의뢰인은 내 모집, 크리에이터는 내 지원·관심 공고·추천, 공통으로 진행 중 대화와 정산
export default function ActivityLive() {
  const { role } = useSession();
  const projects = useQuery({
    queryKey: ["my-projects"],
    enabled: role === "client",
    queryFn: ({ signal }) => kemi.myProjects(signal),
  });
  const applications = useQuery({
    queryKey: ["my-applications"],
    enabled: role === "creator",
    queryFn: ({ signal }) => kemi.myApplications(signal),
  });
  const bookmarks = useQuery({
    queryKey: ["bookmarks"],
    enabled: role === "creator",
    queryFn: ({ signal }) => kemi.bookmarks(signal),
  });
  const recommendations = useQuery({
    queryKey: ["recommendations"],
    enabled: role === "creator",
    queryFn: ({ signal }) => kemi.recommendations(signal),
  });
  const rooms = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: ({ signal }) => kemi.chatRooms(signal),
  });
  const settlements = useQuery({
    queryKey: ["my-settlements"],
    enabled: role === "creator",
    queryFn: ({ signal }) => kemi.mySettlements(signal),
  });
  return (
    <>
      <h1 className="type-heading-lg">내 활동</h1>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/notifications">알림</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/requests">의뢰 현황</Link>
        </Button>
        {role === "client" && (
          <Button asChild>
            <Link to="/campaigns/new">모집 작성</Link>
          </Button>
        )}
      </div>
      {role === "client" && (
        <Card title="내 모집">
          {projects.isPending && <Loading />}
          {projects.error && <Failure error={projects.error} />}
          {projects.data?.items.length === 0 && <p>작성한 모집이 없어요.</p>}
          <ul className="grid gap-2">
            {projects.data?.items.map((p) => (
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
                  지원자 보기
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {role === "creator" && (
        <>
          <Card title="내 지원">
            {applications.data?.items.length === 0 && (
              <p>지원한 모집이 없어요.</p>
            )}
            <ul className="grid gap-2">
              {applications.data?.items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/requests/${a.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {a.project.title}
                  </Link>
                  <Badge variant="secondary">
                    {label(requestStatusLabels, a.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="관심 공고">
            {bookmarks.data?.items.length === 0 && <p>저장한 공고가 없어요.</p>}
            <ul className="grid gap-2">
              {bookmarks.data?.items.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/campaigns/${p.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {p.title}
                  </Link>{" "}
                  · {won(p.budget)}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="추천 공고">
            {recommendations.data?.items.length === 0 && (
              <p>
                추천할 공고가 아직 없어요. 프로필 분야를 채우면 추천이
                정확해져요.
              </p>
            )}
            <ul className="grid gap-2">
              {recommendations.data?.items.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/campaigns/${p.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {p.title}
                  </Link>{" "}
                  · {won(p.budget)}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="모의 정산">
            {settlements.data?.items.length === 0 && (
              <p>정산된 거래가 없어요.</p>
            )}
            <ul className="grid gap-2">
              {settlements.data?.items.map((s) => (
                <li key={s.contractId}>
                  {s.title} · 지급(모의) {won(s.payoutKrw)} ·{" "}
                  {dateTime(s.createdAt)}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      <Card title="진행 중인 대화">
        {rooms.data?.items.length === 0 && <p>진행 중인 대화가 없어요.</p>}
        <ul className="grid gap-2">
          {rooms.data?.items.map((r) => (
            <li
              key={r.workRequestId}
              className="flex flex-wrap items-center gap-2"
            >
              <Link
                to={`/requests/${r.workRequestId}`}
                className="underline-offset-4 hover:underline"
              >
                {r.projectTitle ?? "직접 의뢰"} · {r.counterpartName}
              </Link>
              {r.unreadCount > 0 && <Badge>새 메시지 {r.unreadCount}</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
