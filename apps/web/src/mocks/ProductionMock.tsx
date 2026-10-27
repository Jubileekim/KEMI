import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { session, useSession } from "../app/session";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";
import DeadlineChangePanel from "../features/production/DeadlineChangePanel";
import deadlineTime from "../features/production/time";
import { loadProduction, updateProduction } from "./production-api";
import {
  allPrepared,
  readinessKeys,
  type ProductionCommand,
  type ProductionState,
} from "./production-model";

const names = { product: "제품", file: "필수 파일", info: "병행 정보" };
type Action = ProductionCommand["action"];
function Requirement({
  itemKey,
  state,
  client,
  disabled,
  send,
}: {
  itemKey: (typeof readinessKeys)[number];
  state: ProductionState;
  client: boolean;
  disabled: boolean;
  send: (action: Action) => void;
}) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState("");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const item = state.requirements[itemKey];
  const name = names[itemKey];
  return (
    <article
      className="grid min-w-0 gap-3 rounded-xl border p-4"
      aria-label={`${name} 준비`}
    >
      <h3 className="type-heading-sm">
        {name} · {item.ready ? "정상 준비" : "미완료·확인 필요"}
      </h3>
      <p>{item.value || "제공 기록 없음"}</p>
      {item.shippedOn && (
        <p>
          발송일: {item.shippedOn} · 운송장: {item.tracking || "미입력"}
        </p>
      )}
      {client ? (
        <>
          <Label htmlFor={`value-${itemKey}`}>
            {name} 제공·정정 기록 (파일은 자료명만 기록)
          </Label>
          <Input
            id={`value-${itemKey}`}
            maxLength={1000}
            value={value}
            disabled={disabled}
            onChange={(e) => setValue(e.target.value)}
          />
          {itemKey === "product" && (
            <>
              <Label htmlFor="shipment-date">발송일</Label>
              <Input
                id="shipment-date"
                type="date"
                value={date}
                disabled={disabled}
                onChange={(e) => setDate(e.target.value)}
              />
              <Label htmlFor="tracking">운송장 (선택)</Label>
              <Input
                id="tracking"
                maxLength={100}
                value={tracking}
                disabled={disabled}
                onChange={(e) => setTracking(e.target.value)}
              />
            </>
          )}
          <Button
            variant="outline"
            disabled={
              disabled || !value.trim() || (itemKey === "product" && !date)
            }
            onClick={() =>
              send({
                type: "supply",
                key: itemKey,
                value,
                ...(itemKey === "product" ? { shippedOn: date, tracking } : {}),
              })
            }
          >
            {name} {itemKey === "product" ? "발송 등록" : "제공 기록"}
          </Button>
        </>
      ) : (
        <>
          <Label htmlFor={`reason-${itemKey}`}>
            {name} 확인·문제·정정 사유
          </Label>
          <Textarea
            id={`reason-${itemKey}`}
            maxLength={1000}
            value={reason}
            disabled={disabled}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={disabled || !item.value || !reason.trim()}
              onClick={() =>
                send({ type: "check", key: itemKey, ready: true, reason })
              }
            >
              {name} 정상 확인
            </Button>
            <Button
              variant="outline"
              disabled={disabled || !item.value || !reason.trim()}
              onClick={() =>
                send({ type: "check", key: itemKey, ready: false, reason })
              }
            >
              {name} 문제·누락 신고
            </Button>
          </div>
        </>
      )}
    </article>
  );
}
export default function ProductionMock({ contractId }: { contractId: string }) {
  const { hash } = useLocation();
  const { user } = useSession();
  const [days, setDays] = useState("7");
  const [required, setRequired] = useState({
    product: true,
    file: true,
    info: true,
  });
  const [pending, setPending] = useState<ProductionCommand | null>(null);
  const [notice, setNotice] = useState("");
  const valid = z.string().uuid().safeParse(contractId).success;
  const query = useQuery({
    queryKey: ["mock-production", session.epoch(), user?.id, contractId],
    queryFn: ({ signal }) => loadProduction(contractId, signal),
    enabled: valid,
    refetchOnReconnect: false,
  });
  const mutation = useMutation({
    mutationFn: (command: ProductionCommand) =>
      updateProduction(contractId, command),
  });
  const busy = query.isFetching || mutation.isPending;
  const { data } = query;
  const state = data?.state;
  const client = user?.id === data?.clientId && user?.role === "CLIENT";
  const disabled =
    busy || Boolean(query.error) || Boolean(pending) || !data?.paid;
  const reconcile = async () => {
    const epoch = session.epoch();
    const response = await query.refetch();
    if (epoch !== session.epoch() || response.isError || !response.data) return;
    if (
      pending &&
      response.data.state.receipts.some((r) => r.id === pending.id)
    ) {
      setPending(null);
      mutation.reset();
    }
    setNotice("최신 준비·납기를 재조회했어요.");
  };
  const dispatch = (cmd: ProductionCommand) => {
    if (busy) return;
    const epoch = session.epoch();
    setPending(cmd);
    setNotice("");
    mutation.mutate(cmd, {
      onSuccess: async () => {
        if (epoch !== session.epoch()) return;
        const response = await query.refetch();
        if (epoch !== session.epoch() || response.isError || !response.data)
          return;
        if (response.data.state.receipts.some((r) => r.id === cmd.id))
          setPending(null);
      },
    });
  };
  let statusLabel = "준비 대기 · 제작 시작 전";
  if (state?.startedAt)
    statusLabel = allPrepared(state)
      ? "제작 중 · 모의 시작 확인"
      : "시작 후 준비 문제 보류";
  const send = (action: Action) => {
    if (state)
      dispatch({ id: crypto.randomUUID(), revision: state.revision, action });
  };
  return (
    <section
      className="showcase-card grid min-w-0 gap-6 break-words"
      aria-label="제품·자료 제작 준비"
    >
      <h1 className="type-heading-lg">제품·자료 준비와 제작 납기</h1>
      <p>
        개발용 Mock · 실제 API·배송사·파일 저장 미연결. 단일 탭 메모리로
        새로고침 시 초기화돼요.
      </p>
      <p>
        D09 미결정: 시작일 미포함·시작 시각 + 달력일 수의 모의 계산 예시예요.
        확정 납기 정책이 아니에요. 카운트다운은 재조회 시각 기준이에요.
      </p>
      <Button variant="outline" disabled={!valid || busy} onClick={reconcile}>
        준비·납기 재조회
      </Button>
      {!valid && <p role="alert">유효한 계약 식별이 필요해요.</p>}
      {busy && <p role="status">준비 상태 확인 중…</p>}
      {(query.error || mutation.error || (pending && !busy)) && (
        <p role="alert">
          결과를 확인하지 못했어요. 최신 상태를 재조회해 주세요. 확인 전에는 새
          변경을 차단해요.
        </p>
      )}
      {pending && !busy && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => dispatch(pending)}>
            같은 준비 요청 재시도
          </Button>
          <Button
            variant="outline"
            disabled={
              Boolean(query.error) ||
              query.dataUpdatedAt <= mutation.submittedAt
            }
            onClick={() => {
              setPending(null);
              mutation.reset();
              setNotice(
                "미확인 요청을 해제했어요. 재조회된 상태에서 다시 확인해 주세요.",
              );
            }}
          >
            재조회 상태로 다시 작성
          </Button>
        </div>
      )}
      {data && state && !query.error && (
        <>
          <p>
            모의 계약: {contractId} ·{" "}
            {data.paid ? "전액 Mock 결제 확인" : "결제 전 · 제작 시작 불가"}
          </p>
          <details>
            <summary>서명한 원래 조건 확인</summary>
            <p>자료: {data.terms.materials}</p>
            <p>기간: {data.terms.deadline}</p>
          </details>
          <section className="grid gap-3" aria-label="구조화 Mock 준비 조건">
            <h2 className="type-heading-md">구조화 Mock 준비 조건</h2>
            <p>
              원래 조건은 자유 텍스트예요. 아래는 별도의 개발 예시이며 실제 계약
              변경이 아니에요. 양측 확인 후 진행해요.
            </p>
            {state.plan && (
              <p>
                제안: {state.plan.days} 달력일 · 필수:{" "}
                {readinessKeys
                  .filter((key) => state.plan?.[key])
                  .map((key) => names[key])
                  .join(", ") || "없음"}{" "}
                · {state.agreed ? "양측 확인" : "상대 확인 대기"}
              </p>
            )}
            {client && !state.agreed && (
              <>
                <Label htmlFor="work-days">Mock 작업 기간 (달력일)</Label>
                <Input
                  id="work-days"
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  disabled={disabled}
                  onChange={(e) => setDays(e.target.value)}
                />
                {readinessKeys.map((key) => (
                  <Label key={key}>
                    <input
                      type="checkbox"
                      checked={required[key]}
                      disabled={disabled}
                      onChange={(e) =>
                        setRequired({ ...required, [key]: e.target.checked })
                      }
                    />
                    {names[key]} 필수
                  </Label>
                ))}
                <Button
                  disabled={
                    disabled ||
                    !Number.isInteger(Number(days)) ||
                    Number(days) < 1 ||
                    Number(days) > 365
                  }
                  onClick={() =>
                    send({
                      type: "plan",
                      plan: { ...required, days: Number(days) },
                    })
                  }
                >
                  Mock 준비 조건 제안
                </Button>
              </>
            )}
            {!client && state.plan && !state.agreed && (
              <Button
                disabled={disabled}
                onClick={() => send({ type: "agree-plan" })}
              >
                표시된 Mock 준비 조건 확인
              </Button>
            )}
          </section>
          {state.agreed &&
            readinessKeys
              .filter((key) => state.plan?.[key])
              .map((key) => (
                <Requirement
                  key={`${key}-${user?.id}`}
                  itemKey={key}
                  state={state}
                  client={client}
                  disabled={disabled}
                  send={send}
                />
              ))}
          <section
            className="grid gap-3 rounded-xl bg-muted p-4"
            aria-label="제작 상태"
          >
            <h2 className="type-heading-md">{statusLabel}</h2>
            <p>
              서명·전액 결제·양측 확인·모든 필수 준비가 충족되면 모의 서버가 한
              번만 시작해요. 발송만으로 시작하지 않아요.
            </p>
            {state.startedAt && state.due && (
              <>
                <p>시작: {deadlineTime(state.startedAt)}</p>
                <p>현재 모의 납기: {deadlineTime(state.due)} (한국 시간)</p>
                <p>
                  최초 모의 납기:{" "}
                  {state.originalDue && deadlineTime(state.originalDue)}
                </p>
                <p>
                  {Date.parse(state.due) < Date.parse(data.now)
                    ? "모의 납기 지연"
                    : `남은 시간: ${Math.ceil((Date.parse(state.due) - Date.parse(data.now)) / 3600000)}시간 (조회 기준)`}
                </p>
                <p>문제·정정은 시작일·납기를 자동 변경하지 않아요.</p>
              </>
            )}
          </section>
          <DeadlineChangePanel
            due={state.due}
            changes={state.changes}
            userId={user?.id ?? ""}
            disabled={disabled}
            propose={(due, reason) => send({ type: "propose", due, reason })}
            respond={(changeId, accept) =>
              send({ type: "respond", changeId, accept })
            }
          />
          <details open={hash.startsWith("#production-") || undefined}>
            <summary>준비·정정·납기 이력 ({state.history.length})</summary>
            {state.history.map((h) => (
              <p key={h.id} id={`production-${h.id}`}>
                {deadlineTime(h.at)} ·{" "}
                {h.actorId === user?.id ? "본인" : "상대방"} · {h.message}
              </p>
            ))}
          </details>
          <Link to={`/workspace/${data.requestId}`}>
            같은 작업 공간으로 돌아가기
          </Link>
          <Link to={`/contracts/${contractId}/deliveries`}>
            초안·완성 검토본과 영상 버전 (Mock)
          </Link>
          <Link to={`/contracts/${contractId}/settlement`}>
            모의 정산 결과 확인
          </Link>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      <details>
        <summary>4-A 개발 전용 시나리오</summary>
        <Label htmlFor="production-scenario">Mock 준비 응답</Label>
        <select
          id="production-scenario"
          disabled={busy}
          defaultValue="success"
          onChange={async (e) => {
            await fetch("/__mock__/production/scenario", {
              method: "POST",
              body: e.target.value,
            });
          }}
        >
          {[
            "success",
            "delay",
            "lost-response",
            "network",
            "401",
            "403",
            "409",
            "500",
            "malformed",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </details>
    </section>
  );
}
