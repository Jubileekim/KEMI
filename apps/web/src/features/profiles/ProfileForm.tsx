import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CONTENT_STYLES,
  PRODUCT_CATEGORIES,
  PRODUCTION_ROLES,
  type MyProfileResponse,
} from "@kemi/shared";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Textarea from "../../components/ui/textarea";
import Label from "../../components/ui/label";
import { session } from "../../app/session";
import { mockEnabled } from "../auth/config";
import safeReturnTo from "../auth/redirect";
import { uploadFile } from "../../shared/api/upload";
import ProfileImageField from "./ProfileImageField";
import { saveProfile, profileError } from "./api";
import {
  labels,
  optionLabels,
  profileValues,
  profileFormSchema,
  profilePatch,
  type ProfileRole,
} from "./contracts";

export default function ProfileForm({
  data,
  queryKey,
  reload,
}: {
  data: MyProfileResponse;
  queryKey: readonly unknown[];
  reload: () => void;
}) {
  const role: ProfileRole = data.profile.type;
  // 모든 항목이 선택이라, 아무것도 바꾸지 않아도 다음 화면으로 넘어갈 수 있게 한다.
  // 가입 전에 가려던 곳(returnTo)이 있으면 그리로, 없으면 역할별 첫 화면으로 보낸다.
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo");
  let next = { to: "/studio/portfolio", label: "작업물 올리러 가기" };
  if (role === "CLIENT") next = { to: "/works", label: "작품 둘러보기" };
  if (returnTo)
    next = {
      to: safeReturnTo(returnTo, role === "CLIENT" ? "client" : "creator"),
      label: "하던 일 이어가기",
    };
  const [original, setOriginal] = useState(() => profileValues(data));
  const [saved, setSaved] = useState(false);
  const cache = useQueryClient();
  const form = useForm({
    defaultValues: original,
    resolver: zodResolver(profileFormSchema(role)),
  });
  const imageId = useWatch({ control: form.control, name: "imageFileId" });
  const mutation = useMutation({
    mutationFn: async () => {
      const expected = session.epoch();
      const result = await saveProfile(
        role,
        profilePatch(role, form.getValues(), original),
      );
      if (expected !== session.epoch()) return;
      cache.setQueryData(queryKey, result);
      const values = profileValues(result);
      setOriginal(values);
      form.reset(values);
      setSaved(true);
    },
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size === 0 ||
        file.size > 10 * 1024 * 1024
      ) {
        throw new Error("PNG·JPG·WebP 이미지(최대 10MB)를 선택해 주세요.");
      }
      const expected = session.epoch();
      const result = await uploadFile(file, "PROFILE_IMAGE");
      if (expected !== session.epoch()) return;
      form.setValue("imageFileId", result.id, { shouldDirty: true });
      setSaved(false);
    },
  });
  const busy =
    mutation.isPending || form.formState.isSubmitting || upload.isPending;
  const { errors } = form.formState;
  function textField(
    name:
      | "name"
      | "brandName"
      | "introduction"
      | "websiteUrl"
      | "socialUrl"
      | "workMethod"
      | "career"
      | "availableFrom",
    multiline = false,
  ) {
    let maxLength = 2048;
    if (name === "name") maxLength = 20;
    if (name === "brandName") maxLength = 50;
    const props = {
      id: `profile-${name}`,
      ...form.register(name),
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name] ? `profile-${name}-error` : undefined,
    };
    return (
      <div className="grid gap-2" key={name}>
        <Label htmlFor={props.id}>
          {role === "CREATOR" && name === "websiteUrl"
            ? "포트폴리오·웹사이트 주소 (선택)"
            : labels[name]}
        </Label>
        {multiline ? (
          <Textarea
            {...props}
            maxLength={name === "career" ? 2000 : 1000}
            rows={4}
          />
        ) : (
          <Input
            {...props}
            type={name === "availableFrom" ? "date" : "text"}
            maxLength={maxLength}
            autoComplete={name === "name" ? "nickname" : "off"}
          />
        )}
        {errors[name] && (
          <p
            id={`profile-${name}-error`}
            role="alert"
            className="text-destructive"
          >
            {errors[name].message}
          </p>
        )}
      </div>
    );
  }
  function category(name: "industry" | "niche") {
    return (
      <div className="grid gap-2">
        <Label htmlFor={`profile-${name}`}>{labels[name]}</Label>
        <select
          id={`profile-${name}`}
          {...form.register(name)}
          className="min-h-11 w-full rounded-md border border-input bg-card px-3"
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        >
          <option value="">선택하지 않음</option>
          {PRODUCT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {optionLabels[value]}
            </option>
          ))}
        </select>
        {errors[name] && (
          <p role="alert" id={`${name}-error`}>
            {errors[name].message}
          </p>
        )}
      </div>
    );
  }
  function choices(
    name: "contentStyles" | "productionRoles",
    options: readonly string[],
  ) {
    return (
      <fieldset
        className="grid gap-3"
        aria-describedby={errors[name] ? `${name}-error` : undefined}
      >
        <legend className="mb-3 type-label-md">{labels[name]}</legend>
        <div className="flex flex-wrap gap-4">
          {options.map((value) => (
            <label
              key={value}
              htmlFor={`profile-${name}-${value}`}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                id={`profile-${name}-${value}`}
                type="checkbox"
                className="accent-primary"
                value={value}
                {...form.register(name)}
              />
              {optionLabels[value]}
            </label>
          ))}
        </div>
        {errors[name] && (
          <p role="alert" id={`${name}-error`}>
            {errors[name].message}
          </p>
        )}
      </fieldset>
    );
  }
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async () => {
        if (!busy) await mutation.mutateAsync().catch(() => {});
      })}
      className="grid gap-6"
      aria-busy={busy}
    >
      <fieldset disabled={busy} className="grid min-w-0 gap-6">
        {!mockEnabled && (
          <ProfileImageField
            value={imageId}
            label={role === "CLIENT" ? "로고" : "프로필 이미지"}
            busy={busy}
            onSelect={(file) => upload.mutate(file)}
            onRemove={() => {
              form.setValue("imageFileId", "", { shouldDirty: true });
              upload.reset();
              setSaved(false);
            }}
          />
        )}
        {textField("name")}
        <p className="text-sm text-muted-foreground">
          표시 이름은 2~20자예요. 이메일과 배송지는 이 화면에 표시하지 않아요.
        </p>
        {role === "CLIENT" && (
          <div className="grid gap-6 border-t pt-6">
            <div>
              <h2 className="type-heading-sm">브랜드 정보</h2>
              <p className="text-muted-foreground">
                모두 선택이에요. 개인도 브랜드 정보 없이 의뢰할 수 있어요.
              </p>
            </div>
            {textField("brandName")}
            {textField("introduction", true)}
            {category("industry")}
            {textField("websiteUrl")}
            {textField("socialUrl")}
            <p className="text-sm text-muted-foreground">
              주소는 http:// 또는 https://로 시작해 주세요.
            </p>
          </div>
        )}
        {role === "CREATOR" && (
          <>
            {textField("introduction", true)}
            {category("niche")}
            {choices("contentStyles", CONTENT_STYLES)}
            {choices("productionRoles", PRODUCTION_ROLES)}
            {textField("workMethod", true)}
            {!mockEnabled && (
              <>
                {textField("career", true)}
                {textField("websiteUrl")}
                {textField("socialUrl")}
                <p className="text-sm text-muted-foreground">
                  제작 서비스를 공개하면 이미지·경력·링크도 제작자 페이지에
                  표시돼요. 링크는 http:// 또는 https://로 시작해 주세요.
                </p>
              </>
            )}
            <label
              htmlFor="profile-isAvailable"
              className="flex min-h-11 items-center gap-2"
            >
              <input
                id="profile-isAvailable"
                type="checkbox"
                className="accent-primary"
                {...form.register("isAvailable")}
              />
              {labels.isAvailable}
            </label>
            {textField("availableFrom")}
          </>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!form.formState.isDirty}>
            {busy ? "저장 중…" : "프로필 저장"}
          </Button>
          <Button
            asChild
            variant={form.formState.isDirty ? "outline" : "default"}
          >
            <Link to={next.to}>{next.label}</Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty}
            onClick={() => {
              form.reset(original);
              mutation.reset();
              upload.reset();
              setSaved(false);
            }}
          >
            변경 취소
          </Button>
        </div>
      </fieldset>
      {upload.isPending && (
        <p role="status">이미지를 업로드하고 확인하고 있어요.</p>
      )}
      {upload.error && <p role="alert">{upload.error.message}</p>}
      {saved && !form.formState.isDirty && (
        <p role="status">프로필을 저장했어요.</p>
      )}
      {form.formState.isDirty ? (
        <p className="text-sm text-muted-foreground">
          아직 저장하지 않은 변경이 있어요. 화면을 나가면 입력이 사라져요.
        </p>
      ) : (
        !saved && (
          <p className="text-sm text-muted-foreground">
            모든 항목은 선택이에요. 나중에 채워도 돼요.
          </p>
        )
      )}
      {mutation.error && (
        <div role="alert" className="grid gap-3">
          <p>{profileError(mutation.error)}</p>
          <p>
            입력은 유지했어요. 통신 오류라면 저장되었을 수 있어요. 최신 값을
            확인한 뒤 다시 저장해 주세요.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={reload}
          >
            최신 값 확인 (입력 대체)
          </Button>
        </div>
      )}
    </form>
  );
}
