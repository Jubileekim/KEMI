import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import { ApiError } from "../shared/api/client";
import { loadProposals, updateProposal } from "./proposal-api";
import { type ProposalCommand } from "./proposal-model";
import ProposalCard from "./ProposalCard";
import ProposalEditorMock from "./ProposalEditorMock";
import ChatPanelMock from "./ChatPanelMock";
import ProposalConfirm from "./ProposalConfirm";
import TermsMock from "./TermsMock";

function failure(error: unknown) {
  if (!error) return "";
  if (error instanceof ApiError && error.status === 404)
    return "본인 공고·의뢰·협의방을 찾을 수 없어요.";
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return "로그인·활성 역할·당사자 권한·공개 서비스/작업물을 확인해 주세요.";
  if (error instanceof ApiError && error.status === 409)
    return "마감·중복 제출·변경된 상태를 확인해 주세요. 종료 후 재지원은 D06 결정 대기예요.";
  return "응답을 확인하지 못했어요. 최신 상태를 확인한 뒤 수동 재시도해 주세요. 입력은 유지해요.";
}
function Scenario() {
  const [selected, setSelected] = useState("success");
  const [busy, setBusy] = useState(false);
  return (
    <details className="rounded-xl border p-4">
      <summary>2-D 개발 전용 시나리오</summary>
      <Label htmlFor="proposal-scenario">Mock 제안·채팅 응답</Label>
      <select
        id="proposal-scenario"
        value={selected}
        disabled={busy}
        onChange={async (event) => {
          const { value } = event.target;
          setBusy(true);
          try {
            const response = await fetch("/__mock__/proposals/scenario", {
              method: "POST",
              body: value,
            });
            if (response.ok) setSelected(value);
          } finally {
            setBusy(false);
          }
        }}
      >
        {[
          "success",
          "delay",
          "401",
          "403",
          "404",
          "409",
          "500",
          "network",
          "malformed",
          "lost-response",
        ].map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </details>
  );
}
function Content() {
  const { campaignId, requestId } = useParams();
  const { pathname } = useLocation();
  const { user } = useSession();
  const cache = useQueryClient();
  const [notice, setNotice] = useState("");
  const applying = pathname.endsWith("/apply");
  const workspace = pathname.startsWith("/workspace/");
  const params = new URLSearchParams();
  if (campaignId) params.set("campaignId", campaignId);
  if (workspace && requestId) params.set("roomId", requestId);
  const key = ["mock-proposals", session.epoch(), user?.id, params.toString()];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => loadProposals(`?${params}`, signal),
    refetchOnReconnect: false,
  });
  const mutation = useMutation({ mutationFn: updateProposal });
  const busy = query.isFetching || mutation.isPending;
  const error = failure(mutation.error);
  const submit = (command: ProposalCommand, done?: () => void) => {
    if (busy) return;
    const epoch = session.epoch();
    mutation.mutate(command, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        await Promise.all([
          cache.invalidateQueries({ queryKey: ["mock-proposals"] }),
          cache.invalidateQueries({ queryKey: ["mock-discovery"] }),
          cache.invalidateQueries({ queryKey: ["mock-campaigns"] }),
        ]);
        if (epoch !== session.epoch()) return;
        setNotice(
          "모의 처리 응답을 확인했어요. 실제 저장·알림은 미연결이에요.",
        );
        done?.();
      },
    });
  };
  const { data } = query;
  const items =
    data?.items.filter((item) => !requestId || item.id === requestId) ?? [];
  let title = "의뢰 현황";
  if (requestId) title = "의뢰 상세";
  if (campaignId) title = "제안 후보 비교";
  if (workspace) title = "협의 작업 공간";
  return (
    <>
      <div className="flex flex-wrap gap-4">
        <Link to="/requests">내 제안·협의 목록</Link>
        <Link to="/campaigns">공개 모집</Link>
        {campaignId && <Link to={`/campaigns/${campaignId}`}>공고 상세</Link>}
      </div>
      <Button variant="outline" disabled={busy} onClick={() => query.refetch()}>
        최신 제안·대화 확인
      </Button>
      {query.isFetching && <p role="status">제안·대화를 불러오고 있어요.</p>}
      {query.error && <p role="alert">{failure(query.error)}</p>}
      {data && !query.error && user && (
        <>
          {applying && campaignId ? (
            <ProposalEditorMock
              campaignId={campaignId}
              data={data}
              busy={busy}
              error={error}
              submit={submit}
            />
          ) : (
            <>
              <h1 className="type-heading-lg">{title}</h1>
              <p>
                후보별 견적과 대화는 분리돼요. 협의 요청은 선정이 아니며 다른
                후보는 유지돼요.
              </p>
              {campaignId && data.campaign && (
                <>
                  <h2 className="type-heading-md">{data.campaign.title}</h2>
                  {data.campaign.ended ? (
                    <p>무선정 종료 · 신규 제안 종료</p>
                  ) : (
                    <ProposalConfirm
                      label="무선정 종료"
                      description="확정 계약이 없을 때 남은 제안을 종료하고 기존 방을 읽기 전용으로 바꿔요. 모집 마감과 별도 동작이에요."
                      reasonRequired
                      busy={busy}
                      error={error}
                      onConfirm={(reason, done) =>
                        submit({ type: "end", campaignId, reason }, done)
                      }
                    />
                  )}
                </>
              )}
              {!items.length && (
                <p role="status">표시할 본인 제안·의뢰가 없어요.</p>
              )}
              <div className="grid min-w-0 gap-6 lg:grid-cols-2">
                {items.map((item) => (
                  <ProposalCard
                    key={item.id}
                    item={item}
                    user={user}
                    busy={busy}
                    error={error}
                    submit={submit}
                  />
                ))}
              </div>
              {workspace && items[0] && (
                <ChatPanelMock
                  key={items[0].id}
                  item={items[0]}
                  messages={data.messages}
                  user={user}
                  busy={busy}
                  error={error}
                  submit={submit}
                />
              )}
              {workspace && items[0] && (
                <TermsMock
                  key={`${items[0].id}-${session.epoch()}`}
                  requestId={items[0].id}
                  item={items[0]}
                  active={
                    items[0].status === "DISCUSSING" && !items[0].contracted
                  }
                />
              )}
            </>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </>
  );
}
export default function ProposalMock() {
  const { user } = useSession();
  const { pathname } = useLocation();
  return (
    <section className="grid min-w-0 gap-6">
      <p className="rounded-xl bg-muted p-4">
        개발용 Mock · 이 탭의 메모리만 사용하며 새로고침하면 제안·대화가
        초기화돼요. 실제 API·DB·알림·첨부 저장은 미연결이에요. 갱신과 읽음은
        수동 예시이며 D06/D07/D19는 미결정이에요.
      </p>
      <Scenario />
      <Content key={`${user?.id}-${session.epoch()}-${pathname}`} />
    </section>
  );
}
