import { Link, useLocation } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import ScreenLinks from "../app/ScreenLinks";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import loadActivity from "./activity-api";
import { recruitmentStatus } from "./discovery-model";

export default function ActivityMock() {
  const { user } = useSession();
  const { pathname } = useLocation();
  const query = useQuery({
    queryKey: ["mock-activity", session.epoch(), user?.id, pathname],
    queryFn: ({ signal }) => loadActivity(signal),
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: (id: string) => loadActivity(undefined, { id, saved: false }),
    onSuccess: () => query.refetch(),
  });
  const { data } = query;
  const busy = query.isFetching || mutation.isPending;
  const bookmarks = pathname === "/bookmarks";
  const recommendations = pathname === "/recommendations";
  let title = "내 활동";
  if (bookmarks) title = "저장한 캠페인";
  if (recommendations) title = "추천 캠페인";
  return (
    <section className="grid min-w-0 gap-6 break-words">
      <h1 className="type-heading-lg">{title}</h1>
      <p className="rounded-xl bg-muted p-4">
        개발용 Mock · 이 탭의 본인 활동만 표시해요. 실제 API·DB 미연결, 새로고침
        시 초기화돼요.
      </p>
      <nav aria-label="활동 메뉴" className="flex flex-wrap gap-4">
        <Link to="/requests">내 제안·협의</Link>
        <Link to="/notifications">알림</Link>
        <Link to="/reports/new">신고·이용 안내</Link>
        {user?.role === "CREATOR" && (
          <>
            <Link to="/bookmarks">저장한 캠페인</Link>
            <Link to="/recommendations">추천 캠페인</Link>
          </>
        )}
      </nav>
      <Button variant="outline" disabled={busy} onClick={() => query.refetch()}>
        활동 다시 확인
      </Button>
      {busy && <p role="status">활동 확인 중…</p>}
      {(query.error || mutation.error) && (
        <p role="alert">활동 응답을 확인하지 못했어요. 다시 조회해 주세요.</p>
      )}
      {data && !query.error && !busy && (
        <>
          {!bookmarks && !recommendations && (
            <>
              {user?.role === "CLIENT" && (
                <section className="showcase-card grid gap-4">
                  <h2 className="type-heading-sm">내 모집·초안</h2>
                  {!data.campaigns.length && <p>작성한 모집이 없어요.</p>}
                  {data.campaigns.map((c) => (
                    <Link
                      key={c.id}
                      to={
                        c.status === "DRAFT"
                          ? `/campaigns/${c.id}/edit`
                          : `/campaigns/${c.id}`
                      }
                    >
                      {c.title} · {c.status}
                    </Link>
                  ))}
                </section>
              )}
              <section className="showcase-card grid gap-4">
                <h2 className="type-heading-sm">내 의뢰·계약</h2>
                {!data.requests.length && <p>진행 중인 의뢰가 없어요.</p>}
                {data.requests.map((r) => (
                  <article
                    key={r.id}
                    className="grid gap-3 rounded-xl border p-4"
                  >
                    <Link to={`/requests/${r.id}`}>
                      {r.title} · {r.status}
                    </Link>
                    {r.contractIds.map((id) => (
                      <div key={id} className="flex flex-wrap gap-4">
                        <Link to={`/contracts/${id}/deliveries`}>
                          영상·납품 확인
                        </Link>
                        <Link to={`/contracts/${id}/settlement`}>
                          정산 결과
                        </Link>
                        <Link to={`/contracts/${id}/review`}>
                          완료 거래 리뷰
                        </Link>
                      </div>
                    ))}
                  </article>
                ))}
              </section>
            </>
          )}
          {bookmarks && (
            <>
              <p>
                D15 처리 미결정 · 이 Mock은 마감 항목을 표시하고 비공개·삭제
                대상은 제목을 숨겨요.
              </p>
              {!data.bookmarks.length && <p>저장한 캠페인이 없어요.</p>}
              {data.bookmarks.map(({ id, item }) => (
                <article key={id} className="showcase-card grid gap-4">
                  {item ? (
                    <Link to={`/campaigns/${id}`}>
                      {item.title} ·{" "}
                      {recruitmentStatus(item) === "OPEN"
                        ? "모집 중"
                        : "모집 종료"}
                    </Link>
                  ) : (
                    <p>조회할 수 없는 저장 항목이에요.</p>
                  )}
                  <Button
                    disabled={busy}
                    variant="outline"
                    onClick={() => mutation.mutate(id)}
                  >
                    저장 해제
                  </Button>
                </article>
              ))}
            </>
          )}
          {recommendations && (
            <>
              <p>
                개발 예시 · 프로필 분야와 제품 표현만 비교해요.
                스타일·예산·일정의 적합을 보장하지 않아요. D15 추천 규칙은
                미결정이에요.
              </p>
              <Link to="/me/profile">프로필 분야 확인·수정</Link>
              {!data.recommendations.sufficient && (
                <p>추천 정보가 부족해요. 프로필 분야를 먼저 입력해 주세요.</p>
              )}
              {data.recommendations.sufficient &&
                !data.recommendations.items.length && (
                  <p>현재 조건에 일치하는 모집이 없어요.</p>
                )}
              {data.recommendations.sufficient &&
                data.recommendations.items.map(({ item, reason }) => (
                  <article key={item.id} className="showcase-card grid gap-4">
                    <Link to={`/campaigns/${item.id}`}>{item.title}</Link>
                    <p>{reason}</p>
                  </article>
                ))}
            </>
          )}
          <Link to="/campaigns">공개 모집 둘러보기</Link>
        </>
      )}
      <ScreenLinks />
    </section>
  );
}
