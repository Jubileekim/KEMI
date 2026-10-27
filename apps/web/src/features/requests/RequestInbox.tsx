import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { session, useSession } from "../../app/session";
import Button from "../../components/ui/button";
import Label from "../../components/ui/label";
import Textarea from "../../components/ui/textarea";
import ProposalConfirm from "../../mocks/ProposalConfirm";
import type { Proposal } from "../../mocks/proposal-model";
import { respondToDirect } from "../../mocks/direct-api";
import type { DirectResponse } from "../../mocks/direct-contract";

export default function RequestInbox({ item }: { item: Proposal }) {
  const { user } = useSession();
  const cache = useQueryClient();
  const [reason, setReason] = useState("");
  const [elapsed, setElapsed] = useState(false);
  const [notice, setNotice] = useState("");
  const mutation = useMutation({ mutationFn: respondToDirect });
  const due = item.direct?.respondDueAt;
  useEffect(() => {
    if (!due || item.status !== "PENDING") return undefined;
    const timer = setTimeout(
      () => {
        setElapsed(true);
        cache.invalidateQueries({ queryKey: ["mock-proposals"] });
      },
      Math.max(0, Date.parse(due) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [due, item.status, cache]);
  if (!item.direct || item.status !== "PENDING") return null;
  const expired = elapsed;
  const answer = (action: DirectResponse["action"], done: () => void) => {
    const epoch = session.epoch();
    setNotice("");
    mutation.mutate(
      {
        id: item.id,
        revision: item.revision,
        action,
        reason: action === "decline" ? reason : "",
      },
      {
        onSuccess: async () => {
          if (epoch !== session.epoch()) return;
          done();
          await cache.invalidateQueries({ queryKey: ["mock-proposals"] });
        },
        onError: () => {
          if (epoch !== session.epoch()) return;
          setNotice(
            "응답 여부를 확인하지 못했어요. 최신 의뢰 확인 후 같은 응답을 다시 확인해 주세요. 기한·수신자·변경 상태도 확인해 주세요.",
          );
        },
      },
    );
  };
  return (
    <section
      className="grid gap-3 rounded-xl border p-4"
      aria-label="직접 의뢰 최초 응답"
    >
      {expired ? (
        <p role="status">
          최초 응답 48시간이 지나 수락할 수 없어요. 최신 의뢰에서 만료 상태를
          확인해 주세요.
        </p>
      ) : (
        <p>응답 대기 · 수락은 협의 시작이며 계약·결제는 생성하지 않아요.</p>
      )}
      {user?.role === "CREATOR" && !expired && (
        <>
          <Label htmlFor={`direct-reason-${item.id}`}>
            거절 사유 (선택·Mock)
          </Label>
          <Textarea
            id={`direct-reason-${item.id}`}
            maxLength={4000}
            disabled={mutation.isPending}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <ProposalConfirm
              label="직접 의뢰 협의 수락"
              description="이 의뢰의 대화·조건서 작업 공간을 열어요. 계약 확정은 같은 최종 조건에 대한 양측 서명 뒤에만 가능해요."
              busy={mutation.isPending}
              error={notice}
              onConfirm={(_, done) => answer("accept", done)}
            />
            <ProposalConfirm
              label="직접 의뢰 거절"
              description="이번 최초 의뢰를 종료해요. 계약과 결제는 생성되지 않아요."
              busy={mutation.isPending}
              error={notice}
              onConfirm={(_, done) => answer("decline", done)}
            />
          </div>
        </>
      )}
      <Button
        variant="outline"
        disabled={mutation.isPending}
        onClick={() =>
          cache.invalidateQueries({ queryKey: ["mock-proposals"] })
        }
      >
        직접 의뢰 최신 응답 확인
      </Button>
      {notice && <p role="alert">{notice}</p>}
    </section>
  );
}
