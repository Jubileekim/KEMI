import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { session, useSession } from "../app/session";
import { loadOperations, reviewResolution } from "./resolution-api";
import type {
  ResolutionCommand,
  resolutionViewSchema,
} from "./resolution-model";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";

function ReviewCase({
  view,
  disabled,
  hideRecords,
  run,
}: {
  view: z.infer<typeof resolutionViewSchema>;
  disabled: boolean;
  hideRecords: boolean;
  run: (id: string, cmd: ResolutionCommand) => void;
}) {
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const { workflow } = view.state;
  const latest = view.state.versions.at(-1);
  const base = { id: crypto.randomUUID(), revision: view.state.revision };
  const busy =
    disabled || !note.trim() || !nextStep.trim() || Boolean(view.blocked);
  return (
    <section
      className="grid min-w-0 gap-3 rounded-xl border p-4 break-words"
      aria-label={`운영 검토 ${view.contractId}`}
    >
      {!hideRecords && (
        <>
          <h2 className="type-heading-sm">계약 {view.contractId}</h2>
          <p>
            확인 {latest?.confirmations.length ?? 0}/2 · 환불{" "}
            {workflow.refunds.at(-1)?.status ?? "미실행"} · 파일 수령{" "}
            {workflow.receipt ? "있음" : "없음"}
          </p>
          <p>
            합의 파일: {latest?.values.files ?? "미합의"} · 사용권:{" "}
            {latest?.values.rights ?? "미합의"}
          </p>
          {view.blocked && <p role="status">{view.blocked}</p>}
          {workflow.disputes.map((d) => (
            <article key={d.id} className="grid gap-2">
              <p>
                분쟁 {d.id} · {d.reason} · 증빙 {d.evidence} ·{" "}
                {d.released ? "근거 기록 후 합의 흐름 복귀" : "보류 중"}
              </p>
              {d.reviews.map((r) => (
                <p key={r.id}>
                  담당 {r.actorId} · {r.at} · {r.note} · 다음 안내 {r.nextStep}
                </p>
              ))}
              {!d.released && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run(view.contractId, {
                        ...base,
                        type: "review",
                        disputeId: d.id,
                        note: note.trim(),
                        nextStep: nextStep.trim(),
                        release: false,
                      })
                    }
                  >
                    검토 기록·보류 유지 (Mock)
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || latest?.confirmations.length !== 2}
                    onClick={() =>
                      run(view.contractId, {
                        ...base,
                        type: "review",
                        disputeId: d.id,
                        note: note.trim(),
                        nextStep: nextStep.trim(),
                        release: true,
                      })
                    }
                  >
                    합의 근거로 분쟁 보류 해제 (Mock)
                  </Button>
                </div>
              )}
            </article>
          ))}
          {workflow.release && (
            <p>
              취소 정산 보류 해제 근거: {workflow.release.reason} · 담당{" "}
              {workflow.release.actorId}
            </p>
          )}
        </>
      )}
      <Label htmlFor={`ops-note-${view.contractId}`}>검토·보류 해제 근거</Label>
      <Textarea
        id={`ops-note-${view.contractId}`}
        value={note}
        disabled={disabled}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
      />
      <Label htmlFor={`ops-next-${view.contractId}`}>다음 안내</Label>
      <Textarea
        id={`ops-next-${view.contractId}`}
        value={nextStep}
        disabled={disabled}
        maxLength={2000}
        onChange={(e) => setNextStep(e.target.value)}
      />
      {!hideRecords && latest && !workflow.release && (
        <Button
          disabled={
            busy ||
            latest.confirmations.length !== 2 ||
            !workflow.receipt ||
            workflow.refunds.at(-1)?.status !== "SUCCEEDED" ||
            workflow.disputes.some((d) => !d.released)
          }
          onClick={() =>
            run(view.contractId, {
              ...base,
              type: "release",
              versionId: latest.id,
              reason: `${note.trim()} / 다음 안내: ${nextStep.trim()}`,
            })
          }
        >
          환불·파일 근거로 취소 정산 보류 해제 (Mock)
        </Button>
      )}
    </section>
  );
}
export default function ReviewMock() {
  const { user } = useSession();
  const [pending, setPending] = useState<{
    id: string;
    cmd: ResolutionCommand;
  } | null>(null);
  const query = useQuery({
    queryKey: ["mock-ops-resolution", session.epoch(), user?.id],
    queryFn: ({ signal }) => loadOperations(signal),
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: ({ id, cmd }: { id: string; cmd: ResolutionCommand }) =>
      reviewResolution(id, cmd),
  });
  const busy = query.isFetching || mutation.isPending;
  const refresh = async () => {
    const epoch = session.epoch();
    const result = await query.refetch();
    if (
      epoch === session.epoch() &&
      !result.isError &&
      pending &&
      result.data?.some(
        (v) =>
          v.contractId === pending.id &&
          v.state.commands.some((c) => c.id === pending.cmd.id),
      )
    ) {
      setPending(null);
      mutation.reset();
    }
  };
  const run = (id: string, cmd: ResolutionCommand) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending({ id, cmd });
    mutation.mutate(
      { id, cmd },
      {
        onSuccess: async () => {
          if (epoch !== session.epoch()) return;
          const result = await query.refetch();
          if (epoch === session.epoch() && !result.isError) setPending(null);
        },
      },
    );
  };
  return (
    <section className="showcase-card grid min-w-0 gap-4 [&_button]:h-auto [&_button]:whitespace-normal [&_button]:py-2">
      <h1 className="type-heading-lg">분쟁 운영 검토 (Mock)</h1>
      <p>
        개발용 ADMIN fixture · 실제 운영 권한 D13/D18 미확정. 운영자는 양측
        확인·서명·수령을 대신하지 않아요. 환불·정산도 당사자 결과 확인과
        분리해요.
      </p>
      <Button variant="outline" disabled={busy} onClick={refresh}>
        운영 검토 재조회
      </Button>
      {busy && <p role="status">검토 기록 확인 중…</p>}
      {(query.error || mutation.error || pending) && !busy && (
        <p role="alert">
          검토 응답 확인 실패 · 재조회 또는 같은 검토 요청을 재시도해 주세요.
        </p>
      )}
      {pending && !busy && (
        <Button
          disabled={Boolean(query.error)}
          onClick={() => run(pending.id, pending.cmd)}
        >
          같은 검토 요청 재시도
        </Button>
      )}
      {pending && !busy && !query.error && (
        <Button
          variant="outline"
          onClick={async () => {
            const epoch = session.epoch();
            const result = await query.refetch();
            if (epoch === session.epoch() && !result.isError) {
              setPending(null);
              mutation.reset();
            }
          }}
        >
          최신 운영 기록 확인 후 새 입력
        </Button>
      )}
      {!busy && !query.error && !query.data?.length && (
        <p>검토할 취소·분쟁 기록이 없어요.</p>
      )}
      {query.data?.map((view) => (
        <ReviewCase
          key={view.contractId}
          view={view}
          disabled={busy || Boolean(pending) || Boolean(query.error)}
          hideRecords={busy || Boolean(pending) || Boolean(query.error)}
          run={run}
        />
      ))}
    </section>
  );
}
