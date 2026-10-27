import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BookmarkMock from "./BookmarkMock";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "../components/ui/dialog";
import { campaignTime } from "./campaign-model";
import { recruitmentStatus } from "./discovery-model";
import { detailDiscovery, closeDiscovery } from "./discovery-api";
import { useNow, failure } from "./discovery-ui";

export default function DiscoveryDetailMock({ id }: { id: string }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [params] = useSearchParams();
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const queryKey = ["mock-discovery", session.epoch(), user?.id, "detail", id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => detailDiscovery(id, signal),
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (query.data?.revision === null || query.data?.revision === undefined)
        throw new Error("권한 확인 필요");
      const epoch = session.epoch();
      const result = await closeDiscovery(id, query.data.revision);
      if (epoch !== session.epoch()) return;
      cache.setQueryData(queryKey, result);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["mock-campaigns"] }),
        cache.invalidateQueries({ queryKey: ["mock-discovery"] }),
      ]);
      if (epoch !== session.epoch()) return;
      setNotice("모의 마감 응답을 확인했어요. 신규 접수만 종료해요.");
      setConfirm(false);
    },
  });
  const item = query.data?.item;
  const closed = item && recruitmentStatus(item, now) === "CLOSED";
  const own =
    user?.role === "CLIENT" &&
    user.status === "ACTIVE" &&
    item?.ownerId === user.id &&
    query.data?.revision !== null;
  const busy = query.isFetching || mutation.isPending;
  return (
    <>
      <Link to={`/campaigns?${params}`}>모집 목록으로</Link>
      <h1 className="type-heading-lg">모집 상세</h1>
      <BookmarkMock key={id} id={id} />
      <Button variant="outline" disabled={busy} onClick={() => query.refetch()}>
        최신 상태 확인
      </Button>
      {query.isFetching && <p role="status">모집 상세를 불러오고 있어요.</p>}
      {query.error && <p role="alert">{failure(query.error)}</p>}
      {item && !query.error && (
        <article className="showcase-card grid gap-4 break-words">
          <p role="status" className="type-label-sm text-primary">
            {closed ? "모집 마감 · 신규 제안 종료" : "모집 중"}
          </p>
          <h2 className="type-heading-md">{item.title}</h2>
          <dl className="grid gap-3">
            {[
              ["제품·서비스", item.product],
              ["제작 목적", item.purpose],
              ["작업 범위", item.scope],
              ["예산", `${Number(item.budget).toLocaleString("ko-KR")}원`],
              ["모집 기간", `${item.days}일`],
              ["공개", item.publishedAt && campaignTime(item.publishedAt)],
              [
                "마감",
                item.recruitmentEndAt && campaignTime(item.recruitmentEndAt),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="font-semibold">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>
            모집 마감은 기존 후보와의 협의·서명·계약을 자동 취소하지 않아요.
            제안·협의는 개발용 Mock이며 실제 거래는 미연결이에요.
          </p>
          {closed ? (
            <Button disabled>신규 제안 종료</Button>
          ) : (
            (!user || user.role === "CREATOR") && (
              <Button asChild>
                <Link to={`/campaigns/${id}/apply`}>제안 제출하기</Link>
              </Button>
            )
          )}
          {own && (
            <Button asChild variant="outline">
              <Link to={`/campaigns/${id}/proposals`}>제안 후보 확인</Link>
            </Button>
          )}
          {own && !closed && (
            <Dialog
              open={confirm}
              onOpenChange={(open) => {
                if (!mutation.isPending) {
                  setConfirm(open);
                  mutation.reset();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" disabled={busy}>
                  모집 마감하기
                </Button>
              </DialogTrigger>
              <DialogContent
                onEscapeKeyDown={(event) => {
                  if (mutation.isPending) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                  if (mutation.isPending) event.preventDefault();
                }}
              >
                <DialogHeader>
                  <DialogTitle>모집을 마감할까요?</DialogTitle>
                  <DialogDescription>
                    신규 제안만 종료해요. 기존 협의·서명·계약은 유지하며
                    취소하지 않아요. 개발용 Mock 동작이에요.
                  </DialogDescription>
                </DialogHeader>
                {mutation.error && (
                  <p role="alert">
                    {failure(mutation.error)} 응답 유실일 수 있으니 닫고 최신
                    상태를 확인해 주세요.
                  </p>
                )}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" disabled={mutation.isPending}>
                      마감 취소
                    </Button>
                  </DialogClose>
                  <Button disabled={busy} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? "마감 처리 중…" : "모의 마감 확정"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </article>
      )}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
