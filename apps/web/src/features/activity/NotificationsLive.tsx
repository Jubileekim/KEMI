import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@kemi/shared";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import { kemi, query } from "../../shared/api/kemi";
import { dateTime } from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import readPage from "./navigation";

function targetOf(n: Notification) {
  if (n.type.startsWith("SAFETY_") || n.type === "REPORT_RESOLVED")
    return "/reports/new";
  if (n.applicationId) return `/requests/${n.applicationId}`;
  if (n.projectId) return `/campaigns/${n.projectId}`;
  return null;
}

export default function NotificationsLive() {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = readPage(params.get("page"));
  const unread = params.get("unread") === "true";
  const scope = `${page}:${unread}`;
  const [selection, setSelection] = useState<{ scope: string; ids: string[] }>({
    scope,
    ids: [],
  });
  const selected = selection.scope === scope ? selection.ids : [];
  const list = useQuery({
    queryKey: ["notifications", page, unread],
    queryFn: ({ signal }) =>
      kemi.notifications(
        query({ page, pageSize: 20, unread: unread ? "true" : undefined }),
        signal,
      ),
  });
  const refresh = () => {
    setSelection({ scope, ids: [] });
    client.invalidateQueries({ queryKey: ["notifications"] });
    client.invalidateQueries({ queryKey: ["unread-count"] });
    client.invalidateQueries({ queryKey: ["activity"] });
  };
  const read = useMutation({
    mutationFn: (ids: string[]) => kemi.readNotifications(ids),
    onSuccess: refresh,
  });
  const all = useMutation({
    mutationFn: () => kemi.readAllNotifications(),
    onSuccess: refresh,
  });
  const busy = list.isFetching || read.isPending || all.isPending;
  const data = list.isError || list.isFetching ? undefined : list.data;
  const maxPage = Math.max(1, list.data?.pagination.totalPages ?? 1);
  useEffect(() => {
    if (!list.data || list.isError || list.isFetching || page <= maxPage)
      return;
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("page", String(maxPage));
        return next;
      },
      { replace: true },
    );
  }, [list.data, list.isError, list.isFetching, page, maxPage, setParams]);
  const move = (nextPage: number) => {
    setSelection({ scope: "", ids: [] });
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("page", String(nextPage));
      return next;
    });
  };
  return (
    <>
      <h1 className="type-heading-lg">알림</h1>
      <p>
        인앱 알림 미확인 {data?.unreadCount ?? "확인 중"} · 채팅 미확인 수와
        별도예요.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => list.refetch()}
        >
          알림 다시 확인
        </Button>
        <Button
          disabled={busy || !data || selected.length === 0}
          onClick={() => read.mutate(selected)}
        >
          선택한 {selected.length}개 읽음
        </Button>
        <Button
          variant="outline"
          disabled={busy || !data?.unreadCount}
          onClick={() => all.mutate()}
        >
          모두 읽음
        </Button>
      </div>
      <label htmlFor="notifications-unread" className="flex items-center gap-2">
        <input
          id="notifications-unread"
          type="checkbox"
          checked={unread}
          disabled={read.isPending || all.isPending}
          onChange={(event) => {
            const { checked } = event.target;
            setSelection({ scope: "", ids: [] });
            setParams((previous) => {
              const next = new URLSearchParams(previous);
              if (checked) next.set("unread", "true");
              else next.delete("unread");
              next.delete("page");
              return next;
            });
          }}
        />
        미확인만 보기
      </label>
      {list.isFetching && <Loading text="알림 확인 중…" />}
      {list.error && <Failure error={list.error} />}
      {(read.error || all.error) && (
        <p role="alert">{errorText(read.error ?? all.error)}</p>
      )}
      {data?.items.length === 0 && (
        <Card>
          <p>표시할 알림이 없어요.</p>
        </Card>
      )}
      <ul className="grid gap-3">
        {data?.items.map((n) => {
          const target = targetOf(n);
          return (
            <li key={n.id} className="showcase-card grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {!n.readAt && (
                  <input
                    type="checkbox"
                    aria-label={`${n.title} 선택`}
                    disabled={busy}
                    checked={selected.includes(n.id)}
                    onChange={(event) => {
                      const { checked } = event.target;
                      setSelection((previous) => {
                        const ids =
                          previous.scope === scope ? previous.ids : [];
                        return {
                          scope,
                          ids: checked
                            ? [...ids, n.id]
                            : ids.filter((id) => id !== n.id),
                        };
                      });
                    }}
                  />
                )}
                <span className="type-title">{n.title}</span>
                <Badge>{n.readAt ? "읽음" : "새 알림"}</Badge>
                <span className="text-muted-foreground">
                  {dateTime(n.createdAt)}
                </span>
              </div>
              <p>{n.body}</p>
              <div className="flex flex-wrap gap-3">
                {target && (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to={target}
                      onClick={() => {
                        if (!n.readAt) read.mutate([n.id]);
                      }}
                    >
                      바로 가기
                    </Link>
                  </Button>
                )}
                {!n.readAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => read.mutate([n.id])}
                  >
                    이 알림 읽음 처리
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {data && (
        <nav
          aria-label="알림 페이지"
          className="flex flex-wrap items-center gap-3"
        >
          <Button
            variant="outline"
            disabled={busy || page <= 1}
            onClick={() => move(page - 1)}
          >
            이전 알림
          </Button>
          <span>
            {page} / {maxPage}
          </span>
          <Button
            variant="outline"
            disabled={busy || page >= maxPage}
            onClick={() => move(page + 1)}
          >
            다음 알림
          </Button>
        </nav>
      )}
    </>
  );
}
