import { useState } from "react";
import { useNavigate } from "react-router";
import Button from "../../components/ui/button";
import { authEnabled, mockEnabled } from "./config";
import { rememberGoogleReturn } from "./google";

export default function GoogleButton({
  returnTo = null,
  disabled = false,
  preserveReturn = false,
}: {
  returnTo?: string | null;
  disabled?: boolean;
  preserveReturn?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      disabled={!authEnabled || disabled || busy}
      onClick={() => {
        setBusy(true);
        if (!preserveReturn) rememberGoogleReturn(returnTo);
        if (mockEnabled) navigate("/__mock__/google");
        else
          window.location.assign(
            new URL(
              "/api/auth/google/start",
              new URL(
                import.meta.env.VITE_API_BASE_URL || "/",
                window.location.origin,
              ),
            ).href,
          );
      }}
    >
      {busy ? "Google로 이동 중…" : "Google로 계속하기"}
    </Button>
  );
}
