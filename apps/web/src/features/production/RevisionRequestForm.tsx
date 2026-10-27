import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";
import Textarea from "../../components/ui/textarea";
import {
  revisionItemSchema,
  type RevisionCommand,
} from "../../mocks/revision-model";

const formSchema = z.strictObject({
  category: z.enum(["GENERAL", "ERROR", "DRAFT"]),
  scopeConfirmed: z.boolean(),
  items: z.array(revisionItemSchema).min(1).max(20),
});
const blank = () => ({
  id: crypto.randomUUID(),
  seconds: 0,
  area: "EDITING" as const,
  problem: "",
  change: "",
  reference: "",
});
export default function RevisionRequestForm({
  versionId,
  draft,
  revision,
  generalAllowed,
  disabled,
  position,
  submit,
}: {
  versionId: string;
  draft: boolean;
  revision: number;
  generalAllowed: boolean;
  disabled: boolean;
  position: { seconds: number; duration: number };
  submit: (cmd: RevisionCommand) => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: draft ? "DRAFT" : "GENERAL",
      scopeConfirmed: false,
      items: [blank()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  return (
    <form
      className="grid min-w-0 gap-4 rounded-xl border p-4"
      aria-label="수정 요청 작성"
      onSubmit={handleSubmit((value) => {
        if (
          value.category === "GENERAL" &&
          (!generalAllowed || !value.scopeConfirmed)
        ) {
          setError("root", {
            message:
              "일반 수정은 양측 조건 확인·남은 회차·계약 범위 확인이 필요해요. 한도 초과는 별도 협의해 주세요.",
          });
          return;
        }
        if (
          !position.duration ||
          value.items.some((i) => i.seconds > position.duration)
        ) {
          setError("root", {
            message:
              "영상을 불러온 뒤 영상 길이 안의 시간 위치를 입력해 주세요.",
          });
          return;
        }
        if (
          new Set(value.items.map((i) => i.area)).size !== 1 ||
          value.items.some((i) => i.area === "ADDITIONAL")
        ) {
          setError("root", {
            message: "혼합·추가 작업은 별도 협의가 필요해요. D10/D11 미결정",
          });
          return;
        }
        submit({
          ...value,
          type: "request",
          id: crypto.randomUUID(),
          revision,
          versionId,
        });
      })}
    >
      <h3 className="type-heading-sm">
        {draft ? "초안 의견 (회차 제외)" : "시간 위치별 수정 체크리스트"}
      </h3>
      <p>
        여러 항목을 한 요청으로 묶어요. 한 요청은 같은 분류·작업 분야로 작성해
        주세요. 혼합·추가 작업과 이견은 협의가 필요해요.
      </p>
      <fieldset disabled={disabled} className="grid gap-4 min-w-0">
        <Label htmlFor="revision-category">요청 분류</Label>
        <select
          id="revision-category"
          className="w-full rounded-xl border p-3"
          {...register("category")}
          disabled={draft || disabled}
        >
          {draft ? (
            <option value="DRAFT">초안 의견</option>
          ) : (
            <>
              <option value="GENERAL">일반 수정</option>
              <option value="ERROR">계약 오류 시정 (합의 대기)</option>
            </>
          )}
        </select>
        <Label>
          <input type="checkbox" {...register("scopeConfirmed")} /> 일반 수정은
          확인한 계약 범위 안의 요청이에요
        </Label>
        {fields.map((field, index) => (
          <fieldset
            key={field.id}
            className="grid min-w-0 gap-3 rounded-xl border p-4"
          >
            <legend>항목 {index + 1}</legend>
            <Label htmlFor={`revision-time-${index}`}>
              시간 위치 (초) {index + 1}
            </Label>
            <Input
              id={`revision-time-${index}`}
              type="number"
              min={0}
              max={86400}
              step={1}
              {...register(`items.${index}.seconds`, { valueAsNumber: true })}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!position.duration}
              onClick={() =>
                setValue(`items.${index}.seconds`, Math.floor(position.seconds))
              }
            >
              현재 재생 위치 사용 {index + 1}
            </Button>
            <Label htmlFor={`revision-area-${index}`}>
              작업 분야 {index + 1}
            </Label>
            <select
              id={`revision-area-${index}`}
              className="w-full rounded-xl border p-3"
              {...register(`items.${index}.area`)}
            >
              <option value="EDITING">편집</option>
              <option value="SHOOTING">촬영</option>
              <option value="ADDITIONAL">추가 작업 (협의 필요)</option>
            </select>
            <Label htmlFor={`revision-problem-${index}`}>
              문제 {index + 1}
            </Label>
            <Textarea
              id={`revision-problem-${index}`}
              maxLength={1000}
              {...register(`items.${index}.problem`)}
              aria-invalid={Boolean(errors.items?.[index]?.problem)}
            />
            <Label htmlFor={`revision-change-${index}`}>
              희망 변경 {index + 1}
            </Label>
            <Textarea
              id={`revision-change-${index}`}
              maxLength={1000}
              {...register(`items.${index}.change`)}
              aria-invalid={Boolean(errors.items?.[index]?.change)}
            />
            <Label htmlFor={`revision-reference-${index}`}>
              참고 메모 {index + 1}
            </Label>
            <Textarea
              id={`revision-reference-${index}`}
              maxLength={1000}
              {...register(`items.${index}.reference`)}
            />
            {fields.length > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => remove(index)}
              >
                항목 {index + 1} 삭제
              </Button>
            )}
          </fieldset>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={fields.length >= 20}
          onClick={() => append(blank())}
        >
          체크 항목 추가
        </Button>
        <Button type="submit">수정 요청 정식 등록</Button>
      </fieldset>
      {Object.keys(errors).length > 0 && (
        <p role="alert">
          {errors.root?.message ??
            "각 항목의 필수 문제·희망 변경과 유효한 시간 위치를 확인해 주세요."}
        </p>
      )}
    </form>
  );
}
