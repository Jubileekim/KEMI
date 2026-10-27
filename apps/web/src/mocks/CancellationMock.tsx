import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import CancellationForm from "../features/resolution/CancellationForm";
import CancellationAgreement from "../features/resolution/CancellationAgreement";
import Button from "../components/ui/button";
import loadResolution from "./resolution-api";
import type { CancellationCommand } from "./resolution-model";

export default function CancellationMock({
  contractId,
}: {
  contractId: string;
}) {
  const { user } = useSession();
  const [pending, setPending] = useState<CancellationCommand | null>(null);
  const valid = z.string().uuid().safeParse(contractId).success;
  const query = useQuery({
    queryKey: ["mock-resolution", session.epoch(), user?.id, contractId],
    queryFn: ({ signal }) => loadResolution(contractId, signal),
    enabled: valid,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (cmd: CancellationCommand) =>
      loadResolution(contractId, undefined, cmd),
  });
  const busy = query.isFetching || mutation.isPending;
  const refresh = async () => {
    const epoch = session.epoch();
    const result = await query.refetch();
    if (epoch !== session.epoch() || result.isError) return;
    if (
      pending &&
      result.data?.state.commands.some(
        (c) => c.id === pending.id && c.actorId === user?.id,
      )
    ) {
      setPending(null);
      mutation.reset();
    }
  };
  const run = (cmd: CancellationCommand) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending(cmd);
    mutation.mutate(cmd, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const result = await query.refetch();
        if (epoch === session.epoch() && !result.isError) setPending(null);
      },
    });
  };
  const data = !query.error && !busy && !pending ? query.data : undefined;
  const latest = data?.state.versions.at(-1);
  return (
    <section
      aria-label="취소 협의"
      className="showcase-card grid min-w-0 gap-4 break-words [&_button]:h-auto [&_button]:whitespace-normal [&_button]:py-2"
    >
      <h1 className="type-heading-lg">취소 요청·양측 합의</h1>
      <p>
        개발용 Mock · 실제 API·DB·PG 미연결. 요청·대화·무응답만으로
        환불·지급하지 않아요. 새로고침 시 거래 기록이 초기화돼요.
      </p>
      <p>D12 세금·절사, D13 회신 기한·완료 후 취소·해제 권한은 미결정이에요.</p>
      <Button variant="outline" disabled={busy || !valid} onClick={refresh}>
        취소 상태 재조회
      </Button>
      {busy && <p role="status">취소 상태 확인 중…</p>}
      {!valid && <p role="alert">유효한 계약 식별이 필요해요.</p>}
      {(query.error || mutation.error || pending) && !busy && (
        <p role="alert">
          응답을 확인하지 못했어요. 완료로 표시하지 않아요. 재조회 후 같은
          요청을 재시도해 주세요.
        </p>
      )}
      {pending && !busy && (
        <Button disabled={Boolean(query.error)} onClick={() => run(pending)}>
          같은 취소 요청 재시도
        </Button>
      )}
      {pending &&
        !busy &&
        !query.error &&
        query.data &&
        !query.data.state.commands.some((c) => c.id === pending.id) && (
          <Button
            variant="outline"
            onClick={async () => {
              const epoch = session.epoch();
              const result = await query.refetch();
              if (
                epoch === session.epoch() &&
                !result.isError &&
                result.data &&
                !result.data.state.commands.some((c) => c.id === pending.id)
              ) {
                setPending(null);
                mutation.reset();
              }
            }}
          >
            최신 기록 확인 후 입력 수정
          </Button>
        )}
      {data && (
        <>
          <p>
            계약 금액 {data.amount.toLocaleString("ko-KR")}원 · 성공 결제{" "}
            {data.paidAmount?.toLocaleString("ko-KR") ?? "미확인"}원
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to={`/workspace/${data.requestId}`}>
              같은 작업 공간으로 돌아가기
            </Link>
            <Link to={`/contracts/${contractId}/settlement`}>
              모의 정산 결과 확인
            </Link>
            <Link to={`/contracts/${contractId}/deliveries`}>
              영상·증빙 기록 확인
            </Link>
          </div>
          {data.blocked && <p role="status">{data.blocked}</p>}
          {latest && (
            <CancellationAgreement
              key={`${latest.id}:${user?.id}`}
              version={latest}
              userId={user?.id ?? ""}
              disabled={
                Boolean(data.blocked) || data.paidAmount !== data.amount
              }
              onConfirm={() =>
                run({
                  type: "confirm",
                  id: crypto.randomUUID(),
                  revision: data.state.revision,
                  versionId: latest.id,
                  consent: true,
                })
              }
            />
          )}
          {data.paidAmount !== data.amount && (
            <p>
              양측 확인과 환불 실행에는 원계약과 성공 전액 결제의 일치 확인이
              필요해요.
            </p>
          )}
          {data.state.versions.length > 1 && (
            <details>
              <summary>이전 취소 조건 기록</summary>
              {data.state.versions.slice(0, -1).map((v) => (
                <p key={v.id}>
                  버전 {v.id} · 대가{" "}
                  {v.values.compensation.toLocaleString("ko-KR")}원 ·{" "}
                  {v.values.rights} · 이전 확인 {v.confirmations.length}/2 (현재
                  버전 아님)
                </p>
              ))}
            </details>
          )}
        </>
      )}
      {query.data &&
        !query.data.blocked &&
        query.data.state.versions.at(-1)?.confirmations.length !== 2 && (
          <CancellationForm
            disabled={busy || Boolean(pending) || Boolean(query.error)}
            amount={query.data.amount}
            onSubmit={(values) => {
              if (!query.data || busy || pending || query.error) return;
              run({
                type: "propose",
                id: crypto.randomUUID(),
                revision: query.data.state.revision,
                values: {
                  ...values,
                  compensation: Number(values.compensation),
                },
              });
            }}
          />
        )}
    </section>
  );
}
