import type { ReactNode } from "react";
import { Link } from "react-router";
import { useSession } from "../app/session";
import Button from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export default function AuthRequiredCta({
  className,
  children,
  returnTo,
  role,
  title = "로그인이 필요해요",
  description = "계속하려면 회원가입 또는 로그인이 필요해요.",
  browseTo,
}: {
  className?: string;
  children: ReactNode;
  returnTo: string;
  role?: "client" | "creator";
  title?: string;
  description?: string;
  /** 비회원에게 공개된 화면에서만 지정합니다. */
  browseTo?: string;
}) {
  const { status } = useSession();
  const loginQuery = new URLSearchParams({ returnTo });
  const signupQuery = new URLSearchParams(loginQuery);
  if (role) signupQuery.set("role", role);
  if (status === "authenticated")
    return (
      <Link className={className} to={returnTo}>
        {children}
      </Link>
    );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={className}
          disabled={["checking", "logging-out"].includes(status)}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Button asChild>
            <Link to={`/signup?${signupQuery}`}>회원가입</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/login?${loginQuery}`}>로그인</Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          가입 및 프로필 설정 또는 로그인 후 하던 일로 이어집니다.
        </p>
        {browseTo && (
          <Link className="text-center text-sm underline" to={browseTo}>
            로그인 없이 둘러보기
          </Link>
        )}
      </DialogContent>
    </Dialog>
  );
}
