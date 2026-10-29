import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { VIDEO_PURPOSES } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import { kemi, query } from "../../shared/api/kemi";
import {
  dateOnly,
  dateTime,
  label,
  projectStatusLabels,
  purposeLabels,
  styleLabels,
  won,
} from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";

function List() {
  const { role } = useSession();
  const [params, setParams] = useSearchParams();
  // 검색어·필터·페이지가 하나라도 있으면 "조건에 맞는 모집 없음", 아니면 "아직 모집 없음"
  const filtered = [
    "q",
    "purpose",
    "budgetMin",
    "budgetMax",
    "sort",
    "page",
  ].some((key) => params.has(key));
  const search = query({
    q: params.get("q") ?? undefined,
    purpose: params.get("purpose") ?? undefined,
    budgetMin: params.get("budgetMin") ?? undefined,
    budgetMax: params.get("budgetMax") ?? undefined,
    sort: params.get("sort") ?? undefined,
    page: params.get("page") ?? undefined,
  });
  const list = useQuery({
    queryKey: ["projects", search],
    queryFn: ({ signal }) => kemi.projects(search, signal),
  });
  const pageTo = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    setParams(next);
  };
  return (
    <>
      <h1 className="type-heading-lg">공개 모집</h1>
      <form
        key={params.toString()}
        className="showcase-card grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          new FormData(event.currentTarget).forEach((value, key) => {
            if (typeof value === "string" && value.trim())
              next.set(key, value.trim());
          });
          setParams(next);
        }}
      >
        <Field id="browse-q" label="검색어">
          <Input
            id="browse-q"
            name="q"
            maxLength={100}
            defaultValue={params.get("q") ?? ""}
          />
        </Field>
        <Field id="browse-purpose" label="영상 목적">
          <select
            id="browse-purpose"
            name="purpose"
            className={selectClass}
            defaultValue={params.get("purpose") ?? ""}
          >
            <option value="">전체</option>
            {VIDEO_PURPOSES.map((value) => (
              <option key={value} value={value}>
                {label(purposeLabels, value)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="browse-sort" label="정렬">
          <select
            id="browse-sort"
            name="sort"
            className={selectClass}
            defaultValue={params.get("sort") ?? "LATEST"}
          >
            <option value="LATEST">최신순</option>
            <option value="DEADLINE">마감 임박순</option>
            <option value="BUDGET_LOW">예산 낮은순</option>
            <option value="BUDGET_HIGH">예산 높은순</option>
          </select>
        </Field>
        <Field id="browse-min" label="최소 예산 (원)">
          <Input
            id="browse-min"
            name="budgetMin"
            type="number"
            min="1"
            step="1"
            defaultValue={params.get("budgetMin") ?? ""}
          />
        </Field>
        <Field id="browse-max" label="최대 예산 (원)">
          <Input
            id="browse-max"
            name="budgetMax"
            type="number"
            min="1"
            step="1"
            defaultValue={params.get("budgetMax") ?? ""}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="submit">검색 적용</Button>
          <Button asChild variant="outline">
            <Link to="/campaigns">필터 초기화</Link>
          </Button>
        </div>
      </form>
      {list.isPending && <Loading text="모집 목록을 불러오고 있어요." />}
      {list.error && <Failure error={list.error} />}
      {list.data && (
        <>
          <p role="status">
            모집 중 {list.data.pagination.total}개 · {list.data.pagination.page}{" "}
            / {Math.max(1, list.data.pagination.totalPages)}페이지
          </p>
          {list.data.items.length === 0 && (
            <Card>
              {filtered ? (
                <p>조건에 맞는 모집이 없어요. 필터를 바꿔 주세요.</p>
              ) : (
                <p>아직 모집 중인 공고가 없어요.</p>
              )}
              {!filtered && role === "client" && (
                <Button asChild className="justify-self-start">
                  <Link to="/campaigns/new">첫 모집 공고 올리기</Link>
                </Button>
              )}
              {!filtered && role !== "creator" && (
                <Button
                  asChild
                  variant="outline"
                  className="justify-self-start"
                >
                  <Link to="/works">작품 피드에서 크리에이터 찾기</Link>
                </Button>
              )}
            </Card>
          )}
          <ul className="grid gap-4">
            {list.data.items.map((item) => (
              <li key={item.id} className="showcase-card grid gap-2">
                <Link
                  to={`/campaigns/${item.id}`}
                  className="type-heading-md underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="text-muted-foreground">
                  {label(purposeLabels, item.purpose)} · 예산 {won(item.budget)}{" "}
                  · 마감 {dateTime(item.recruitmentEndAt)} · 의뢰인{" "}
                  {item.clientName}
                </p>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <Button
              variant="outline"
              disabled={list.data.pagination.page <= 1}
              onClick={() => pageTo(list.data.pagination.page - 1)}
            >
              이전 페이지
            </Button>
            <Button
              variant="outline"
              disabled={
                list.data.pagination.page >= list.data.pagination.totalPages
              }
              onClick={() => pageTo(list.data.pagination.page + 1)}
            >
              다음 페이지
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function Detail({ id }: { id: string }) {
  const { role, user, status } = useSession();
  const client = useQueryClient();
  // 작성자·지원자는 마감·선정 뒤에도 상세를 본다(서버가 로그인 정보로 판단).
  // 새로고침 직후 로그인 확인이 끝나기 전에 비회원으로 조회하면 404가 남으므로, 확인이 끝난 뒤 사용자별로 조회한다.
  const projectKey = ["project", id, user?.id ?? "guest"];
  const project = useQuery({
    queryKey: projectKey,
    enabled: status !== "checking",
    queryFn: ({ signal }) => kemi.project(id, signal),
  });
  const close = useMutation({
    mutationFn: () => kemi.closeProject(id),
    onSuccess: (data) => client.setQueryData(projectKey, data),
  });
  const bookmark = useMutation({
    mutationFn: (on: boolean) => (on ? kemi.bookmark(id) : kemi.unbookmark(id)),
  });
  if (project.isPending) return <Loading text="모집 상세를 불러오고 있어요." />;
  if (project.error) return <Failure error={project.error} />;
  const item = project.data;
  const owner = user?.id === item.clientId;
  const applyPath = `/campaigns/${id}/apply`;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-heading-lg">{item.title}</h1>
        <Badge variant="secondary">
          {label(projectStatusLabels, item.status)}
        </Badge>
      </div>
      <Card title="모집 내용">
        <p className="whitespace-pre-wrap">{item.description}</p>
        <Facts
          items={[
            ["영상 목적", label(purposeLabels, item.purpose)],
            [
              "스타일",
              item.styles.map((s) => label(styleLabels, s)).join(", "),
            ],
            ["예산", won(item.budget)],
            ["모집 마감", dateTime(item.recruitmentEndAt)],
            ["희망 납품일", dateOnly(item.deliveryDueDate)],
            ["의뢰인", item.clientName],
          ]}
        />
      </Card>
      <div className="flex flex-wrap gap-3">
        {role === "creator" && item.status === "OPEN" && (
          <Button asChild>
            <Link to={applyPath}>지원하기</Link>
          </Button>
        )}
        {/* 비회원: 크리에이터로 가입(또는 로그인)하고 프로필을 저장하면 이 공고의 지원 화면으로 돌아온다. */}
        {role === "guest" && item.status === "OPEN" && (
          <div className="grid gap-1">
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link
                  to={`/signup?role=creator&returnTo=${encodeURIComponent(applyPath)}`}
                >
                  크리에이터로 가입하고 지원하기
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  to={`/login?role=creator&returnTo=${encodeURIComponent(applyPath)}`}
                >
                  로그인하고 지원하기
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              지원은 크리에이터 계정으로 할 수 있어요.
            </p>
          </div>
        )}
        {role === "client" && !owner && item.status === "OPEN" && (
          <p className="text-sm text-muted-foreground">
            지원은 크리에이터 계정으로 할 수 있어요.
          </p>
        )}
        {role === "creator" && (
          <>
            <Button
              variant="outline"
              disabled={bookmark.isPending}
              onClick={() => bookmark.mutate(true)}
            >
              관심 공고 저장
            </Button>
            <Button
              variant="ghost"
              disabled={bookmark.isPending}
              onClick={() => bookmark.mutate(false)}
            >
              저장 해제
            </Button>
          </>
        )}
        {owner && (
          <>
            <Button asChild>
              <Link to={`/campaigns/${id}/proposals`}>지원자 보기</Link>
            </Button>
            {item.status === "OPEN" && (
              <>
                <Button asChild variant="outline">
                  <Link to={`/campaigns/${id}/edit`}>수정</Link>
                </Button>
                <Button
                  variant="outline"
                  disabled={close.isPending}
                  onClick={() => close.mutate()}
                >
                  모집 마감
                </Button>
              </>
            )}
          </>
        )}
        {!owner && (role === "client" || role === "creator") && (
          <Button asChild variant="ghost">
            <Link to={`/reports/new?targetType=PROJECT&targetId=${id}`}>
              신고
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link to="/campaigns">목록으로</Link>
        </Button>
      </div>
      {bookmark.isSuccess && <p role="status">관심 공고를 반영했어요.</p>}
      {(close.error ?? bookmark.error) && (
        <p role="alert">{errorText(close.error ?? bookmark.error)}</p>
      )}
    </>
  );
}

// CAMP-03·04: 공개 모집 목록·상세 (실제 API)
export default function CampaignBrowseLive() {
  const { campaignId } = useParams();
  return campaignId ? <Detail id={campaignId} /> : <List />;
}
