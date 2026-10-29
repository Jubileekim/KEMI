import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  projectDraftValuesSchema,
  RECRUITMENT_DAYS,
  VIDEO_PURPOSES,
  VIDEO_STYLES,
  type ProjectDraft,
} from "@kemi/shared";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import { kemi } from "../../shared/api/kemi";
import { Card, Failure, Field, Loading } from "../live/ui";
import { errorText, selectClass } from "../live/errors";
import { label, purposeLabels, styleLabels } from "../live/labels";
import PricingPanel from "./PricingPanel";
import { pricingConditions, setBudget } from "./pricing-form";
import limitBudgetInput, { MAX_PROJECT_BUDGET_KRW } from "./budget-input";

function DraftForm({ draft }: { draft?: ProjectDraft }) {
  const form = useRef<HTMLFormElement>(null);
  const savedId = useRef(draft?.id);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const values = draft?.values;
  const [styles, setStyles] = useState<string[]>(values?.styles ?? []);
  const save = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!form.current) throw new Error("입력 폼을 확인해 주세요.");
      const data = new FormData(form.current);
      const text = (name: string) => String(data.get(name) ?? "").trim();
      const body = projectDraftValuesSchema.parse({
        title: text("title") || null,
        description: text("description") || null,
        purpose: text("purpose") || null,
        styles,
        budget: text("budget") ? Number(text("budget")) : null,
        deliveryDueDate: text("deliveryDueDate") || null,
        recruitmentDays: Number(text("days")),
      });
      const saved = await kemi.saveDraft(body, savedId.current);
      // 공개에 실패해도 저장된 초안 번호를 보존하여 같은 초안을 이어서 수정한다.
      savedId.current = saved.id;
      if (publish)
        return { project: (await kemi.publishDraft(saved.id)).project };
      return { draft: saved };
    },
    onSuccess: (result) => {
      cache.invalidateQueries({ queryKey: ["project-drafts"] });
      cache.invalidateQueries({ queryKey: ["activity"] });
      if (result.project) navigate(`/campaigns/${result.project.id}`);
      else
        navigate(`/campaigns/new?draft=${result.draft.id}`, { replace: true });
    },
  });
  return (
    <>
      <h1 className="type-heading-lg">
        {draft ? "초안 이어 쓰기" : "모집 작성"}
      </h1>
      <p>
        작성 중인 내용은 임시 저장할 수 있어요. 공개할 때 필수 항목을 확인하며
        모집 마감은 공개 시각부터 계산해요.
      </p>
      <form
        ref={form}
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(true);
        }}
      >
        <fieldset className="grid gap-4" disabled={save.isPending}>
          <Card title="기본 정보">
            <Field id="draft-title" label="제목">
              <Input
                id="draft-title"
                name="title"
                maxLength={100}
                defaultValue={values?.title ?? ""}
                required
              />
            </Field>
            <Field id="draft-description" label="설명">
              <Textarea
                id="draft-description"
                name="description"
                maxLength={5000}
                defaultValue={values?.description ?? ""}
                required
              />
            </Field>
            <Field id="draft-purpose" label="영상 목적">
              <select
                id="draft-purpose"
                name="purpose"
                className={selectClass}
                defaultValue={values?.purpose ?? ""}
                required
              >
                <option value="">선택해 주세요</option>
                {VIDEO_PURPOSES.map((value) => (
                  <option key={value} value={value}>
                    {label(purposeLabels, value)}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="grid gap-2">
              <legend>스타일 (1~5개)</legend>
              <div className="flex flex-wrap gap-3">
                {VIDEO_STYLES.map((value) => (
                  <label
                    key={value}
                    htmlFor={`draft-style-${value}`}
                    className="flex items-center gap-2"
                  >
                    <input
                      id={`draft-style-${value}`}
                      type="checkbox"
                      checked={styles.includes(value)}
                      onChange={(event) =>
                        setStyles((previous) =>
                          event.target.checked
                            ? [...previous, value]
                            : previous.filter((item) => item !== value),
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
            <Field
              id="draft-budget"
              label="예산 (원)"
              hint="최대 1,000,000,000원까지 입력할 수 있어요."
            >
              <Input
                id="draft-budget"
                name="budget"
                type="number"
                min={1}
                max={MAX_PROJECT_BUDGET_KRW}
                onInput={limitBudgetInput}
                defaultValue={values?.budget ?? ""}
                required
              />
            </Field>
            <PricingPanel
              conditions={() => pricingConditions(form.current, styles)}
              target={() =>
                savedId.current ? { draftId: savedId.current } : null
              }
              onApply={(amount) => setBudget(form.current, amount)}
            />
            <Field id="draft-days" label="모집 기간">
              <select
                id="draft-days"
                name="days"
                className={selectClass}
                defaultValue={draft?.recruitmentDays ?? 7}
              >
                {RECRUITMENT_DAYS.map((days) => (
                  <option key={days} value={days}>
                    {days}일
                  </option>
                ))}
              </select>
            </Field>
            <Field id="draft-due" label="희망 납품일">
              <Input
                id="draft-due"
                name="deliveryDueDate"
                type="date"
                defaultValue={values?.deliveryDueDate ?? ""}
                required
              />
            </Field>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => save.mutate(false)}
            >
              임시 저장
            </Button>
            <Button type="submit">모집 공개</Button>
          </div>
        </fieldset>
        {save.error && (
          <p role="alert">
            {errorText(
              save.error,
              "저장·공개하지 못했어요. 입력을 확인해 주세요.",
            )}
          </p>
        )}
        {save.isSuccess && !save.data.project && (
          <p role="status">초안을 저장했어요.</p>
        )}
      </form>
      <Link to="/me/activity" className="underline">
        내 활동·저장한 초안으로
      </Link>
    </>
  );
}

export default function ProjectDraftEditorLive() {
  const [params] = useSearchParams();
  const id = params.get("draft");
  const drafts = useQuery({
    queryKey: ["project-drafts"],
    enabled: !!id,
    queryFn: ({ signal }) => kemi.drafts(signal),
  });
  if (!id) return <DraftForm key="new" />;
  if (drafts.isPending) return <Loading />;
  if (drafts.error) return <Failure error={drafts.error} />;
  const draft = drafts.data?.items.find((item) => item.id === id);
  if (!draft) return <p role="alert">저장한 초안을 찾을 수 없어요.</p>;
  return <DraftForm key={id} draft={draft} />;
}
