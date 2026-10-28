import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, matchPath, useLocation, useNavigate } from "react-router";
import { applicationCreateSchema } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi } from "../../shared/api/kemi";
import { dateTime, requestProgress, won } from "../live/labels";
import { Card, Failure, Field, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import WorkspaceLive from "./WorkspaceLive";

// APPLY-01: 크리에이터 지원서 제출
function ApplyForm({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => kemi.project(projectId, signal),
  });
  const [problem, setProblem] = useState("");
  const apply = useMutation({
    mutationFn: (body: {
      message: string;
      proposedAmount: number;
      expectedDays: number;
    }) => kemi.apply(projectId, body),
    onSuccess: () => navigate("/requests"),
  });
  if (project.isPending) return <Loading />;
  if (project.error) return <Failure error={project.error} />;
  return (
    <>
      <h1 className="type-heading-lg">지원하기</h1>
      <Card title={project.data.title}>
        <p className="text-muted-foreground">
          예산 {won(project.data.budget)} · 마감{" "}
          {dateTime(project.data.recruitmentEndAt)}
        </p>
      </Card>
      <form
        className="showcase-card grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setProblem("");
          const form = new FormData(event.currentTarget);
          const body = {
            message: String(form.get("message") ?? "").trim(),
            proposedAmount: Number(form.get("proposedAmount")),
            expectedDays: Number(form.get("expectedDays")),
          };
          const checked = applicationCreateSchema.safeParse(body);
          if (!checked.success) {
            setProblem(
              checked.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
            );
            return;
          }
          apply.mutate(body);
        }}
      >
        <Field id="apply-message" label="제안 내용">
          <Textarea id="apply-message" name="message" rows={6} required />
        </Field>
        <Field id="apply-amount" label="제안 금액 (원)">
          <Input
            id="apply-amount"
            name="proposedAmount"
            type="number"
            min="1"
            step="1"
            required
          />
        </Field>
        <Field id="apply-days" label="예상 작업 일수">
          <Input
            id="apply-days"
            name="expectedDays"
            type="number"
            min="1"
            step="1"
            required
          />
        </Field>
        {problem && <p role="alert">{problem}</p>}
        {apply.error && (
          <p role="alert">{errorText(apply.error, "지원하지 못했어요.")}</p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={apply.isPending}>
            지원서 제출
          </Button>
          <Button asChild variant="outline">
            <Link to={`/campaigns/${projectId}`}>취소</Link>
          </Button>
        </div>
      </form>
    </>
  );
}

