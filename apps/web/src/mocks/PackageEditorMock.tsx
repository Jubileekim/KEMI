import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import Label from "../components/ui/label";
import {
  emptyPackage,
  packageSchema,
  packageFields,
  packageProblems,
  type PackageItem,
  type StudioCommand,
} from "./studio-model";

export default function PackageEditorMock({
  item,
  busy,
  onSave,
  onClose,
}: {
  item?: PackageItem;
  busy: boolean;
  onSave: (command: StudioCommand) => Promise<boolean>;
  onClose: () => void;
}) {
  const form = useForm({
    defaultValues: item ?? emptyPackage,
    resolver: zodResolver(packageSchema),
  });
  const [problems, setProblems] = useState<string[]>([]);
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const pending = busy || form.formState.isSubmitting;
  async function submit(visibility: PackageItem["visibility"]) {
    await form.handleSubmit(async (values) => {
      const issues = visibility === "PUBLIC" ? packageProblems(values) : [];
      setProblems(issues);
      if (issues.length) return;
      if (await onSave({ type: "save-package", id, values, visibility }))
        onClose();
    })();
  }
  return (
    <form
      className="showcase-card grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit(item?.visibility ?? "DRAFT");
      }}
      noValidate
    >
      <h2 className="type-heading-sm">{item ? "패키지 수정" : "새 패키지"}</h2>
      <p>
        패키지는 협의 출발점이에요. 추가 옵션 구매 없이 최종 계약에서 조건을
        합의해요. 초안은 미완성으로 저장할 수 있어요.
      </p>
      <fieldset
        disabled={pending}
        className="grid min-w-0 gap-4 sm:grid-cols-2"
      >
        <legend className="sr-only">패키지 조건</legend>
        {Object.entries(packageFields).map(([name, label]) => {
          const key = packageSchema.keyof().parse(name);
          const error = form.formState.errors[key];
          const props = {
            id: `package-${name}`,
            ...form.register(key),
            "aria-invalid": !!error,
            "aria-describedby": error ? `package-${name}-error` : undefined,
            maxLength: 4000,
          };
          return (
            <div key={name} className="grid gap-2">
              <Label htmlFor={props.id}>{label}</Label>
              {["description", "included", "excluded", "usage"].includes(
                name,
              ) ? (
                <Textarea {...props} rows={3} />
              ) : (
                <Input
                  {...props}
                  inputMode={
                    ["price", "quantity", "days", "revisions"].includes(name)
                      ? "numeric"
                      : "text"
                  }
                />
              )}
              {error && (
                <p role="alert" id={`package-${name}-error`}>
                  입력은 4,000자 이내로 작성해 주세요. (Mock 입력 보호 한도)
                </p>
              )}
            </div>
          );
        })}
        <label
          htmlFor="package-commercial"
          className="flex items-start gap-2 sm:col-span-2"
        >
          <input
            id="package-commercial"
            type="checkbox"
            {...form.register("commercial")}
          />
          상업 광고 활용 가능한 상품임을 확인했어요
        </label>
      </fieldset>
      {problems.length > 0 && (
        <div role="alert" className="rounded-lg border border-destructive p-4">
          <p>공개 전에 확인해 주세요. (모의 검증 기준)</p>
          <ul className="list-inside list-disc">
            {problems.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "처리 중…" : "패키지 저장"}
        </Button>
        {item?.visibility !== "PUBLIC" && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => submit("PUBLIC")}
          >
            공개 패키지로 저장
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onClose}
        >
          편집 취소
        </Button>
      </div>
    </form>
  );
}
