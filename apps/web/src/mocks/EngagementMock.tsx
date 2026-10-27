import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";
import Input from "../components/ui/input";
import { loadNotifications, loadReview } from "./engagement-api";

function Notices() {
  const { user } = useSession();
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useQuery({
    queryKey: ["mock-notifications", session.epoch(), user?.id],
    queryFn: ({ signal }) => loadNotifications(signal),
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: (ids: string[]) => loadNotifications(undefined, ids),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["mock-notifications"] }),
  });
  const busy = query.isFetching || mutation.isPending;
  const items = (query.data?.items ?? []).filter((n) => !unreadOnly || !n.read);
  const max = Math.max(1, Math.ceil(items.length / 20));
  const current = Math.min(page, max);
  return (
    <section className="grid gap-4">
      <h1 className="type-heading-lg">알림</h1>
      <p>
        인앱 알림 미확인{" "}
        {query.isError ? "확인 실패" : (query.data?.unreadCount ?? "확인 중")} ·
        채팅 미확인 수와 별도예요.
      </p>
      <div className="flex flex-wrap gap-4">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => query.refetch()}
        >
          알림 다시 확인
        </Button>
        <Button
          disabled={busy || !items.some((n) => !n.read) || query.isError}
          onClick={() =>
            mutation.mutate(
              items
                .filter((n) => !n.read)
                .slice(0, 200)
                .map((n) => n.id),
            )
          }
        >
          미확인 알림 읽음 처리 (최대 200개)
        </Button>
      </div>
      <Label>
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => {
            setUnreadOnly(e.target.checked);
            setPage(1);
          }}
        />{" "}
        미확인만 보기
      </Label>
      {busy && <p role="status">알림 확인 중…</p>}
      {(query.error || mutation.error) && (
        <p role="alert">알림 응답을 확인하지 못했어요. 다시 조회해 주세요.</p>
      )}
      {!busy && !query.isError && query.data && (
        <>
          {!items.length && <p>표시할 알림이 없어요.</p>}
          {items.slice((current - 1) * 20, current * 20).map((n) => (
            <article key={n.id} className="showcase-card grid gap-3">
              <p>
                {n.label} · {n.read ? "읽음" : "미확인"}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date(n.at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}{" "}
                (한국 시간·기록 확인 시각)
              </p>
              <Link to={n.path}>연결 화면 확인</Link>
              {!n.read && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => mutation.mutate([n.id])}
                >
                  이 알림 읽음 처리
                </Button>
              )}
            </article>
          ))}
          <nav aria-label="알림 페이지" className="flex flex-wrap gap-4">
            <Button
              variant="outline"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              이전 알림
            </Button>
            <span>
              {current} / {max}
            </span>
            <Button
              variant="outline"
              disabled={current >= max}
              onClick={() => setPage(current + 1)}
            >
              다음 알림
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
function ReviewForm({ id }: { id: string }) {
  const { user } = useSession();
  const [rating, setRating] = useState("5");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const query = useQuery({
    queryKey: ["mock-review", session.epoch(), user?.id, id],
    queryFn: ({ signal }) => loadReview(id, signal),
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: () =>
      loadReview(id, undefined, {
        rating: Number(rating),
        content,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => query.refetch(),
  });
  const busy = query.isFetching || mutation.isPending;
  const { data } = query;
  return (
    <section className="showcase-card grid gap-4">
      <h1 className="type-heading-lg">완료 거래 리뷰</h1>
      <p>
        정상 수령 완료 후 양측 각각 1회. D14 공개 시점·수정·삭제·태그 정책은
        미결정으로 본인 작성 내용만 표시해요. 상대방 알림·공개 평점에는 반영하지
        않아요.
      </p>
      <Button variant="outline" disabled={busy} onClick={() => query.refetch()}>
        리뷰 상태 다시 확인
      </Button>
      {busy && <p role="status">리뷰 상태 확인 중…</p>}
      {(query.error || mutation.error) && (
        <p role="alert">
          리뷰 응답을 확인하지 못했어요. 입력을 유지해요. 먼저 상태를 다시
          확인해 주세요.
        </p>
      )}
      {data && !query.isError && !busy && (
        <>
          <p>
            {data.reason} · 본인 작성 표본 {data.own ? 1 : 0}건
          </p>
          {data.own && (
            <article aria-label="내 리뷰" className="grid gap-3">
              <p>작성 완료 · {data.own.rating} / 5점</p>
              <p>{data.own.content}</p>
              <p>{data.own.tags.join(" · ")}</p>
            </article>
          )}
          {data.eligible && !data.own && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <Label htmlFor="review-rating">별점 (필수)</Label>
              <select
                id="review-rating"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}점
                  </option>
                ))}
              </select>
              <Label htmlFor="review-content">리뷰 내용 (필수)</Label>
              <Textarea
                id="review-content"
                required
                maxLength={2000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <Label htmlFor="review-tags">태그 (선택·쉼표로 구분)</Label>
              <Input
                id="review-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p>
                개발 입력 보호: 내용 2,000자, 태그 최대 5개·각 30자. 운영 정책은
                미결정이에요.
              </p>
              <Button type="submit">상대방 리뷰 작성</Button>
            </form>
          )}
        </>
      )}
      <Link to={`/contracts/${id}/deliveries`}>영상·납품으로 돌아가기</Link>
      <Link to="/reports/new">신고·이용 안내</Link>
    </section>
  );
}
export default function EngagementMock() {
  const { contractId } = useParams();
  return (
    <div className="grid min-w-0 gap-6 break-words">
      <p className="rounded-xl bg-muted p-4">
        개발용 Mock · 실제 알림·리뷰 API/DB 미연결. 이 탭의 성공 기록을 조회하며
        새로고침·사이트 종료 후 보관은 미지원이에요.
      </p>
      {contractId ? <ReviewForm id={contractId} /> : <Notices />}
      <Link to="/me/activity">내 활동으로</Link>
    </div>
  );
}
