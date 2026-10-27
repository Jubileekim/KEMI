import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import type { CancellationOverview, Dispute } from "@kemi/shared";
import { useSession } from "../../app/session";
import Badge from "../../components/ui/badge";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi } from "../../shared/api/kemi";
import { openFile } from "../../shared/api/upload";
import {
  cancellationStatusLabels,
  dateTime,
  label,
  refundStatusLabels,
  won,
} from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText } from "../live/errors";

const linesOf = (text: string) =>
  text
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[1-9]\d*$/.test(s));

function DisputeItem({
  contractId,
  dispute,
  onDone,
}: {
  contractId: string;
  dispute: Dispute;
  onDone: (next: CancellationOverview) => void;
}) {
  const evidence = useMutation({
    mutationFn: (note: string) =>
      kemi.addEvidence(contractId, dispute.id, { note }),
    onSuccess: onDone,
  });
  return (
    <li className="grid gap-2 rounded-xl border border-input p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-label-md">분쟁</span>
        <Badge variant="secondary">
          {dispute.status === "OPEN" ? "검토 중" : "처리 완료"}
        </Badge>
        <span className="text-muted-foreground">
          {dateTime(dispute.createdAt)}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{dispute.reason}</p>
      {dispute.evidence.map((e) => (
        <p key={e.id} className="text-sm">
          증빙: {e.note}
          {e.fileIds.map((id, i) => (
            <Button
              key={id}
              variant="link"
              size="sm"
              className="p-1"
              onClick={() => openFile(id)}
            >
              파일 {i + 1}
            </Button>
          ))}
        </p>
      ))}
      {dispute.resolution && <p>운영 처리: {dispute.resolution}</p>}
      {dispute.status === "OPEN" && (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const el = event.currentTarget;
            const note = String(new FormData(el).get("note") ?? "").trim();
            if (note) evidence.mutate(note, { onSuccess: () => el.reset() });
          }}
        >
          <Textarea
            aria-label="증빙 설명"
            name="note"
            rows={2}
            maxLength={2000}
            required
          />
          {evidence.error && <p role="alert">{errorText(evidence.error)}</p>}
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={evidence.isPending}
            className="justify-self-start"
          >
            증빙 추가
          </Button>
        </form>
      )}
    </li>
  );
}

