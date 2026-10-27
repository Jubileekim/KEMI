import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { session } from "../../app/session";
import { api } from "../../shared/api/client";
import { authEnabled, mockEnabled } from "./config";
import { googleErrors, googleReturn, readGoogleCallback } from "./google";
import GoogleButton from "./GoogleButton";
import SocialSignupForm from "./SocialSignupForm";

const pendingSchema = z.object({
  provider: z.literal("google"),
  suggestedName: z.string().nullable(),
  providerEmail: z.email().nullable(),
});

function CallbackResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const [result] = useState(() => readGoogleCallback(location.search));
  const [error, setError] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupInfo, setSignupInfo] = useState<z.infer<
    typeof pendingSchema
  > | null>(null);
  const flight = useRef<Promise<void> | null>(null);
  const pending = useQuery({
    queryKey: ["google-signup-pending"],
    enabled: authEnabled && result === "signup",
    retry: false,
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) => {
      const response = await api.get<unknown>("/api/auth/social/signup", {
        withCredentials: true,
        signal,
      });
      return pendingSchema.parse(response.data);
    },
  });
  // Retain the confirmed input across the session controller's private-cache
  // clear. Adjust only for a new response, so submission never remounts the form.
  if (pending.data && signupInfo !== pending.data) setSignupInfo(pending.data);
  useEffect(() => {
    if (!authEnabled || result !== "login") return undefined;
    let active = true;
    flight.current ??= session.completeGoogleLogin();
    flight.current.then(() => {
      if (!active) return;
      const state = session.snapshot();
      if (state.status === "authenticated")
        navigate(googleReturn(state.role), { replace: true });
      else
        setError(
          "로그인 세션을 확인하지 못했어요. Google 로그인을 다시 시작해 주세요.",
        );
    });
    return () => {
      active = false;
    };
  }, [navigate, result]);
  const message = googleErrors[result] ?? error;
  return (
    <section className="auth-panel showcase-card grid gap-6">
      <div className="grid gap-2">
        <p className="type-label-sm text-primary">KEMI ACCOUNT</p>
        <h1 className="type-heading-lg">Google 로그인 확인</h1>
      </div>
      {mockEnabled && (
        <p role="status" className="rounded-lg bg-muted p-4 text-sm">
          개발용 Google Mock · 실제 Google 인증이나 계정 생성이 아니에요.
        </p>
      )}
      {!authEnabled ? (
        <p role="status">Google 인증 API 설정이 필요해요.</p>
      ) : (
        <>
          {message && <p role="alert">{message}</p>}
          {result === "login" && !error && (
            <p role="status">로그인 세션을 확인하고 있어요.</p>
          )}
          {result === "signup" && !signupInfo && pending.isPending && (
            <p role="status">가입 정보를 확인하고 있어요.</p>
          )}
          {result === "signup" && !signupInfo && pending.isError && (
            <p role="alert">
              가입 정보가 만료되었거나 확인되지 않아요. Google 로그인을 다시
              시작해 주세요.
            </p>
          )}
          {result === "signup" && signupInfo && (
            <SocialSignupForm
              onBusyChange={setSignupBusy}
              pending={signupInfo}
              onComplete={() => {
                googleReturn(session.snapshot().role);
                navigate("/me/profile", { replace: true });
              }}
            />
          )}
        </>
      )}
      <GoogleButton
        preserveReturn
        disabled={signupBusy || (result === "login" && !error && authEnabled)}
      />
      <Link
        className="text-primary underline underline-offset-4"
        to="/login"
        aria-disabled={signupBusy}
        onClick={(event) => {
          if (signupBusy) event.preventDefault();
        }}
        replace
      >
        로그인 화면으로
      </Link>
    </section>
  );
}

export default function GoogleCallback() {
  const location = useLocation();
  return <CallbackResult key={location.search} />;
}
