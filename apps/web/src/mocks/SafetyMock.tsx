import { Link, useLocation, useSearchParams } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import loadSafety from "./safety-api";
import {
  reportInputSchema,
  type safetyCommandSchema,
  type SafetyReport,
} from "./safety-model";

type Command = z.infer<typeof safetyCommandSchema>;
const noteFormSchema = z.strictObject({
  note: z.string().trim().min(1).max(2000),
});
const operationFormSchema = noteFormSchema.extend({
  action: z.enum(["REVIEW", "WARN", "LIMIT", "RELEASE"]),
});
function ReportForm({
  busy,
  submit,
}: {
  busy: boolean;
  submit: (cmd: Command) => void;
}) {
  const [params] = useSearchParams();
  const form = useForm<z.infer<typeof reportInputSchema>>({
    resolver: zodResolver(reportInputSchema),
    defaultValues: {
      type: "report",
      id: crypto.randomUUID(),
      targetType: params.get("type") === "request" ? "request" : "campaign",
      targetId: params.get("target") ?? "",
      reason: "",
      evidence: "",
    },
  });
  const errors = Object.values(form.formState.errors);
  return (
    <form
      className="showcase-card grid gap-4"
      onSubmit={form.handleSubmit(submit)}
    >
      <h2 className="type-heading-sm">신고 접수</h2>
      <p>
        공개 캠페인 또는 본인 의뢰의 상대방을 신고할 수 있어요. 신고만으로 자동
        제재하지 않아요. 증빙은 텍스트 기록이며 첨부 저장은 미연결이에요.
      </p>
      <Label htmlFor="report-type">대상 종류</Label>
      <select id="report-type" {...form.register("targetType")}>
        <option value="campaign">공개 캠페인</option>
        <option value="request">본인 의뢰 상대방</option>
      </select>
      <Label htmlFor="report-target">대상 식별 (필수)</Label>
      <Input
        id="report-target"
        {...form.register("targetId")}
        aria-invalid={Boolean(form.formState.errors.targetId)}
      />
      <Label htmlFor="report-reason">신고 사유 (필수)</Label>
      <Textarea
        id="report-reason"
        {...form.register("reason")}
        maxLength={2000}
      />
      <Label htmlFor="report-evidence">증빙 설명 (선택)</Label>
      <Textarea
        id="report-evidence"
        {...form.register("evidence")}
        maxLength={4000}
      />
      <p>
        개발 입력 보호: 사유 2,000자·증빙 4,000자. 운영 한도 D18 미결정.
        비밀번호·연락처·주소를 입력하지 마세요.
      </p>
      {errors.length > 0 && (
        <p role="alert">대상 식별과 필수 사유를 확인해 주세요.</p>
      )}
      <Button type="submit" disabled={busy}>
        신고 접수 (Mock)
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() =>
          form.reset({
            type: "report",
            id: crypto.randomUUID(),
            targetType: "campaign",
            targetId: "",
            reason: "",
            evidence: "",
          })
        }
      >
        새 신고 입력
      </Button>
    </form>
  );
}
function Operation({
  report,
  busy,
  submit,
}: {
  report: SafetyReport;
  busy: boolean;
  submit: (cmd: Command) => void;
}) {
  const form = useForm<z.infer<typeof operationFormSchema>>({
    resolver: zodResolver(operationFormSchema),
    defaultValues: { action: "REVIEW", note: "" },
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={form.handleSubmit((values) =>
        submit({
          type: "operate",
          id: crypto.randomUUID(),
          reportId: report.id,
          ...values,
        }),
      )}
    >
      <Label htmlFor={`action-${report.id}`}>검토·조치</Label>
      <select id={`action-${report.id}`} {...form.register("action")}>
        <option value="REVIEW">검토 시작</option>
        <option value="WARN">경고 안내</option>
        <option value="LIMIT">신규 거래 제한 (DEV)</option>
        <option value="RELEASE">제한 해제 (DEV)</option>
      </select>
      <Label htmlFor={`note-${report.id}`}>당사자 안내 근거 (필수)</Label>
      <Textarea
        id={`note-${report.id}`}
        {...form.register("note")}
        required
        maxLength={2000}
      />
      {form.formState.errors.note && (
        <p role="alert">당사자 안내 근거를 입력해 주세요.</p>
      )}
      <Button type="submit" disabled={busy}>
        운영 조치 기록 (Mock)
      </Button>
    </form>
  );
}
function Appeal({
  reportId,
  busy,
  submit,
}: {
  reportId: string;
  busy: boolean;
  submit: (cmd: Command) => void;
}) {
  const form = useForm<z.infer<typeof noteFormSchema>>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: { note: "" },
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={form.handleSubmit(({ note }) =>
        submit({ type: "appeal", id: crypto.randomUUID(), reportId, note }),
      )}
    >
      <Label htmlFor={`appeal-${reportId}`}>이의 내용 (필수)</Label>
      <Textarea
        id={`appeal-${reportId}`}
        required
        maxLength={2000}
        {...form.register("note")}
      />
      {form.formState.errors.note && (
        <p role="alert">이의 내용을 입력해 주세요.</p>
      )}
      <Button disabled={busy} type="submit">
        이의 접수 (Mock)
      </Button>
    </form>
  );
}
export default function SafetyMock() {
  const { pathname } = useLocation();
  const ops = pathname === "/ops/reports";
  const { user } = useSession();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["mock-safety", session.epoch(), user?.id, ops],
    queryFn: ({ signal }) => loadSafety(ops, signal),
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: (cmd: Command) => loadSafety(ops, undefined, cmd),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["mock-safety"] }),
  });
  const busy = query.isFetching || mutation.isPending;
  const { data } = query;
  return (
    <section className="grid min-w-0 gap-6 break-words">
      <h1 className="type-heading-lg">
        {ops ? "신고 검토 (개발용)" : "신고·이용 제한 안내"}
      </h1>
      <p className="rounded-xl bg-muted p-4">
        DEV/MSW 전용 · 실제 운영 권한·API·DB 미연결. D18 조치·이의 정책은 검토
        예시예요. 자동 3아웃은 없어요. 새로고침하면 기록이 초기화돼요.
      </p>
      <Button variant="outline" disabled={busy} onClick={() => query.refetch()}>
        신고·제한 상태 재조회
      </Button>
      {busy && <p role="status">신고·제한 상태 확인 중…</p>}
      {(query.error || mutation.error) && (
        <p role="alert">
          응답을 확인하지 못했어요. 입력을 유지해요. 먼저 상태를 재조회해
          주세요.
        </p>
      )}
      {mutation.isError && mutation.variables && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => mutation.mutate(mutation.variables)}
        >
          같은 접수·처리 재시도
        </Button>
      )}
      {data && (
        <div hidden={query.isError}>
          {!ops && (
            <>
              <p>
                현재 개발용 제한:{" "}
                {data.limited ? "신규 거래 제한" : "제한 없음"} · 기존
                거래·납품·이의 경로 유지
              </p>
              <nav className="flex flex-wrap gap-4">
                <Link to="/me/activity">기존 거래·납품 확인</Link>
                <Link to="/requests">의뢰·대화 이어가기</Link>
              </nav>
              {data.restrictions.map((r) => (
                <article key={r.reportId} className="showcase-card grid gap-3">
                  <h2 className="type-heading-sm">
                    이용 안내 · {r.limited ? "제한 중" : "해제·경고 이력"}
                  </h2>
                  {r.history.map((h) => (
                    <p key={h.id}>
                      {h.action} · {h.note}
                    </p>
                  ))}
                  {r.limited && (
                    <Appeal
                      reportId={r.reportId}
                      busy={busy}
                      submit={(cmd) => mutation.mutate(cmd)}
                    />
                  )}
                </article>
              ))}
            </>
          )}
          <h2 className="type-heading-sm">
            {ops ? "접수·검토 목록" : "내 신고 기록"}
          </h2>
          {!data.reports.length && <p>접수된 신고가 없어요.</p>}
          {data.reports.map((r) => (
            <article
              key={r.id}
              className="showcase-card grid gap-3"
              aria-label={`신고 ${r.id}`}
            >
              <p>
                {r.status} · {r.id}
              </p>
              <Link
                to={
                  r.targetType === "campaign"
                    ? `/campaigns/${r.targetId}`
                    : `/requests/${r.targetId}`
                }
              >
                대상 화면 확인 (권한 재검사)
              </Link>
              <p>사유: {r.reason}</p>
              <p>증빙 설명: {r.evidence || "없음"}</p>
              {r.history.map((h) => (
                <p key={h.id}>
                  {h.action} · {h.note}
                </p>
              ))}
              {ops && (
                <Operation
                  report={r}
                  busy={busy}
                  submit={(cmd) => mutation.mutate(cmd)}
                />
              )}
            </article>
          ))}
        </div>
      )}
      {!ops && (
        <ReportForm
          busy={busy || query.isError}
          submit={(cmd) => mutation.mutate(cmd)}
        />
      )}
      <Link to="/campaigns">공개 모집으로</Link>
    </section>
  );
}
