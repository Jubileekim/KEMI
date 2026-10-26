import { useState } from "react";
import { Link } from "react-router";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import Label from "../components/ui/label";
import RevisionRequestForm from "../features/production/RevisionRequestForm";
import type { DeliveryState, DeliveryVersion } from "./delivery-model";
import {
  usedRounds,
  revisionLabels,
  type RevisionCommand,
  type RevisionRequest,
  revisionPolicyLocked,
  isDraftVersion,
} from "./revision-model";
import deadlineTime from "../features/production/time";

function requestStatus(item: RevisionRequest) {
  if (item.resultVersionId) return "수정본 제출됨";
  if (item.category === "ERROR" && !item.correctionAccepted)
    return "오류 여부 합의 대기·보류";
  return "수정 중";
}

export default function RevisionPanelMock({
  state,
  version,
  creator,
  terms,
  disabled,
  position,
  selectedRequest,
  submit,
}: {
  state: DeliveryState;
  version?: DeliveryVersion;
  creator: boolean;
  terms: string;
  disabled: boolean;
  position: { seconds: number; duration: number };
  selectedRequest: string | null;
  submit: (cmd: RevisionCommand) => void;
}) {
  const [limit, setLimit] = useState("");
  const [scope, setScope] = useState("");
  const policy = state.revisionPolicy;
  const ready = policy?.confirmedBy.length === 2;
  const requests = selectedRequest
    ? state.requests.filter((r) => r.id === selectedRequest)
    : state.requests;
  const open = state.requests.some((r) => !r.resultVersionId);
  const number = Number(limit);
  const policyLocked = revisionPolicyLocked(state);
  return (
    <section
      className="grid min-w-0 gap-5 [&_button]:h-auto [&_button]:whitespace-normal [&_button]:py-2"
      aria-label="수정 요청과 회차"
    >
      <h2 className="type-heading-md">수정 요청·수정본·회차</h2>
      <p>
        서명 조건 원문:{" "}
        <span className="whitespace-pre-wrap">{terms || "조건 확인 필요"}</span>
      </p>
      <p>
        완료한 일반 수정 {usedRounds(state)}회 ·{" "}
        {ready
          ? `Mock 합의 한도 ${policy.limit}회 · 남은 ${Math.max(0, policy.limit - usedRounds(state))}회`
          : "구조화 Mock 조건 양측 확인 전"}
      </p>
      <p>
        요청·업로드는 차감하지 않아요. 일반 수정본 제출 시 한 번만 완료해요.
        초안·계약 오류 시정은 별도예요.
      </p>
      <details>
        <summary>구조화 Mock 수정 조건 확인</summary>
        <div className="grid gap-3">
          <p>
            서명 문구를 자동 해석하지 않아요. 같은 횟수·범위를 양측이 확인하는
            개발 예시이며 실제 계약 변경이 아니에요. 요청 후 조건 변경은 별도
            협의가 필요해요.
          </p>
          {policy && (
            <p>
              제안: {policy.limit}회 · {policy.scope} · 확인{" "}
              {policy.confirmedBy.join(", ")}
            </p>
          )}
          <Label htmlFor="revision-limit">Mock 일반 수정 한도</Label>
          <Input
            id="revision-limit"
            type="number"
            min={0}
            max={20}
            value={limit}
            disabled={disabled || policyLocked}
            onChange={(e) => setLimit(e.target.value)}
          />
          <Label htmlFor="revision-scope">Mock 계약 수정 범위</Label>
          <Textarea
            id="revision-scope"
            maxLength={1000}
            value={scope}
            disabled={disabled || policyLocked}
            onChange={(e) => setScope(e.target.value)}
          />
          <Button
            disabled={
              disabled ||
              policyLocked ||
              !limit ||
              !Number.isInteger(number) ||
              number < 0 ||
              number > 20 ||
              !scope.trim()
            }
            onClick={() =>
              submit({
                type: "policy",
                id: crypto.randomUUID(),
                revision: state.revision,
                limit: number,
                scope: scope.trim(),
              })
            }
          >
            입력한 Mock 수정 조건 확인
          </Button>
          {policy &&
            !policy.confirmedBy.includes(creator ? "creator" : "client") && (
              <Button
                disabled={disabled || policyLocked}
                onClick={() =>
                  submit({
                    type: "policy",
                    id: crypto.randomUUID(),
                    revision: state.revision,
                    limit: policy.limit,
                    scope: policy.scope,
                  })
                }
              >
                표시된 Mock 수정 조건 확인
              </Button>
            )}
        </div>
      </details>
      {selectedRequest && requests.length === 0 && (
        <p role="alert">
          지정한 수정 요청을 찾을 수 없어요. 다른 요청으로 바꾸지 않아요.
        </p>
      )}
      <ol className="grid min-w-0 gap-4" aria-label="수정 요청 이력">
        {requests.map((r) => (
          <li key={r.id} className="grid min-w-0 gap-3 rounded-xl border p-4">
            <h3 className="type-heading-sm">
              {revisionLabels[r.category]} · {requestStatus(r)}
            </h3>
            <p>
              {deadlineTime(r.at)} · {r.authorId} ·{" "}
              {r.completedRound
                ? `일반 ${r.completedRound}회 완료`
                : "회차 차감 없음"}
            </p>
            <Link to={`?version=${r.versionId}&request=${r.id}`}>
              원요청 대상 영상 보기
            </Link>
            <ol className="grid min-w-0 gap-3">
              {r.items.map((item, index) => (
                <li
                  key={item.id}
                  className="grid min-w-0 gap-2 rounded-xl bg-muted p-3"
                >
                  <Link
                    to={`?version=${r.versionId}&request=${r.id}&t=${item.seconds}`}
                  >
                    항목 {index + 1} · {Math.floor(item.seconds / 60)}:
                    {String(item.seconds % 60).padStart(2, "0")}로 이동
                  </Link>
                  <p>{item.area === "EDITING" ? "편집" : "촬영"}</p>
                  <p className="whitespace-pre-wrap">문제: {item.problem}</p>
                  <p className="whitespace-pre-wrap">
                    희망 변경: {item.change}
                  </p>
                  <p className="whitespace-pre-wrap">
                    참고: {item.reference || "없음"}
                  </p>
                </li>
              ))}
            </ol>
            {creator &&
              r.category === "ERROR" &&
              !r.correctionAccepted &&
              !r.resultVersionId && (
                <Button
                  disabled={disabled}
                  onClick={() =>
                    submit({
                      type: "accept-correction",
                      id: crypto.randomUUID(),
                      revision: state.revision,
                      requestId: r.id,
                    })
                  }
                >
                  계약 오류 시정에 동의 (회차 제외)
                </Button>
              )}
            {r.resultVersionId && (
              <>
                <Link to={`?version=${r.resultVersionId}&request=${r.id}`}>
                  연결된 수정본 보기
                </Link>
                <p className="whitespace-pre-wrap">
                  처리 설명:{" "}
                  {
                    state.versions.find((v) => v.id === r.resultVersionId)
                      ?.description
                  }
                </p>
              </>
            )}
          </li>
        ))}
      </ol>
      {state.requests.length === 0 && <p>등록된 수정 요청이 없어요.</p>}
      {!creator &&
        !state.final.approval &&
        version &&
        version.id === state.versions.at(-1)?.id &&
        !open && (
          <RevisionRequestForm
            key={version.id}
            versionId={version.id}
            draft={isDraftVersion(state, version)}
            revision={state.revision}
            generalAllowed={Boolean(ready && usedRounds(state) < policy.limit)}
            disabled={disabled}
            position={position}
            submit={submit}
          />
        )}
      {open && (
        <p>
          진행 중 요청의 수정본을 기다리고 있어요. 혼합·이견·요청 변경·승인
          제한·수정본 납기는 D11 협의가 필요해요.
        </p>
      )}
    </section>
  );
}