// CANCEL-01·02, REFUND-01, DISPUTE-01: 취소 합의·환불·분쟁 (실제 API)
export default function CancellationLive({
  contractId,
}: {
  contractId: string;
}) {
  const { user, role } = useSession();
  const client = useQueryClient();
  const key = ["cancellation", contractId];
  const overview = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => kemi.cancellation(contractId, signal),
  });
  const update = (next: CancellationOverview) => client.setQueryData(key, next);
  const act = useMutation({
    mutationFn: (run: () => Promise<CancellationOverview>) => run(),
    onSuccess: update,
  });
  const propose = useMutation({
    mutationFn: (form: FormData) => {
      const text = (name: string) => String(form.get(name) ?? "").trim();
      return kemi.proposeCancellation(contractId, {
        reason: text("reason"),
        completedWorkKrw: Number(text("completedWorkKrw") || 0),
        refundKrw: Number(text("refundKrw") || 0),
        deliveredFileIds: linesOf(text("deliveredFileIds")),
        ...(text("unfinishedState")
          ? { unfinishedState: text("unfinishedState") }
          : {}),
        ...(text("usageRights") ? { usageRights: text("usageRights") } : {}),
      });
    },
    onSuccess: update,
  });
  const dispute = useMutation({
    mutationFn: (reason: string) => kemi.openDispute(contractId, { reason }),
    onSuccess: update,
  });
  if (overview.isPending)
    return <Loading text="취소·분쟁 정보를 불러오고 있어요." />;
  if (overview.error) return <Failure error={overview.error} />;
  const o = overview.data;
  const accepted = o.cancellations.find((c) => c.status === "ACCEPTED");
  const pending = o.cancellations.find((c) => c.status === "PROPOSED");
  const openDispute = o.disputes.some((d) => d.status === "OPEN");
  return (
    <>
      <h1 className="type-heading-lg">취소·환불·분쟁</h1>
      <Card title="현재 상태">
        <Facts
          items={[
            ["계약", o.contractStatus === "CANCELED" ? "취소됨" : "진행 중"],
            ["결제 금액", won(o.paidKrw)],
            ["정산 보류 사유", o.settlementHold ?? "없음"],
          ]}
        />
      </Card>
      <Card title="취소 합의">
        {o.cancellations.length === 0 && <p>취소 제안이 없어요.</p>}
        <ul className="grid gap-3">
          {o.cancellations.map((c) => (
            <li
              key={c.id}
              className="grid gap-2 rounded-xl border border-input p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-label-md">{c.versionNo}번째 제안</span>
                <Badge variant="secondary">
                  {label(cancellationStatusLabels, c.status)}
                </Badge>
                <span className="text-muted-foreground">
                  {c.proposedBy === user?.id ? "내 제안" : "상대 제안"}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{c.reason}</p>
              <p className="text-muted-foreground">
                완료 작업 대가 {won(c.completedWorkKrw)} · 환불{" "}
                {won(c.refundKrw)}
              </p>
              {c.refund && (
                <p>
                  환불: {label(refundStatusLabels, c.refund.status)} (
                  {won(c.refund.amountKrw)}, {c.refund.attempt}번째 시도)
                  {c.refund.failureMessage
                    ? ` · ${c.refund.failureMessage}`
                    : ""}
                </p>
              )}
              {c.status === "PROPOSED" && (
                <div className="flex flex-wrap gap-2">
                  {c.proposedBy === user?.id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={act.isPending}
                      onClick={() =>
                        act.mutate(() =>
                          kemi.answerCancellation(contractId, c.id, "withdraw"),
                        )
                      }
                    >
                      제안 거두기
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate(() =>
                            kemi.answerCancellation(contractId, c.id, "accept"),
                          )
                        }
                      >
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={act.isPending}
                        onClick={() =>
                          act.mutate(() =>
                            kemi.answerCancellation(contractId, c.id, "reject"),
                          )
                        }
                      >
                        거절
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {accepted?.refund?.status === "FAILED" && (
          <Button
            disabled={act.isPending}
            onClick={() => act.mutate(() => kemi.retryRefund(contractId))}
          >
            환불 다시 요청
          </Button>
        )}
        {(accepted?.refund?.status === "UNKNOWN" ||
          accepted?.refund?.status === "REQUESTED") && (
          <Button
            variant="outline"
            disabled={act.isPending}
            onClick={() => act.mutate(() => kemi.syncRefund(contractId))}
          >
            환불 결과 확인
          </Button>
        )}
        {accepted &&
          accepted.deliveredFileIds.length > 0 &&
          !accepted.handoverConfirmedAt &&
          role === "client" && (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                {accepted.deliveredFileIds.map((id, i) => (
                  <Button
                    key={id}
                    size="sm"
                    variant="link"
                    className="p-0"
                    onClick={() => openFile(id)}
                  >
                    인도 파일 {i + 1}
                  </Button>
                ))}
              </div>
              <Button
                disabled={act.isPending}
                onClick={() =>
                  act.mutate(() => kemi.confirmHandover(contractId))
                }
              >
                인도 파일 수령 확인
              </Button>
            </div>
          )}
        {act.error && <p role="alert">{errorText(act.error)}</p>}
        {o.contractStatus !== "CANCELED" && !pending && (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const el = event.currentTarget;
              propose.mutate(new FormData(el), { onSuccess: () => el.reset() });
            }}
          >
            <h3 className="type-title">취소 제안하기</h3>
            <Field id="cancel-reason" label="사유">
              <Textarea
                id="cancel-reason"
                name="reason"
                rows={3}
                required
                maxLength={2000}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id="cancel-work"
                label="완료 작업 대가 (원)"
                hint="대가 + 환불 = 결제 금액이어야 해요."
              >
                <Input
                  id="cancel-work"
                  name="completedWorkKrw"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={0}
                />
              </Field>
              <Field id="cancel-refund" label="환불액 (원)">
                <Input
                  id="cancel-refund"
                  name="refundKrw"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={o.paidKrw}
                />
              </Field>
            </div>
            <Field
              id="cancel-files"
              label="인도할 파일 번호 (선택, 쉼표로 구분)"
              hint="크리에이터가 올린 납품 파일 번호"
            >
              <Input id="cancel-files" name="deliveredFileIds" />
            </Field>
            <Field id="cancel-state" label="미완성 상태 (선택)">
              <Input
                id="cancel-state"
                name="unfinishedState"
                maxLength={2000}
              />
            </Field>
            <Field id="cancel-rights" label="사용권 합의 (선택)">
              <Input id="cancel-rights" name="usageRights" maxLength={2000} />
            </Field>
            {propose.error && (
              <p role="alert">
                {errorText(propose.error, "취소를 제안하지 못했어요.")}
              </p>
            )}
            <Button
              type="submit"
              variant="outline"
              disabled={propose.isPending}
            >
              취소 제안 보내기
            </Button>
          </form>
        )}
      </Card>
      <Card title="분쟁">
        <ul className="grid gap-3">
          {o.disputes.map((d) => (
            <DisputeItem
              key={d.id}
              contractId={contractId}
              dispute={d}
              onDone={update}
            />
          ))}
        </ul>
        {!openDispute && (
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const el = event.currentTarget;
              const reason = String(
                new FormData(el).get("reason") ?? "",
              ).trim();
              if (reason)
                dispute.mutate(reason, { onSuccess: () => el.reset() });
            }}
          >
            <Field
              id="dispute-reason"
              label="분쟁 신고 사유"
              hint="분쟁 중에는 정산이 보류되고, 대화·납품은 계속돼요."
            >
              <Textarea
                id="dispute-reason"
                name="reason"
                rows={3}
                required
                maxLength={2000}
              />
            </Field>
            {dispute.error && <p role="alert">{errorText(dispute.error)}</p>}
            <Button
              type="submit"
              variant="outline"
              disabled={dispute.isPending}
              className="justify-self-start"
            >
              분쟁 신고
            </Button>
          </form>
        )}
      </Card>
      <Button asChild variant="ghost">
        <Link to={`/contracts/${contractId}/deliveries`}>납품으로</Link>
      </Button>
    </>
  );
}
