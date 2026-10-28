import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { loginRequestSchema } from "@kemi/shared";
import { z } from "zod";
import Input from "../../components/ui/input";
import Label from "../../components/ui/label";
import Button from "../../components/ui/button";
import { session, useSession } from "../../app/session";
import { ApiError } from "../../shared/api/client";
import { authEnabled, mockEnabled } from "./config";
import { signupFormSchema } from "./contracts";
import safeReturnTo from "./redirect";
import GoogleButton from "./GoogleButton";

const loginFormSchema = loginRequestSchema.extend({
  passwordConfirm: z.string(),
  name: z.string(),
  role: z.enum(["CLIENT", "CREATOR"]),
});
type FormValues = z.input<typeof signupFormSchema>;
function errorMessage(error: unknown) {
  if (!(error instanceof ApiError))
    return "응답을 확인하지 못했어요. 다시 시도해 주세요.";
  if (error.code === "INVALID_CREDENTIALS")
    return "이메일 또는 비밀번호를 확인해 주세요.";
  if (error.code === "EMAIL_ALREADY_EXISTS") return "이미 가입된 이메일이에요.";
  if (error.status === 403)
    return "이용이 제한된 계정이거나 허용되지 않은 요청이에요.";
  if (error.status === 429) return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  if (error.code === "VALIDATION_FAILED") return "입력 내용을 확인해 주세요.";
  return error.message;
}

