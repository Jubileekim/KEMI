import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import Textarea from "../components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import { session, useSession } from "../app/session";
import { ApiError } from "../shared/api/client";
import loadCatalog from "./catalog-api";
import sendDirect from "./direct-api";
import {
  directValuesSchema,
  type DirectValues,
  type DirectSend,
} from "./direct-contract";

export default function DirectMock() {
  const { creatorId = "" } = useParams();
  const [params] = useSearchParams();
  const { user } = useSession();
  const [review, setReview] = useState<DirectSend | null>(null);
  const [pending, setPending] = useState<DirectSend | null>(null);
  const [sent, setSent] = useState("");
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["mock-direct-source", session.epoch(), creatorId],
    queryFn: ({ signal }) =>
      loadCatalog(new URLSearchParams({ creatorId }).toString(), signal),
  });
  const pack = query.data?.creator?.packages.find(
    (p) => p.id === params.get("packageId"),
  );
  const mutation = useMutation({ mutationFn: sendDirect });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DirectValues>({
    resolver: zodResolver(directValuesSchema),
    defaultValues: { title: "", brief: "", conditions: "" },
  });
  const busy = mutation.isPending || query.isFetching;
  const submit = (command: DirectSend) => {
    const epoch = session.epoch();
    setPending(command);
    setNotice("");
    mutation.mutate(command, {
      onSuccess: ({ id }) => {
        if (epoch !== session.epoch()) return;
        setSent(id);
        setPending(null);
        setReview(null);
      },
      onError: (error) => {
        if (epoch !== session.epoch()) return;
        setReview(null);
        if (
          error instanceof ApiError &&
          [400, 401, 403, 404, 409].includes(error.status)
        )
          setPending(null);
        setNotice(
          "발송 결과를 확인하지 못했어요. 입력은 유지돼요. 목록에서 발송 여부를 확인하거나 같은 요청을 재시도해 주세요. 패키지 변경·권한 오류는 최신 상태를 확인하고 다시 검토해 주세요.",
        );
      },
    });
  };
  return (
    <section className="showcase-card grid min-w-0 gap-5">
      <h1 className="type-heading-lg">직접 의뢰 보내기</h1>
      <p>
        개발용 Mock · 실제 의뢰·알림은 발송되지 않아요. 개인 의뢰인도 브랜드
        정보 없이 보낼 수 있어요.
      </p>
      <Link to={`/creators/${encodeURIComponent(creatorId)}`}>
        제작자·패키지 다시 보기
      </Link>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setReview(null);
          query.refetch();
        }}
      >
        발송 전 최신 패키지 확인
      </Button>
      {query.isFetching && <p role="status">공개 패키지를 확인하고 있어요.</p>}
      {(query.error || (query.data && !pack)) && (
        <p role="alert">
          선택한 제작자의 공개 패키지를 확인할 수 없어요. 제작자 화면에서 다시
          선택해 주세요.
        </p>
      )}
      {pack && !query.error && !sent && (
        <>
          <h2 className="type-heading-md">
            {query.data?.creator?.name} · {pack.title}
          </h2>
          <p>
            협의 시작 가격 {Number(pack.price).toLocaleString("ko-KR")}원 ·{" "}
            {pack.days}일 · 수정 {pack.revisions}회
          </p>
          <p>
            발송 시점의 패키지 사본을 보존해요. 최초 응답 기한은 발송 후
            48시간이며, 수락은 협의 시작이에요. 계약·결제는 별도예요.
          </p>
          <form
            className="grid gap-4"
            onSubmit={handleSubmit((values) => {
              if (!pack || busy || pending) return;
              setReview({
                id: crypto.randomUUID(),
                creatorId,
                packageId: pack.id,
                snapshot: pack,
                values,
              });
            })}
          >
            {(
              [
                ["title", "의뢰 제목"],
                ["brief", "제작 브리프"],
                ["conditions", "희망 조건"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid gap-2">
                <Label htmlFor={`direct-${key}`}>{label}</Label>
                <Textarea
                  id={`direct-${key}`}
                  {...register(key)}
                  maxLength={4000}
                  disabled={busy || !!pending}
                  aria-invalid={!!errors[key]}
                  aria-describedby={
                    errors[key] ? `direct-error-${key}` : undefined
                  }
                />
                {errors[key] && (
                  <p id={`direct-error-${key}`} role="alert">
                    {label}을 입력해 주세요 (Mock 최대 4000자).
                  </p>
                )}
              </div>
            ))}
            <Button type="submit" disabled={busy || !!pending}>
              의뢰 내용 검토
            </Button>
          </form>
        </>
      )}
      {notice && <p role="alert">{notice}</p>}
      {pending && !busy && (
        <Button onClick={() => submit(pending)}>같은 발송 다시 확인</Button>
      )}
      {(sent || pending) && (
        <Link to={sent ? `/requests/${sent}` : "/requests"}>
          내 의뢰에서 발송 결과 확인
        </Link>
      )}
      {sent && (
        <p role="status">
          모의 의뢰 발송 응답을 확인했어요. 계약·결제는 생성하지 않았어요.
        </p>
      )}
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!open && !busy) setReview(null);
        }}
      >
        <DialogContent>
          <DialogTitle>직접 의뢰 발송 검토</DialogTitle>
          <DialogDescription>
            공개 공고 없이 선택한 제작자에게 보내요. 최초 응답 48시간 · 수락은
            계약 확정이 아니에요.
          </DialogDescription>
          {review && (
            <div className="grid gap-4 break-words">
              <h2>
                {review.snapshot.title} · {review.snapshot.price}원
              </h2>
              <p>{review.values.title}</p>
              <p className="whitespace-pre-wrap">{review.values.brief}</p>
              <p className="whitespace-pre-wrap">{review.values.conditions}</p>
              <Button
                disabled={busy || !!pending}
                onClick={() => submit(review)}
              >
                모의 직접 의뢰 발송
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                입력으로 돌아가기
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <p className="text-sm text-muted-foreground">
        입력 제한·발송 중복 복구 방식은 Mock 검토 예시이며 최종 API 정책은
        조율이 필요해요.
      </p>
      {user?.role !== "CLIENT" && (
        <p role="alert">의뢰인 로그인 상태를 확인해 주세요.</p>
      )}
    </section>
  );
}
