import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PRODUCTION_ROLES } from "@kemi/shared";
import Button from "../components/ui/button";
import Label from "../components/ui/label";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import FileUpload from "../shared/files/FileUpload";
import { optionLabels } from "../features/profiles/contracts";
import {
  emptyWork,
  originLabels,
  workSchema,
  workProblems,
  type WorkItem,
} from "./portfolio-model";
import type { StudioCommand } from "./studio-model";

export default function WorkEditorMock({
  item,
  busy,
  onSave,
  onClose,
}: {
  item?: WorkItem;
  busy: boolean;
  onSave: (command: StudioCommand) => Promise<boolean>;
  onClose: () => void;
}) {
  const form = useForm({
    defaultValues: item ?? emptyWork,
    resolver: zodResolver(workSchema),
  });
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const [issues, setIssues] = useState<string[]>([]);
  const mediaKind = useWatch({ control: form.control, name: "mediaKind" });
  const asset = useWatch({ control: form.control, name: "asset" });
  const pending = busy || form.formState.isSubmitting;
  const submit = async (visibility: WorkItem["visibility"]) => {
    await form.handleSubmit(async (values) => {
      const problems = visibility === "PUBLIC" ? workProblems(values) : [];
      setIssues(problems);
      if (problems.length) return;
      if (await onSave({ type: "save-work", id, values, visibility }))
        onClose();
    })();
  };
  const fields = {
    title: "작업물 제목",
    description: "작업물 설명",
    style: "스타일 (임시 자유 입력)",
    workType: "작업유형 (임시 자유 입력)",
    source: "작업물 출처",
  } as const;
  return (
    <form
      className="showcase-card grid gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(item?.visibility ?? "DRAFT");
      }}
    >
      <h2 className="type-heading-sm">{item ? "작업물 수정" : "새 작업물"}</h2>
      <p>
        미완성은 초안으로 저장할 수 있어요. 샘플도 등록할 수 있으며 거래
        이력·후기는 필수가 아니에요. 고객 작업물은 동의 없이 공개하지 않아요.
      </p>
      <fieldset className="grid min-w-0 gap-4" disabled={pending}>
        <legend className="sr-only">작업물 내용과 공개 권한</legend>
        {Object.entries(fields).map(([name, label]) => {
          const key = workSchema.keyof().parse(name);
          const error = form.formState.errors[key];
          const props = {
            id: `work-${name}`,
            ...form.register(key),
            maxLength: 4000,
            "aria-invalid": !!error,
            "aria-describedby": error ? `work-${name}-error` : undefined,
          };
          return (
            <div className="grid gap-2" key={name}>
              <Label htmlFor={props.id}>{label}</Label>
              {name === "description" ? (
                <Textarea {...props} rows={4} />
              ) : (
                <Input {...props} />
              )}
              {error && (
                <p role="alert" id={`work-${name}-error`}>
                  입력 형식을 확인해 주세요. (Mock 입력 보호 한도 4,000자)
                </p>
              )}
            </div>
          );
        })}
        <fieldset className="flex flex-wrap gap-4">
          <legend className="mb-2">본인 담당 역할 (복수 선택)</legend>
          {PRODUCTION_ROLES.map((role) => (
            <label
              key={role}
              htmlFor={`work-role-${role}`}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                id={`work-role-${role}`}
                type="checkbox"
                value={role}
                {...form.register("roles")}
              />
              {optionLabels[role]}
            </label>
          ))}
        </fieldset>
        <Label htmlFor="work-origin">작업 출처 구분</Label>
        <select id="work-origin" {...form.register("origin")}>
          {Object.entries(originLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Label htmlFor="work-media">영상 준비 방식</Label>
        <select id="work-media" {...form.register("mediaKind")}>
          <option value="FILE">로컬 영상 파일 · Mock</option>
          <option value="URL">외부 URL · 초안만</option>
        </select>
        {mediaKind === "FILE" ? (
          <FileUpload
            value={asset}
            disabled={pending}
            onChange={(value) =>
              form.setValue("asset", value, { shouldDirty: true })
            }
          />
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="work-url">외부 영상 URL (초안)</Label>
            <Input
              id="work-url"
              {...form.register("externalUrl")}
              maxLength={2048}
              aria-describedby="work-url-help"
            />
            <p id="work-url-help">
              https 형식만 모의 검사해요. 허용 제공자·공개·재생 범위 D02가
              미결정이라 임베드·외부 요청·공개 저장은 하지 않아요.
            </p>
          </div>
        )}
        <label
          htmlFor="work-rights"
          className="flex min-h-11 items-center gap-2"
        >
          <input
            id="work-rights"
            type="checkbox"
            {...form.register("rights")}
          />
          본인에게 공개 권한이 있어요
        </label>
        <label
          htmlFor="work-consent"
          className="flex min-h-11 items-center gap-2"
        >
          <input
            id="work-consent"
            type="checkbox"
            {...form.register("consent")}
          />
          고객 작업물의 공개 동의를 받았어요 (고객 작업일 때 필요)
        </label>
      </fieldset>
      {issues.length > 0 && (
        <div role="alert" className="rounded-xl border border-destructive p-4">
          <p>공개 전 모의 확인</p>
          <ul className="list-inside list-disc">
            {issues.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "처리 중…" : "작업물 저장"}
        </Button>
        {item?.visibility !== "PUBLIC" && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => submit("PUBLIC")}
          >
            공개 작업물로 저장
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onClose}
        >
          작업물 편집 취소
        </Button>
      </div>
    </form>
  );
}
