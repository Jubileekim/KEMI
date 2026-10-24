import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNow } from "./discovery-ui";
import { recruitmentStatus } from "./discovery-model";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import CampaignFormMock from "./CampaignFormMock";
import { campaignRequest, campaignError } from "./campaign-api";
import {
  type CampaignState,
  type CampaignCommand,
  publicCampaigns,
  campaignTime,
} from "./campaign-model";

function CampaignContent({
  state,
  fetching,
  readError,
  reload,
  queryKey,
}: {
  state: CampaignState;
  fetching: boolean;
  readError: unknown;
  reload: () => void;
  queryKey: readonly unknown[];
}) {
  const now = useNow();
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [notice, setNotice] = useState("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const item = state.items.find((candidate) => candidate.id === campaignId);
  const mutation = useMutation({
    mutationFn: async (command: CampaignCommand) => {
      const epoch = session.epoch();
      const result = await campaignRequest(command, state.revision);
      if (epoch !== session.epoch()) return;
      cache.setQueryData(queryKey, result);
      if (!mounted.current) return;
      setNotice(
        command.type === "save"
          ? "비공개 초안을 모의 저장했어요."
          : "모의 공개 응답을 확인했어요.",
      );
      if (!campaignId)
        navigate(`/campaigns/${command.id}/edit`, { replace: true });
    },
  });
  const busy = mutation.isPending || fetching;
  const save = async (command: CampaignCommand) => {
    if (busy) return false;
    setNotice("");
    try {
      await mutation.mutateAsync(command);
      return true;
    } catch {
      return false;
    }
  };
  return (
    <section className="mx-auto grid w-full max-w-4xl gap-6">
      <div className="grid gap-2">
        <p className="type-label-sm text-primary">CAMPAIGN</p>
        <h1 className="type-heading-lg">캠페인 작성·임시 저장·공개</h1>
      </div>
      <p role="status" className="rounded-xl bg-muted p-4">
        개발용 Mock · 실제 API·DB·공개 목록에는 반영되지 않아요. 이 탭에서만
        보관하며 전체 새로고침하면 초기화돼요.
      </p>
      <details className="rounded-xl border p-4">
        <summary>2-A 개발 전용 시나리오</summary>
        <div className="mt-4 grid gap-3">
          <Label htmlFor="campaign-response">Mock 캠페인 응답</Label>
          <select
            id="campaign-response"
            defaultValue="success"
            disabled={busy}
            onChange={(event) => {
              fetch("/__mock__/campaigns/scenario", {
                method: "POST",
                body: event.target.value,
              });
            }}
          >
            {[
              "success",
              "delay",
              "401",
              "403",
              "409",
              "500",
              "network",
              "malformed",
              "lost-response",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
      </details>
      <Button variant="outline" disabled={busy} onClick={reload}>
        최신 값 확인
      </Button>
      {!!readError && (
        <p role="alert">
          최신 값을 확인하지 못했어요. {campaignError(readError)}
        </p>
      )}
      {mutation.error && <p role="alert">{campaignError(mutation.error)}</p>}
      {notice && <p role="status">{notice}</p>}
      {campaignId && !item ? (
        <p role="alert">
          본인 초안을 찾을 수 없어요. 다른 계정의 초안은 볼 수 없으며 새로고침한
          Mock 데이터는 초기화돼요.
        </p>
      ) : (
        <CampaignFormMock
          key={campaignId ?? "new"}
          item={item}
          busy={busy}
          onSave={save}
        />
      )}
      <section aria-label="내 모의 캠페인" className="showcase-card grid gap-4">
        <h2 className="type-heading-sm">내 모의 캠페인</h2>
        <Link to="/campaigns">공개 모집 둘러보기</Link>
        <Link to="/campaigns/new">새 캠페인 작성</Link>
        {!state.items.length && <p>저장한 캠페인이 없어요.</p>}
        {state.items.map((candidate) => (
          <article
            key={candidate.id}
            aria-label={`캠페인 ${candidate.title || "제목 없는 초안"}`}
            className="grid gap-2 rounded-xl border p-4 break-words"
          >
            <h3>
              {candidate.title || "제목 없는 초안"} ·{" "}
              {
                {
                  DRAFT: "비공개 초안",
                  CLOSED: "모집 마감 (Mock)",
                  OPEN: "모집 중 (Mock)",
                }[recruitmentStatus(candidate, now)]
              }
            </h3>
            {candidate.recruitmentEndAt && (
              <p>마감: {campaignTime(candidate.recruitmentEndAt)}</p>
            )}
            <Link to={`/campaigns/${candidate.id}/edit`}>
              {candidate.status === "DRAFT"
                ? "초안 이어 쓰기"
                : "공개 결과 확인"}
            </Link>
          </article>
        ))}
      </section>
      <section aria-label="모의 공개 확인" className="showcase-card grid gap-3">
        <h2 className="type-heading-sm">모의 공개 확인</h2>
        <p>
          초안 노출 제외를 확인하는 본인 테스트용 영역이에요. 공개 모집 화면에서
          모의 목록·상세를 확인할 수 있어요.
        </p>
        {!publicCampaigns(state).length && <p>모의 공개 캠페인 없음</p>}
        {publicCampaigns(state).map((candidate) => (
          <p className="break-words" key={candidate.id}>
            {candidate.title} · 모집 {candidate.days}일
          </p>
        ))}
      </section>
    </section>
  );
}
export default function CampaignMock() {
  const { user } = useSession();
  const queryKey = ["mock-campaigns", user?.id, session.epoch()] as const;
  const query = useQuery({
    queryKey,
    enabled: user?.role === "CLIENT",
    queryFn: ({ signal }) => campaignRequest(undefined, undefined, signal),
    refetchOnMount: "always",
    refetchOnReconnect: false,
  });
  if (!user || user.role !== "CLIENT")
    return (
      <p role="alert">
        의뢰인 계정으로 로그인해 주세요. 역할 도구만으로 저장할 수 없어요.
      </p>
    );
  if (query.isPending) return <p role="status">캠페인을 불러오고 있어요.</p>;
  if (!query.data)
    return (
      <section role="alert">
        <p>{campaignError(query.error)}</p>
        <Button onClick={() => query.refetch()}>캠페인 다시 불러오기</Button>
      </section>
    );
  return (
    <CampaignContent
      key={`${user.id}-${session.epoch()}`}
      state={query.data}
      queryKey={queryKey}
      fetching={query.isFetching}
      readError={query.error}
      reload={() => query.refetch()}
    />
  );
}
