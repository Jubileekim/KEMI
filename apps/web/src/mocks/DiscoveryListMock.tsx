import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Label from "../components/ui/label";
import { campaignTime } from "./campaign-model";
import { browseQuerySchema, recruitmentStatus } from "./discovery-model";
import { listDiscovery } from "./discovery-api";
import { useNow, failure } from "./discovery-ui";

export default function DiscoveryListMock() {
  const [params, setParams] = useSearchParams();
  const { user } = useSession();
  const now = useNow();
  const search = params.toString();
  const parsed = browseQuerySchema.safeParse(Object.fromEntries(params));
  const query = useQuery({
    queryKey: ["mock-discovery", session.epoch(), user?.id, "list", search],
    enabled: parsed.success,
    queryFn: ({ signal }) => listDiscovery(search, signal),
    refetchOnReconnect: false,
  });
  const { data, refetch } = query;
  useEffect(() => {
    const deadline = data?.nextDeadline
      ? Date.parse(data.nextDeadline)
      : undefined;
    if (deadline === undefined) return undefined;
    const timer = window.setTimeout(
      () => {
        refetch();
      },
      Math.min(Math.max(0, deadline - Date.now()) + 10, 2147483647),
    );
    return () => window.clearTimeout(timer);
  }, [data, refetch]);
  function pageTo(page: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
  }
  return (
    <>
      <h1 className="type-heading-lg">공개 모집</h1>
      <form
        key={search}
        className="showcase-card grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          form.forEach((value, key) => {
            if (typeof value === "string" && value.trim())
              next.set(key, value.trim());
          });
          next.set("page", "1");
          setParams(next);
        }}
      >
        {[
          ["q", "검색어"],
          ["product", "제품 분야 (Mock 텍스트)"],
          ["budgetMin", "최소 예산 (원)"],
          ["budgetMax", "최대 예산 (원)"],
        ].map(([name, label]) => (
          <div key={name} className="grid gap-2">
            <Label htmlFor={`browse-${name}`}>{label}</Label>
            <Input
              id={`browse-${name}`}
              name={name}
              defaultValue={params.get(name ?? "") ?? ""}
              type={name?.startsWith("budget") ? "number" : "text"}
              min="1"
              step="1"
              maxLength={100}
            />
          </div>
        ))}
        <div className="grid gap-2">
          <Label htmlFor="browse-status">모집 상태</Label>
          <select
            className="h-10 min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            id="browse-status"
            name="status"
            defaultValue={params.get("status") ?? "OPEN"}
          >
            <option value="OPEN">모집 중</option>
            <option value="CLOSED">모집 마감</option>
            <option value="ALL">전체</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="browse-sort">정렬</Label>
          <select
            className="h-10 min-w-0 rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            id="browse-sort"
            name="sort"
            defaultValue={params.get("sort") ?? "LATEST"}
          >
            <option value="LATEST">최신순</option>
            <option value="DEADLINE">마감 임박순</option>
            <option value="BUDGET_LOW">예산 낮은순</option>
            <option value="BUDGET_HIGH">예산 높은순</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">검색 적용</Button>
          <Button asChild variant="outline">
            <Link to="/campaigns">필터 초기화</Link>
          </Button>
        </div>
      </form>
      <p className="text-muted-foreground">
        제품 분야는 입력된 제품·서비스의 부분 검색으로만 모의 구현해요. 분류
        체계와 마감 공고 공개 범위는 API 조율이 필요해요.
      </p>
      {!parsed.success && (
        <p role="alert">
          검색 조건이 올바르지 않아요. 예산 범위·페이지·상태를 확인하거나 필터를
          초기화해 주세요.
        </p>
      )}
      {parsed.success && (
        <>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => query.refetch()}
          >
            목록 다시 확인
          </Button>
          {query.isFetching && (
            <p role="status">모집 목록을 불러오고 있어요.</p>
          )}
          {query.error && <p role="alert">{failure(query.error)}</p>}
          {data && !query.error && (
            <>
              <p role="status">
                검색 결과 {data.total}개 · {data.page} /{" "}
                {Math.max(1, data.totalPages)}페이지
              </p>
              {!data.items.length && (
                <div className="showcase-card grid gap-3">
                  <p>
                    조건에 맞는 모집이 없어요. 필터나 페이지를 변경해 주세요.
                  </p>
                  {data.page > 1 && (
                    <Button onClick={() => pageTo(1)}>첫 페이지로</Button>
                  )}
                </div>
              )}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.items.map((item) => (
                  <article
                    className="showcase-card grid min-w-0 gap-3 break-words"
                    key={item.id}
                  >
                    <p className="type-label-sm text-primary">
                      {recruitmentStatus(item, now) === "OPEN"
                        ? "모집 중"
                        : "모집 마감"}{" "}
                      · {item.days}일 모집
                    </p>
                    <h2 className="type-heading-md">
                      <Link to={`/campaigns/${item.id}?${search}`}>
                        {item.title}
                      </Link>
                    </h2>
                    <p>{item.product}</p>
                    <p>{Number(item.budget).toLocaleString("ko-KR")}원</p>
                    <p>
                      마감:{" "}
                      {item.recruitmentEndAt &&
                        campaignTime(item.recruitmentEndAt)}
                    </p>
                  </article>
                ))}
              </div>
              <nav aria-label="모집 페이지" className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={data.page <= 1 || query.isFetching}
                  onClick={() => pageTo(data.page - 1)}
                >
                  이전 페이지
                </Button>
                <Button
                  variant="outline"
                  disabled={data.page >= data.totalPages || query.isFetching}
                  onClick={() => pageTo(data.page + 1)}
                >
                  다음 페이지
                </Button>
              </nav>
            </>
          )}
        </>
      )}
    </>
  );
}
