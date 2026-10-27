import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { directRequestCreateSchema, VIDEO_PURPOSES } from "@kemi/shared";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi } from "../../shared/api/kemi";
import { label, purposeLabels, won } from "../live/labels";
import { Card, Facts, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";

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
  const [problem, setProblem] = useState("");
  const send = useMutation({
    mutationFn: (body: {
      message: string;
      purpose?: string;
      eventDate?: string;
    }) =>
      kemi.sendDirectRequest(packageId, directRequestCreateSchema.parse(body)),
    onSuccess: (request) => navigate(`/requests/${request.id}`),
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
          const form = new FormData(event.currentTarget);
          const purpose = String(form.get("purpose") ?? "");
          const eventDate = String(form.get("eventDate") ?? "");
          const body = {
            message: String(form.get("message") ?? "").trim(),
            ...(purpose ? { purpose } : {}),
            ...(eventDate ? { eventDate } : {}),
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
        <Field id="direct-message" label="요청사항 (10자 이상)">
          <Textarea
            id="direct-message"
            name="message"
            rows={5}
            required
            maxLength={2000}
          />
        </Field>
        <Field id="direct-purpose" label="영상 목적 (선택)">
          <select
            id="direct-purpose"
            name="purpose"
            className={selectClass}
            defaultValue=""
          >
            <option value="">선택하지 않음</option>
            {VIDEO_PURPOSES.map((value) => (
              <option key={value} value={value}>
                {label(purposeLabels, value)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="direct-date" label="행사일 (선택)">
          <Input id="direct-date" name="eventDate" type="date" />
        </Field>
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
