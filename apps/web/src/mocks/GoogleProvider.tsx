import { useState } from "react";
import { useNavigate, Link } from "react-router";
import Button from "../components/ui/button";
import { mockEnabled } from "../features/auth/config";
import { api } from "../shared/api/client";

export default function GoogleProvider() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!mockEnabled) return <p>개발용 Google Mock이 꺼져 있어요.</p>;
  return (
    <main className="auth-panel showcase-card m-auto grid gap-5">
      <h1 className="type-heading-lg">Google 제공자 Mock</h1>
      <p>
        실제 Google 화면이 아니에요. 결과를 선택해 UI 흐름을 확인해요. 신규
        예시는 기존 이메일 회원과 같은 이메일을 사용해도 별도 계정이에요.
      </p>
      {(
        [
          ["existing", "기존 Google 회원"],
          ["new", "새 Google 회원"],
          ["cancel", "동의 취소"],
          ["failure", "인증 실패"],
          ["unavailable", "설정 없음"],
          ["rate", "요청 제한"],
          ["restricted", "이용 제한"],
        ] as const
      ).map(([outcome, label]) => (
        <Button
          variant="outline"
          key={outcome}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              const response = await api.post<string>(
                "/__mock__/google/finish",
                outcome,
              );
              navigate(`/auth/social/callback?${response.data}`, {
                replace: true,
              });
            } catch {
              setError(true);
              setBusy(false);
            }
          }}
        >
          {label}
        </Button>
      ))}
      {error && <p role="alert">Mock 응답을 확인하지 못했어요.</p>}
      <Link to="/login">로그인 화면으로</Link>
    </main>
  );
}
