import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { session, useSession } from "../../app/session";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";
import ProposalConfirm from "../../mocks/ProposalConfirm";
import { loadSignatures, updateSignature } from "../../mocks/signature-api";
import {
  roundStatus,
  type SignatureCommand,
} from "../../mocks/signature-model";
import {
  missingTerms,
  termsFields,
  termsValuesSchema,
  type TermsDocument,
} from "../../mocks/terms-model";
import type { Proposal } from "../../mocks/proposal-model";
import { campaignTime } from "../../mocks/campaign-model";
import { ApiError } from "../../shared/api/client";
import type { TermsView } from "../../mocks/terms-api";

const labels = {
  WAITING: "서명 대기",
  CONFIRMED: "양측 서명 완료 · 계약 확정",
  CLOSED: "협의 종료 · 서명 차단",
  SUPERSEDED: "대체됨 · 서명 차단",
  EXPIRED: "만료 · 서명 차단",
};
export default function SignaturePanel({
  document,
  item,
  locked,
}: {
  document: TermsDocument;
  item: Proposal;
  locked: boolean;
}) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [input, setInput] = useState({
    versionId: "",
    name: "",
    consent: false,
  });
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState<SignatureCommand | null>(null);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["mock-signatures", session.epoch(), user?.id, item.id],
    queryFn: ({ signal }) => loadSignatures(item.id, signal),
    refetchOnReconnect: false,
  });
  const mutation = useMutation({ mutationFn: updateSignature });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const latest = document.versions.at(-1);
  const name = input.versionId === latest?.id ? input.name : "";
  const consent = input.versionId === latest?.id && input.consent;
  const rounds = query.data?.rounds ?? [];
  const current = rounds.find((r) => r.versionId === latest?.id);
  const status = current ? roundStatus(current, document, item, now) : null;
  const busy = query.isFetching || mutation.isPending || locked;
  const unavailable =
    busy ||
    item.status !== "DISCUSSING" ||
    item.contracted ||
    !query.data?.editable ||
    Boolean(query.error) ||
    Boolean(pending);
  const refresh = async () => {
    await Promise.all(
      ["mock-terms", "mock-proposals", "mock-discovery", "mock-campaigns"].map(
        (key) => cache.invalidateQueries({ queryKey: [key] }),
      ),
    );
    return query.refetch();
  };
  const send = (command: SignatureCommand, done?: () => void) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending(command);
    setNotice("");
    mutation.mutate(command, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const result = await refresh();
        if (epoch !== session.epoch() || result.isError) return;
        setPending(null);
        setInput({ versionId: "", name: "", consent: false });
        done?.();
        setNotice(
          "모의 처리 응답과 최신 상태를 확인했어요. 실제 계약·알림·결제는 미연결이에요.",
        );
      },
      onError: (error) => {
        if (
          epoch === session.epoch() &&
          error instanceof ApiError &&
          [400, 401, 403, 404, 409].includes(error.status)
        )
          setPending(null);
      },
    });
  };
  const command = (type: SignatureCommand["type"]): SignatureCommand | null =>
    latest
      ? {
          id: crypto.randomUUID(),
          requestId: item.id,
          revision: document.revision,
          versionId: latest.id,
          type,
          name: name.trim(),
          consent,
        }
      : null;
  return (
    <section
      className="grid min-w-0 gap-4 rounded-xl border p-4"
      aria-label="양측 서명"
    >
      <h3 className="type-heading-md">양측 확인·서명</h3>
      <p>
        개발용 Mock · 확인 요청부터 48시간. D08 이름 입력·동의와 만료 정각
        차단은 검토용 예시예요. 한쪽 서명으로 선정하지 않아요.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          const epoch = session.epoch();
          const result = await refresh();
          if (epoch !== session.epoch() || result.isError) return;
          mutation.reset();
          // Re-query before allowing a new ID. A failed/unknown operation can only
          // be retried with its original command until its outcome is resolved.
          if (!pending) setNotice("최신 서명 상태를 확인했어요.");
        }}
      >
        최신 서명 상태 확인
      </Button>
      {(query.error || mutation.error || (pending && !mutation.isPending)) && (
        <p role="alert">
          서명 처리 결과를 확인해 주세요. 권한·최신 버전·만료·타후보 선정을 다시
          조회해 주세요. 결과 확인 전 새 요청은 차단해요.
        </p>
      )}
      {pending && !mutation.isPending && (
        <Button disabled={busy} onClick={() => send(pending)}>
          같은 서명 요청 재시도
        </Button>
      )}
      {pending && !mutation.isPending && !query.isError && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={async () => {
            const epoch = session.epoch();
            const result = await refresh();
            if (epoch !== session.epoch() || result.isError || !result.data)
              return;
            const target = result.data.rounds.find(
              (r) => r.versionId === pending.versionId,
            );
            const stored = cache.getQueryData<TermsView>([
              "mock-terms",
              epoch,
              user?.id,
              item.id,
            ]);
            let confirmed = target?.signatures.some(
              (s) => s.userId === user?.id && s.name === pending.name,
            );
            if (pending.type === "request") confirmed = Boolean(target);
            if (pending.type === "renew")
              confirmed = stored?.document.versions.some(
                (v) => v.id === pending.id,
              );
            if (confirmed) {
              setPending(null);
              mutation.reset();
              setInput({ versionId: "", name: "", consent: false });
              setNotice("저장된 서명 처리 결과를 재조회해 확인했어요.");
            }
          }}
        >
          저장 결과 확인
        </Button>
      )}
      <p>
        서명 대상은 아래에 표시한 최신 저장본이에요. 저장하지 않은 편집 값은
        포함하지 않아요.
      </p>
      {latest && (
        <details open className="min-w-0 break-words">
          <summary>서명 전 최종 확인 · v{latest.number}</summary>
          <dl className="grid gap-2">
            {Object.entries(termsFields).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd className="whitespace-pre-wrap">
                  {latest.values[termsValuesSchema.keyof().parse(key)] ||
                    "미입력"}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      <ProposalConfirm
        label="서명 요청"
        description={`최신 저장본 v${latest?.number ?? 0}의 표시된 조건을 고정하고 48시간 확인을 요청해요. 요청만으로 서명·선정하지 않아요.`}
        busy={
          unavailable ||
          !latest ||
          Boolean(current) ||
          Boolean(latest && missingTerms(latest.values).length)
        }
        error=""
        onConfirm={(_, done) => {
          const cmd = command("request");
          if (cmd) {
            done();
            send(cmd);
          }
        }}
      />
      {status === "WAITING" && (
        <>
          <Label htmlFor="signature-name">Mock 서명 이름 (최대 100자)</Label>
          <Input
            id="signature-name"
            maxLength={100}
            value={name}
            disabled={unavailable}
            onChange={(e) =>
              setInput({
                versionId: latest?.id ?? "",
                name: e.target.value,
                consent,
              })
            }
          />
          <Label className="flex gap-2">
            <input
              type="checkbox"
              checked={consent}
              disabled={unavailable}
              onChange={(e) =>
                setInput({
                  versionId: latest?.id ?? "",
                  name,
                  consent: e.target.checked,
                })
              }
            />
            표시된 동일 버전의 최종 조건에 동의해요
          </Label>
          <ProposalConfirm
            label="동의하고 서명하기"
            description={`v${latest?.number} · ${name} 이름으로 본인 서명을 기록해요. 두 번째 유효 서명이면 한 후보만 선정돼요.`}
            busy={
              unavailable ||
              !name.trim() ||
              !consent ||
              Boolean(current?.signatures.some((s) => s.userId === user?.id))
            }
            error=""
            onConfirm={(_, done) => {
              const cmd = command("sign");
              if (cmd) {
                done();
                send(cmd);
              }
            }}
          />
        </>
      )}
      {status === "EXPIRED" && (
        <Button
          disabled={unavailable}
          onClick={() => {
            const cmd = command("renew");
            if (cmd) send(cmd);
          }}
        >
          새 확인 버전 만들기
        </Button>
      )}
      {rounds.map((round) => {
        const version = document.versions.find((v) => v.id === round.versionId);
        const state = roundStatus(round, document, item, now);
        return (
          <article
            key={round.versionId}
            className="min-w-0 break-words rounded-xl bg-muted p-4"
            aria-label={`서명 이력 v${version?.number}`}
            id={`signature-${round.versionId}`}
          >
            <h4>
              v{version?.number} · {labels[state]}
            </h4>
            <p>
              확인 요청: {campaignTime(round.requestedAt)} · 만료:{" "}
              {campaignTime(round.expiresAt)}
            </p>
            <p>요청자: {round.requestedBy === user?.id ? "본인" : "상대방"}</p>
            <p>
              {round.signatures.length}/2명 서명
              {round.signatures.length === 1 ? " · 계약 미확정" : ""}
            </p>
            {round.signatures.map((s) => (
              <p key={s.userId}>
                {s.name} · {campaignTime(s.at)} ·{" "}
                {s.userId === user?.id ? "본인" : "상대방"}
              </p>
            ))}
            {round.contractId && (
              <>
                <p>모의 계약 식별: {round.contractId}</p>
                <p>선정 완료 · 실제 결제 API 미연결 · 제작 시작 전</p>
                <Link to={`/contracts/${round.contractId}/production`}>
                  제품·자료 준비와 납기 (Mock)
                </Link>
                <Link to={`/contracts/${round.contractId}/deliveries`}>
                  초안·완성 검토본과 영상 버전 (Mock)
                </Link>
                {user?.role === "CLIENT" && (
                  <Link to={`/contracts/${round.contractId}/payment`}>
                    전액 테스트 결제 확인 (Mock)
                  </Link>
                )}
                {user?.role === "CREATOR" && (
                  <Link to={`/payments/result?contractId=${round.contractId}`}>
                    테스트 결제 내역 확인 (Mock)
                  </Link>
                )}
              </>
            )}
          </article>
        );
      })}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
