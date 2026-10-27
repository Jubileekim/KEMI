import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  REVISION_TYPES,
  type Delivery,
  type DeliverableKind,
  type RevisionType,
} from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi, newCommandId } from "../../shared/api/kemi";
import { openFile, uploadFile } from "../../shared/api/upload";
import {
  dateTime,
  deliverableKindLabels,
  deliverableStatusLabels,
  label,
  productionStatusLabels,
  revisionTypeLabels,
} from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";

const KINDS: DeliverableKind[] = ["DRAFT", "REVIEW", "FINAL"];

// DEL-01·02: 크리에이터가 버전을 올린다(파일 업로드 → 확인 → 제출).
function SubmitForm({
  delivery,
  onDone,
}: {
  delivery: Delivery;
  onDone: (next: Delivery) => void;
}) {
  const [commandId, setCommandId] = useState(newCommandId);
  const [kind, setKind] = useState<DeliverableKind>("REVIEW");
  const submit = useMutation({
    mutationFn: async (form: FormData) => {
      const files = form
        .getAll("files")
        .filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length === 0)
        throw new Error("파일을 하나 이상 선택해 주세요.");
      const stored = await Promise.all(
        files.map((file) =>
          uploadFile(file, "DELIVERABLE", delivery.workRequestId),
        ),
      );
      const note = String(form.get("note") ?? "").trim();
      return kemi.submitDeliverable(delivery.contractId, {
        commandId,
        kind,
        fileIds: stored.map((s) => s.id),
        ...(note ? { note } : {}),
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
        const el = event.currentTarget;
        submit.mutate(new FormData(el), { onSuccess: () => el.reset() });
      }}
    >
      <Field id="deliverable-kind" label="버전 종류">
        <select
          id="deliverable-kind"
          className={selectClass}
          value={kind}
          onChange={(event) =>
            setKind(KINDS.find((k) => k === event.target.value) ?? "REVIEW")
          }
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {label(deliverableKindLabels, k)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="deliverable-files" label="파일 (최대 10개)">
        <Input
          id="deliverable-files"
          name="files"
          type="file"
          multiple
          required
        />
      </Field>
      <Field id="deliverable-note" label="메모 (선택)">
        <Textarea id="deliverable-note" name="note" rows={2} maxLength={2000} />
      </Field>
      {submit.error && (
        <p role="alert">
          {errorText(
            submit.error,
            submit.error instanceof Error
              ? submit.error.message
              : "버전을 올리지 못했어요.",
          )}
        </p>
      )}
      <Button type="submit" disabled={submit.isPending}>
        {submit.isPending ? "올리는 중…" : "버전 제출"}
      </Button>
    </form>
  );
}

// REV-01: 의뢰인의 수정 요청(체크리스트 한 줄 이상)
function RevisionForm({
  delivery,
  deliverableId,
  onDone,
}: {
  delivery: Delivery;
  deliverableId: string;
  onDone: (next: Delivery) => void;
}) {
  const [commandId, setCommandId] = useState(newCommandId);
  const [type, setType] = useState<RevisionType>("GENERAL");
  const send = useMutation({
    mutationFn: (form: FormData) =>
      kemi.requestRevision(delivery.contractId, deliverableId, {
        commandId,
        type,
        items: [
          {
            position: String(form.get("position") ?? "").trim() || undefined,
            problem: String(form.get("problem") ?? "").trim(),
            desired: String(form.get("desired") ?? "").trim(),
          },
        ],
      }),
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
        const el = event.currentTarget;
        send.mutate(new FormData(el), { onSuccess: () => el.reset() });
      }}
    >
      <Field id={`revision-type-${deliverableId}`} label="수정 종류">
        <select
          id={`revision-type-${deliverableId}`}
          className={selectClass}
          value={type}
          onChange={(event) =>
            setType(
              REVISION_TYPES.find((t) => t === event.target.value) ?? "GENERAL",
            )
          }
        >
          {REVISION_TYPES.map((t) => (
            <option key={t} value={t}>
              {label(revisionTypeLabels, t)}
            </option>
          ))}
        </select>
      </Field>
      <Field
        id={`revision-position-${deliverableId}`}
        label="영상 위치 (예: 01:23, 선택)"
      >
        <Input
          id={`revision-position-${deliverableId}`}
          name="position"
          maxLength={50}
        />
      </Field>
      <Field id={`revision-problem-${deliverableId}`} label="현재 문제">
        <Textarea
          id={`revision-problem-${deliverableId}`}
          name="problem"
          rows={2}
          required
          maxLength={1000}
        />
      </Field>
      <Field id={`revision-desired-${deliverableId}`} label="원하는 변경">
        <Textarea
          id={`revision-desired-${deliverableId}`}
          name="desired"
          rows={2}
          required
          maxLength={1000}
        />
      </Field>
      {send.error && (
        <p role="alert">
          {errorText(send.error, "수정 요청을 보내지 못했어요.")}
        </p>
      )}
      <Button type="submit" variant="outline" disabled={send.isPending}>
        수정 요청 보내기
      </Button>
    </form>
  );
}

// DEL-01~05·REV-01~02: 검토·수정·최종 수령 (실제 API)
export default function DeliveryLive({ contractId }: { contractId: string }) {
  const { role } = useSession();
  const client = useQueryClient();
  const key = ["delivery", contractId];
  const delivery = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => kemi.delivery(contractId, signal),
  });
  const update = (next: Delivery) => client.setQueryData(key, next);
  const act = useMutation({
    mutationFn: (run: () => Promise<Delivery>) => run(),
    onSuccess: update,
  });
  const [revising, setRevising] = useState<string | null>(null);
  if (delivery.isPending)
    return <Loading text="납품 정보를 불러오고 있어요." />;
  if (delivery.error) return <Failure error={delivery.error} />;
  const d = delivery.data;
  const latest = d.deliverables.at(-1);
  const inProgress = d.productionStatus === "IN_PROGRESS";
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="type-heading-lg">납품·수정</h1>
        <Badge variant="secondary">
          {label(productionStatusLabels, d.productionStatus)}
        </Badge>
      </div>
      <Card title="수정 회차">
        <Facts
          items={[
            ["일반 수정", `${d.revisionLimit}회 중 ${d.revisionsUsed}회 사용`],
            ["남은 회차", `${d.revisionsRemaining}회`],
          ]}
        />
      </Card>
      <Card title="버전">
        {d.deliverables.length === 0 && <p>아직 올라온 버전이 없어요.</p>}
        <ol className="grid gap-3">
          {d.deliverables.map((item) => (
            <li
              key={item.id}
              className="grid gap-2 rounded-xl border border-input p-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="type-label-md">
                  {item.versionNo}번째 ·{" "}
                  {label(deliverableKindLabels, item.kind)}
                </span>
                <Badge variant="secondary">
                  {label(deliverableStatusLabels, item.status)}
                </Badge>
                <span className="text-muted-foreground">
                  {dateTime(item.createdAt)}
                </span>
              </div>
              {item.note && <p className="whitespace-pre-wrap">{item.note}</p>}
              <div className="flex flex-wrap gap-2">
                {item.fileIds.map((fileId, index) => (
                  <Button
                    key={fileId}
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={() => openFile(fileId)}
                  >
                    파일 {index + 1} 열기
                  </Button>
                ))}
              </div>
              {role === "client" &&
                inProgress &&
                item.id === latest?.id &&
                item.status === "SUBMITTED" && (
                  <div className="flex flex-wrap gap-3">
                    {item.kind === "REVIEW" && (
                      <Button
                        size="sm"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate(() =>
                            kemi.approveDeliverable(contractId, item.id),
                          )
                        }
                      >
                        검토본 승인
                      </Button>
                    )}
                    {item.kind === "FINAL" && (
                      <Button
                        size="sm"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate(() =>
                            kemi.receiveDeliverable(contractId, item.id),
                          )
                        }
                      >
                        최종본 수령 확인
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setRevising(revising === item.id ? null : item.id)
                      }
                    >
                      수정 요청
                    </Button>
                  </div>
                )}
              {revising === item.id && (
                <RevisionForm
                  delivery={d}
                  deliverableId={item.id}
                  onDone={(next) => {
                    setRevising(null);
                    update(next);
                  }}
                />
              )}
            </li>
          ))}
        </ol>
        {act.error && <p role="alert">{errorText(act.error)}</p>}
      </Card>
      {d.revisionRequests.length > 0 && (
        <Card title="수정 요청">
          <ul className="grid gap-3">
            {d.revisionRequests.map((r) => (
              <li key={r.id} className="grid gap-1">
                <span className="type-label-md">
                  {label(revisionTypeLabels, r.type)} ·{" "}
                  {r.status === "OPEN" ? "진행 중" : "반영됨"}
                </span>
                {r.items.map((it) => (
                  <p key={`${r.id}-${it.problem}`}>
                    {it.position ? `[${it.position}] ` : ""}
                    {it.problem} → {it.desired}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {role === "creator" && inProgress && (
        <Card title="새 버전 올리기">
          <SubmitForm delivery={d} onDone={update} />
        </Card>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to={`/contracts/${contractId}/settlement`}>정산·리뷰</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to={`/requests/${d.workRequestId}`}>대화로</Link>
        </Button>
      </div>
    </>
  );
}
