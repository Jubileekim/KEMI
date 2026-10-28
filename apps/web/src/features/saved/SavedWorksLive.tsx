import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  BULK_INQUIRY_MAX,
  bulkInquiryCreateSchema,
  type BulkInquiryResponse,
  type WorkBookmark,
} from "@kemi/shared";
import Button from "../../components/ui/button";
import { kemi } from "../../shared/api/kemi";
import track from "../../shared/analytics/track";
import { bulkResultLabels, label, won } from "../live/labels";
import { Card, Failure, Loading } from "../live/ui";
import { errorText } from "../live/errors";
import ConditionFields from "./ConditionFields";
import readConditions from "./conditions";

function Results({
  result,
  onDone,
}: {
  result: BulkInquiryResponse;
  onDone: () => void;
}) {
  const sent = result.results.filter((r) => r.status === "SENT").length;
  return (
    <Card title={`일괄 문의 결과 · ${sent}명에게 보냈어요`}>
      <ul className="grid gap-3">
        {result.results.map((r) => (
          <li key={r.portfolioId} className="grid gap-1">
            <p className="font-medium">
              {r.portfolioTitle ?? "작품"}
              {r.creatorName ? ` · ${r.creatorName}` : ""}
            </p>
            <p className="text-sm">{label(bulkResultLabels, r.status)}</p>
            {r.request && (
              <Link to={`/requests/${r.request.id}`} className="underline">
                의뢰 진행 보기
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        크리에이터마다 48시간 안에 수락·거절을 알려줘요. 수락한 크리에이터와
        대화방에서 조건을 맞춘 뒤 계약해요.
      </p>
      <Button variant="outline" className="justify-self-start" onClick={onDone}>
        저장함으로 돌아가기
      </Button>
    </Card>
  );
}

function WorkRow({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: WorkBookmark;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const cache = useQueryClient();
  const remove = useMutation({
    mutationFn: () => kemi.unsaveWork(item.portfolio.id),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["work-bookmarks"] }),
  });
  const id = `saved-${item.portfolio.id}`;
  return (
    <li className="showcase-card flex flex-wrap items-center gap-3">
      <input
        id={id}
        type="checkbox"
        className="size-5 accent-primary"
        checked={checked}
        disabled={!item.available || disabled}
        onChange={onToggle}
      />
      <label htmlFor={id} className="grid min-w-0 flex-1 gap-1">
        <span className="type-title">{item.portfolio.title}</span>
        <span className="text-sm text-muted-foreground">
          {item.creator.name}
          {item.startingPriceKrw ? ` · ${won(item.startingPriceKrw)}부터` : ""}
          {item.available ? "" : " · 지금은 의뢰할 수 없어요"}
        </span>
      </label>
      <Button asChild variant="outline" size="sm">
        <Link to={`/works/${item.portfolio.id}`}>작품 보기</Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={remove.isPending}
        onClick={() => remove.mutate()}
      >
        저장 해제
      </Button>
    </li>
  );
}

// SAVE-01·INQ-01: 저장한 작품을 골라, 그 작품의 제작자들에게 같은 조건으로 한 번에 문의한다.
export default function SavedWorksLive() {
  const cache = useQueryClient();
  // 같은 발송을 다시 눌러도 중복되지 않게, 결과를 받을 때까지 같은 요청 ID를 쓴다.
  const commandId = useRef(crypto.randomUUID());
  const [selected, setSelected] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<BulkInquiryResponse>();
  const list = useQuery({
    queryKey: ["work-bookmarks"],
    queryFn: ({ signal }) => kemi.workBookmarks(signal),
  });
  const send = useMutation({
    mutationFn: (body: Parameters<typeof kemi.sendBulkInquiry>[0]) =>
      kemi.sendBulkInquiry(body),
    onSuccess: (response) => {
      response.results
        .filter((r) => r.request)
        .forEach((r) => track("request_sent", r.request?.id ?? ""));
      setResult(response);
      setSelected([]);
      commandId.current = crypto.randomUUID();
      cache.invalidateQueries({ queryKey: ["activity"] });
    },
  });
  if (list.isPending) return <Loading text="저장한 작품을 불러오고 있어요." />;
  if (list.error) return <Failure error={list.error} />;
  const {items} = list.data;
  const chosen = items.filter((i) => selected.includes(i.portfolio.id));
  const creators = [...new Set(chosen.map((i) => i.creator.userId))];
  if (result)
    return <Results result={result} onDone={() => setResult(undefined)} />;
  return (
    <>
      <div className="grid gap-2">
        <h1 className="type-heading-lg">작품 저장함</h1>
        <p className="text-muted-foreground">
          마음에 드는 작품을 모아 두고, 최대 {BULK_INQUIRY_MAX}개를 골라 그
          작품을 만든 크리에이터들에게 같은 조건으로 한 번에 문의할 수 있어요.
        </p>
      </div>
      {items.length === 0 ? (
        <Card>
          <p>아직 저장한 작품이 없어요.</p>
          <Button asChild className="justify-self-start">
            <Link to="/">작품 둘러보기</Link>
          </Button>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <WorkRow
              key={item.portfolio.id}
              item={item}
              checked={selected.includes(item.portfolio.id)}
              disabled={
                !selected.includes(item.portfolio.id) &&
                selected.length >= BULK_INQUIRY_MAX
              }
              onToggle={() =>
                setSelected((prev) =>
                  prev.includes(item.portfolio.id)
                    ? prev.filter((id) => id !== item.portfolio.id)
                    : [...prev, item.portfolio.id],
                )
              }
            />
          ))}
        </ul>
      )}
      {chosen.length > 0 && (
        <form
          className="showcase-card grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setProblem("");
            const body = {
              commandId: commandId.current,
              portfolioIds: selected,
              ...readConditions(event.currentTarget),
            };
            const checked = bulkInquiryCreateSchema.safeParse(body);
            if (!checked.success) {
              setProblem(
                checked.error.issues[0]?.message ??
                  "입력 내용을 확인해 주세요.",
              );
              return;
            }
            send.mutate(checked.data);
          }}
        >
          <h2 className="type-heading-md">공통 조건 작성</h2>
          <ConditionFields idPrefix="bulk" />
          <div className="grid gap-2 rounded-xl bg-muted p-4">
            <h3 className="type-title">
              보낼 대상 · 크리에이터 {creators.length}명
            </h3>
            <ul className="grid gap-1 text-sm">
              {chosen.map((item) => (
                <li key={item.portfolio.id}>
                  {item.creator.name} — 참고 작품 「{item.portfolio.title}」
                </li>
              ))}
            </ul>
            {creators.length < chosen.length && (
              <p className="text-sm">
                같은 크리에이터의 작품을 여러 개 골랐어요. 크리에이터마다 한
                번만 보내요.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              각 작품에 연결된 패키지(없으면 대표 패키지)의 금액·작업 일수·수정
              횟수로 시작해요. 최종 조건은 수락 뒤 대화방에서 정해요.
            </p>
          </div>
          {problem && <p role="alert">{problem}</p>}
          {send.error && (
            <p role="alert">
              {errorText(send.error, "문의를 보내지 못했어요.")}
            </p>
          )}
          <Button
            type="submit"
            className="justify-self-start"
            disabled={send.isPending}
          >
            {send.isPending
              ? "보내는 중…"
              : `크리에이터 ${creators.length}명에게 문의 보내기`}
          </Button>
        </form>
      )}
    </>
  );
}
