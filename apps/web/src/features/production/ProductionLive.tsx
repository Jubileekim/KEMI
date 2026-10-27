import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { MaterialCreateRequest, Production } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi, newCommandId } from "../../shared/api/kemi";
import { openFile, uploadFile } from "../../shared/api/upload";
import {
  dateOnly,
  dateTime,
  label,
  materialKindLabels,
  materialStatusLabels,
  productionStatusLabels,
} from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";

type Kind = MaterialCreateRequest["kind"];

// READY-01: 의뢰인이 자료를 낸다(파일·실물 발송·메모). 같은 요청 식별자로 재전송해도 한 번만 생긴다.
function MaterialForm({
  production,
  onDone,
}: {
  production: Production;
  onDone: (next: Production) => void;
}) {
  const [kind, setKind] = useState<Kind>("NOTE");
  const [commandId, setCommandId] = useState(newCommandId);
  const replaceable = production.materials.filter(
    (m) => m.status === "ISSUE_REPORTED",
  );
  const add = useMutation({
    mutationFn: async (form: FormData) => {
      const text = (name: string) => String(form.get(name) ?? "").trim();
      const note = text("note") || undefined;
      const replacesMaterialId = text("replaces") || undefined;
      if (kind === "FILE") {
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0)
          throw new Error("파일을 선택해 주세요.");
        const stored = await uploadFile(
          file,
          "MATERIAL",
          production.workRequestId,
        );
        return kemi.addMaterial(production.contractId, {
          commandId,
          kind,
          fileId: stored.id,
          note,
          replacesMaterialId,
        });
      }
      if (kind === "SHIPMENT")
        return kemi.addMaterial(production.contractId, {
          commandId,
          kind,
          carrier: text("carrier"),
          trackingNumber: text("trackingNumber"),
          note,
          replacesMaterialId,
        });
      return kemi.addMaterial(production.contractId, {
        commandId,
        kind,
        note: text("note"),
        replacesMaterialId,
      });
    },
    onSuccess: (next) => {
      setCommandId(newCommandId());
      onDone(next);
    },
  });
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate(new FormData(event.currentTarget));
      }}
    >
      <Field id="material-kind" label="자료 종류">
        <select
          id="material-kind"
          className={selectClass}
          value={kind}
          onChange={(event) =>
            setKind(
              event.target.value === "FILE" || event.target.value === "SHIPMENT"
                ? event.target.value
                : "NOTE",
            )
          }
        >
          <option value="NOTE">메모</option>
          <option value="FILE">파일</option>
          <option value="SHIPMENT">실물 발송</option>
        </select>
      </Field>
      {kind === "FILE" && (
        <Field id="material-file" label="파일">
          <Input id="material-file" name="file" type="file" required />
        </Field>
      )}
      {kind === "SHIPMENT" && (
        <>
          <Field id="material-carrier" label="택배사">
            <Input
              id="material-carrier"
              name="carrier"
              required
              maxLength={50}
            />
          </Field>
          <Field id="material-tracking" label="송장번호">
            <Input
              id="material-tracking"
              name="trackingNumber"
              required
              maxLength={50}
            />
          </Field>
        </>
      )}
      <Field
        id="material-note"
        label={kind === "NOTE" ? "메모" : "메모 (선택)"}
      >
        <Textarea
          id="material-note"
          name="note"
          rows={3}
          required={kind === "NOTE"}
          maxLength={2000}
        />
      </Field>
      {replaceable.length > 0 && (
        <Field id="material-replaces" label="문제 신고된 자료 대체 (선택)">
          <select
            id="material-replaces"
            name="replaces"
            className={selectClass}
            defaultValue=""
          >
            <option value="">대체하지 않음</option>
            {replaceable.map((m) => (
              <option key={m.id} value={m.id}>
                {label(materialKindLabels, m.kind)} · {m.issueNote ?? ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {add.error && (
        <p role="alert">
          {errorText(
            add.error,
            add.error instanceof Error
              ? add.error.message
              : "자료를 내지 못했어요.",
          )}
        </p>
      )}
      <Button type="submit" disabled={add.isPending}>
        자료 내기
      </Button>
    </form>
  );
}

// WORK-02: 납기 변경 요청과 상대방 승인·거절
function DeadlinePanel({
  production,
  onDone,
}: {
  production: Production;
  onDone: (next: Production) => void;
}) {
  const { user } = useSession();
  const request = useMutation({
    mutationFn: (form: FormData) =>
      kemi.requestDeadline(production.contractId, {
        newDueDate: String(form.get("newDueDate") ?? ""),
        reason: String(form.get("reason") ?? "").trim(),
      }),
    onSuccess: onDone,
  });
  const answer = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      kemi.answerDeadline(production.contractId, id, approve),
    onSuccess: onDone,
  });
  return (
    <Card title="납기">
      <Facts
        items={[
          ["작업 일수", `${production.workingDays}일`],
          [
            "납품 기한",
            production.dueDate
              ? dateOnly(production.dueDate)
              : "제작 시작 때 정해져요",
          ],
        ]}
      />
      <ul className="grid gap-2">
        {production.deadlineChanges.map((change) => (
          <li key={change.id} className="flex flex-wrap items-center gap-3">
            <span>
              {dateOnly(change.previousDueDate)} → {dateOnly(change.newDueDate)}{" "}
              · {change.reason}
            </span>
            <Badge variant="secondary">
              {
                {
                  PENDING: "답변 대기",
                  APPROVED: "승인됨",
                  REJECTED: "거절됨",
                }[change.status]
              }
            </Badge>
            {change.status === "PENDING" && change.requestedBy !== user?.id && (
              <>
                <Button
                  size="sm"
                  disabled={answer.isPending}
                  onClick={() =>
                    answer.mutate({ id: change.id, approve: true })
                  }
                >
                  승인
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={answer.isPending}
                  onClick={() =>
                    answer.mutate({ id: change.id, approve: false })
                  }
                >
                  거절
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {production.status === "IN_PROGRESS" && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            request.mutate(new FormData(event.currentTarget));
          }}
        >
          <Field id="deadline-date" label="새 납품 기한">
            <Input id="deadline-date" name="newDueDate" type="date" required />
          </Field>
          <Field id="deadline-reason" label="사유">
            <Input
              id="deadline-reason"
              name="reason"
              required
              maxLength={1000}
            />
          </Field>
          <Button type="submit" variant="outline" disabled={request.isPending}>
            납기 변경 요청
          </Button>
        </form>
      )}
      {(request.error ?? answer.error) && (
        <p role="alert">{errorText(request.error ?? answer.error)}</p>
      )}
    </Card>
  );
}

// READY-01·02, WORK-01·02: 제작 준비·시작·납기 (실제 API)
export default function ProductionLive({ contractId }: { contractId: string }) {
  const { role } = useSession();
  const client = useQueryClient();
  const key = ["production", contractId];
  const production = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => kemi.production(contractId, signal),
  });
  const update = (next: Production) => client.setQueryData(key, next);
  const act = useMutation({
    mutationFn: (run: () => Promise<Production>) => run(),
    onSuccess: update,
  });
  const [issue, setIssue] = useState<Record<string, string>>({});
  if (production.isPending)
    return <Loading text="제작 정보를 불러오고 있어요." />;
  if (production.error) return <Failure error={production.error} />;
  const p = production.data;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-heading-lg">제작 준비</h1>
        <Badge variant="secondary">
          {label(productionStatusLabels, p.status)}
        </Badge>
      </div>
      <Card title="시작 조건">
        <Facts
          items={[
            ["결제", p.paid ? "완료" : "대기"],
            [
              "자료 확인",
              p.materials.some((m) => m.status === "CONFIRMED")
                ? "확인된 자료 있음"
                : "확인 대기",
            ],
            ["제작 시작", p.startedAt ? dateTime(p.startedAt) : "시작 전"],
          ]}
        />
        {!p.paid && role === "client" && (
          <Button asChild>
            <Link to={`/contracts/${contractId}/payment`}>테스트 결제하기</Link>
          </Button>
        )}
        {role === "creator" && p.status === "PREPARING" && (
          <Button
            disabled={!p.readyToStart || act.isPending}
            onClick={() => act.mutate(() => kemi.startProduction(contractId))}
          >
            제작 시작
          </Button>
        )}
        {role === "creator" && p.status === "PREPARING" && !p.readyToStart && (
          <p className="text-muted-foreground">
            결제가 끝나고 자료를 확인하면 제작을 시작할 수 있어요.
          </p>
        )}
      </Card>
      <Card title="자료">
        {p.materials.length === 0 && <p>아직 낸 자료가 없어요.</p>}
        <ul className="grid gap-3">
          {p.materials.map((m) => (
            <li
              key={m.id}
              className="grid gap-2 rounded-xl border border-input p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="type-label-md">
                  {label(materialKindLabels, m.kind)}
                </span>
                <Badge variant="secondary">
                  {label(materialStatusLabels, m.status)}
                </Badge>
                <span className="text-muted-foreground">
                  {dateTime(m.createdAt)}
                </span>
              </div>
              {m.kind === "SHIPMENT" && (
                <p>
                  {m.carrier} · {m.trackingNumber}
                </p>
              )}
              {m.note && <p className="whitespace-pre-wrap">{m.note}</p>}
              {m.fileId && (
                <Button
                  variant="link"
                  className="justify-self-start p-0"
                  onClick={() => openFile(m.fileId ?? "")}
                >
                  파일 열기
                </Button>
              )}
              {m.issueNote && <p>문제: {m.issueNote}</p>}
              {role === "creator" &&
                p.status === "PREPARING" &&
                m.status === "SUBMITTED" && (
                  <div className="flex flex-wrap items-end gap-3">
                    <Button
                      size="sm"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(() => kemi.confirmMaterial(contractId, m.id))
                      }
                    >
                      정상 확인
                    </Button>
                    <Input
                      aria-label="문제 내용"
                      className="max-w-xs"
                      placeholder="문제 내용"
                      value={issue[m.id] ?? ""}
                      onChange={(event) =>
                        setIssue((prev) => ({
                          ...prev,
                          [m.id]: event.target.value,
                        }))
                      }
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={act.isPending || !(issue[m.id] ?? "").trim()}
                      onClick={() =>
                        act.mutate(() =>
                          kemi.reportMaterial(
                            contractId,
                            m.id,
                            (issue[m.id] ?? "").trim(),
                          ),
                        )
                      }
                    >
                      문제 신고
                    </Button>
                  </div>
                )}
            </li>
          ))}
        </ul>
        {role === "client" && p.status === "PREPARING" && (
          <MaterialForm production={p} onDone={update} />
        )}
        {act.error && <p role="alert">{errorText(act.error)}</p>}
      </Card>
      <DeadlinePanel production={p} onDone={update} />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to={`/contracts/${contractId}/deliveries`}>납품·수정으로</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to={`/requests/${p.workRequestId}`}>대화로</Link>
        </Button>
      </div>
    </>
  );
}
