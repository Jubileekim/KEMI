import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import TermsEditor from "../features/terms/TermsEditor";
import { loadTerms, updateTerms } from "./terms-api";
import type { TermsCommand, TermsDocument } from "./terms-model";
import { ApiError } from "../shared/api/client";

function failure(error: unknown) {
  if (!error) return "";
  if (error instanceof ApiError && error.status === 409)
    return "저장 충돌 또는 참조 변경이 있어요. 최신 조건서를 확인하고 비교해 주세요.";
  if (error instanceof ApiError && [401, 403, 404].includes(error.status))
    return "로그인·당사자 권한·유효한 협의를 확인해 주세요.";
  return "저장 여부를 확인하지 못했어요. 최신 조건서 확인 후 같은 저장을 재시도해 주세요. 입력은 보존해요.";
}
export default function TermsMock({
  requestId,
  active,
}: {
  requestId: string;
  active: boolean;
}) {
  const { user } = useSession();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{
    command: TermsCommand;
    done: (document: TermsDocument) => void;
  } | null>(null);
  const query = useQuery({
    queryKey: ["mock-terms", session.epoch(), user?.id, requestId],
    queryFn: ({ signal }) => loadTerms(requestId, signal),
    refetchOnReconnect: false,
  });
  const mutation = useMutation({ mutationFn: updateTerms });
  const busy = query.isFetching || mutation.isPending;
  const save = (
    command: TermsCommand,
    done: (document: TermsDocument) => void,
  ) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending({ command, done });
    setNotice("");
    mutation.mutate(command, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const result = await query.refetch();
        if (epoch !== session.epoch()) return;
        if (result.isError || !result.data) return;
        done(result.data.document);
        setPending(null);
        setNotice(
          "모의 작성본 저장 응답을 확인했어요. 서명·계약은 생성하지 않았어요.",
        );
      },
      onError: (error) => {
        if (epoch !== session.epoch()) return;
        if (
          error instanceof ApiError &&
          [400, 401, 403, 404, 409].includes(error.status)
        )
          setPending(null);
      },
    });
  };
  return (
    <section
      aria-label="최종 조건서"
      className="showcase-card grid min-w-0 gap-4"
    >
      <h2 className="type-heading-md">최종 조건서 · 작성·버전 관리</h2>
      <p>
        개발용 Mock · 단일 탭 메모리. 새로고침하면 초기화돼요. 실제
        API·DB·서명·알림은 미연결이에요. 양 당사자 편집/revision 충돌 차단은 D08
        검토용 예시예요.
      </p>
      <details>
        <summary>3-A 개발 전용 시나리오</summary>
        <Label htmlFor="terms-scenario">Mock 조건서 응답</Label>
        <select
          id="terms-scenario"
          disabled={busy}
          defaultValue="success"
          onChange={async (e) => {
            await fetch("/__mock__/terms/scenario", {
              method: "POST",
              body: e.target.value,
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
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </details>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          const epoch = session.epoch();
          const result = await query.refetch();
          if (epoch !== session.epoch()) return;
          if (
            !result.isError &&
            pending &&
            result.data?.document.versions.some(
              (v) => v.id === pending.command.id,
            )
          ) {
            pending.done(result.data.document);
            setPending(null);
            mutation.reset();
            setNotice(
              "저장된 작성본을 재조회해 확인했어요. 중복 저장하지 않아요.",
            );
          }
        }}
      >
        최신 조건서 확인
      </Button>
      {busy && <p role="status">조건서를 불러오거나 저장하고 있어요.</p>}
      {query.error && <p role="alert">{failure(query.error)}</p>}
      {mutation.error && <p role="alert">{failure(mutation.error)}</p>}
      {pending && !mutation.isPending && (
        <Button
          disabled={busy || Boolean(query.error)}
          onClick={() => save(pending.command, pending.done)}
        >
          같은 저장 재시도
        </Button>
      )}
      {query.data && (
        <TermsEditor
          document={query.data.document}
          requestId={requestId}
          editable={active && query.data.editable && !query.error}
          busy={busy}
          unresolved={Boolean(pending)}
          onSave={save}
        />
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