export default function AuthForm({ signup = false }: { signup?: boolean }) {
  const [params] = useSearchParams();
  const { role, status, notice } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<FormValues>({
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
      name: "",
      // 공고 지원 버튼처럼 역할을 정해 들어오면(?role=creator) 그 역할을 먼저 골라 둔다.
      role: params.get("role") === "creator" ? "CREATOR" : "CLIENT",
    },
    resolver: zodResolver(signup ? signupFormSchema : loginFormSchema),
  });
  const mutation = useMutation({
    // Keep credentials in the form, never in Query mutation variables/devtools.
    mutationFn: async () => {
      const values = form.getValues();
      if (signup) {
        const input = signupFormSchema.parse(values);
        await session.authenticate(
          {
            email: input.email,
            password: input.password,
            name: input.name,
            role: input.role,
          },
          true,
        );
      } else await session.authenticate(loginRequestSchema.parse(values));
    },
  });
  const blocked =
    !authEnabled ||
    ["checking", "logging-out", "logout-error"].includes(status);
  const busy = form.formState.isSubmitting || mutation.isPending;
  const { errors } = form.formState;
  const submitLabel = signup ? "가입하고 시작하기" : "이메일로 로그인";
  const passwordDescription = signup ? "password-hint" : undefined;
  if (status === "authenticated") {
    // 가입은 프로필 화면으로 보내되, 원래 가려던 곳(returnTo)을 넘겨 프로필 화면에서 이어 가게 한다.
    const returnTo = params.get("returnTo");
    const destination = signup
      ? `/me/profile${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`
      : safeReturnTo(returnTo, role);
    return <Navigate replace to={destination} />;
  }
  return (
    <section className="auth-panel showcase-card grid gap-6">
      <div className="grid gap-2">
        <p className="type-label-sm text-primary">KEMI ACCOUNT</p>
        <h1 className="type-heading-lg">{signup ? "회원가입" : "로그인"}</h1>
        <p className="text-muted-foreground">
          {signup
            ? "함께할 역할을 고르고 케미를 시작해요."
            : "다시 만나 반가워요. 함께 만드는 일을 이어가세요."}
        </p>
      </div>
      {mockEnabled && (
        <p className="rounded-lg bg-muted p-4 text-sm" role="status">
          개발용 Mock 인증 · 실제 계정이 생성되지 않아요. 예시 로그인:
          client@example.test 또는 creator@example.test / Kemi1234
        </p>
      )}
      {!authEnabled && (
        <p role="status">
          인증 API 설정이 필요해요. 현재 실제 계정 연결은 꺼져 있어요.
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <GoogleButton
        returnTo={params.get("returnTo")}
        disabled={
          busy || ["checking", "logging-out", "logout-error"].includes(status)
        }
      />
      {status === "checking" && <p role="status">세션을 확인하고 있어요.</p>}
      {status === "error" && (
        <Button variant="outline" onClick={() => session.bootstrap()}>
          세션 다시 확인
        </Button>
      )}
      <form
        noValidate
        onSubmit={form.handleSubmit(() =>
          mutation.mutateAsync().catch(() => {}),
        )}
        className="grid gap-5"
      >
        <fieldset disabled={busy || blocked} className="grid min-w-0 gap-5">
          {signup && (
            <>
              <fieldset className="grid gap-3">
                <legend className="mb-3 type-label-md">이용 역할 (필수)</legend>
                <div className="flex flex-wrap gap-6">
                  <label
                    htmlFor="role-client"
                    className="flex items-center gap-2"
                  >
                    <input
                      type="radio"
                      value="CLIENT"
                      id="role-client"
                      {...form.register("role")}
                    />
                    의뢰인
                  </label>
                  <label
                    htmlFor="role-creator"
                    className="flex items-center gap-2"
                  >
                    <input
                      type="radio"
                      value="CREATOR"
                      id="role-creator"
                      {...form.register("role")}
                    />
                    크리에이터
                  </label>
                </div>
              </fieldset>
              <div className="grid gap-2">
                <Label htmlFor="auth-name">표시 이름 (필수)</Label>
                <Input
                  id="auth-name"
                  autoComplete="nickname"
                  maxLength={20}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "name-error" : "name-hint"}
                  {...form.register("name")}
                />
                <p id="name-hint" className="text-sm text-muted-foreground">
                  2~20자, 같은 이름도 사용할 수 있어요.
                </p>
                {errors.name && (
                  <p id="name-error" role="alert">
                    표시 이름은 2~20자로 입력해 주세요.
                  </p>
                )}
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="auth-email">이메일 (필수)</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              maxLength={254}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...form.register("email")}
            />
            {errors.email && (
              <p id="email-error" role="alert">
                올바른 이메일을 입력해 주세요.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="auth-password">비밀번호 (필수)</Label>
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              maxLength={signup ? 64 : 1024}
              aria-invalid={!!errors.password}
              aria-describedby={
                errors.password ? "password-error" : passwordDescription
              }
              {...form.register("password")}
            />
            {signup && (
              <p id="password-hint" className="text-sm text-muted-foreground">
                8~64자, 영문과 숫자를 함께 입력해 주세요.
              </p>
            )}
            {errors.password && (
              <p id="password-error" role="alert">
                {signup ? errors.password.message : "비밀번호를 입력해 주세요."}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="justify-self-start"
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            </Button>
          </div>
          {signup && (
            <div className="grid gap-2">
              <Label htmlFor="auth-confirm">비밀번호 확인 (필수)</Label>
              <Input
                id="auth-confirm"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                maxLength={64}
                aria-invalid={!!errors.passwordConfirm}
                aria-describedby={
                  errors.passwordConfirm ? "confirm-error" : undefined
                }
                {...form.register("passwordConfirm")}
              />
              {errors.passwordConfirm && (
                <p id="confirm-error" role="alert">
                  {errors.passwordConfirm.message}
                </p>
              )}
            </div>
          )}
          <Button type="submit" className="w-full">
            {busy ? "처리 중…" : submitLabel}
          </Button>
        </fieldset>
        {mutation.error && (
          <p role="alert" className="text-destructive">
            {errorMessage(mutation.error)}
          </p>
        )}
      </form>
      <p className="text-sm text-muted-foreground">
        {signup ? "이미 계정이 있나요? " : "처음 오셨나요? "}
        <Link
          className="font-semibold text-primary underline underline-offset-4"
          to={`${signup ? "/login" : "/signup"}${params.get("returnTo") ? `?returnTo=${encodeURIComponent(params.get("returnTo") ?? "")}` : ""}`}
        >
          {signup ? "로그인" : "회원가입"}
        </Link>
      </p>
    </section>
  );
}
