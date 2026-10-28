import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { directRequestCreateSchema } from "@kemi/shared";
import Button from "../../components/ui/button";
import { kemi } from "../../shared/api/kemi";
import { won } from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";
import track from "../../shared/analytics/track";
import ConditionFields from "../saved/ConditionFields";
import readConditions from "../saved/conditions";

// DIRECT-01: 공개 패키지로 직접 의뢰 보내기(실제 API). 크리에이터가 48시간 안에 수락하면 협의가 시작된다.
export default function DirectRequestLive() {
  const { creatorId = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const creator = useQuery({
    queryKey: ["creator", creatorId],
    queryFn: ({ signal }) => kemi.creator(creatorId, signal),
  });
  const [packageId, setPackageId] = useState(params.get("packageId") ?? "");
  // 작품 상세에서 왔으면 그 작품을 참고 작품으로 함께 보낸다(INQ-01).
  const referenceId = params.get("portfolioId") ?? "";
  const reference = useQuery({
    queryKey: ["portfolio", referenceId],
    enabled: !!referenceId,
    queryFn: ({ signal }) => kemi.portfolio(referenceId, signal),
  });
  const [problem, setProblem] = useState("");
  const send = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      kemi.sendDirectRequest(packageId, directRequestCreateSchema.parse(body)),
    onSuccess: (request) => {
      track("request_sent", request.id);
      navigate(`/requests/${request.id}`);
    },
  });
  if (creator.isPending) return <Loading />;
  if (creator.error) return <Failure error={creator.error} />;
  const packages = [
    creator.data.representativePackage,
    ...creator.data.packages.filter(
      (p) => p.id !== creator.data.representativePackage.id,
    ),
  ].filter((p) => p.status === "PUBLIC");
  const selected = packages.find((p) => p.id === packageId) ?? packages[0];
  return (
    <>
      <h1 className="type-heading-lg">직접 의뢰 · {creator.data.name}</h1>
      <form
        className="showcase-card grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setProblem("");
          if (!selected) return;
          if (selected.id !== packageId) setPackageId(selected.id);
          const body = {
            ...readConditions(event.currentTarget),
            ...(reference.data?.creatorId === creatorId
              ? { referencePortfolioId: reference.data.id }
              : {}),
          };
          const checked = directRequestCreateSchema.safeParse(body);
          if (!checked.success) {
            setProblem(
              checked.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
            );
            return;
          }
          send.mutate(body);
        }}
      >
        <Field id="direct-package" label="패키지">
          <select
            id="direct-package"
            className={selectClass}
            value={selected?.id ?? ""}
            onChange={(event) => setPackageId(event.target.value)}
          >
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.priceKrw ? won(p.priceKrw) : "가격 미정"}
              </option>
            ))}
          </select>
        </Field>
        {selected && (
          <Facts
            items={[
              ["금액", selected.priceKrw ? won(selected.priceKrw) : "미정"],
              ["작업 일수", `${selected.deliveryDays ?? "-"}일`],
              ["수정", `${selected.revisionCount ?? 0}회`],
            ]}
          />
        )}
        {reference.data?.creatorId === creatorId && (
          <p className="rounded-xl bg-muted p-3 text-sm">
            참고 작품: 「{reference.data.title}」 — 크리에이터가 이 작품을 보고
            제작 가능 여부를 판단해요.
          </p>
        )}
        <ConditionFields idPrefix="direct" />
        {packages.length === 0 && (
          <p role="alert">공개된 패키지가 없어 직접 의뢰를 보낼 수 없어요.</p>
        )}
        {problem && <p role="alert">{problem}</p>}
        {send.error && (
          <p role="alert">{errorText(send.error, "의뢰를 보내지 못했어요.")}</p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={send.isPending || !selected}>
            의뢰 보내기
          </Button>
          <Button asChild variant="outline">
            <Link to={`/creators/${creatorId}`}>취소</Link>
          </Button>
        </div>
      </form>
      <Card>
        <p className="text-muted-foreground">
          크리에이터가 48시간 안에 수락하면 대화와 조건 협의가 시작돼요.
        </p>
      </Card>
    </>
  );
}
