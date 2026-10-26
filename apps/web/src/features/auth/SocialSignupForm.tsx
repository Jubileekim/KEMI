import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  socialSignupRequestSchema,
  type SocialSignupRequest,
  type SocialSignupPendingResponse,
} from "@kemi/shared";
import { useMutation } from "@tanstack/react-query";
import { session } from "../../app/session";
import { ApiError } from "../../shared/api/client";
import Button from "../../components/ui/button";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";

export default function SocialSignupForm({
  pending,
  onComplete,
  onBusyChange,
}: {
  pending: SocialSignupPendingResponse;
  onComplete: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const form = useForm<SocialSignupRequest>({
    resolver: zodResolver(socialSignupRequestSchema),
    defaultValues: { name: pending.suggestedName ?? "", role: undefined },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      onBusyChange(true);
      try {
        await session.completeGoogleSignup(
          socialSignupRequestSchema.parse(form.getValues()),
        );
        if (mounted.current) onComplete();
      } finally {
        if (mounted.current) onBusyChange(false);
      }
    },
  });
  const restart =
    mutation.error instanceof ApiError &&
    [401, 409].includes(mutation.error.status);
  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={form.handleSubmit(() => mutation.mutateAsync().catch(() => {}))}
    >
      <p>
        처음 오셨네요. 역할과 표시 이름을 확인해 주세요. 가입 완료 전에는 계정이
        만들어지지 않아요.
      </p>
      <p className="text-sm text-muted-foreground">
        Google 계정: {pending.providerEmail ?? "이메일 정보 없음"} · 표시용
        정보이며 기존 이메일 계정과 자동으로 합치지 않아요.
      </p>
      <fieldset
        className="grid min-w-0 gap-5"
        disabled={form.formState.isSubmitting || mutation.isPending || restart}
      >
        <fieldset
          aria-describedby={
            form.formState.errors.role ? "social-role-error" : undefined
          }
        >
          <legend className="mb-2 font-semibold">함께할 역할 (필수)</legend>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["CLIENT", "의뢰인"],
                ["CREATOR", "크리에이터"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                htmlFor={`social-role-${value}`}
                className="flex items-center gap-2"
              >
                <input
                  id={`social-role-${value}`}
                  type="radio"
                  value={value}
                  {...form.register("role")}
                />
                {label}
              </label>
            ))}
          </div>
          {form.formState.errors.role && (
            <p id="social-role-error" role="alert">
              역할을 선택해 주세요.
            </p>
          )}
        </fieldset>
        <div className="grid gap-2">
          <Label htmlFor="social-name">표시 이름 (필수)</Label>
          <Input
            id="social-name"
            autoComplete="nickname"
            {...form.register("name")}
            aria-invalid={!!form.formState.errors.name}
            aria-describedby={
              form.formState.errors.name ? "social-name-error" : undefined
            }
          />
          {form.formState.errors.name && (
            <p id="social-name-error" role="alert">
              이름은 2~20자로 입력해 주세요.
            </p>
          )}
        </div>
        <Button type="submit">
          {mutation.isPending ? "가입 중…" : "Google 계정으로 가입 완료"}
        </Button>
      </fieldset>
      {mutation.error && (
        <p role="alert">
          {mutation.error instanceof ApiError &&
            mutation.error.status === 429 &&
            "요청이 많아요. 잠시 후 Google 로그인을 다시 시작해 주세요."}
          {!(
            mutation.error instanceof ApiError && mutation.error.status === 429
          ) &&
            (restart
              ? "가입 정보가 만료되었거나 이미 처리되었어요. Google 로그인을 다시 시작해 주세요."
              : "가입 결과를 확인하지 못했어요. 입력을 확인하거나 Google 로그인을 다시 시작해 주세요.")}
        </p>
      )}
    </form>
  );
}