// APPLY-02·03: 의뢰인의 후보 비교. 협의 요청은 선정이 아니다(A안). 여러 후보와 동시에 협의할 수 있다.
function Proposals({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: ({ signal }) => kemi.project(projectId, signal),
  });
  const list = useQuery({
    queryKey: ["project-applications", projectId],
    queryFn: ({ signal }) => kemi.projectApplications(projectId, signal),
  });
  const act = useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: string;
      action: "discuss" | "decline";
    }) => (action === "discuss" ? kemi.discuss(id) : kemi.decline(id)),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: ["project-applications", projectId],
      }),
  });
  const end = useMutation({
    mutationFn: () => kemi.endWithoutSelection(projectId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["project", projectId] });
      client.invalidateQueries({
        queryKey: ["project-applications", projectId],
      });
    },
  });
  return (
    <>
      <h1 className="type-heading-lg">후보 비교</h1>
      {project.data && (
        <p className="text-muted-foreground">
          {project.data.title} · 예산 {won(project.data.budget)}
        </p>
      )}
      <p>
        협의 요청은 선정이 아니에요. 여러 후보와 동시에 대화·조건 협의를 할 수
        있고, 같은 최종 조건서에 양측이 서명하면 그 후보 한 명이 선정돼요.
      </p>
      {list.isPending && <Loading text="지원 목록을 불러오고 있어요." />}
      {list.error && <Failure error={list.error} />}
      {list.data?.items.length === 0 && (
        <Card>
          <p>아직 지원이 없어요.</p>
        </Card>
      )}
      <ul className="grid gap-4">
        {list.data?.items.map((item) => (
          <li key={item.id} className="showcase-card grid gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="type-heading-md">{item.creatorName}</h2>
              <Badge variant="secondary">
                {requestProgress(item.status, item.stage)}
              </Badge>
            </div>
            <p className="whitespace-pre-wrap">{item.message}</p>
            <p className="text-muted-foreground">
              제안 {won(item.proposedAmount)} · {item.expectedDays}일 ·{" "}
              {dateTime(item.createdAt)}
            </p>
            <div className="flex flex-wrap gap-3">
              {item.status === "PENDING" && (
                <>
                  <Button
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({ id: item.id, action: "discuss" })
                    }
                  >
                    협의 요청
                  </Button>
                  <Button
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({ id: item.id, action: "decline" })
                    }
                  >
                    거절
                  </Button>
                </>
              )}
              {item.status === "DISCUSSING" && (
                <>
                  <Button asChild>
                    <Link to={`/requests/${item.id}`}>대화·조건 협의</Link>
                  </Button>
                  <Button
                    variant="outline"
                    disabled={act.isPending}
                    onClick={() =>
                      act.mutate({ id: item.id, action: "decline" })
                    }
                  >
                    협의 종료(거절)
                  </Button>
                </>
              )}
              {item.status === "CONTRACTED" && (
                <Button asChild>
                  <Link to={`/requests/${item.id}`}>계약 보기</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {project.data &&
        !["CONTRACTED", "MATCHED"].includes(project.data.status) && (
          <Button
            variant="outline"
            disabled={end.isPending}
            onClick={() => end.mutate()}
          >
            선정 없이 모집 종료
          </Button>
        )}
      {(act.error ?? end.error) && (
        <p role="alert">{errorText(act.error ?? end.error)}</p>
      )}
    </>
  );
}

// 의뢰 현황: 요청별 대화방(공개 모집 협의·직접 의뢰)과 크리에이터의 지원 내역
function RequestList() {
  const { role } = useSession();
  const rooms = useQuery({
    queryKey: ["chat-rooms"],
    queryFn: ({ signal }) => kemi.chatRooms(signal),
  });
  const mine = useQuery({
    queryKey: ["my-applications"],
    enabled: role === "creator",
    queryFn: ({ signal }) => kemi.myApplications(signal),
  });
  const directs = useQuery({
    queryKey: ["direct-requests"],
    queryFn: ({ signal }) => kemi.directRequests(signal),
  });
  return (
    <>
      <h1 className="type-heading-lg">의뢰 현황</h1>
      <Card title="진행 중인 대화">
        {rooms.isPending && <Loading />}
        {rooms.error && <Failure error={rooms.error} />}
        {rooms.data?.items.length === 0 && <p>아직 협의 중인 의뢰가 없어요.</p>}
        <ul className="grid gap-3">
          {rooms.data?.items.map((room) => (
            <li
              key={room.workRequestId}
              className="flex flex-wrap items-center gap-3"
            >
              <Link
                to={`/requests/${room.workRequestId}`}
                className="underline-offset-4 hover:underline"
              >
                {room.projectTitle ?? "직접 의뢰"} · {room.counterpartName}
              </Link>
              {room.unreadCount > 0 && (
                <Badge>새 메시지 {room.unreadCount}</Badge>
              )}
              {room.readOnly && <Badge variant="outline">종료됨</Badge>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="직접 의뢰">
        {directs.isPending && <Loading />}
        {directs.error && <Failure error={directs.error} />}
        {directs.data?.items.length === 0 && <p>직접 의뢰가 없어요.</p>}
        <ul className="grid gap-3">
          {directs.data?.items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3">
              <Link
                to={`/requests/${item.id}`}
                className="underline-offset-4 hover:underline"
              >
                {item.package.title} ·{" "}
                {role === "creator" ? item.clientName : item.creatorName}
              </Link>
              <Badge variant="secondary">
                {requestProgress(item.status, item.stage)}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
      {role === "creator" && (
        <Card title="내 지원">
          {mine.isPending && <Loading />}
          {mine.error && <Failure error={mine.error} />}
          {mine.data?.items.length === 0 && <p>지원한 모집이 없어요.</p>}
          <ul className="grid gap-3">
            {mine.data?.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3">
                <Link
                  to={`/requests/${item.id}`}
                  className="underline-offset-4 hover:underline"
                >
                  {item.project.title}
                </Link>
                <Badge variant="secondary">
                  {requestProgress(item.status, item.stage)}
                </Badge>
                <span className="text-muted-foreground">
                  제안 {won(item.proposedAmount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// 제안·협의 화면 묶음(실제 API). 경로에 따라 지원·후보 비교·현황·의뢰 상세를 보여준다.
export default function RequestsLive() {
  const { pathname } = useLocation();
  const apply = matchPath("/campaigns/:campaignId/apply", pathname);
  if (apply) return <ApplyForm projectId={apply.params.campaignId ?? ""} />;
  const proposals = matchPath("/campaigns/:campaignId/proposals", pathname);
  if (proposals)
    return <Proposals projectId={proposals.params.campaignId ?? ""} />;
  const detail =
    matchPath("/requests/:requestId", pathname) ??
    matchPath("/workspace/:requestId", pathname);
  if (detail)
    return (
      <WorkspaceLive
        key={detail.params.requestId}
        requestId={detail.params.requestId ?? ""}
      />
    );
  return <RequestList />;
}
