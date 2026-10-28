import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import {
  projectCreateSchema,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
  type ProjectSummary,
} from "@kemi/shared";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi } from "../../shared/api/kemi";
import { label, purposeLabels, styleLabels } from "../live/labels";
import { Card, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";
import ProjectDraftEditorLive from "./ProjectDraftEditorLive";
import PricingPanel from "./PricingPanel";
import { pricingConditions, setBudget } from "./pricing-form";

// datetime-local 값(브라우저 현지 시각)을 ISO로
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");
const toLocal = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

function Editor({ initial }: { initial?: ProjectSummary }) {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [styles, setStyles] = useState<string[]>(initial?.styles ?? []);
  const [problem, setProblem] = useState("");
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      const parsed = projectCreateSchema.parse(body);
      return initial
        ? kemi.updateProject(initial.id, parsed)
        : kemi.createProject(parsed);
    },
    onSuccess: (project) => navigate(`/campaigns/${project.id}`),
  });
  return (
    <>
      <h1 className="type-heading-lg">{initial ? "모집 수정" : "모집 작성"}</h1>
      <form
        ref={formRef}
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          setProblem("");
          const form = new FormData(event.currentTarget);
          const text = (name: string) => String(form.get(name) ?? "").trim();
          const body = {
            title: text("title"),
            description: text("description"),
            purpose: text("purpose"),
            styles,
            budget: Number(text("budget")),
            recruitmentEndAt: toIso(text("recruitmentEndAt")),
            deliveryDueDate: text("deliveryDueDate"),
          };
          const checked = projectCreateSchema.safeParse(body);
          if (!checked.success) {
            setProblem(
              checked.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.",
            );
            return;
          }
          save.mutate(body);
        }}
      >
        <Card title="기본 정보">
          <Field id="campaign-title" label="제목">
            <Input
              id="campaign-title"
              name="title"
              required
              maxLength={100}
              defaultValue={initial?.title}
            />
          </Field>
          <Field
            id="campaign-description"
            label="설명"
            hint="원하는 영상, 자료, 상영·게시 장소를 적어 주세요."
          >
            <Textarea
              id="campaign-description"
              name="description"
              required
              rows={6}
              defaultValue={initial?.description}
            />
          </Field>
          <Field id="campaign-purpose" label="영상 목적">
            <select
              id="campaign-purpose"
              name="purpose"
              className={selectClass}
              required
              defaultValue={initial?.purpose ?? ""}
            >
              <option value="" disabled>
                선택해 주세요
              </option>
              {VIDEO_PURPOSES.map((value) => (
                <option key={value} value={value}>
                  {label(purposeLabels, value)}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="grid gap-2">
            <legend className="type-label-md">스타일 (1~5개)</legend>
            <div className="flex flex-wrap gap-3">
              {VIDEO_STYLES.map((value) => (
                <label
                  key={value}
                  htmlFor={`campaign-style-${value}`}
                  className="flex items-center gap-2"
                >
                  <input
                    id={`campaign-style-${value}`}
                    type="checkbox"
                    checked={styles.includes(value)}
                    onChange={(event) =>
                      setStyles((prev) =>
                        event.target.checked
                          ? [...prev, value]
                          : prev.filter((s) => s !== value),
                      )
                    }
                  />
                  {label(styleLabels, value)}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>
        <Card title="예산·일정">
          <Field id="campaign-budget" label="예산 (원)">
            <Input
              id="campaign-budget"
              name="budget"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={initial?.budget}
            />
          </Field>
          <PricingPanel
            conditions={() => pricingConditions(formRef.current, styles)}
            target={() => (initial ? { projectId: initial.id } : null)}
            onApply={(amount) => setBudget(formRef.current, amount)}
          />
          <Field id="campaign-end" label="모집 마감">
            <Input
              id="campaign-end"
              name="recruitmentEndAt"
              type="datetime-local"
              required
              defaultValue={toLocal(initial?.recruitmentEndAt)}
            />
          </Field>
          <Field id="campaign-due" label="희망 납품일">
            <Input
              id="campaign-due"
              name="deliveryDueDate"
              type="date"
              required
              defaultValue={initial?.deliveryDueDate}
            />
          </Field>
        </Card>
        {problem && <p role="alert">{problem}</p>}
        {save.error && (
          <p role="alert">
            {errorText(save.error, "모집을 저장하지 못했어요.")}
          </p>
        )}
        <div className="flex gap-3">
          <Button type="submit" disabled={save.isPending}>
            {initial ? "수정 저장" : "모집 공개"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            취소
          </Button>
        </div>
      </form>
    </>
  );
}

// CAMP-01·02: 모집 작성·수정 (실제 API). 저장하면 바로 공개되고, 마감 전까지 수정할 수 있다.
export default function CampaignEditorLive() {
  const { campaignId } = useParams();
  const existing = useQuery({
    queryKey: ["project", campaignId],
    enabled: !!campaignId,
    queryFn: ({ signal }) => kemi.project(campaignId ?? "", signal),
  });
  if (!campaignId) return <ProjectDraftEditorLive />;
  if (campaignId && existing.isPending) return <Loading />;
  if (campaignId && existing.error) return <Failure error={existing.error} />;
  return <Editor key={campaignId ?? "new"} initial={existing.data} />;
}
