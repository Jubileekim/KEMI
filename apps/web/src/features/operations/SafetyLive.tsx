import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import type { ReportTargetType, SafetyEvent, SafetyReport } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi, newCommandId } from "../../shared/api/kemi";
import { dateTime } from "../live/labels";
import { Card, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";

const actionLabels: Record<string, string> = {
  RECEIVED: "접수",
  REVIEW: "검토 시작",
  WARN: "경고",
  LIMIT: "이용 제한",
  RELEASE: "제한 해제",
  APPEAL: "이의 제기",
};
const statusLabels: Record<string, string> = {
  RECEIVED: "접수됨",
  REVIEWING: "검토 중",
  RESOLVED: "처리 완료",
};

// 응답이 유실된 뒤 같은 내용을 재시도해도 운영 조치·이의를 중복 기록하지 않는다.
function useCommandId() {
  const pending = useRef<{ key: string; id: string } | null>(null);
  return {
    forValue(value: unknown) {
      const key = JSON.stringify(value);
      if (pending.current?.key !== key)
        pending.current = { key, id: newCommandId() };
      return pending.current.id;
    },
    clear() {
      pending.current = null;
    },
  };
}

function History({ events }: { events: SafetyEvent[] }) {
  return (
    <ol className="grid gap-1 text-sm">
      {events.map((e) => (
        <li key={e.id}>
          {dateTime(e.createdAt)} · {actionLabels[e.action] ?? e.action} ·{" "}
          {e.note}
        </li>
      ))}
    </ol>
  );
}

// 회원: 신고하기·내 신고·나에 대한 제한 안내·이의 제기 (/reports/new)
function MemberSafety() {
  const [params] = useSearchParams();
  const client = useQueryClient();
  const view = useQuery({
    queryKey: ["my-safety"],
    queryFn: ({ signal }) => kemi.mySafety(signal),
  });
  const [commandId, setCommandId] = useState(newCommandId);
  const [targetType, setTargetType] = useState<ReportTargetType>(
    params.get("targetType") === "WORK_REQUEST" ? "WORK_REQUEST" : "PROJECT",
  );
  const refresh = () => client.invalidateQueries({ queryKey: ["my-safety"] });
  const report = useMutation({
    mutationFn: (form: FormData) =>
      kemi.report({
        commandId,
        targetType,
        targetId: String(form.get("targetId") ?? "").trim(),
        reason: String(form.get("reason") ?? "").trim(),
        evidence: String(form.get("evidence") ?? "").trim(),
      }),
    onSuccess: () => {
      setCommandId(newCommandId());
      refresh();
    },
  });
  const appealCommand = useCommandId();
  const appeal = useMutation({
    mutationFn: ({ reportId, note }: { reportId: string; note: string }) =>
      kemi.appeal(reportId, {
        commandId: appealCommand.forValue({ reportId, note }),
        note,
      }),
    onSuccess: () => {
      appealCommand.clear();
      refresh();
    },
  });
  return (
    <>
      <h1 className="type-heading-lg">신고·이용 안내</h1>
      {view.data?.limited && (
        <Card title="이용 제한 중">
          <p>
            새 공고·지원·직접 의뢰가 제한돼요. 진행 중인 대화·납품·결제는 계속할
            수 있어요.
          </p>
        </Card>
      )}
      <Card title="신고하기">
        <p className="text-muted-foreground">
          신고만으로 제재되지 않아요. 운영자가 검토한 뒤 처리해요.
        </p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const el = event.currentTarget;
            report.mutate(new FormData(el), { onSuccess: () => el.reset() });
          }}
        >
          <Field id="report-type" label="신고 대상">
            <select
              id="report-type"
              className={selectClass}
              value={targetType}
              onChange={(event) =>
                setTargetType(
                  event.target.value === "WORK_REQUEST"
                    ? "WORK_REQUEST"
                    : "PROJECT",
                )
              }
            >
              <option value="PROJECT">공개 모집</option>
              <option value="WORK_REQUEST">내가 참여한 의뢰</option>
            </select>
          </Field>
          <Field
            id="report-target"
            label="대상 번호"
            hint="모집·의뢰 화면의 신고 버튼으로 오면 자동으로 채워져요."
          >
            <Input
              id="report-target"
              name="targetId"
              required
              pattern="[1-9][0-9]*"
              defaultValue={params.get("targetId") ?? ""}
            />
          </Field>
          <Field id="report-reason" label="신고 사유">
            <Textarea
              id="report-reason"
              name="reason"
              rows={3}
              required
              maxLength={2000}
            />
          </Field>
          <Field id="report-evidence" label="근거 (선택)">
            <Textarea
              id="report-evidence"
              name="evidence"
              rows={2}
              maxLength={4000}
            />
          </Field>
          {report.isSuccess && <p role="status">신고를 접수했어요.</p>}
          {report.error && (
            <p role="alert">
              {errorText(report.error, "신고를 접수하지 못했어요.")}
            </p>
          )}
          <Button
            type="submit"
            disabled={report.isPending}
            className="justify-self-start"
          >
            신고 접수
          </Button>
        </form>
      </Card>
      {view.isPending && <Loading />}
      {view.error && <Failure error={view.error} />}
      {view.data && view.data.notices.length > 0 && (
        <Card title="나에 대한 운영 안내">
          <ul className="grid gap-3">
            {view.data.notices.map((n) => (
              <li
                key={n.reportId}
                className="grid gap-2 rounded-xl border border-input p-3"
              >
                {n.limited && <Badge>이용 제한 중</Badge>}
                <History events={n.history} />
                {n.limited && (
                  <form
                    className="grid gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const note = String(
                        new FormData(event.currentTarget).get("note") ?? "",
                      ).trim();
                      if (note) appeal.mutate({ reportId: n.reportId, note });
                    }}
                  >
                    <Textarea
                      aria-label="이의 내용"
                      name="note"
                      rows={2}
                      required
                      maxLength={2000}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={appeal.isPending}
                      className="justify-self-start"
                    >
                      이의 제기
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {appeal.error && <p role="alert">{errorText(appeal.error)}</p>}
        </Card>
      )}
      {view.data && view.data.reports.length > 0 && (
        <Card title="내가 낸 신고">
          <ul className="grid gap-3">
            {view.data.reports.map((r) => (
              <li key={r.id} className="grid gap-1">
                <span className="type-label-md">
                  {r.targetType === "PROJECT" ? "공개 모집" : "의뢰"}{" "}
                  {r.targetId} · {statusLabels[r.status]}
                </span>
                <History events={r.history} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function ReportCard({ report }: { report: SafetyReport }) {
  const client = useQueryClient();
  const command = useCommandId();
  const act = useMutation({
    mutationFn: ({
      action,
      note,
    }: {
      action: "REVIEW" | "WARN" | "LIMIT" | "RELEASE";
      note: string;
    }) =>
      kemi.actOnReport(report.id, {
        commandId: command.forValue({ action, note }),
        action,
        note,
      }),
    onSuccess: () => {
      command.clear();
      return client.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });
  const [note, setNote] = useState("");
  const actions: ["REVIEW" | "WARN" | "LIMIT" | "RELEASE", string][] = [
    ["REVIEW", "검토 시작"],
    ["WARN", "경고"],
    ["LIMIT", "이용 제한"],
    ["RELEASE", "제한 해제"],
  ];
  return (
    <li className="showcase-card grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-title">
          신고 {report.id} ·{" "}
          {report.targetType === "PROJECT" ? "공개 모집" : "의뢰"}{" "}
          {report.targetId}
        </span>
        <Badge variant="secondary">{statusLabels[report.status]}</Badge>
        {report.limited && <Badge>제한 중</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        신고자 {report.reporterId} → 대상 {report.subjectId}
      </p>
      <p className="whitespace-pre-wrap">{report.reason}</p>
      {report.evidence && <p className="text-sm">근거: {report.evidence}</p>}
      <History events={report.history} />
      <Textarea
        aria-label="처리 근거"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {actions
          .filter(([a]) => a !== "RELEASE" || report.limited)
          .map(([a, text]) => (
            <Button
              key={a}
              size="sm"
              variant={a === "LIMIT" ? "default" : "outline"}
              disabled={act.isPending || !note.trim()}
              onClick={() =>
                act.mutate(
                  { action: a, note: note.trim() },
                  { onSuccess: () => setNote("") },
                )
              }
            >
              {text}
            </Button>
          ))}
      </div>
      {act.error && <p role="alert">{errorText(act.error)}</p>}
    </li>
  );
}

// 운영자: 신고 검토·조치, 행동 집계 (/ops/reports)
function OpsReports() {
  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: ({ signal }) => kemi.adminReports(signal),
  });
  const summary = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: ({ signal }) => kemi.analyticsSummary(signal),
  });
  return (
    <>
      <h1 className="type-heading-lg">신고 검토</h1>
      <p className="text-muted-foreground">
        조치 근거는 운영 기록에 남고, 대상자에게 안내돼요. 신고만으로 자동
        제재하지 않아요.
      </p>
      {reports.isPending && <Loading />}
      {reports.error && <Failure error={reports.error} />}
      {reports.data?.items.length === 0 && (
        <Card>
          <p>신고가 없어요.</p>
        </Card>
      )}
      <ul className="grid gap-4">
        {reports.data?.items.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </ul>
      {summary.data && (
        <Card title={`행동 집계 (최근 ${summary.data.days}일, 시연 계정 제외)`}>
          <ul className="grid gap-1 text-sm">
            {summary.data.counts.map((c) => (
              <li key={c.name}>
                {c.name} · {c.total}건 · 사용자 {c.users}명
              </li>
            ))}
          </ul>
        </Card>
      )}
      {summary.error && <Failure error={summary.error} />}
    </>
  );
}

// /reports/new(회원), /ops/reports(운영자)
export default function SafetyLive() {
  const { role } = useSession();
  return role === "ops" ? <OpsReports /> : <MemberSafety />;
}

// 제한 중인 회원에게 화면 위쪽에 안내를 보여준다.
export function RestrictionNotice() {
  const { role } = useSession();
  const member = role === "client" || role === "creator";
  const view = useQuery({
    queryKey: ["my-safety"],
    enabled: member,
    queryFn: ({ signal }) => kemi.mySafety(signal),
    staleTime: 60_000,
  });
  if (!member || !view.data?.limited) return null;
  return (
    <p role="status" className="showcase-card">
      이용 제한 중이에요. 새 공고·지원·직접 의뢰는 할 수 없고, 진행 중인 거래는
      계속할 수 있어요.{" "}
      <a href="/reports/new" className="underline">
        안내 보기
      </a>
    </p>
  );
}
